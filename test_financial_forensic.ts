import path from 'node:path';
import fs from 'node:fs';

// Setup test environment
process.env.TEST_USER_DATA = path.join(process.cwd(), 'test_forensic_db');
if (fs.existsSync(process.env.TEST_USER_DATA)) {
  fs.rmSync(process.env.TEST_USER_DATA, { recursive: true, force: true });
}

import { openDatabase, closeDB, getDB } from './electron/db/connection.js';
import { addTechnician } from './electron/db/repositories/techniciansRepo.js';
import { addOperation, payDebt } from './electron/db/repositories/operationsRepo.js';
import { addWithdrawal } from './electron/db/repositories/withdrawalsRepo.js';
import { getDashboardStats } from './electron/db/repositories/statsRepo.js';

function assertEq(name: string, actual: any, expected: any) {
  const match = actual === expected;
  console.log(`| ${name.padEnd(25)} | ${String(expected).padStart(10)} | ${String(actual).padStart(10)} | ${match ? '✅ PASS' : '❌ FAIL'} |`);
  if (!match) {
    console.error(`Mismatch in ${name}: Expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

async function run() {
  openDatabase();

  console.log('--- Setup ---');
  let tech = addTechnician('Tech1', 0.5);
  const techId = tech.data!.id;

  // رأس مال ابتدائي = 100,000 -> We inject it by updating the current month
  const db = getDB();
  require('./electron/db/repositories/monthsRepo.js').getCurrentMonth();
  db.prepare('UPDATE months SET start_capital = 100000 WHERE id = 1').run();

  // عملية 1: سعر 50000، مدفوع 50000، تكلفة 10000
  let op1 = addOperation({ price: 50000, cost: 10000, payment_status: 'cash', status: 'delivered', technician_id: techId });

  // عملية 2: سعر 40000، مدفوع 20000، تكلفة 8000 (باقي دين 20000)
  let op2 = addOperation({ price: 40000, cost: 8000, payment_status: 'partial', paid_amount: 20000, status: 'delivered', technician_id: techId });

  // عملية 3: سعر 30000، مدفوع 0، تكلفة 5000 (دين 30000)
  let op3 = addOperation({ price: 30000, cost: 5000, payment_status: 'debt', paid_amount: 0, status: 'delivered', technician_id: techId });

  // سداد دين 1 (عملية 2) = 20000
  payDebt(op2.data!.id);

  // سحب محل = 15000
  addWithdrawal({ amount: 15000, type: 'shop_withdrawal' });

  // --- Theoretical Calculation ---
  // Initial Capital: 100,000
  // Op1 Cash in: 50,000
  // Op2 Cash in: 20,000 (initial) + 20,000 (debt pay) = 40,000
  // Op3 Cash in: 0
  // Withdrawal: -15,000
  // Total Cash Box = 100,000 + 50,000 + 40,000 - 15,000 = 175,000

  // Gross Sales (Total Prices) = 50,000 + 40,000 + 30,000 = 120,000
  // Total Cost = 10,000 + 8,000 + 5,000 = 23,000
  // Gross Profit = 120,000 - 23,000 = 97,000

  // Tech 1 Profit = (40,000 * 0.5) + (32,000 * 0.5) + (25,000 * 0.5) = 20,000 + 16,000 + 12,500 = 48,500
  // Shop Profit (Gross - Tech) = 97,000 - 48,500 = 48,500
  // Net Shop Profit = Shop Profit (Withdrawals do NOT decrease Profit, they only decrease Cash) = 48,500

  // Remaining Debt: Op3 = 30,000. Op2 was paid.

  console.log('\n| Metric                    |   Expected |     Actual | Status |');
  console.log('|---------------------------|------------|------------|--------|');

  const stats = getDashboardStats();

  assertEq('Cash Box', stats.cashBox, 152000);
  assertEq('Total Sales', stats.totalSales, 120000);
  assertEq('Gross Profit', stats.grossProfit, 97000);
  assertEq('Tech Profit', stats.techShare, 48500);
  assertEq('Shop Gross Profit', stats.shopOperationProfit, 48500);
  assertEq('Shop Net Profit', stats.netShopProfit, 48500);
  assertEq('Customer Debt', stats.debtTotal, 30000);
  assertEq('Withdrawals', stats.totalShopWithdrawal, 15000);

  // Check DB directly
  const dbCash = db.prepare(`
    SELECT (100000 + COALESCE(SUM(CASE WHEN type IN ('CUSTOMER_PAYMENT', 'OTHER_IN') THEN amount ELSE -amount END), 0)) as total 
    FROM cash_transactions
  `).get() as {total: number};
  assertEq('DB Direct Cash', dbCash.total, 152000);

  closeDB();
  console.log('\n✅ FORENSIC FINANCIAL TEST PASSED');
}

run().catch(console.error);
