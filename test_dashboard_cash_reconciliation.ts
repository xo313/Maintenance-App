import path from 'node:path';
import fs from 'node:fs';

// Override paths to use a fresh isolated test DB
const testDir = path.join(process.cwd(), 'test_dashboard_recon_db');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

process.env.TEST_USER_DATA = testDir;
// NOT enabling FINANCIAL_RECONCILIATION_MODE here to test standard behavior
// where month closing rolls over cash properly.

import { openDatabase, getDB } from './electron/db/connection.js';
import { getDashboardStats } from './electron/db/repositories/statsRepo.js';
import { addOperation, editOperation } from './electron/db/repositories/operationsRepo.js';
import { closeMonth, getCurrentMonth } from './electron/db/repositories/monthsRepo.js';
import { addTechnician } from './electron/db/repositories/techniciansRepo.js';

function runDashboardReconciliation() {
  openDatabase();
  console.log('\x1b[36mStarting Dashboard Cash Reconciliation Test...\x1b[0m\n');

  const tech = addTechnician('Test Tech', 0.5);
  const techId = tech.data!.id;

  // Month 1
  addOperation({ price: 1000, cost: 200, paid_amount: 1000, payment_status: 'cash', status: 'delivered', technician_id: techId });
  addOperation({ price: 500, cost: 100, paid_amount: 0, payment_status: 'debt', status: 'delivered', technician_id: techId });
  
  // Dashboard Cash = 1000 - 200 - 100 = 700.
  let stats = getDashboardStats();
  if (Math.abs(stats.cashBox - 700) > 0.001) {
    console.error(`[FAIL] Month 1 Cash expected 700, got ${stats.cashBox}`);
    process.exit(1);
  }
  console.log('[PASS] Month 1 Cash is 700');

  // Close Month 1
  const oldMonthId = getCurrentMonth().id;
  const closed = closeMonth(stats.cashBox);
  if (!closed.success) {
    console.error('[FAIL] Could not close month 1');
    process.exit(1);
  }
  
  // Month 2
  // Opening balance should be 700.
  const newMonthId = getCurrentMonth().id;
  if (oldMonthId === newMonthId) {
    console.error('[FAIL] Month did not change');
    process.exit(1);
  }

  stats = getDashboardStats();
  if (Math.abs(stats.cashBox - 700) > 0.001) {
    console.error(`[FAIL] Month 2 Opening Cash expected 700, got ${stats.cashBox}`);
    process.exit(1);
  }
  console.log('[PASS] Month 2 Opening Cash matches Month 1 Closing Cash (700)');

  // Month 2 Ops
  addOperation({ price: 300, cost: 50, paid_amount: 300, payment_status: 'cash', status: 'delivered', technician_id: techId });
  // Cash should be 700 + 300 - 50 = 950
  
  stats = getDashboardStats();
  if (Math.abs(stats.cashBox - 950) > 0.001) {
    console.error(`[FAIL] Month 2 Cash expected 950, got ${stats.cashBox}`);
    process.exit(1);
  }
  console.log('[PASS] Month 2 Cash is 950');

  // Check the Ledger directly
  const db = getDB();
  const ledgerMonth2 = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type IN ('CUSTOMER_PAYMENT', 'OTHER_IN', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as cash
    FROM cash_transactions
    WHERE month_id = ?
  `).get(newMonthId) as { cash: number };

  if (Math.abs(stats.cashBox - (stats.baseCapital + ledgerMonth2.cash)) > 0.001) {
    console.error(`[FAIL] Dashboard Cash (${stats.cashBox}) does NOT match Base Capital + Ledger Month 2 (${stats.baseCapital} + ${ledgerMonth2.cash})`);
    process.exit(1);
  }
  console.log('[PASS] Dashboard Cash perfectly equals (Base Capital + Month Ledger)');
  
  console.log('\n\x1b[32mALL DASHBOARD RECONCILIATION TESTS PASSED!\x1b[0m\n');
}

runDashboardReconciliation();
