import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// Use process.cwd() as app data for testing since app is not ready
process.env.TEST_USER_DATA = path.join(process.cwd(), 'test_audit_db');

import { openDatabase, closeDB, getDB } from './electron/db/connection.js';
import { addTechnician } from './electron/db/repositories/techniciansRepo.js';
import { addOperation, editOperation, deleteOperation, payDebt } from './electron/db/repositories/operationsRepo.js';
import { addWithdrawal } from './electron/db/repositories/withdrawalsRepo.js';
import { getDashboardStats } from './electron/db/repositories/statsRepo.js';
import { closeMonth } from './electron/db/repositories/monthsRepo.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('❌ ASSERTION FAILED: ' + message);
    process.exit(1);
  }
}

async function run() {
  const dbDir = process.env.TEST_USER_DATA;
  if (fs.existsSync(dbDir)) {
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
  
  openDatabase();

  console.log('--- PRE-REQUISITE: Add Technician ---');
  let tech = addTechnician('Test Tech', 0.5);
  const techId = tech.data!.id;

  console.log('--- A) إنشاء عملية نقدية كاملة (price=100, cost=20) ---');
  let opA = addOperation({ price: 100, cost: 20, payment_status: 'cash', status: 'delivered', technician_id: techId });
  let stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}`);
  assert(stats.cashBox === 100, 'Cash should be 100');
  assert(stats.grossProfit === 80, 'Profit should be 80');

  console.log('--- B) إنشاء عملية دفع جزئي (price=200, cost=50, paid=50) ---');
  let opB = addOperation({ price: 200, cost: 50, payment_status: 'partial', paid_amount: 50, status: 'delivered', technician_id: techId });
  stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}, Debt: ${stats.debtTotal}`);
  assert(stats.cashBox === 150, 'Cash should be 150');
  assert(stats.grossProfit === 230, 'Profit should be 230 (80 + 150)');
  assert(stats.debtTotal === 150, 'Debt should be 150');

  console.log('--- C) إنشاء عملية دين (price=300, cost=100) ---');
  let opC = addOperation({ price: 300, cost: 100, payment_status: 'debt', status: 'delivered', technician_id: techId });
  stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}, Debt: ${stats.debtTotal}`);
  assert(stats.cashBox === 150, 'Cash should be 150');
  assert(stats.grossProfit === 430, 'Profit should be 430');
  assert(stats.debtTotal === 450, 'Debt should be 450 (150 + 300)');

  console.log('--- D) تسديد الدين جزئياً (تعديل العملية C لتدفع 100) ---');
  editOperation(opC.data!.id, { payment_status: 'partial', paid_amount: 100 });
  stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}, Debt: ${stats.debtTotal}`);
  assert(stats.cashBox === 250, 'Cash should be 250');
  assert(stats.grossProfit === 430, 'Profit should be 430 (unchanged)');
  assert(stats.debtTotal === 350, 'Debt should be 350');

  console.log('--- E) تسديد الدين بالكامل (Process payDebt on C) ---');
  payDebt(opC.data!.id);
  stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}, Debt: ${stats.debtTotal}`);
  assert(stats.cashBox === 450, 'Cash should be 450 (250 + 200)');
  assert(stats.grossProfit === 430, 'Profit should be 430 (unchanged)');
  assert(stats.debtTotal === 150, 'Debt should be 150');

  console.log('--- F) تعديل سعر عملية موجودة (A -> price=150) ---');
  editOperation(opA.data!.id, { price: 150 });
  stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}, Debt: ${stats.debtTotal}`);
  assert(stats.cashBox === 500, 'Cash should be 500 (450 + 50)');
  assert(stats.grossProfit === 480, 'Profit should be 480 (430 + 50)');

  console.log('--- G) تخفيض سعر عملية (A -> price=50) ---');
  editOperation(opA.data!.id, { price: 50 });
  stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}, Debt: ${stats.debtTotal}`);
  assert(stats.cashBox === 400, 'Cash should be 400');
  assert(stats.grossProfit === 380, 'Profit should be 380');

  console.log('--- H) حذف عملية A ---');
  deleteOperation(opA.data!.id);
  stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}, Debt: ${stats.debtTotal}`);
  assert(stats.cashBox === 350, 'Cash should be 350');
  assert(stats.grossProfit === 350, 'Profit should be 350');

  console.log('--- I) سحب من الصندوق (50) ---');
  addWithdrawal({ amount: 50, type: 'shop_withdrawal' });
  stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}`);
  assert(stats.cashBox === 300, 'Cash should be 300');
  assert(stats.grossProfit === 350, 'Profit should be 350 (Withdrawal does not affect profit)');

  console.log('--- J) إغلاق الشهر برأس مال 300 ---');
  closeMonth(300);
  stats = getDashboardStats();
  console.log(`Cash: ${stats.cashBox}, Profit: ${stats.grossProfit}`);
  assert(stats.cashBox === 300, 'Cash should be 300 in new month');
  assert(stats.grossProfit === 0, 'Profit should be 0 in new month');

  console.log('✅ ALL MATH TESTS PASSED!');
  closeDB();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
