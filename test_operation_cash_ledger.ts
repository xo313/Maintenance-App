import fs from 'fs';
import path from 'path';
import { runAutomaticMigration } from './electron/db/migration.js';
import { closeDB, openDatabase } from './electron/db/connection.js';
import { addOperation, editOperation, deleteOperation, payDebt, getOperationById } from './electron/db/repositories/operationsRepo.js';
import { addTechnician, getAllTechnicians } from './electron/db/repositories/techniciansRepo.js';
import { addCustomer } from './electron/db/repositories/customersRepo.js';
import { getCurrentMonth } from './electron/db/repositories/monthsRepo.js';
import { getDashboardStats } from './electron/db/repositories/statsRepo.js';

const testDir = path.join(process.cwd(), 'test_operation_cash_ledger_runtime');
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir, { recursive: true });

process.env.TEST_USER_DATA = testDir;
process.env.ISOLATED_TEST_APPDATA = testDir;
closeDB();

function cashForOperation(db: any, operationId: number): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM cash_transactions
    WHERE type = 'CUSTOMER_PAYMENT' AND reference_id = ?
  `).get(operationId) as { total: number };
  return Number(row?.total) || 0;
}

function assertClose(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function run() {
  const results: Record<string, string> = {};

  try {
    // 1. Fresh DB
    if (!runAutomaticMigration()) throw new Error('Migration failed');
    const db = openDatabase();
    results['Fresh DB'] = 'PASS';

    // 2. Schema V2
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all() as { name: string }[];
    const tableNames = new Set(tables.map(t => t.name));
    const requiredTables = ['operations', 'payments', 'cash_transactions', 'technicians', 'customers', 'months', 'settings', 'shop_expenses', 'suppliers'];
    for (const req of requiredTables) {
      if (!tableNames.has(req)) throw new Error(`Missing Schema V2 table: ${req}`);
    }
    results['Schema V2'] = 'PASS';

    // 3. Test technician and customer creation
    const currentMonth = getCurrentMonth();
    if (!currentMonth || !currentMonth.id) throw new Error('Failed to get or initialize test month');

    let tech = getAllTechnicians().find(t => t.is_active);
    if (!tech) {
      const techRes = addTechnician('فني فحص الصندوق', 0.5);
      if (!techRes.success || !techRes.data) throw new Error(`Failed to create test technician: ${techRes.reason}`);
      tech = techRes.data;
    }
    if (!tech || !tech.id) throw new Error('Technician initialization failed');

    const custRes = addCustomer({ name: 'عميل فحص الصندوق', phone: '0501234567' });
    if (!custRes.success || !custRes.data) throw new Error(`Failed to create test customer: ${custRes.reason}`);
    const customer = custRes.data;
    results['Test technician creation'] = 'PASS';

    // 4. Operation creation
    const op1Res = addOperation({
      month_id: currentMonth.id,
      technician_id: tech.id,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      device: 'هاتف اختبار',
      cost: 40,
      price: 100,
      payment_status: 'cash',
      status: 'delivered'
    });
    if (!op1Res.success || !op1Res.data) throw new Error(`Add operation failed: ${op1Res.reason}`);
    const op1Id = op1Res.data.id;
    results['Operation creation'] = 'PASS';

    // 5. Cash ledger entry
    assertClose(cashForOperation(db, op1Id), 100, 'Op1 cash ledger entry');
    let stats = getDashboardStats();
    assertClose(stats.cashBox, 100, 'Cash box after 100 cash op');
    assertClose(stats.netShopProfit, 30, 'Net shop profit for (100-40)*0.5');
    results['Cash ledger entry'] = 'PASS';

    // 6. Operation edit reconciliation
    // Increase price in cash
    const incRes = editOperation(op1Id, { price: 150, payment_status: 'cash' });
    if (!incRes.success) throw new Error(`Increase edit failed: ${incRes.reason}`);
    assertClose(cashForOperation(db, op1Id), 150, 'Cash after price increase to 150');

    // Decrease price in cash
    const decRes = editOperation(op1Id, { price: 80, payment_status: 'cash' });
    if (!decRes.success) throw new Error(`Decrease edit failed: ${decRes.reason}`);
    assertClose(cashForOperation(db, op1Id), 80, 'Cash after price decrease to 80');

    // Convert to debt
    const debtRes = editOperation(op1Id, { payment_status: 'debt' });
    if (!debtRes.success) throw new Error(`Debt edit failed: ${debtRes.reason}`);
    assertClose(cashForOperation(db, op1Id), 0, 'Cash after conversion to debt');
    stats = getDashboardStats();
    assertClose(stats.cashBox, 0, 'Cash box after op becomes debt');
    assertClose(stats.debtTotal, 80, 'Customer debt total after debt conversion');
    results['Operation edit reconciliation'] = 'PASS';

    // 7. Payment reconciliation
    // Partial payment of 30
    const partialRes = editOperation(op1Id, { payment_status: 'partial', paid_amount: 30 });
    if (!partialRes.success) throw new Error(`Partial edit failed: ${partialRes.reason}`);
    assertClose(cashForOperation(db, op1Id), 30, 'Cash after partial payment of 30');
    stats = getDashboardStats();
    assertClose(stats.cashBox, 30, 'Cash box after 30 partial payment');
    assertClose(stats.debtTotal, 50, 'Customer debt after 30 paid on 80');

    // Pay remaining debt via payDebt
    const payRes = payDebt(op1Id);
    if (!payRes.success) throw new Error(`Pay debt failed: ${payRes.reason}`);
    assertClose(cashForOperation(db, op1Id), 80, 'Cash after full debt payment');
    stats = getDashboardStats();
    assertClose(stats.cashBox, 80, 'Cash box after full payment');
    assertClose(stats.debtTotal, 0, 'Customer debt after full payment');
    assertClose(stats.netShopProfit, 20, 'Net shop profit on 80 price, 40 cost, 50% tech share');
    results['Payment reconciliation'] = 'PASS';

    // 8. Operation deletion reconciliation
    const delRes = deleteOperation(op1Id);
    if (!delRes.success) throw new Error(`Delete failed: ${delRes.reason}`);
    if (getOperationById(op1Id)) throw new Error('Operation still exists after delete');
    assertClose(cashForOperation(db, op1Id), 0, 'Cash transactions cleared after delete');
    stats = getDashboardStats();
    assertClose(stats.cashBox, 0, 'Cash box back to 0 after deleting operation');
    results['Operation deletion reconciliation'] = 'PASS';

    // 9. Double counting check
    // Create operation with partial payment, edit multiple times, verify cumulative ledger consistency
    const op2Res = addOperation({
      month_id: currentMonth.id,
      technician_id: tech.id,
      customer_id: customer.id,
      device: 'جهاز مزدوج',
      cost: 50,
      price: 200,
      payment_status: 'partial',
      paid_amount: 50,
      status: 'delivered'
    });
    if (!op2Res.success || !op2Res.data) throw new Error('Failed to create op2');
    const op2Id = op2Res.data.id;

    assertClose(cashForOperation(db, op2Id), 50, 'Initial partial ledger 50');

    // Edit paid amount from 50 to 120
    editOperation(op2Id, { payment_status: 'partial', paid_amount: 120 });
    assertClose(cashForOperation(db, op2Id), 120, 'Ledger after increasing paid amount to 120');

    // Pay full debt (remaining 80)
    payDebt(op2Id);
    assertClose(cashForOperation(db, op2Id), 200, 'Ledger after full debt pay 200');

    // Verify payments table sum matches cash_transactions sum
    const paySum = (db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM payments WHERE operation_id = ?').get(op2Id) as { s: number }).s;
    assertClose(paySum, 200, 'Payments table sum matches total 200');
    assertClose(cashForOperation(db, op2Id), 200, 'Cash transactions sum matches total 200');

    // Clean up op2
    deleteOperation(op2Id);
    assertClose(cashForOperation(db, op2Id), 0, 'Cleaned up op2');
    results['Double counting check'] = 'PASS';

    // 10. Final cash balance & Final profit
    // Op A: Cash 100, Cost 40, Delivered -> Net Shop Profit = 30, Cash = 100
    const opARes = addOperation({
      month_id: currentMonth.id,
      technician_id: tech.id,
      customer_id: customer.id,
      device: 'جهاز A',
      cost: 40,
      price: 100,
      payment_status: 'cash',
      status: 'delivered'
    });
    if (!opARes.success) throw new Error('Op A failed');

    // Op B: Debt 200, Cost 50, Delivered -> Net Shop Profit = 75, Cash = 0, Debt = 200
    const opBRes = addOperation({
      month_id: currentMonth.id,
      technician_id: tech.id,
      customer_id: customer.id,
      device: 'جهاز B',
      cost: 50,
      price: 200,
      payment_status: 'debt',
      status: 'delivered'
    });
    if (!opBRes.success || !opBRes.data) throw new Error('Op B failed');

    // Stats before debt payment:
    // Cash = 100
    // Net Shop Profit = 30 + 75 = 105
    // Debt = 200
    stats = getDashboardStats();
    assertClose(stats.cashBox, 100, 'Pre-debt pay Cash');
    assertClose(stats.netShopProfit, 105, 'Pre-debt pay Profit');
    assertClose(stats.debtTotal, 200, 'Pre-debt pay Debt');

    // Now pay the debt of Op B
    payDebt(opBRes.data.id);

    // Stats after debt payment:
    // Cash = 100 + 200 = 300
    // Net Shop Profit should remain 105 (paying debt is cash collection, not extra profit!)
    // Debt = 0
    stats = getDashboardStats();
    assertClose(stats.cashBox, 300, 'Final cash balance after debt collection');
    assertClose(stats.debtTotal, 0, 'Final debt total');
    assertClose(stats.netShopProfit, 105, 'Final net shop profit (not duplicated)');
    assertClose(stats.totalSales, 300, 'Final total sales');

    results['Final cash balance'] = 'PASS';
    results['Final profit'] = 'PASS';

    // Print standardized summary
    console.log('\n# CASH LEDGER INTEGRATION TEST\n');
    console.log(`Fresh DB: ${results['Fresh DB']}`);
    console.log(`Schema V2: ${results['Schema V2']}`);
    console.log(`Test technician creation: ${results['Test technician creation']}`);
    console.log(`Operation creation: ${results['Operation creation']}`);
    console.log(`Cash ledger entry: ${results['Cash ledger entry']}`);
    console.log(`Operation edit reconciliation: ${results['Operation edit reconciliation']}`);
    console.log(`Payment reconciliation: ${results['Payment reconciliation']}`);
    console.log(`Operation deletion reconciliation: ${results['Operation deletion reconciliation']}`);
    console.log(`Double counting check: ${results['Double counting check']}`);
    console.log(`Final cash balance: ${results['Final cash balance']}`);
    console.log(`Final profit: ${results['Final profit']}`);
    console.log('\nRESULT: PASS\n');

  } finally {
    closeDB();
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('CASH LEDGER INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
