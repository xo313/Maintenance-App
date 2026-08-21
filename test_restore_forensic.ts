import path from 'node:path';
import fs from 'node:fs';

// Setup test environment
process.env.TEST_USER_DATA = path.join(process.cwd(), 'test_restore_db');
if (fs.existsSync(process.env.TEST_USER_DATA)) {
  fs.rmSync(process.env.TEST_USER_DATA, { recursive: true, force: true });
}

import { openDatabase, closeDB, getDB, isIntegrityOk } from './electron/db/connection.js';
import { createSQLiteBackup, restoreSQLiteBackup, getBackupDir } from './electron/db/backup.js';

import { addOperation } from './electron/db/repositories/operationsRepo.js';
import { addTechnician } from './electron/db/repositories/techniciansRepo.js';
import { getCurrentMonth } from './electron/db/repositories/monthsRepo.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

async function run() {
  openDatabase();

  const db = getDB();
  getCurrentMonth();
  let tech = addTechnician('TestTech', 0.5);
  const techId = tech.data!.id;

  addOperation({ customer_name: 'RESTORE_TEST_CUSTOMER', status: 'delivered', price: 123456, technician_id: techId });
  
  // Create Backup
  const backupRes = await createSQLiteBackup(true);
  assert(backupRes.success, 'Backup should succeed');
  const backupFile = backupRes.filename!;

  // Modify DB after backup
  addOperation({ customer_name: 'SHOULD_BE_LOST', status: 'delivered', price: 999, technician_id: techId });

  // Verify it exists
  let count = (db.prepare('SELECT COUNT(*) as c FROM operations').get() as any).c;
  assert(count === 2, 'Should have 2 operations before restore');

  // Perform Restore
  const restoreRes = await restoreSQLiteBackup(backupFile);
  assert(restoreRes.success, 'Restore should succeed');

  // Verify the restored DB state
  // We don't have electron restart, so we just open the db again.
  // restoreSQLiteBackup ALREADY opened and closed the DB in my new fix. Wait, I added closeDB() before return in my previous step.
  // So the DB should be closed now.
  const restoredDb = openDatabase();
  assert(isIntegrityOk(restoredDb), 'Restored DB integrity should be ok');

  count = (restoredDb.prepare('SELECT COUNT(*) as c FROM operations').get() as any).c;
  assert(count === 1, 'Should have 1 operation after restore');

  const customerName = (restoredDb.prepare('SELECT customer_name FROM operations WHERE id = 1').get() as any).customer_name;
  assert(customerName === 'RESTORE_TEST_CUSTOMER', 'Should restore the correct customer');

  closeDB();

  console.log('\n✅ FORENSIC RESTORE TEST PASSED');
}

run().catch(console.error);
