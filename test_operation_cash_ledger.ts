import fs from 'fs';
import path from 'path';
import { runAutomaticMigration } from './electron/db/migration.js';
import { closeDB, openDatabase } from './electron/db/connection.js';
import { addOperation, editOperation, deleteOperation } from './electron/db/repositories/operationsRepo.js';

const testDir = path.join(process.cwd(), 'test_operation_cash_ledger_runtime');
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir, { recursive: true });
process.env.TEST_USER_DATA = testDir;
closeDB();

function cashForOperation(db: any, operationId: number): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM cash_transactions
    WHERE type = 'CUSTOMER_PAYMENT' AND reference_id = ?
  `).get(operationId) as { total: number };
  return Number(row.total) || 0;
}

function assertClose(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.000001) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

try {
  if (!runAutomaticMigration()) throw new Error('Migration failed');
  const db = openDatabase();

  const month = db.prepare('SELECT id FROM months ORDER BY id LIMIT 1').get() as { id: number } | undefined;
  if (!month) throw new Error('No test month available');
  const tech = db.prepare('SELECT id FROM technicians ORDER BY id LIMIT 1').get() as { id: number } | undefined;
  if (!tech) throw new Error('No test technician available');

  const created = addOperation({
    month_id: month.id,
    technician_id: tech.id,
    customer_name: 'Ledger Test',
    device: 'Test Device',
    cost: 50,
    price: 100,
    payment_status: 'cash',
    status: 'delivered'
  });
  if (!created.success || !created.data) throw new Error(`Add failed: ${created.reason}`);
  const operationId = created.data.id;

  assertClose(cashForOperation(db, operationId), 100, 'initial cash');

  const increased = editOperation(operationId, { price: 150, payment_status: 'cash' });
  if (!increased.success) throw new Error(`Increase edit failed: ${increased.reason}`);
  assertClose(cashForOperation(db, operationId), 150, 'cash after increase');

  const decreased = editOperation(operationId, { price: 80, payment_status: 'cash' });
  if (!decreased.success) throw new Error(`Decrease edit failed: ${decreased.reason}`);
  assertClose(cashForOperation(db, operationId), 80, 'cash after decrease');

  const debt = editOperation(operationId, { payment_status: 'debt' });
  if (!debt.success) throw new Error(`Debt edit failed: ${debt.reason}`);
  assertClose(cashForOperation(db, operationId), 0, 'cash after debt conversion');

  const partial = editOperation(operationId, { payment_status: 'partial', paid_amount: 30 });
  if (!partial.success) throw new Error(`Partial edit failed: ${partial.reason}`);
  assertClose(cashForOperation(db, operationId), 30, 'cash after partial payment');

  const deleted = deleteOperation(operationId);
  if (!deleted.success) throw new Error(`Delete failed: ${deleted.reason}`);

  const operationExists = db.prepare('SELECT id FROM operations WHERE id = ?').get(operationId);
  if (operationExists) throw new Error('Operation still exists after delete');
  assertClose(cashForOperation(db, operationId), 0, 'cash after delete');

  const paymentCount = (db.prepare('SELECT COUNT(*) AS count FROM payments WHERE operation_id = ?').get(operationId) as { count: number }).count;
  if (paymentCount !== 0) throw new Error(`Payment rows remain after delete: ${paymentCount}`);

  console.log('OPERATION CASH LEDGER TEST: PASS');
} finally {
  closeDB();
  fs.rmSync(testDir, { recursive: true, force: true });
}
