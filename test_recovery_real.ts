import fs from 'node:fs';
import path from 'node:path';
import { createBackup, readBackup, validateSchema, getCanonicalDatabaseHash } from './electron/backup';

// --- STUB ELECTRON ---
const mockUserData = path.join(process.cwd(), 'test_userData');
process.env.TEST_USER_DATA = mockUserData;
if (!fs.existsSync(mockUserData)) fs.mkdirSync(mockUserData, { recursive: true });

function getBackupDir() {
  const dir = path.join(mockUserData, 'backups_v2');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
// ---------------------

// --- STUB DATABASE ---
class SimpleDB {
  data: any = {};
  dbPath = path.join(mockUserData, 'database.json');
  forceSaveFail = false;

  load() {
    if (fs.existsSync(this.dbPath)) {
      this.data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
    }
  }

  forceCorruptWrite = false;

  save(): boolean {
    if (this.forceSaveFail) return false;
    const tmpPath = this.dbPath + '.tmp';
    try {
      const dataToWrite = this.forceCorruptWrite ? {} : this.data;
      fs.writeFileSync(tmpPath, JSON.stringify(dataToWrite, null, 2));
      fs.renameSync(tmpPath, this.dbPath);
      return true;
    } catch (err) {
      return false;
    }
  }
}
const db = new SimpleDB();
// ---------------------

// --- STUB IPC LOGIC (Simulating main.ts) ---
function simulateRestore(filename: string, simulateRollbackSaveFail = false) {
  const originalHash = getCanonicalDatabaseHash(db.data);
  let restoreResult;
  try {
    restoreResult = readBackup(filename);
  } catch (err: any) {
    return { success: false, reason: err.message };
  }

  const restoredData = restoreResult.data;
  const expectedHash = getCanonicalDatabaseHash(restoredData);

  if (restoreResult.fileHash && restoreResult.fileHash !== expectedHash) {
    return { success: false, reason: 'RESTORE_VERIFY_FAILED' };
  }

  const preRestoreBackup = createBackup(db.data, true);
  if (!preRestoreBackup.success) return { success: false, reason: 'CURRENT_BACKUP_FAILED' };

  db.data = restoredData;
  const saveSuccess = db.save();

  if (!saveSuccess) {
    db.load();
    const rollbackHash = getCanonicalDatabaseHash(db.data);
    if (rollbackHash !== originalHash) return { success: false, reason: 'RESTORE_ROLLBACK_SAVE_FAILED' };
    return { success: false, reason: 'DATABASE_SAVE_FAILED' };
  }

  db.load();
  const actualHash = getCanonicalDatabaseHash(db.data);
  const opsMatch = db.data.operations?.length === restoredData.operations?.length;

  if (actualHash !== expectedHash || !opsMatch) {
    try {
      const rollbackFilename = path.basename(preRestoreBackup.filename!);
      const rollbackData = readBackup(rollbackFilename).data;
      db.data = rollbackData;
      if (simulateRollbackSaveFail) db.forceSaveFail = true;
      const rbSave = db.save();
      db.forceSaveFail = false;
      db.load();
      
      const rollbackHash = getCanonicalDatabaseHash(db.data);
      if (!rbSave || rollbackHash !== originalHash) {
        return { success: false, reason: 'CRITICAL RECOVERY ERROR' };
      }
    } catch (e) {
      return { success: false, reason: 'CRITICAL RECOVERY ERROR' };
    }
    return { success: false, reason: 'RESTORE_VERIFY_FAILED' };
  }
  return { success: true };
}

function simulateFactoryReset(simulateSaveFail = false, simulateRollbackSaveFail = false) {
  const originalHash = getCanonicalDatabaseHash(db.data);
  const backupResult = createBackup(db.data, true);
  if (!backupResult.success) return { success: false, reason: 'FACTORY_RESET_BACKUP_FAILED' };

  db.data.operations = [];
  db.data.months = [{ id: 1, month_name: 'test' }];

  if (simulateSaveFail) db.forceSaveFail = true;
  const saveSuccess = db.save();
  db.forceSaveFail = false;

  if (!saveSuccess) {
    try {
      const rollbackFilename = path.basename(backupResult.filename!);
      db.data = readBackup(rollbackFilename).data;
      if (simulateRollbackSaveFail) db.forceSaveFail = true;
      const rbSave = db.save();
      db.forceSaveFail = false;
      if (!rbSave) return { success: false, reason: 'FACTORY_RESET_ROLLBACK_SAVE_FAILED' };
      db.load();
      if (getCanonicalDatabaseHash(db.data) !== originalHash) return { success: false, reason: 'FACTORY_RESET_ROLLBACK_FAILED' };
    } catch (e) {
      return { success: false, reason: 'FACTORY_RESET_ROLLBACK_FAILED' };
    }
    return { success: false, reason: 'FACTORY_RESET_FAILED' };
  }

  db.load();
  if (db.data.operations.length !== 0) {
    try {
      const rollbackFilename = path.basename(backupResult.filename!);
      db.data = readBackup(rollbackFilename).data;
      if (simulateRollbackSaveFail) db.forceSaveFail = true;
      const rbSave = db.save();
      db.forceSaveFail = false;
      if (!rbSave) return { success: false, reason: 'FACTORY_RESET_ROLLBACK_SAVE_FAILED' };
      db.load();
      if (getCanonicalDatabaseHash(db.data) !== originalHash) return { success: false, reason: 'FACTORY_RESET_ROLLBACK_FAILED' };
    } catch (e) {
      return { success: false, reason: 'FACTORY_RESET_ROLLBACK_FAILED' };
    }
    return { success: false, reason: 'FACTORY_RESET_FAILED' };
  }
  return { success: true };
}
// -------------------------------------------

// --- RUN TESTS ---
console.log("=== PHASE 2.2 FINAL INTEGRATION TESTS ===");
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    testsPassed++;
  } else {
    console.log(`[FAIL] ${testName}`);
    testsFailed++;
  }
}

