import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from 'electron';

export interface BackupMetadata {
  filename: string;
  created_at: string;
  size_kb: number;
  operations_count: number;
  months_count: number;
  technicians_count: number;
  withdrawals_count: number;
}

const BACKUP_VERSION = 1;
const MAX_BACKUPS = 30;

function getBackupDir() {
  const userDataPath = process.env.TEST_USER_DATA || app.getPath('userData');
  const dir = path.join(userDataPath, 'backups_v2');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getCanonicalDatabaseHash(database: any): string {
  if (!database) return crypto.createHash('sha256').update('', 'utf8').digest('hex');
  
  const sortKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sortKeys);
    }
    const sortedObj: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sortedObj[key] = sortKeys(obj[key]);
    }
    return sortedObj;
  };

  const canonicalDb = sortKeys(database);
  const jsonStr = JSON.stringify(canonicalDb);
  return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
}

export function validateSchema(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.months)) return false;
  if (!Array.isArray(data.operations)) return false;
  if (!Array.isArray(data.technicians)) return false;
  if (!Array.isArray(data.withdrawals)) return false;
  
  // Check duplicates
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

  // Check finite numbers in operations
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
    
    // Auto Backup limit: 1 per day
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
      database_hash: getCanonicalDatabaseHash(dbData),
      database: dbData
    };

    // Atomic write
    fs.writeFileSync(tmpFilepath, JSON.stringify(backupContent, null, 2), 'utf8');
    
    // Verify readable and valid
    const writtenRaw = fs.readFileSync(tmpFilepath, 'utf8');
    const parsed = JSON.parse(writtenRaw);
    if (!parsed || !parsed.database || !validateSchema(parsed.database)) {
      fs.unlinkSync(tmpFilepath); // Clean up
      return { success: false, reason: 'BACKUP_INVALID_SCHEMA' };
    }

    // Rename to final
    fs.renameSync(tmpFilepath, filepath);

    // Retention Policy - only delete AutoBackups
    const allAutoBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('AutoBackup_') && f.endsWith('.json'))
      .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time); // newest first

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

export function listBackups(): BackupMetadata[] {
  try {
    const backupDir = getBackupDir();
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
    
    const results: BackupMetadata[] = [];
    
    for (const file of files) {
      try {
        const filepath = path.join(backupDir, file);
        const stats = fs.statSync(filepath);
        const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        
        const db = content.database || content; // Handle backward compat if old backup is raw db
        
        results.push({
          filename: file,
          created_at: content.created_at || stats.mtime.toISOString(),
          size_kb: Math.round(stats.size / 1024),
          operations_count: Array.isArray(db.operations) ? db.operations.length : 0,
          months_count: Array.isArray(db.months) ? db.months.length : 0,
          technicians_count: Array.isArray(db.technicians) ? db.technicians.length : 0,
          withdrawals_count: Array.isArray(db.withdrawals) ? db.withdrawals.length : 0,
        });
      } catch (e) {
        // Corrupt file, skip
      }
    }
    
    // Sort by created_at desc
    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (e) {
    return [];
  }
}

export function readBackup(filename: string): { data: any, fileHash?: string } {
  if (typeof filename !== 'string') throw new Error('BACKUP_INVALID_PATH');
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('BACKUP_INVALID_PATH');
  }
  
  const safeName = path.basename(filename);
  if (!safeName.endsWith('.json')) throw new Error('BACKUP_INVALID_PATH');

  const backupDirResolved = path.resolve(getBackupDir());
  const filepath = path.resolve(backupDirResolved, safeName);
  
  // Anti-traversal check
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

  const dbData = data.database || data; // backward compatibility
  const fileHash = data.database_hash;
  
  if (!validateSchema(dbData)) {
    throw new Error('BACKUP_INVALID_SCHEMA');
  }

  // Backup Integrity Validation
  if (fileHash) {
    const calculatedHash = getCanonicalDatabaseHash(dbData);
    if (fileHash !== calculatedHash) {
      throw new Error('BACKUP_HASH_MISMATCH');
    }
  }
  
  return { data: dbData, fileHash };
}
