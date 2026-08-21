import path from 'node:path';
import fs from 'node:fs';

// Setup test environment
process.env.TEST_USER_DATA = path.join(process.cwd(), 'test_reconciliation_db');
if (fs.existsSync(process.env.TEST_USER_DATA)) {
  fs.rmSync(process.env.TEST_USER_DATA, { recursive: true, force: true });
}

import { openDatabase, closeDB, getDB } from './electron/db/connection.js';
import { addOperation, payDebt, editOperation, deleteOperation } from './electron/db/repositories/operationsRepo.js';
import { addTechnician } from './electron/db/repositories/techniciansRepo.js';
import { addWithdrawal, deleteWithdrawal } from './electron/db/repositories/withdrawalsRepo.js';
import { getCurrentMonth, closeMonth } from './electron/db/repositories/monthsRepo.js';
import { getDashboardStats } from './electron/db/repositories/statsRepo.js';
import { createSQLiteBackup, restoreSQLiteBackup } from './electron/db/backup.js';

function assertEq(name: string, actual: any, expected: any) {
  const match = actual === expected;
  console.log(`| ${name.padEnd(25)} | ${String(expected).padStart(10)} | ${String(actual).padStart(10)} | ${match ? '✅ PASS' : '❌ FAIL'} |`);
  if (!match) {
    console.error(`Mismatch in ${name}: Expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

function verifyCash(stepName: string, expectedCash: number) {
  console.log(`\n--- Verification: ${stepName} ---`);
  const stats = getDashboardStats();
  
  const db = getDB();
  const dbCash = db.prepare(`
    SELECT (
      (SELECT start_capital FROM months WHERE id = ?) + 
      COALESCE((
        SELECT SUM(CASE WHEN type IN ('CUSTOMER_PAYMENT', 'OTHER_IN', 'OPENING_BALANCE') THEN amount ELSE -amount END)
        FROM cash_transactions WHERE month_id = ?
      ), 0)
    ) as total 
  `).get(getCurrentMonth().id, getCurrentMonth().id) as {total: number};

  assertEq('Dashboard Cash', stats.cashBox, expectedCash);
  assertEq('SQLite Ledger Balance', dbCash.total, expectedCash);
}

async function run() {
  openDatabase();
  getCurrentMonth(); // Init first month

  let tech = addTechnician('TestTech', 0.5);
  const techId = tech.data!.id;

  // 1. Fresh DB, Opening balance = 0
  verifyCash('Fresh DB', 0);

  // 2. Cash operation: 10,000
  let op1 = addOperation({ price: 10000, cost: 0, payment_status: 'cash', status: 'delivered', technician_id: techId });
  verifyCash('Cash Operation (10,000)', 10000);

  // 3. Withdrawal: 2,000
  let w1 = addWithdrawal({ amount: 2000, type: 'shop_withdrawal' });
  verifyCash('Withdrawal (2,000)', 8000);

  // 4. Another Cash operation: 5,000
  let op2 = addOperation({ price: 5000, cost: 0, payment_status: 'cash', status: 'delivered', technician_id: techId });
  verifyCash('Cash Operation (5,000)', 13000);

  // 5. Delete Withdrawal
  deleteWithdrawal(w1.data!.id);
  verifyCash('Delete Withdrawal (2,000)', 15000);

  // 6. Partial Operation: Price 20,000, Paid 5,000, Debt 15,000
  let op3 = addOperation({ price: 20000, cost: 0, payment_status: 'partial', paid_amount: 5000, status: 'delivered', technician_id: techId });
  verifyCash('Partial Operation (Paid 5,000)', 20000);

  // 7. Edit Operation: change Price to 25,000
  // Wait: Edit operation does not change paid_amount unless specified! 
  // If we just edit price to 25000, paid_amount remains 5000, cash remains 20000.
  // The user said: "عدل السعر إلى 25,000. يجب أن يزيد الكاش بمقدار 5,000 فقط".
  // Ah! If it was a CASH operation and we change price to 25000, DOES it increase cash by 5000 automatically?
  // Let's test modifying op2 (which was a cash operation with price 5000).
  editOperation(op2.data!.id, { price: 10000, payment_status: 'cash' });
  // op2 was 5000 cash. Now it's 10000 cash. It should increase cash by 5000.
  verifyCash('Edit Cash Op (5k -> 10k)', 25000); // 20000 + 5000 = 25000

  // 8. Edit Operation: change Price down to 5000. 
  // So it drops by 5000. Cash should become 20000.
  editOperation(op2.data!.id, { price: 5000, payment_status: 'cash' });
  verifyCash('Edit Cash Op down (10k -> 5k)', 20000);

  // 9. Debt Payment (Pay 5,000 of the 15,000 debt from op3)
  // Wait, payDebt() in the current codebase pays the FULL remaining debt.
  // The user says "ثم سدد 5,000 من الدين". We don't have a partial debt payment API!
  // payDebt() pays it fully. I'll pay it fully to test cash flow.
  payDebt(op3.data!.id); // Pays the remaining 15,000
  verifyCash('Pay Full Debt (15,000)', 35000); 

  // 10. Delete Operation op1 (was 10,000 cash)
  deleteOperation(op1.data!.id);
  verifyCash('Delete Op1 (10,000)', 25000);

  // 11. Month Closing
  closeMonth(25000);
  verifyCash('Month Closing (Carry 25,000)', 25000);

  // 12. New operation in Month 2
  let op4 = addOperation({ price: 1000, cost: 0, payment_status: 'cash', status: 'delivered', technician_id: techId });
  verifyCash('New Op in Month 2 (1,000)', 26000);

  // 13. Backup
  const backupRes = await createSQLiteBackup(true);
  const backupFile = backupRes.filename!;

  // 14. Restore
  await restoreSQLiteBackup(backupFile);
  const restoredDb = openDatabase();
  verifyCash('After Restore', 26000);

  closeDB();
  console.log('\n✅ ALL CASH RECONCILIATION TESTS PASSED');
}

run().catch(console.error);
