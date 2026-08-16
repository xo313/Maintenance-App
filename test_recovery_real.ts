import fs from 'node:fs';
import path from 'node:path';

// --- STUB ELECTRON ---
const mockUserData = path.join(process.cwd(), 'test_userData');
if (!fs.existsSync(mockUserData)) fs.mkdirSync(mockUserData, { recursive: true });

function getBackupDir() {
  const dir = path.join(mockUserData, 'backups_v2');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
// ---------------------

const BACKUP_VERSION = 1;
const MAX_BACKUPS = 30;

export function validateSchema(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.months)) return false;
  if (!Array.isArray(data.operations)) return false;
  if (!Array.isArray(data.technicians)) return false;
  if (!Array.isArray(data.withdrawals)) return false;
  
  const checkDuplicates = (arr: any[]) => {
    const ids = new Set();
    for (const item of arr) {
      if (!item || typeof item !== 'object') return false;
      if (item.id === undefined) return false;
      if (ids.has(item.id)) return false;
      ids.add(item.id);
    }
    return true;
  };

  if (!checkDuplicates(data.months)) return false;
  if (!checkDuplicates(data.operations)) return false;
  if (!checkDuplicates(data.technicians)) return false;
  if (!checkDuplicates(data.withdrawals)) return false;

  for (const op of data.operations) {
    if (op.cost !== undefined && !Number.isFinite(op.cost)) return false;
    if (op.price !== undefined && !Number.isFinite(op.price)) return false;
    if (op.shop_profit !== undefined && !Number.isFinite(op.shop_profit)) return false;
    if (op.tech_profit !== undefined && !Number.isFinite(op.tech_profit)) return false;
  }

  return true;
}