function clearAll() {
  const dir = getBackupDir();
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  if (fs.existsSync(db.dbPath)) fs.unlinkSync(db.dbPath);
  db.data = {};
}

// SETUP BASELINE
clearAll();
const validDbTemplate = {
  settings: {},
  months: [{ id: 1 }, { id: 2 }],
  operations: [{ id: 100, cost: 50, price: 100, name: "TEST-A" }, { id: 101, cost: 20, price: 50, name: "TEST-B" }],
  technicians: [{ id: 1 }, { id: 2 }],
  withdrawals: [{ id: 1 }, { id: 2 }]
};

// 1. VALID RESTORE (ACTUAL DATA MATCH)
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const validBackup = createBackup(db.data, true);
db.data.operations[0].name = "MODIFIED"; // change active DB
db.save();
const res1 = simulateRestore(path.basename(validBackup.filename!));
assert(res1.success === true && db.data.operations[0].name === "TEST-A", "Test 1: Valid Restore & Actual Data Reverted");

// 2. BACKUP HASH MATCH
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const validBackup2 = createBackup(db.data, true);
const res2 = simulateRestore(path.basename(validBackup2.filename!));
assert(res2.success === true, "Test 2: Backup Hash Match (Valid Backup)");

// 3. MODIFIED DATABASE INSIDE BACKUP (BACKUP_HASH_MISMATCH)
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const diffDataBackup = createBackup(db.data, true);
const rawBackup = JSON.parse(fs.readFileSync(diffDataBackup.filename!, 'utf8'));
rawBackup.database.operations[0].name = "FORCED-MALICIOUS-2";
fs.writeFileSync(diffDataBackup.filename!, JSON.stringify(rawBackup)); // hash doesn't match database_hash inside file
const res3 = simulateRestore(path.basename(diffDataBackup.filename!));
assert(res3.success === false && res3.reason === 'BACKUP_HASH_MISMATCH', "Test 3: Modified database inside Backup yields BACKUP_HASH_MISMATCH");

