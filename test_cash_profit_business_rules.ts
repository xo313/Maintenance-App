import path from 'node:path';
import fs from 'node:fs';

// Override paths to use a fresh isolated test DB
const testDir = path.join(process.cwd(), 'test_financial_rules_db');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

process.env.TEST_USER_DATA = testDir;

import { openDatabase, getDB } from './electron/db/connection.js';
import { getDashboardStats } from './electron/db/repositories/statsRepo.js';
import { addOperation, editOperation, deleteOperation, payDebt } from './electron/db/repositories/operationsRepo.js';
import { addWithdrawal, deleteWithdrawal } from './electron/db/repositories/withdrawalsRepo.js';
import { closeMonth } from './electron/db/repositories/monthsRepo.js';
import { addTechnician } from './electron/db/repositories/techniciansRepo.js';
import { createSQLiteBackup, restoreSQLiteBackup } from './electron/db/backup.js';

let stepCount = 1;

function assertEqual(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.001) {
    console.error(`\x1b[31m[FAIL] Step ${stepCount}: ${label}. Expected ${expected}, got ${actual}\x1b[0m`);
    process.exit(1);
  }
  console.log(`\x1b[32m[PASS] Step ${stepCount}: ${label} = ${actual}\x1b[0m`);
}

function verify(expectedCash: number, expectedProfit: number, expectedDebt: number, stepName: string) {
  console.log(`\n--- Step ${stepCount}: ${stepName} ---`);
  const stats = getDashboardStats();
  
  // Verify statsRepo Cash matches expected
  assertEqual(stats.cashBox, expectedCash, 'Dashboard Cash');
  assertEqual(stats.realizedShopProfit + stats.totalTechProfit, expectedProfit, 'Total Realized Profit');
  assertEqual(stats.debtTotal, expectedDebt, 'Total Debt');

  // Verify Ledger explicitly matches expected cash
  const db = getDB();
  const ledgerCash = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type IN ('CUSTOMER_PAYMENT', 'OTHER_IN', 'OPENING_BALANCE') THEN amount ELSE -amount END), 0) as cash
    FROM cash_transactions
  `).get() as { cash: number };
  
  assertEqual(ledgerCash.cash, expectedCash, 'Cash Ledger Total');
  stepCount++;
}

async function runTests() {
  openDatabase();
  console.log('\x1b[36mStarting Financial Business Rules Test...\x1b[0m\n');

  const tech = addTechnician('Test Tech', 0.5);
  const techId = tech.data!.id;

  verify(0, 0, 0, 'Initial State (Fresh DB)');

  // 1. Operation 1
  // Sale = 100, Cost = 60, Not Delivered, Paid = 0
  const op1 = addOperation({ price: 100, cost: 60, paid_amount: 0, status: 'under_maintenance', payment_status: 'debt', technician_id: techId });
  verify(-60, 0, 0, 'Add Op1 (Cost 60, Paid 0, Not Delivered)');

  // 2. Operation 2
  // Sale = 200, Cost = 80, Not Delivered, Paid = 0
  const op2 = addOperation({ price: 200, cost: 80, paid_amount: 0, status: 'under_maintenance', payment_status: 'debt', technician_id: techId });
  verify(-140, 0, 0, 'Add Op2 (Cost 80, Paid 0, Not Delivered)');

  // 3. Deliver Operation 1 + Customer Payment
  editOperation(op1.data!.id, { status: 'delivered', payment_status: 'cash' });
  // Profit: 100 - 60 = 40. Cash: -140 + 100 = -40
  verify(-40, 40, 0, 'Deliver Op1 & Full Payment (100)');

  // 4. Deliver Operation 2 without payment (Debt)
  editOperation(op2.data!.id, { status: 'delivered' });
  // Profit: 40 + (200 - 80) = 160. Debt: 200. Cash: -40
  verify(-40, 160, 200, 'Deliver Op2 (No Payment - Debt)');

  // 5. Withdrawal 20
  const with1 = addWithdrawal({ amount: 20, type: 'shop_withdrawal' });
  verify(-60, 160, 200, 'Shop Withdrawal 20');

  // 6. Pay Debt Operation 2 fully
  payDebt(op2.data!.id);
  // Cash: -60 + 200 = 140. Profit: unchanged (160). Debt: 0
  verify(140, 160, 0, 'Pay Op2 Debt (200)');

  // 7. Prepaid Operation
  // Sale = 300, Cost = 100, Not Delivered, Paid = 300
  const op3 = addOperation({ price: 300, cost: 100, paid_amount: 300, payment_status: 'cash', status: 'under_maintenance', technician_id: techId });
  // Cash: 140 - 100(cost) + 300(paid) = 340. Profit: unchanged.
  verify(340, 160, 0, 'Add Op3 (Cost 100, Prepaid 300, Not Delivered)');

  // 8. Deliver Prepaid Operation
  editOperation(op3.data!.id, { status: 'delivered' });
  // Cash: unchanged (340). Profit: 160 + 200 = 360
  verify(340, 360, 0, 'Deliver Op3 (Prepaid)');

  // 9. Edit operation cost
  // Change Op3 cost from 100 to 150
  editOperation(op3.data!.id, { cost: 150 });
  // Cash: 340 - 50 = 290. Profit: 360 - 50 = 310
  verify(290, 310, 0, 'Edit Op3 Cost (+50)');

  // 10. Edit operation price (decrease paid amount)
  // Change Op3 to partial payment 200 (was 300) -> customer now owes 100
  editOperation(op3.data!.id, { payment_status: 'partial', paid_amount: 200 });
  // Cash: 290 - 100 = 190. Profit: unchanged. Debt: 100
  verify(190, 310, 100, 'Edit Op3 Payment (-100)');

  // 11. Delete operation
  deleteOperation(op1.data!.id);
  // Op1 was: Price 100, Cost 60, Delivered, Paid 100.
  // Reverting: Cash: 190 - 100(payment) + 60(cost) = 150. 
  // Profit: 310 - 40 = 270.
  verify(150, 270, 100, 'Delete Op1');

  // 12. Delete Withdrawal
  deleteWithdrawal(with1.data!.id);
  // Cash: 150 + 20 = 170.
  verify(170, 270, 100, 'Delete Withdrawal');

  console.log('\n\x1b[32mALL BUSINESS RULES VERIFIED SUCCESSFULLY!\x1b[0m\n');
}

runTests();
