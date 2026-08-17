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

export const BACKUP_VERSION = 1;
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
  if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) return false;
  if (!Array.isArray(data.months)) return false;
  if (!Array.isArray(data.operations)) return false;
  if (!Array.isArray(data.technicians)) return false;
  if (!Array.isArray(data.withdrawals)) return false;

  const isFiniteNumber = (value: any) => typeof value === 'number' && Number.isFinite(value);
  const isObject = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const hasValidOptionalNumber = (value: any, key: string) => value[key] === undefined || isFiniteNumber(value[key]);
  const hasValidOptionalString = (value: any, key: string) => value[key] === undefined || typeof value[key] === 'string';
  const hasValidOptionalNullableString = (value: any, key: string) => value[key] === undefined || value[key] === null || typeof value[key] === 'string';

  if (!hasValidOptionalNumber(data.settings, 'id') ||
      !hasValidOptionalNumber(data.settings, 'base_capital') ||
      !hasValidOptionalString(data.settings, 'shop_name') ||
      !hasValidOptionalString(data.settings, 'whatsapp_template')) return false;
  
  // Check duplicates
  const checkDuplicates = (arr: any[]) => {
    const ids = new Set();
    for (const item of arr) {
      if (!isObject(item) || !isFiniteNumber(item.id)) return false;
      if (ids.has(item.id)) return false;
      ids.add(item.id);
    }
    return true;
  };

  if (!checkDuplicates(data.months)) return false;
  if (!checkDuplicates(data.operations)) return false;
  if (!checkDuplicates(data.technicians)) return false;
  if (!checkDuplicates(data.withdrawals)) return false;

  for (const month of data.months) {
    if (!hasValidOptionalString(month, 'month_name') ||
        !hasValidOptionalNumber(month, 'start_capital') ||
        (month.is_closed !== undefined && typeof month.is_closed !== 'boolean') ||
        !hasValidOptionalString(month, 'created_at') ||
        !hasValidOptionalNullableString(month, 'closed_at')) return false;
  }

  for (const technician of data.technicians) {
    if (!hasValidOptionalString(technician, 'name') ||
        !hasValidOptionalNumber(technician, 'profit_percentage') ||
        !hasValidOptionalNumber(technician, 'start_balance') ||
        (technician.is_active !== undefined && typeof technician.is_active !== 'boolean')) return false;
  }

  // Check finite numbers in operations
  for (const op of data.operations) {
    if (!hasValidOptionalString(op, 'date') ||
        !hasValidOptionalString(op, 'customer_name') ||
        !hasValidOptionalString(op, 'customer_phone') ||
        !hasValidOptionalString(op, 'device') ||
        !hasValidOptionalNumber(op, 'cost') ||
        !hasValidOptionalNumber(op, 'price') ||
        !hasValidOptionalNumber(op, 'shop_profit') ||
        !hasValidOptionalNumber(op, 'tech_profit') ||
        !hasValidOptionalNumber(op, 'technician_id') ||
        !hasValidOptionalNumber(op, 'month_id') ||
        !hasValidOptionalNumber(op, 'paid_in_month_id') ||
        !hasValidOptionalNullableString(op, 'paid_at')) return false;
    if (op.faults !== undefined && (!Array.isArray(op.faults) || op.faults.some((fault: any) => typeof fault !== 'string'))) return false;
    if (op.payment_status !== undefined && !['cash', 'debt'].includes(op.payment_status)) return false;
    if (op.status !== undefined && !['under_maintenance', 'completed', 'delivered'].includes(op.status)) return false;
  }

  for (const withdrawal of data.withdrawals) {
    if (!hasValidOptionalString(withdrawal, 'date') ||
        !hasValidOptionalString(withdrawal, 'description') ||
        !hasValidOptionalNumber(withdrawal, 'amount') ||
        !hasValidOptionalNumber(withdrawal, 'month_id')) return false;
    if (withdrawal.technician_id !== undefined && withdrawal.technician_id !== null && !isFiniteNumber(withdrawal.technician_id)) return false;
    if (withdrawal.type !== undefined && !['shop_withdrawal', 'tech_withdrawal'].includes(withdrawal.type)) return false;
  }

  const optionalArrays = ['ic_compatibilities', 'scrap_devices', 'common_devices', 'common_faults'];
  for (const field of optionalArrays) {
    if (data[field] !== undefined && !Array.isArray(data[field])) return false;
  }

  return true;
}

