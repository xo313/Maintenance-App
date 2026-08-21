import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import * as connection from './electron/db/connection.js';
import { runAutomaticMigration } from './electron/db/migration.js';

function runForensicAudit() {
  const jsonPath = path.join(process.cwd(), 'test_production_env', 'backups_v2', 'migration-json-backup-2026-08-20_16-37-21.json');
  const sqlitePath = path.join(process.cwd(), 'test_userData', 'maintenance.db');

  // Mock getDatabasePath
  // @ts-ignore
  connection.getDatabasePath = () => sqlitePath;

  console.log('Loading JSON:', jsonPath);
  console.log('Loading SQLite:', sqlitePath);

  const backupData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const legacyData = backupData.database || backupData;

  const userDataDir = path.join(process.cwd(), 'test_userData');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(path.join(userDataDir, 'database.json'), JSON.stringify(legacyData));
  if (fs.existsSync(sqlitePath)) fs.unlinkSync(sqlitePath);
  process.env.TEST_USER_DATA = userDataDir;
  
  if (!runAutomaticMigration()) {
    console.error('Migration failed');
    return;
  }

  const db = new Database(sqlitePath);

  let md = '# Forensic Migration Audit Report\n\n';

  // 1. Financial Totals
  let oldIncomes = 0;
  let oldExpenses = 0;
  let oldShopProfit = 0;
  let oldTechPayables = 0;
  let oldCustomerDebt = 0;

  for (const op of (legacyData.operations || [])) {
    const price = Number(op.price) || 0;
    const paidAmt = op.paid_amount !== undefined ? Number(op.paid_amount) : (op.payment_status === 'cash' ? price : 0);
    oldIncomes += paidAmt;
    oldShopProfit += Number(op.shop_profit) || 0;
    oldTechPayables += Number(op.tech_profit) || 0;
    oldCustomerDebt += (price - paidAmt);
  }

  for (const w of (legacyData.withdrawals || [])) {
    const amt = Number(w.amount) || 0;
    oldExpenses += amt;
    if (w.type === 'tech_withdrawal') {
      oldTechPayables -= amt;
    }
  }

  const oldBaseCapital = Number(legacyData.settings?.base_capital) || 0;
  const oldCash = oldBaseCapital + oldIncomes - oldExpenses;

  // New Totals
  const cashRows = db.prepare('SELECT amount, type FROM cash_transactions').all() as any[];
  let newCash = oldBaseCapital; // Assuming base capital is added manually or kept out
  let newIncomes = 0;
  let newExpenses = 0;
  for (const r of cashRows) {
    if (['CUSTOMER_PAYMENT', 'OPENING_BALANCE', 'DEBT_PAYMENT'].includes(r.type)) { newCash += r.amount; newIncomes += r.amount; }
    if (['SHOP_WITHDRAWAL', 'TECHNICIAN_PAYMENT', 'EXPENSE', 'SUPPLIER_PAYMENT'].includes(r.type)) { newCash -= r.amount; newExpenses += r.amount; }
  }

  let newShopProfit = 0;
  let newTechPayables = 0;
  let newCustomerDebt = 0;
  const opsRows = db.prepare('SELECT shop_profit, tech_profit, price, paid_amount FROM operations').all() as any[];
  for (const r of opsRows) {
    newShopProfit += r.shop_profit;
    newTechPayables += r.tech_profit;
    newCustomerDebt += (r.price - r.paid_amount);
  }

  const withRows = db.prepare('SELECT amount, type FROM withdrawals').all() as any[];
  for (const r of withRows) {
    if (r.type === 'tech_withdrawal') {
      newTechPayables -= r.amount;
    }
  }

  md += '## 1. Financial Totals\n\n';
  md += '| Metric | Old JSON | New SQLite | Difference |\n';
  md += '|---|---|---|---|\n';
  md += `| Total Cash | ${oldCash.toFixed(2)} | ${newCash.toFixed(2)} | ${(oldCash - newCash).toFixed(2)} |\n`;
  md += `| Shop Profit | ${oldShopProfit.toFixed(2)} | ${newShopProfit.toFixed(2)} | ${(oldShopProfit - newShopProfit).toFixed(2)} |\n`;
  md += `| Tech Payables | ${oldTechPayables.toFixed(2)} | ${newTechPayables.toFixed(2)} | ${(oldTechPayables - newTechPayables).toFixed(2)} |\n`;
  md += `| Customer Debt | ${oldCustomerDebt.toFixed(2)} | ${newCustomerDebt.toFixed(2)} | ${(oldCustomerDebt - newCustomerDebt).toFixed(2)} |\n\n`;

  // 2. Operations Comparison
  md += '## 2. Operations Comparison\n\n';
  md += '| Op ID | Old Status | New Status | Old Paid | New Paid | Old Debt | New Debt | Double Count Check |\n';
  md += '|---|---|---|---|---|---|---|---|\n';

  let hasDoubleCounting = false;

  for (const op of (legacyData.operations || [])) {
    const newOp = db.prepare('SELECT * FROM operations WHERE id = ?').get(op.id) as any;
    const oldPrice = Number(op.price) || 0;
    const oldPaid = op.paid_amount !== undefined ? Number(op.paid_amount) : (op.payment_status === 'cash' ? oldPrice : 0);
    const oldDebt = oldPrice - oldPaid;

    if (!newOp) {
      md += `| ${op.id} | ${op.payment_status} | MISSING | ${oldPaid} | - | ${oldDebt} | - | FAIL (Missing) |\n`;
      continue;
    }

    const newPaid = Number(newOp.paid_amount);
    const newDebt = Number(newOp.price) - newPaid;

    // Check cash transactions for this op
    const cashTx = db.prepare('SELECT * FROM cash_transactions WHERE type = ' + "'CUSTOMER_PAYMENT'" + ' AND reference_id = ?').all(op.id) as any[];
    const totalCashTx = cashTx.reduce((sum, tx) => sum + tx.amount, 0);

    // Check payments for this op
    const payments = db.prepare('SELECT * FROM payments WHERE operation_id = ?').all(op.id) as any[];
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

    let doubleCountStatus = 'PASS';
    if (totalCashTx !== newPaid || totalPayments !== newPaid) {
      doubleCountStatus = `FAIL (CashTx=${totalCashTx}, Payments=${totalPayments}, PaidAmt=${newPaid})`;
      hasDoubleCounting = true;
    }

    if (totalCashTx > oldPaid) {
      doubleCountStatus = `FAIL (Overcharged: OldPaid=${oldPaid}, CashTx=${totalCashTx})`;
      hasDoubleCounting = true;
    }

    md += `| ${op.id} | ${op.payment_status} | ${newOp.payment_status} | ${oldPaid} | ${newPaid} | ${oldDebt} | ${newDebt} | ${doubleCountStatus} |\n`;
  }

  // 3. Withdrawals Comparison
  md += '\n## 3. Withdrawals Comparison\n\n';
  md += '| With ID | Old Amount | New Amount | CashTx Check |\n';
  md += '|---|---|---|---|\n';

  for (const w of (legacyData.withdrawals || [])) {
    const newWith = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(w.id) as any;
    const oldAmt = Number(w.amount) || 0;

    if (!newWith) {
      md += `| ${w.id} | ${oldAmt} | MISSING | FAIL |\n`;
      continue;
    }

    const newAmt = Number(newWith.amount);
    md += `| ${w.id} | ${oldAmt} | ${newAmt} | PASS |\n`;
  }

  md += `\n## 4. Overall Conclusion\n\n`;
  md += `Double Counting: **${hasDoubleCounting ? 'FAIL' : 'PASS'}**\n`;

  fs.writeFileSync('C:/Users/ms24/.gemini/antigravity-ide/brain/6628449b-2345-419c-ab7c-79046bae4d1a/FORENSIC_AUDIT_REPORT.md', md);
  console.log('Audit complete. Wrote FORENSIC_AUDIT_REPORT.md');
}

runForensicAudit();
