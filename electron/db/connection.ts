// @ts-ignore
const req = typeof globalThis.require === 'function' ? globalThis.require : require;
const Database = req('better-sqlite3');
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

  // Safety check to prevent DEV from writing to STABLE db
  const isDev = process.env.VITE_APP_ENV === 'development';
  if (isDev) {
    const appDataRaw = (app && typeof app.getPath === 'function') ? app.getPath('appData') : process.cwd();
    const stableDbPath = path.join(appDataRaw, 'maintenance_app', 'maintenance.db');
    if (dbPath === stableDbPath) {
      console.error('FATAL ERROR: Development environment is trying to open the STABLE database. Halting to protect data.');
      process.exit(1);
    }
  }

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
  const v1Exists = db.prepare('SELECT version FROM schema_migrations WHERE version = 1').get();
  if (!v1Exists) {
    db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)')
      .run(1, new Date().toISOString(), 'Initial SQLite schema');
  }

  const v2Exists = db.prepare('SELECT version FROM schema_migrations WHERE version = 2').get();
  if (!v2Exists) {
    console.log('[SQLite] Running migration to Schema V2 (Cash Ledger & Suppliers)...');
    db.transaction(() => {
      // Migrate Payments (All Customer Payments including initial and debt payments)
      db.prepare(`
        INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
        SELECT 
          'CUSTOMER_PAYMENT', 
          amount, 
          paid_at, 
          month_id, 
          operation_id, 
          COALESCE(notes, 'دفعة عملية #' || operation_id), 
          paid_at
        FROM payments
        WHERE amount > 0
      `).run();

      // Migrate Withdrawals
      db.prepare(`
        INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
        SELECT 
          CASE WHEN type = 'shop_withdrawal' THEN 'SHOP_WITHDRAWAL' ELSE 'TECHNICIAN_PAYMENT' END,
          amount, 
          date, 
          month_id, 
          technician_id, 
          notes, 
          date
        FROM withdrawals
        WHERE amount > 0
      `).run();

      db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)')
        .run(2, new Date().toISOString(), 'Added unified cash ledger and suppliers');
    })();
    console.log('[SQLite] Migration to Schema V2 completed.');
  }

  const v3Exists = db.prepare('SELECT version FROM schema_migrations WHERE version = 3').get();
  if (!v3Exists) {
    console.log('[SQLite] Running migration to Schema V3 (Zero Out Current Month Capital)...');
    db.prepare('UPDATE months SET start_capital = 0 WHERE is_closed = 0').run();
    db.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)')
      .run(CURRENT_SCHEMA_VERSION, new Date().toISOString(), 'Zero out current month start capital');
    console.log('[SQLite] Migration to Schema V3 completed.');
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