interface ParsedBackup {
  data: any;
  fileHash?: string;
  version: number;
}

function parseBackupPayload(payload: any): ParsedBackup {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('BACKUP_INVALID_JSON');
  }

  const isEnvelope = Object.prototype.hasOwnProperty.call(payload, 'database');
  const database = isEnvelope ? payload.database : payload;
  const version = isEnvelope ? payload.backup_version : 0;

  // Raw database snapshots predate the backup envelope and remain supported.
  if (isEnvelope) {
    if (!Number.isInteger(version) || version < 1 || version > BACKUP_VERSION) {
      throw new Error('BACKUP_UNSUPPORTED_VERSION');
    }
    if (typeof payload.created_at !== 'string' || payload.created_at.length === 0) {
      throw new Error('BACKUP_INVALID_METADATA');
    }
    if (payload.database_hash !== undefined &&
        (typeof payload.database_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(payload.database_hash))) {
      throw new Error('BACKUP_INVALID_HASH');
    }
  }

  if (!validateSchema(database)) {
    throw new Error('BACKUP_INVALID_SCHEMA');
  }

  const fileHash = isEnvelope ? payload.database_hash : undefined;
  if (fileHash && getCanonicalDatabaseHash(database) !== fileHash) {
    throw new Error('BACKUP_HASH_MISMATCH');
  }

  return { data: database, fileHash, version };
}

function readBackupFile(filepath: string): ParsedBackup {
  let payload: any;
  try {
    payload = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    throw new Error('BACKUP_INVALID_JSON');
  }
  return parseBackupPayload(payload);
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
    let filename = `${prefix}_${timestamp}.json`;
    let filepath = path.join(backupDir, filename);
    let suffix = 1;
    while (fs.existsSync(filepath)) {
      filename = `${prefix}_${timestamp}_${suffix++}.json`;
      filepath = path.join(backupDir, filename);
    }
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
        try { fs.unlinkSync(old.path); } catch {}
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
        const parsed = parseBackupPayload(content);
        const db = parsed.data;
        
        results.push({
          filename: file,
          created_at: content.created_at || stats.mtime.toISOString(),
          size_kb: Math.round(stats.size / 1024),
          operations_count: Array.isArray(db.operations) ? db.operations.length : 0,
          months_count: Array.isArray(db.months) ? db.months.length : 0,
          technicians_count: Array.isArray(db.technicians) ? db.technicians.length : 0,
          withdrawals_count: Array.isArray(db.withdrawals) ? db.withdrawals.length : 0,
        });
      } catch {
        // Corrupt file, skip
      }
    }
    
    // Sort by created_at desc
    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
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
  
  const parsed = readBackupFile(filepath);
  return { data: parsed.data, fileHash: parsed.fileHash };
}

export function findLatestValidBackup(backupDirectories: string[]): { data: any, sourcePath: string } | null {
  const candidates: { path: string, modifiedAt: number }[] = [];
  const seenDirectories = new Set<string>();

  for (const directory of backupDirectories) {
    if (!directory) continue;
    const resolvedDirectory = path.resolve(directory);
    if (seenDirectories.has(resolvedDirectory) || !fs.existsSync(resolvedDirectory)) continue;
    seenDirectories.add(resolvedDirectory);

    try {
      for (const name of fs.readdirSync(resolvedDirectory)) {
        if (!name.endsWith('.json')) continue;
        const filePath = path.join(resolvedDirectory, name);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) candidates.push({ path: filePath, modifiedAt: stats.mtimeMs });
      }
    } catch (error) {
      console.error('Failed to inspect backup directory', error);
    }
  }

  candidates.sort((a, b) => b.modifiedAt - a.modifiedAt);
  for (const candidate of candidates) {
    try {
      return { data: readBackupFile(candidate.path).data, sourcePath: candidate.path };
    } catch {
      // A corrupt backup must never block trying older valid backups.
    }
  }

  return null;
}
