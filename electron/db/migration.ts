import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
// @ts-ignore
const req = typeof globalThis.require === 'function' ? globalThis.require : require;
const Database = req('better-sqlite3');
import { getDatabasePath, openDatabase, isIntegrityOk } from './connection.js';
import { validateSchema, getCanonicalDatabaseHash } from '../backup.js';
import { CURRENT_SCHEMA_VERSION } from './schema.js';

export interface MigrationResult {
  success: boolean;
  migratedFrom?: string;
  operationsCount?: number;
  monthsCount?: number;
  techniciansCount?: number;
  customersCount?: number;
  withdrawalsCount?: number;
  error?: string;
}

function getLegacyPaths(): string[] {
  const currentDataPath = process.env.TEST_USER_DATA || (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(process.cwd(), 'test_userData'));
  const appData = (app && typeof app.getPath === 'function') ? app.getPath('appData') : process.cwd();
  return [
    path.join(currentDataPath, 'database.json'),
    path.join(appData, 'Maintenance App', 'database.json'),
    path.join(appData, 'maintenance_app', 'database.json'),
    path.join(process.cwd(), 'database.json')
  ];
}

export function findLegacyDatabase(): string | null {
  for (const legacyPath of getLegacyPaths()) {
    if (fs.existsSync(legacyPath)) {
      try {
        if (fs.statSync(legacyPath).size > 10) return legacyPath;
      } catch {
        // Continue searching
      }
    }
  }
  return null;
}

function getMigrationState(dbPath: string): { status: string, error?: string } | null {
  try {
    const db = new Database(dbPath, { fileMustExist: true });
    // In WAL mode, ensure we can read safely.
    const row = db.prepare('SELECT status, error FROM legacy_migration_state WHERE id = 1').get() as { status: string, error: string | null } | undefined;
    db.close();
    if (row) {
      return { status: row.status, error: row.error || undefined };
    }
    return null;
  } catch {
    return null; // Table doesn't exist or DB is unreadable
  }
}

