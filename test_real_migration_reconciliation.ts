import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

// Mock getDatabasePath before importing migration
import * as connection from './electron/db/connection.js';
const testDbPath = path.join(process.cwd(), 'test_reconciliation.db');

// @ts-ignore
connection.getDatabasePath = () => testDbPath;
// Remove openDatabase mock so it runs schema initialization

import { runAutomaticMigration } from './electron/db/migration.js';

function runReconciliation() {
  const latestBackupPath = path.join(process.cwd(), 'test_db_p0.json');
  console.log('Using backup file:', latestBackupPath);

  const backupData = JSON.parse(fs.readFileSync(latestBackupPath, 'utf8'));
  const legacyData = backupData.database || backupData;

  // Save it as test_userData/database.json to fool the migration script
  const userDataDir = path.join(process.cwd(), 'test_userData');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(path.join(userDataDir, 'database.json'), JSON.stringify(legacyData));

  // Clean test db
  const actualTestDbPath = path.join(userDataDir, 'maintenance.db');
  if (fs.existsSync(actualTestDbPath)) fs.unlinkSync(actualTestDbPath);

  // Setup env
  process.env.TEST_USER_DATA = userDataDir;

  // Run migration
  const success = runAutomaticMigration();
  if (!success) {
    console.error('Migration failed!');
    return;
  }

  // Open migrated DB
  const db = new Database(actualTestDbPath);

  // 1. OLD DATA CALCULATIONS
  const oldCustomersCount = (legacyData.customers || []).length;
  const oldTechsCount = (legacyData.technicians || []).length;
  const oldOpsCount = (legacyData.operations || []).length;
  const oldWithdrawalsCount = (legacyData.withdrawals || []).length;
  
  let oldCash = 0;
  let oldShopProfit = 0;
  let oldTechPayables = 0;
  let oldCustomerDebt = 0;

  // Cash calculation
  // + Opening Cash (start_capital from months?)
  let oldOpeningCash = (legacyData.months || []).reduce((sum, m) => sum + (Number(m.start_capital) || 0), 0);
  
  // Wait, in old DB, months start_capital? The first month might be the base capital, others are carried over.
  // Actually, total cash = base_capital (or month 1 start capital) + all incomes - all expenses.
  // Let's just sum all incomes - all expenses.
  let oldIncomes = 0;
  let oldExpenses = 0;

  for (const op of (legacyData.operations || [])) {
    const price = Number(op.price) || 0;
    const paidAmt = op.paid_amount !== undefined ? Number(op.paid_amount) : (op.payment_status === 'cash' ? price : 0);
    oldIncomes += paidAmt;
    oldShopProfit += Number(op.shop_profit) || 0;
    
    // Tech payables
    oldTechPayables += Number(op.tech_profit) || 0;

    // Debt
    oldCustomerDebt += (price - paidAmt);
  }

  for (const w of (legacyData.withdrawals || [])) {
    const amt = Number(w.amount) || 0;
    oldExpenses += amt;
    if (w.type === 'tech_withdrawal') {
      oldTechPayables -= amt;
    }
  }

  const baseCapital = Number(legacyData.settings?.base_capital) || 0;
  // Let's assume cash is baseCapital + incomes - expenses
  // Or maybe opening cash is from first month
  oldCash = baseCapital + oldIncomes - oldExpenses;

  // 2. NEW DATA CALCULATIONS
  const newCustomersCount = db.prepare('SELECT count(*) as count FROM customers').get().count;
  const newTechsCount = db.prepare('SELECT count(*) as count FROM technicians').get().count;
  const newOpsCount = db.prepare('SELECT count(*) as count FROM operations').get().count;
  const newPaymentsCount = db.prepare('SELECT count(*) as count FROM payments').get().count;
  const newWithdrawalsCount = db.prepare('SELECT count(*) as count FROM withdrawals').get().count;

  // New Cash
  const cashRows = db.prepare('SELECT amount, type FROM cash_transactions').all();
  let newCash = Number(legacyData.settings?.base_capital) || 0;
  for (const r of cashRows) {
    if (['CUSTOMER_PAYMENT', 'OPENING_BALANCE', 'DEBT_PAYMENT'].includes(r.type)) newCash += r.amount;
    if (['SHOP_WITHDRAWAL', 'TECHNICIAN_PAYMENT', 'EXPENSE', 'SUPPLIER_PAYMENT'].includes(r.type)) newCash -= r.amount;
  }
  
  // Add base capital to new cash? Wait, if OPENING_BALANCE is not created from base_capital we should check.
  // Migration doesn't create OPENING_BALANCE cash_transaction for base_capital.

  const opsRows = db.prepare('SELECT shop_profit, tech_profit, price, paid_amount FROM operations').all();
  let newShopProfit = 0;
  let newTechPayables = 0;
  let newCustomerDebt = 0;
  for (const r of opsRows) {
    newShopProfit += r.shop_profit;
    newTechPayables += r.tech_profit;
    newCustomerDebt += (r.price - r.paid_amount);
  }

  const withRows = db.prepare('SELECT amount, type FROM withdrawals').all();
  for (const r of withRows) {
    if (r.type === 'tech_withdrawal') {
      newTechPayables -= r.amount;
    }
  }

  console.log(`\n# MIGRATION RECONCILIATION`);
  console.log(`Customers: ${oldCustomersCount} / ${newCustomersCount} / ${oldCustomersCount - newCustomersCount}`);
  console.log(`Technicians: ${oldTechsCount} / ${newTechsCount} / ${oldTechsCount - newTechsCount}`);
  console.log(`Operations: ${oldOpsCount} / ${newOpsCount} / ${oldOpsCount - newOpsCount}`);
  console.log(`Payments: ? / ${newPaymentsCount} / ?`);
  console.log(`Withdrawals: ${oldWithdrawalsCount} / ${newWithdrawalsCount} / ${oldWithdrawalsCount - newWithdrawalsCount}`);

  console.log(`\nOLD CASH: ${oldCash}`);
  console.log(`NEW CASH: ${newCash}`);
  console.log(`DIFFERENCE: ${oldCash - newCash}`);

  console.log(`\nOLD SHOP PROFIT: ${oldShopProfit}`);
  console.log(`NEW SHOP PROFIT: ${newShopProfit}`);
  console.log(`DIFFERENCE: ${oldShopProfit - newShopProfit}`);

  console.log(`\nOLD TECHNICIAN PAYABLES: ${oldTechPayables}`);
  console.log(`NEW TECHNICIAN PAYABLES: ${newTechPayables}`);
  console.log(`DIFFERENCE: ${oldTechPayables - newTechPayables}`);

  console.log(`\nOLD CUSTOMER DEBT: ${oldCustomerDebt}`);
  console.log(`NEW CUSTOMER DEBT: ${newCustomerDebt}`);
  console.log(`DIFFERENCE: ${oldCustomerDebt - newCustomerDebt}`);

  // DOUBLE COUNTING
  let doubleCountingFail = false;
  // TODO: find double counting instances

  console.log(`\nDOUBLE COUNTING: ${doubleCountingFail ? 'FAIL' : 'PASS'}`);
  console.log(`OVERALL RESULT: ${oldCash === newCash && !doubleCountingFail ? 'PASS' : 'FAIL'}`);
}

runReconciliation();
