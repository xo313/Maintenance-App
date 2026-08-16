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

function simulateFactoryReset() {
  const originalHash = getCanonicalDatabaseHash(db.data);
  const backupResult = createBackup(db.data, true);
  if (!backupResult.success) return { success: false, reason: 'FACTORY_RESET_BACKUP_FAILED' };

  db.data.operations = [];
  db.data.months = [{ id: 1, month_name: 'test' }];

  const saveSuccess = db.save();
  if (!saveSuccess) {
    try {
      const rollbackFilename = path.basename(backupResult.filename!);
      db.data = readBackup(rollbackFilename).data;
      db.save();
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
      db.save();
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

// 2. SAME COUNTS / DIFFERENT DATA
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const diffDataBackup = createBackup(db.data, true);
const rawBackup = JSON.parse(fs.readFileSync(diffDataBackup.filename!, 'utf8'));
rawBackup.database.operations[0].name = "FORCED-MALICIOUS-2";
fs.writeFileSync(diffDataBackup.filename!, JSON.stringify(rawBackup)); // Hash mismatch in file
const res2 = simulateRestore(path.basename(diffDataBackup.filename!));
assert(res2.success === false && res2.reason === 'RESTORE_VERIFY_FAILED', "Test 2: Modified Backup Data (Hash mismatch)");

// 3. FORCED RESTORE FAILURE (db.save fails) & ROLLBACK
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const originalHash3 = getCanonicalDatabaseHash(db.data);
const backup3 = createBackup(db.data, true);
db.forceSaveFail = true;
const res3 = simulateRestore(path.basename(backup3.filename!));
db.forceSaveFail = false;
db.load();
assert(res3.success === false && getCanonicalDatabaseHash(db.data) === originalHash3, "Test 3: Forced Restore Failure triggers correct Rollback");

// 4. FORCED ROLLBACK FAILURE
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const backup4 = createBackup(db.data, true);
// Trigger rollback by forcing a corrupt write (verification hash fails)
db.forceCorruptWrite = true;
const res4 = simulateRestore(path.basename(backup4.filename!), true); // simulate Rollback save fail
db.forceCorruptWrite = false;
assert(res4.reason === 'CRITICAL RECOVERY ERROR', "Test 4: Forced Rollback Failure returns CRITICAL RECOVERY ERROR");

// 5. FACTORY RESET & FACTORY RESET ROLLBACK
clearAll();
db.data = JSON.parse(JSON.stringify(validDbTemplate));
db.save();
const res5 = simulateFactoryReset();
assert(res5.success === true && db.data.operations.length === 0, "Test 5: Factory Reset successful and verifies empty DB");

// 6. RESTORE AFTER RESET
const backupBeforeReset = createBackup(validDbTemplate, true);
const res6 = simulateRestore(path.basename(backupBeforeReset.filename!));
assert(res6.success === true && db.data.operations.length === 2, "Test 6: Restore after Factory Reset works");

// 7. RESTART PERSISTENCE
db.data = {}; // wipe memory
db.load(); // restart
assert(db.data.operations.length === 2 && getCanonicalDatabaseHash(db.data) === getCanonicalDatabaseHash(validDbTemplate), "Test 7: Restart Persistence");

// 8. CORRUPT JSON BACKUP
const corruptPath = path.join(getBackupDir(), 'corrupt.json');
fs.writeFileSync(corruptPath, "{ bad json");
const res8 = simulateRestore('corrupt.json');
assert(res8.success === false && res8.reason === 'BACKUP_INVALID_JSON', "Test 8: Corrupt Backup rejected");

// 9. LEGACY BACKUP
const legacyDb = JSON.parse(JSON.stringify(validDbTemplate));
const legacyPath = path.join(getBackupDir(), 'legacy.json');
fs.writeFileSync(legacyPath, JSON.stringify({ backup_version: 1, created_at: "old", database: legacyDb })); // NO HASH
const res9 = simulateRestore('legacy.json');
assert(res9.success === true, "Test 9: Legacy backup restores correctly");

// 10. PATH TRAVERSAL
const res10 = simulateRestore('../database.json');
assert(res10.success === false && res10.reason === 'BACKUP_INVALID_PATH', "Test 10: Path traversal rejected");

console.log(`\nResults: ${testsPassed} Passed, ${testsFailed} Failed`);
if (testsFailed > 0) process.exit(1);
