import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { getDB, getDatabasePath, closeDB, openDatabase, isIntegrityOk } from './connection.js';
import { CURRENT_SCHEMA_VERSION } from './schema.js';

export interface SQLiteBackupMetadata {
  filename: string;
  created_at: string;
  size_kb: number;
  operations_count: number;
  months_count: number;
  technicians_count: number;
  withdrawals_count: number;
  sha256: string;
  schema_version: number;
  is_manual?: boolean;
}

const MAX_BACKUPS = 30;

export function getBackupDir(): string {
  const currentDataPath = process.env.TEST_USER_DATA || (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(process.cwd(), 'test_userData'));
  const dir = path.join(currentDataPath, 'backups_v2');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

export async function createSQLiteBackup(isManual = false): Promise<{ success: boolean; filename?: string; metadata?: SQLiteBackupMetadata; reason?: string }> {
  try {
    const db = getDB();
    if (!isIntegrityOk(db)) {
      throw new Error('DATABASE_CORRUPTED_BEFORE_BACKUP');
    }

    const backupDir = getBackupDir();
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const filename = `backup-${timestamp}.db`;
    const destPath = path.join(backupDir, filename);

    // Online atomic SQLite backup API
    await db.backup(destPath);

    // Verify backup file integrity
    const backupDb = new Database(destPath, { readonly: true });
    const isOk = isIntegrityOk(backupDb);
    backupDb.close();

    if (!isOk) {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      throw new Error('BACKUP_INTEGRITY_CHECK_FAILED');
    }

    const stats = fs.statSync(destPath);
    const sha256 = getFileSha256(destPath);

    // Get current record counts
    const opsCount = (db.prepare('SELECT count(*) as count FROM operations').get() as { count: number }).count;
    const monthsCount = (db.prepare('SELECT count(*) as count FROM months').get() as { count: number }).count;
    const techsCount = (db.prepare('SELECT count(*) as count FROM technicians').get() as { count: number }).count;
    const withsCount = (db.prepare('SELECT count(*) as count FROM withdrawals').get() as { count: number }).count;

    const metadata: SQLiteBackupMetadata = {
      filename,
      created_at: now.toISOString(),
      size_kb: Math.round(stats.size / 1024),
      operations_count: opsCount,
      months_count: monthsCount,
      technicians_count: techsCount,
      withdrawals_count: withsCount,
      sha256,
      schema_version: CURRENT_SCHEMA_VERSION,
      is_manual: isManual
    };

    const metaPath = path.join(backupDir, `${filename}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    // Enforce retention policy
    cleanOldBackups(backupDir);

    return { success: true, filename, metadata };
  } catch (err: any) {
    console.error('[SQLite Backup] Create backup failed:', err);
    return { success: false, reason: err?.message || 'BACKUP_FAILED' };
  }
}

export function listSQLiteBackups(): SQLiteBackupMetadata[] {
  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir);
  const metadataList: SQLiteBackupMetadata[] = [];

  for (const file of files) {
    if (file.endsWith('.meta.json')) {
      try {
        const metaRaw = fs.readFileSync(path.join(backupDir, file), 'utf8');
        const meta = JSON.parse(metaRaw) as SQLiteBackupMetadata;
        if (fs.existsSync(path.join(backupDir, meta.filename))) {
          metadataList.push(meta);
        }
      } catch (err) {
        console.warn(`[SQLite Backup] Failed to read metadata for ${file}:`, err);
      }
    }
  }

  // Sort descending by creation date
  return metadataList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function restoreSQLiteBackup(filename: string): Promise<{ success: boolean; reason?: string }> {
  const backupDir = getBackupDir();
  const backupFilePath = path.join(backupDir, filename);

  if (!fs.existsSync(backupFilePath)) {
    return { success: false, reason: 'BACKUP_FILE_NOT_FOUND' };
  }

  // 1. Verify candidate backup integrity
  try {
    const candidateDb = new Database(backupFilePath, { readonly: true });
    const isOk = isIntegrityOk(candidateDb);
    candidateDb.close();

    if (!isOk) {
      return { success: false, reason: 'BACKUP_FILE_CORRUPTED' };
    }
  } catch (err: any) {
    return { success: false, reason: 'BACKUP_OPEN_FAILED: ' + (err?.message || err) };
  }

  // 2. Create emergency snapshot of active DB
  const preRestoreName = `pre-restore-${Date.now()}.db`;
  const preRestorePath = path.join(backupDir, preRestoreName);
  const currentDbPath = getDatabasePath();

  try {
    const db = getDB();
    await db.backup(preRestorePath);
  } catch (err) {
    console.warn('[SQLite Restore] Could not create pre-restore snapshot:', err);
  }

  // 3. Close active database connection
  closeDB();

  // Remove WAL and SHM files
  const walPath = `${currentDbPath}-wal`;
  const shmPath = `${currentDbPath}-shm`;
  if (fs.existsSync(walPath)) { try { fs.unlinkSync(walPath); } catch {} }
  if (fs.existsSync(shmPath)) { try { fs.unlinkSync(shmPath); } catch {} }

  // 4. Atomic file replacement
  try {
    fs.copyFileSync(backupFilePath, currentDbPath);

    // 5. Verify restored database
    const restoredDb = openDatabase(currentDbPath);
    if (!isIntegrityOk(restoredDb)) {
      throw new Error('RESTORED_DB_INTEGRITY_FAILED');
    }

    console.log(`[SQLite Restore] Successfully restored database from: ${filename}`);
    return { success: true };
  } catch (err: any) {
    console.error('[SQLite Restore] Restore failed, attempting rollback to pre-restore snapshot:', err);
    closeDB();
    if (fs.existsSync(preRestorePath)) {
      try {
        fs.copyFileSync(preRestorePath, currentDbPath);
        openDatabase(currentDbPath);
      } catch (rollbackErr) {
        console.error('[SQLite Restore] Rollback failed critically:', rollbackErr);
      }
    }
    return { success: false, reason: err?.message || 'RESTORE_FAILED' };
  }
}

function cleanOldBackups(backupDir: string): void {
  try {
    const backups = listSQLiteBackups();
    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      for (const b of toDelete) {
        const dbPath = path.join(backupDir, b.filename);
        const metaPath = path.join(backupDir, `${b.filename}.meta.json`);
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      }
    }
  } catch (err) {
    console.warn('[SQLite Backup] Failed to clean old backups:', err);
  }
}
