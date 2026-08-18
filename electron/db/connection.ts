import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { CREATE_TABLES_SQL, CREATE_INDEXES_SQL, CURRENT_SCHEMA_VERSION } from './schema.js';

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  const currentDataPath = process.env.TEST_USER_DATA || (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(process.cwd(), 'test_userData'));
  return path.join(currentDataPath, 'maintenance.db');
}

export function getDB(): Database.Database {
  if (!dbInstance) {
    dbInstance = openDatabase();
  }
  return dbInstance;
}

export function openDatabase(customPath?: string): Database.Database {
  const isDefaultPath = !customPath || customPath === getDatabasePath();
  const dbPath = customPath || getDatabasePath();
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  if (isDefaultPath && dbInstance) {
    try { dbInstance.close(); } catch {}
    dbInstance = null;
  }

  const db = new Database(dbPath);

  // Configure high-reliability WAL mode & Foreign Keys
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');

  // Initialize schema if not exists
  initSchema(db);

  if (isDefaultPath) {
    dbInstance = db;
  }

  return db;
}

export function initSchema(db: Database.Database): void {
  db.exec(CREATE_TABLES_SQL);
  db.exec(CREATE_INDEXES_SQL);

  // Check and record schema migration version
  const checkMigration = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(CURRENT_SCHEMA_VERSION);
  if (!checkMigration) {
    db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)')
      .run(CURRENT_SCHEMA_VERSION, new Date().toISOString(), 'Initial SQLite schema');
  }
}

export function isIntegrityOk(db?: Database.Database): boolean {
  const targetDb = db || getDB();
  try {
    const result = targetDb.pragma('integrity_check') as { integrity_check: string }[];
    return Array.isArray(result) && result.length === 1 && result[0].integrity_check === 'ok';
  } catch (err) {
    console.error('[SQLite] Integrity check failed with error:', err);
    return false;
  }
}

export function closeDB(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (err) {
      console.error('[SQLite] Error closing database connection:', err);
    } finally {
      dbInstance = null;
    }
  }
}