// 4. LEGACY BACKUP WITHOUT DATABASE_HASH
const legacyDb = JSON.parse(JSON.stringify(validDbTemplate));
const legacyPath = path.join(getBackupDir(), 'legacy.json');
fs.writeFileSync(legacyPath, JSON.stringify({ backup_version: 1, created_at: "old", database: legacyDb })); // NO HASH
const res4 = simulateRestore('legacy.json');
assert(res4.success === true, "Test 4: Legacy Backup without database_hash restores supported");

// 5. VALID RESTORE (tested in 1)
assert(res1.success === true, "Test 5: Valid Restore (Restored Hash matches Backup Hash)");

// 6. RESTORE FAILURE triggers Rollback
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const originalHash6 = getCanonicalDatabaseHash(db.data);
const backup6 = createBackup(db.data, true);
db.forceSaveFail = true;
const res6 = simulateRestore(path.basename(backup6.filename!));
db.forceSaveFail = false;
db.load();
assert(res6.success === false && getCanonicalDatabaseHash(db.data) === originalHash6, "Test 6: Restore failure triggers Rollback");

// 7. ROLLBACK SAVE FAILURE
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const backup7 = createBackup(db.data, true);
db.forceCorruptWrite = true;
const res7 = simulateRestore(path.basename(backup7.filename!), true); // simulate Rollback save fail
db.forceCorruptWrite = false;
assert(res7.reason === 'CRITICAL RECOVERY ERROR', "Test 7: Rollback save failure yields CRITICAL RECOVERY ERROR");

// 8. FACTORY RESET
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const res8 = simulateFactoryReset();
assert(res8.success === true && db.data.operations.length === 0, "Test 8: Factory Reset Backup -> Reset -> Verify");

// 9. FACTORY RESET FORCED FAILURE
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const originalHash9 = getCanonicalDatabaseHash(db.data);
const res9 = simulateFactoryReset(true, false);
db.load();
assert(res9.success === false && res9.reason === 'FACTORY_RESET_FAILED' && getCanonicalDatabaseHash(db.data) === originalHash9, "Test 9: Factory Reset forced failure triggers Rollback");

// 10. FACTORY RESET ROLLBACK SAVE FAILURE
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const res10 = simulateFactoryReset(true, true);
assert(res10.success === false && res10.reason === 'FACTORY_RESET_ROLLBACK_SAVE_FAILED', "Test 10: Factory Reset Rollback save failure explicit error");

// 11. PATH TRAVERSAL
const res11 = simulateRestore('../database.json');
assert(res11.success === false && res11.reason === 'BACKUP_INVALID_PATH', "Test 11: Path Traversal Rejected");

// 12. APPLICATION RESTART AFTER RESTORE
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const backup12 = createBackup(db.data, true);
simulateRestore(path.basename(backup12.filename!));
db.data = {};
db.load();
assert(db.data.operations.length === 2 && getCanonicalDatabaseHash(db.data) === getCanonicalDatabaseHash(validDbTemplate), "Test 12: Application restart after Restore persists data");

// 13. HASH TEST (A vs B)
const dbA = { b: 2, a: 1 };
const dbB = { a: 1, b: 2 };
const hashA = getCanonicalDatabaseHash(dbA);
const hashB = getCanonicalDatabaseHash(dbB);
assert(hashA === hashB, "Test 13: Hash Test - Object key insertion order differs but hash matches");

const dbC = { a: 1, b: 3 };
const hashC = getCanonicalDatabaseHash(dbC);
assert(hashA !== hashC, "Test 13: Hash Test - Different value changes hash");

console.log(`\nResults: ${testsPassed} Passed, ${testsFailed} Failed`);
if (testsFailed > 0) process.exit(1);
