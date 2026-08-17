import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import { getCanonicalDatabaseHash } from './backup.js';
import { userDataPath } from './database.js';

interface MigrationState {
  source: string;
  destination: string;
  timestamp: string;
  sourceHash: string;
  destinationHash: string;
  appVersion: string;
  success: boolean;
  migrationVersion: number;
}

const CURRENT_DB_PATH = path.join(userDataPath, 'database.json');
const MIGRATION_STATE_PATH = path.join(userDataPath, 'migration-state.json');
const BACKUP_DIR = path.join(userDataPath, 'backups_v2');

function getLegacyPaths(): string[] {
  const appData = app.getPath('appData');
  return [
    path.join(appData, 'Maintenance App', 'database.json'),
    path.join(appData, 'maintenance_app', 'database.json'),
    path.join(process.cwd(), 'database.json')
  ];
}

function findLegacyDatabase(): string | null {
  for (const legacyPath of getLegacyPaths()) {
    if (legacyPath.toLowerCase() === CURRENT_DB_PATH.toLowerCase()) continue;
    if (fs.existsSync(legacyPath)) return legacyPath;
  }
  return null;
}

// Legacy databases intentionally use a looser schema than the current v2 backup schema.
// database.ts performs the actual field-by-field normalization after the file is moved.
function validateLegacyDatabase(data: any): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) return false;

  const requiredCollections = ['months', 'technicians', 'operations', 'withdrawals'];
  for (const field of requiredCollections) {
    if (data[field] !== undefined && !Array.isArray(data[field])) return false;
  }

  // A legacy database may omit newer collections. If present, they must still be arrays.
  const optionalCollections = [
    'ic_compatibilities',
    'scrap_devices',
    'common_devices',
    'common_faults',
    'customers'
  ];
  for (const field of optionalCollections) {
    if (data[field] !== undefined && !Array.isArray(data[field])) return false;
  }

  return true;
}

export function runAutomaticMigration(): boolean {
  if (fs.existsSync(CURRENT_DB_PATH)) {
    console.log('[Migration] Current database exists. Skipping migration.');
    return true;
  }

  const legacyDbPath = findLegacyDatabase();
  if (!legacyDbPath) {
    console.log('[Migration] No legacy database found. Starting fresh.');
    return true;
  }

  console.log(`[Migration] Legacy database found at: ${legacyDbPath}`);

  let legacyData: any;
  try {
    const legacyRaw = fs.readFileSync(legacyDbPath, 'utf8');
    legacyData = JSON.parse(legacyRaw);
  } catch (e) {
    console.error('[Migration] Failed to read or parse legacy database.', e);
    showMigrationError('تعذر قراءة قاعدة البيانات القديمة. يرجى استعادتها يدوياً.');
    return false;
  }

  if (!validateLegacyDatabase(legacyData)) {
    console.error('[Migration] Legacy database has an invalid basic structure.');
    showMigrationError('قاعدة البيانات القديمة تالفة أو غير متوافقة.\nتم الحفاظ على بياناتك الأصلية دون تغيير.');
    return false;
  }

  const sourceHash = getCanonicalDatabaseHash(legacyData);

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const date = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timestamp = `${dateStr}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  const backupFileName = `migration-backup-${timestamp}.json`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  try {
    const backupContent = {
      backup_version: 1,
      is_migration_backup: true,
      created_at: date.toISOString(),
      database_hash: sourceHash,
      database: legacyData
    };
    fs.writeFileSync(backupFilePath, JSON.stringify(backupContent, null, 2), 'utf8');

    const backupCheck = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    if (getCanonicalDatabaseHash(backupCheck.database) !== sourceHash) {
      throw new Error('Migration backup hash mismatch');
    }

    console.log(`[Migration] Legacy backup created safely at: ${backupFilePath}`);
  } catch (e) {
    console.error('[Migration] Failed to create migration backup.', e);
    try {
      if (fs.existsSync(backupFilePath)) fs.unlinkSync(backupFilePath);
    } catch {}
    showMigrationError('فشل إنشاء نسخة احتياطية من البيانات القديمة.\nتم إيقاف الترحيل لحماية بياناتك.');
    return false;
  }

  const tmpPath = CURRENT_DB_PATH + '.migration.tmp';
  try {
    const currentDir = path.dirname(CURRENT_DB_PATH);
    if (!fs.existsSync(currentDir)) {
      fs.mkdirSync(currentDir, { recursive: true });
    }

    fs.writeFileSync(tmpPath, JSON.stringify(legacyData, null, 2), 'utf8');

    const tmpRaw = fs.readFileSync(tmpPath, 'utf8');
    const tmpData = JSON.parse(tmpRaw);
    const tmpHash = getCanonicalDatabaseHash(tmpData);
    if (tmpHash !== sourceHash) {
      throw new Error('Hash mismatch after tmp write');
    }

    fs.renameSync(tmpPath, CURRENT_DB_PATH);
  } catch (e) {
    console.error('[Migration] Failed during atomic write/rename.', e);
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
    showMigrationError('حدث خطأ أثناء نقل البيانات.\nالبيانات الأصلية ما زالت في أمان.');
    return false;
  }

  let destinationHash = '';
  try {
    const finalRaw = fs.readFileSync(CURRENT_DB_PATH, 'utf8');
    const finalData = JSON.parse(finalRaw);
    destinationHash = getCanonicalDatabaseHash(finalData);

    if (destinationHash !== sourceHash) {
      throw new Error('Final hash mismatch');
    }
  } catch (e) {
    console.error('[Migration] Final verification failed.', e);
    if (fs.existsSync(CURRENT_DB_PATH)) {
      try { fs.unlinkSync(CURRENT_DB_PATH); } catch {}
    }
    showMigrationError('فشل التحقق من صحة البيانات بعد النقل.\nتم التراجع والبيانات الأصلية في أمان.');
    return false;
  }

  const marker: MigrationState = {
    source: legacyDbPath,
    destination: CURRENT_DB_PATH,
    timestamp: new Date().toISOString(),
    sourceHash,
    destinationHash,
    appVersion: app.getVersion(),
    success: true,
    migrationVersion: 1
  };

  try {
    fs.writeFileSync(MIGRATION_STATE_PATH, JSON.stringify(marker, null, 2), 'utf8');
  } catch (e) {
    console.error('[Migration] Failed to write migration state marker.', e);
  }

  console.log('[Migration] Migration completed successfully!');
  return true;
}

function showMigrationError(message: string) {
  dialog.showErrorBox('خطأ في ترحيل البيانات', message);
}