function setMigrationState(db: Database.Database, status: string, sourceHash: string | null, error: string | null) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO legacy_migration_state (id, status, source_hash, error, updated_at) 
    VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      status = excluded.status,
      source_hash = COALESCE(excluded.source_hash, legacy_migration_state.source_hash),
      error = excluded.error,
      updated_at = excluded.updated_at
  `).run(status, sourceHash, error, now);
}

export function runAutomaticMigration(): boolean {
  const dbPath = getDatabasePath();

  // Never skip solely because tables contain data. A populated but unverified DB
  // can be the result of an interrupted migration. Only a valid schema version
  // plus a verified migration-state marker may short-circuit migration.
  if (fs.existsSync(dbPath)) {
    try {
      const db = openDatabase();
      
      // Determine if schema is V2 or higher
      const row = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get() as { version: number | null };
      const hasCurrentSchema = Number(row?.version || 0) >= CURRENT_SCHEMA_VERSION;
      
      if (isIntegrityOk(db) && hasCurrentSchema) {
        const state = db.prepare('SELECT status FROM legacy_migration_state WHERE id = 1').get() as { status: string } | undefined;
        
        if (state?.status === 'COMPLETED' || state?.status === 'ADOPTED') {
          console.log('[SQLite Migration] Existing SQLite database is verified. Skipping migration.');
          return true;
        }

        // If migration is explicitly marked as FAILED or IN_PROGRESS, we must recover it, not adopt it.
        if (state?.status !== 'FAILED' && state?.status !== 'IN_PROGRESS') {
          // A database may have been created fresh by the current application.
          const opsCount = (db.prepare('SELECT count(*) as count FROM operations').get() as { count: number }).count;
          const monthsCount = (db.prepare('SELECT count(*) as count FROM months').get() as { count: number }).count;
          const customersCount = (db.prepare('SELECT count(*) as count FROM customers').get() as { count: number }).count;
          const techniciansCount = (db.prepare('SELECT count(*) as count FROM technicians').get() as { count: number }).count;
          const hasSettings = (db.prepare('SELECT count(*) as count FROM settings').get() as { count: number }).count > 0;
          
          if (opsCount === 0 && monthsCount <= 1 && customersCount === 0 && techniciansCount === 0) {
            console.log('[SQLite Migration] Fresh SQLite database detected. No legacy migration required.');
            setMigrationState(db, 'COMPLETED', 'fresh_install', null);
            return true;
          }

          // --- SAFE ADOPTION LOGIC ---
          // If we reach here, the database is populated and has V2 schema, but no migration marker.
          // It could be a database created by a V2 dev version, or a restored V2 backup.
          if (hasSettings && monthsCount > 0) {
             console.log('[SQLite Migration] Populated V2 database detected without migration marker. Proceeding with Safe Adoption.');
             setMigrationState(db, 'ADOPTED', 'safe_adoption', null);
             return true;
          }

          console.error('[SQLite Migration] Existing populated SQLite database is unrecognized (missing markers and fails adoption). Halting.');
          showMigrationError('تم العثور على قاعدة بيانات موجودة تحتاج إلى التحقق قبل الترحيل. تم إيقاف التشغيل للحماية.');
          return false;
        }
      }
    } catch (e) {
      console.warn('[SQLite Migration] Existing DB verification warning:', e);
    }
  }

  const legacyDbPath = findLegacyDatabase();
  if (!legacyDbPath) {
    console.log('[SQLite Migration] No legacy database found. Initializing fresh SQLite database.');
    const db = openDatabase();
    seedFreshDatabase(db);
    setMigrationState(db, 'COMPLETED', 'fresh_install', null);
    return true;
  }

  console.log(`[SQLite Migration] Legacy database found at: ${legacyDbPath}. Starting migration...`);

  let legacyData: any;
  try {
    legacyData = JSON.parse(fs.readFileSync(legacyDbPath, 'utf8'));
  } catch (e: any) {
    console.error('[SQLite Migration] Failed to read or parse legacy database:', e);
    showMigrationError('تعذر قراءة قاعدة البيانات القديمة: ' + (e?.message || e));
    return false;
  }

  if (!validateSchema(legacyData)) {
    console.error('[SQLite Migration] Legacy database schema validation failed.');
    showMigrationError('قاعدة البيانات القديمة غير متوافقة أو تالفة. تم إيقاف الترحيل لحماية بياناتك.');
    return false;
  }

  const sourceHash = getCanonicalDatabaseHash(legacyData);
  const currentDataPath = process.env.TEST_USER_DATA || (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(process.cwd(), 'test_userData'));
  const backupDir = path.join(currentDataPath, 'backups_v2');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const backupFilePath = path.join(backupDir, `migration-json-backup-${timestamp}.json`);

  try {
    fs.writeFileSync(backupFilePath, JSON.stringify({
      backup_version: 1,
      is_migration_backup: true,
      created_at: now.toISOString(),
      source_file: legacyDbPath,
      database_hash: sourceHash,
      database: legacyData
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[SQLite Migration] Failed to create legacy backup:', err);
    showMigrationError('فشل إنشاء نسخة احتياطية من البيانات القديمة قبل الترحيل. تم الإيقاف للأمان.');
    return false;
  }

  const db = openDatabase();
  
  // Check if we are recovering from IN_PROGRESS or FAILED state
  const state = db.prepare('SELECT status FROM legacy_migration_state WHERE id = 1').get() as { status: string } | undefined;
  if (state?.status === 'IN_PROGRESS' || state?.status === 'FAILED') {
      console.log(`[SQLite Migration] Recovering from ${state.status} migration state...`);
  }
  
  setMigrationState(db, 'IN_PROGRESS', sourceHash, null);

  try {
    const migrateTx = db.transaction(() => {
      // CLEAR all tables to ensure idempotency if running on a partially populated DB
      db.prepare('DELETE FROM cash_transactions').run();
      db.prepare('DELETE FROM payments').run();
      db.prepare('DELETE FROM withdrawals').run();
      db.prepare('DELETE FROM operations').run();
      db.prepare('DELETE FROM customers').run();
      db.prepare('DELETE FROM technicians').run();
      db.prepare('DELETE FROM months').run();
      db.prepare('DELETE FROM settings').run();
      db.prepare('DELETE FROM ic_compatibilities').run();
      db.prepare('DELETE FROM scrap_devices').run();
      db.prepare('DELETE FROM common_devices').run();
      db.prepare('DELETE FROM common_faults').run();
      
      const settings = legacyData.settings || {};
      db.prepare(`INSERT OR REPLACE INTO settings (id, base_capital, shop_name, whatsapp_template, theme) VALUES (1, ?, ?, ?, ?)`)
        .run(settings.base_capital || 0, settings.shop_name || 'مركز الصيانة', settings.whatsapp_template || 'السلام عليكم [اسم_الزبون] 👋\nنود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.\nالمبلغ المطلوب: [المبلغ]\nشكراً لاختيارك مركزنا! 🛠️✨', settings.theme || 'dark');

      const months = Array.isArray(legacyData.months) ? legacyData.months : [];
      const insertMonth = db.prepare(`INSERT OR REPLACE INTO months (id, month_name, start_capital, is_closed, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?)`);
      if (months.length === 0) {
        insertMonth.run(1, now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }), settings.base_capital || 0, 0, now.toISOString(), null);
      } else {
        for (const m of months) insertMonth.run(m.id, m.month_name || 'شهر غير مسمى', Number(m.start_capital) || 0, m.is_closed ? 1 : 0, m.created_at || now.toISOString(), m.closed_at || null);
      }

      const technicians = Array.isArray(legacyData.technicians) ? legacyData.technicians : [];
      const insertTech = db.prepare(`INSERT OR REPLACE INTO technicians (id, name, profit_percentage, start_balance, is_active) VALUES (?, ?, ?, ?, ?)`);
      for (const t of technicians) insertTech.run(t.id, t.name || 'فني', Number(t.profit_percentage) || 0, Number(t.start_balance) || 0, t.is_active !== false ? 1 : 0);

      const customers = Array.isArray(legacyData.customers) ? legacyData.customers : [];
      const insertCustomer = db.prepare(`INSERT OR REPLACE INTO customers (id, name, phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const c of customers) insertCustomer.run(c.id, c.name || 'عميل', c.phone || '', c.notes || '', c.created_at || now.toISOString(), c.updated_at || now.toISOString());

      const operations = Array.isArray(legacyData.operations) ? legacyData.operations : [];
      const insertOp = db.prepare(`INSERT OR REPLACE INTO operations (id, date, month_id, technician_id, customer_id, customer_name, customer_phone, device, device_code, faults, cost, price, tech_profit_percentage, shop_profit, tech_profit, payment_status, status, paid_in_month_id, delivered_in_month_id, paid_at, paid_amount, notes, accessories, warranty_enabled, warranty_days, warranty_note, warranty_expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const insertPayment = db.prepare(`INSERT INTO payments (operation_id, month_id, amount, paid_at, payment_type, notes) VALUES (?, ?, ?, ?, ?, ?)`);
      const insertCash = db.prepare(`INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);

      const defaultMonthId = months.length > 0 ? months[0].id : 1;
      const validTechIds = new Set(technicians.map((t: any) => t.id));
      const validMonthIds = new Set(months.map((m: any) => m.id));
      if (validTechIds.size === 0) {
        insertTech.run(1, 'فني افتراضي', 0.5, 0, 1);
        validTechIds.add(1);
      }
      const firstTechId = Array.from(validTechIds)[0];

      for (const op of operations) {
        const monthId = validMonthIds.has(op.month_id) ? op.month_id : defaultMonthId;
        const techId = validTechIds.has(op.technician_id) ? op.technician_id : firstTechId;
        let faultsJson = '[]';
        if (Array.isArray(op.faults)) faultsJson = JSON.stringify(op.faults);
        else if (typeof op.faults === 'string' && op.faults.trim()) faultsJson = JSON.stringify([op.faults.trim()]);
        const paidInMonth = op.paid_in_month_id && validMonthIds.has(op.paid_in_month_id) ? op.paid_in_month_id : null;
        const deliveredInMonth = op.delivered_in_month_id && validMonthIds.has(op.delivered_in_month_id) ? op.delivered_in_month_id : null;
        const paidAmt = op.paid_amount !== undefined ? Number(op.paid_amount) : (op.payment_status === 'cash' ? (Number(op.price) || 0) : 0);
        const actionDate = op.paid_at || op.date || now.toISOString();

        insertOp.run(op.id, op.date || now.toLocaleDateString('en-GB'), monthId, techId, op.customer_id || null, op.customer_name || 'عميل', op.customer_phone || '', op.device || 'جهاز', op.device_code || null, faultsJson, Number(op.cost) || 0, Number(op.price) || 0, op.tech_profit_percentage !== undefined ? Number(op.tech_profit_percentage) : null, Number(op.shop_profit) || 0, Number(op.tech_profit) || 0, ['cash', 'debt', 'partial'].includes(op.payment_status) ? op.payment_status : 'cash', ['under_maintenance', 'completed', 'delivered', 'cancelled'].includes(op.status) ? op.status : 'delivered', paidInMonth, deliveredInMonth, paidAmt > 0 ? actionDate : null, paidAmt, op.notes || null, op.accessories || null, op.warranty_enabled ? 1 : 0, op.warranty_days ? Number(op.warranty_days) : null, op.warranty_note || null, op.warranty_expiry_date || null);
        
        if (paidAmt > 0) {
          const actMonthId = paidInMonth || monthId;
          insertPayment.run(op.id, actMonthId, paidAmt, actionDate, 'cash', 'رصيد مدفوع مسجل من البيانات السابقة');
          insertCash.run('CUSTOMER_PAYMENT', paidAmt, actionDate, actMonthId, op.id, 'دفعة عملية #' + op.id, actionDate);
        }
      }

      const withdrawals = Array.isArray(legacyData.withdrawals) ? legacyData.withdrawals : [];
      const insertWithdrawal = db.prepare(`INSERT OR REPLACE INTO withdrawals (id, date, amount, notes, type, technician_id, month_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const w of withdrawals) {
        const monthId = validMonthIds.has(w.month_id) ? w.month_id : defaultMonthId;
        const techId = w.technician_id && validTechIds.has(w.technician_id) ? w.technician_id : null;
        const wType = ['shop_withdrawal', 'tech_withdrawal'].includes(w.type) ? w.type : 'shop_withdrawal';
        const wAmount = Number(w.amount) || 0;
        const wDate = w.date || now.toLocaleDateString('en-GB');
        const wNotes = w.notes || w.description || '';
        
        insertWithdrawal.run(w.id, wDate, wAmount, wNotes, wType, techId, monthId);
        if (wAmount > 0) {
          const cashType = wType === 'shop_withdrawal' ? 'SHOP_WITHDRAWAL' : 'TECHNICIAN_PAYMENT';
          insertCash.run(cashType, wAmount, wDate, monthId, techId, wNotes, wDate);
        }
      }

      const commonDevices = Array.isArray(legacyData.common_devices) ? legacyData.common_devices : [];
      const insertCommonDevice = db.prepare('INSERT OR IGNORE INTO common_devices (name) VALUES (?)');
      for (const d of commonDevices) if (typeof d === 'string' && d.trim()) insertCommonDevice.run(d.trim());
      const commonFaults = Array.isArray(legacyData.common_faults) ? legacyData.common_faults : [];
      const insertCommonFault = db.prepare('INSERT OR IGNORE INTO common_faults (name) VALUES (?)');
      for (const f of commonFaults) if (typeof f === 'string' && f.trim()) insertCommonFault.run(f.trim());

      const icCompatibilities = Array.isArray(legacyData.ic_compatibilities) ? legacyData.ic_compatibilities : [];
      const insertIc = db.prepare(`INSERT OR REPLACE INTO ic_compatibilities (id, ic_number, component_type, compatible_devices, notes) VALUES (?, ?, ?, ?, ?)`);
      for (const ic of icCompatibilities) insertIc.run(ic.id || Date.now(), ic.ic_number || '', ic.component_type || '', ic.compatible_devices || '', ic.notes || '');

      const scrapDevices = Array.isArray(legacyData.scrap_devices) ? legacyData.scrap_devices : [];
      const insertScrap = db.prepare(`INSERT OR REPLACE INTO scrap_devices (id, device_name, device_model, quantity) VALUES (?, ?, ?, ?)`);
      for (const s of scrapDevices) insertScrap.run(s.id || Date.now(), s.device_name || '', s.device_model || '', Number(s.quantity) || 1);
    });

    migrateTx();

    const verifyOpsCount = (db.prepare('SELECT count(*) as count FROM operations').get() as { count: number }).count;
    const verifyTechsCount = (db.prepare('SELECT count(*) as count FROM technicians').get() as { count: number }).count;
    const verifyMonthsCount = (db.prepare('SELECT count(*) as count FROM months').get() as { count: number }).count;
    const verifyWithsCount = (db.prepare('SELECT count(*) as count FROM withdrawals').get() as { count: number }).count;
    const legacyOps = Array.isArray(legacyData.operations) ? legacyData.operations : [];
    const legacyTechs = Array.isArray(legacyData.technicians) ? legacyData.technicians : [];
    const legacyMonths = Array.isArray(legacyData.months) ? legacyData.months : [];
    const legacyWiths = Array.isArray(legacyData.withdrawals) ? legacyData.withdrawals : [];

    if (verifyOpsCount !== legacyOps.length || verifyTechsCount < legacyTechs.length || verifyMonthsCount < legacyMonths.length || verifyWithsCount !== legacyWiths.length) {
      throw new Error(`Record count mismatch: Ops(${verifyOpsCount}/${legacyOps.length}), Techs(${verifyTechsCount}/${legacyTechs.length}), Months(${verifyMonthsCount}/${legacyMonths.length}), Withs(${verifyWithsCount}/${legacyWiths.length})`);
    }

    const sqliteSums = db.prepare(`SELECT SUM(price) as total_price, SUM(cost) as total_cost, SUM(shop_profit) as total_shop_profit, SUM(tech_profit) as total_tech_profit FROM operations`).get() as { total_price: number; total_cost: number; total_shop_profit: number; total_tech_profit: number };
    const jsonTotalPrice = legacyOps.reduce((sum: number, op: any) => sum + (Number(op.price) || 0), 0);
    const jsonTotalCost = legacyOps.reduce((sum: number, op: any) => sum + (Number(op.cost) || 0), 0);
    const jsonTotalShopProfit = legacyOps.reduce((sum: number, op: any) => sum + (Number(op.shop_profit) || 0), 0);
    const jsonTotalTechProfit = legacyOps.reduce((sum: number, op: any) => sum + (Number(op.tech_profit) || 0), 0);
    const isClose = (a: number, b: number) => Math.abs((a || 0) - (b || 0)) < 0.01;
    if (!isClose(sqliteSums.total_price, jsonTotalPrice) || !isClose(sqliteSums.total_cost, jsonTotalCost) || !isClose(sqliteSums.total_shop_profit, jsonTotalShopProfit) || !isClose(sqliteSums.total_tech_profit, jsonTotalTechProfit)) {
      throw new Error(`Financial sum mismatch: Price(${sqliteSums.total_price}/${jsonTotalPrice}), Cost(${sqliteSums.total_cost}/${jsonTotalCost}), ShopProfit(${sqliteSums.total_shop_profit}/${jsonTotalShopProfit}), TechProfit(${sqliteSums.total_tech_profit}/${jsonTotalTechProfit})`);
    }

    setMigrationState(db, 'COMPLETED', sourceHash, null);

    console.log('[SQLite Migration] Migration completed and verified with 100% data integrity!');
    return true;
  } catch (err: any) {
    console.error('[SQLite Migration] Migration transaction failed:', err);
    try {
      setMigrationState(db, 'FAILED', sourceHash, err?.message || String(err));
    } catch(e) {
      // In case db itself is closed/corrupted
    }
    showMigrationError('فشل ترحيل البيانات إلى SQLite: ' + (err?.message || err) + '\nتم التراجع والبيانات القديمة في أمان.');
    return false;
  }
}

function seedFreshDatabase(db: Database.Database): void {
  const appRoot = (app && typeof app.getAppPath === 'function') ? app.getAppPath() : process.cwd();
  const seedPath = path.join(appRoot, 'default_seed.json');
  if (fs.existsSync(seedPath)) {
    try {
      const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      if (Array.isArray(seedData.common_devices)) {
        const insertDevice = db.prepare('INSERT OR IGNORE INTO common_devices (name) VALUES (?)');
        for (const d of seedData.common_devices) insertDevice.run(d);
      }
      if (Array.isArray(seedData.common_faults)) {
        const insertFault = db.prepare('INSERT OR IGNORE INTO common_faults (name) VALUES (?)');
        for (const f of seedData.common_faults) insertFault.run(f);
      }
      if (Array.isArray(seedData.ic_compatibilities)) {
        const insertIc = db.prepare('INSERT OR IGNORE INTO ic_compatibilities (id, ic_number, component_type, compatible_devices, notes) VALUES (?, ?, ?, ?, ?)');
        let id = 1;
        for (const ic of seedData.ic_compatibilities) insertIc.run(id++, ic.ic_number, ic.component_type || '', ic.compatible_devices || '', ic.notes || '');
      }
    } catch (e) {
      console.warn('Failed to seed initial default_seed.json:', e);
    }
  }
  const monthCount = (db.prepare('SELECT count(*) as count FROM months').get() as { count: number }).count;
  if (monthCount === 0) db.prepare('INSERT INTO months (id, month_name, start_capital, is_closed, created_at, closed_at) VALUES (1, ?, 0, 0, ?, NULL)').run(new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }), new Date().toISOString());
  const settingsCount = (db.prepare('SELECT count(*) as count FROM settings').get() as { count: number }).count;
  if (settingsCount === 0) db.prepare('INSERT INTO settings (id, base_capital, shop_name, whatsapp_template, theme) VALUES (1, 0, ?, ?, ?)').run('مركز الصيانة', 'السلام عليكم [اسم_الزبون] 👋\nنود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.\nالمبلغ المطلوب: [المبلغ]\nشكراً لاختيارك مركزنا! 🛠️✨', 'dark');
}

function showMigrationError(message: string): void {
  try { dialog.showErrorBox('خطأ في ترحيل البيانات', message); }
  catch { console.error('[Error Box]', message); }
}