export function createBackup(dbData: any, isManual: boolean = false): { success: boolean, reason?: string, error?: string, filename?: string } {
  try {
    const backupDir = getBackupDir();
    const date = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const timestamp = `${dateStr}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
    
    if (!isManual) {
      const existingAuto = fs.readdirSync(backupDir).find(f => f.startsWith('AutoBackup_' + dateStr));
      if (existingAuto) {
        return { success: true, reason: 'AUTO_BACKUP_SKIPPED_ALREADY_EXISTS' };
      }
    }

    const prefix = isManual ? 'ManualBackup' : 'AutoBackup';
    const filename = `${prefix}_${timestamp}.json`;
    const filepath = path.join(backupDir, filename);
    const tmpFilepath = filepath + '.tmp';

    const backupContent = {
      backup_version: BACKUP_VERSION,
      created_at: date.toISOString(),
      database: dbData
    };

    fs.writeFileSync(tmpFilepath, JSON.stringify(backupContent, null, 2), 'utf8');
    
    const writtenRaw = fs.readFileSync(tmpFilepath, 'utf8');
    const parsed = JSON.parse(writtenRaw);
    if (!parsed || !parsed.database || !validateSchema(parsed.database)) {
      fs.unlinkSync(tmpFilepath);
      return { success: false, reason: 'BACKUP_INVALID_SCHEMA' };
    }

    fs.renameSync(tmpFilepath, filepath);

    const allAutoBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('AutoBackup_') && f.endsWith('.json'))
      .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (allAutoBackups.length > MAX_BACKUPS) {
      const toDelete = allAutoBackups.slice(MAX_BACKUPS);
      for (const old of toDelete) {
        try { fs.unlinkSync(old.path); } catch (e) {}
      }
    }

    return { success: true, filename: filepath };
  } catch (error: any) {
    return { success: false, reason: 'BACKUP_WRITE_FAILED', error: error.message };
  }
}

export function readBackup(filename: string): any {
  if (typeof filename !== 'string') throw new Error('BACKUP_INVALID_PATH');
  
  const safeName = path.basename(filename);
  if (!safeName.endsWith('.json')) throw new Error('BACKUP_INVALID_PATH');

  const backupDirResolved = path.resolve(getBackupDir());
  const filepath = path.resolve(backupDirResolved, safeName);
  
  if (!filepath.startsWith(backupDirResolved + path.sep)) {
    throw new Error('BACKUP_INVALID_PATH');
  }

  if (!fs.existsSync(filepath)) throw new Error('BACKUP_NOT_FOUND');
  
  const raw = fs.readFileSync(filepath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('BACKUP_INVALID_JSON');
  }

  const dbData = data.database || data;
  if (!validateSchema(dbData)) throw new Error('BACKUP_INVALID_SCHEMA');
  
  return dbData;
}

// ----------------------------------------------------
// Testing
// ----------------------------------------------------
console.log("=== RUNNING PHASE 2.1 TESTS ===\n");
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

function clearBackups() {
  const dir = path.join(mockUserData, 'backups_v2');
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

clearBackups();

const validDb = {
  settings: {},
  months: [{ id: 1 }],
  operations: [{ id: 100, cost: 50, price: 100 }],
  technicians: [],
  withdrawals: []
};

// TEST 1
let t1 = createBackup(validDb, true);
assert(t1.success, "TEST 1: Create Manual Backup");

// TEST 2
let readData = readBackup(path.basename(t1.filename!));
assert(readData.operations[0].id === 100, "TEST 2: Read created Backup");

// TEST 3
const badJsonPath = path.join(getBackupDir(), 'bad.json');
fs.writeFileSync(badJsonPath, "{ bad_json: ");
try { readBackup('bad.json'); assert(false, "TEST 3: Invalid JSON"); }
catch (e: any) { assert(e.message === 'BACKUP_INVALID_JSON', "TEST 3: Invalid JSON"); }

// TEST 4
const badSchemaPath = path.join(getBackupDir(), 'bad_schema.json');
fs.writeFileSync(badSchemaPath, JSON.stringify({ backup_version: 1, database: { months: "not_array" } }));
try { readBackup('bad_schema.json'); assert(false, "TEST 4: Invalid Schema"); }
catch (e: any) { assert(e.message === 'BACKUP_INVALID_SCHEMA', "TEST 4: Invalid Schema"); }

// TEST 5
const dupOpDb = { ...validDb, operations: [{ id: 1 }, { id: 1 }] };
assert(!validateSchema(dupOpDb), "TEST 5: Duplicate Operation IDs rejected");

// TEST 6
const dupTechDb = { ...validDb, technicians: [{ id: 1 }, { id: 1 }] };
assert(!validateSchema(dupTechDb), "TEST 6: Duplicate Technician IDs rejected");

// TEST 7
const nanDb = { ...validDb, operations: [{ id: 1, cost: NaN }] };
assert(!validateSchema(nanDb), "TEST 7: NaN / Infinity rejected");

// TEST 8 & 9
assert(validateSchema(validDb), "TEST 8 & 9: Valid Schema accepts valid DB");

// TEST 14 & 15
try { readBackup('../database.json'); assert(false, "TEST 14: Path traversal"); }
catch (e: any) { assert(e.message === 'BACKUP_INVALID_PATH', "TEST 14: Path traversal rejected"); }
try { readBackup('C:/Windows/System32/config'); assert(false, "TEST 15: Absolute path"); }
catch (e: any) { assert(e.message === 'BACKUP_INVALID_PATH', "TEST 15: Absolute path rejected"); }

// TEST 16
clearBackups();
const a1 = createBackup(validDb, false);
const a2 = createBackup(validDb, false);
assert(a1.success && a2.reason === 'AUTO_BACKUP_SKIPPED_ALREADY_EXISTS', "TEST 16: Maximum one automatic backup per day");

// TEST 17
clearBackups();
createBackup(validDb, true);
for (let i = 0; i < 35; i++) {
  fs.writeFileSync(path.join(getBackupDir(), `AutoBackup_1990-01-${i}_00-00-00.json`), "{}");
}
createBackup(validDb, false);
const files = fs.readdirSync(getBackupDir());
const manualExists = files.some(f => f.startsWith('ManualBackup'));
const autoCount = files.filter(f => f.startsWith('AutoBackup')).length;
assert(manualExists && autoCount <= 30, "TEST 17: Manual Backup is preserved during retention");

console.log(`\nResults: ${testsPassed} Passed, ${testsFailed} Failed`);
if (testsFailed > 0) process.exit(1);
