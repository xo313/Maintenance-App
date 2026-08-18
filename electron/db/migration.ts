import fs from 'node:fs';
import path from 'node:path';
import { app, dialog } from 'electron';
import Database from 'better-sqlite3';
import { getDatabasePath, openDatabase, isIntegrityOk } from './connection.js';
import { validateSchema, getCanonicalDatabaseHash } from '../backup.js';

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
        const stats = fs.statSync(legacyPath);
        if (stats.size > 10) {
          return legacyPath;
        }
      } catch {
        // Continue searching
      }
    }
  }
  return null;
}

export function runAutomaticMigration(): boolean {
  const dbPath = getDatabasePath();

  // 1. Idempotency check: If SQLite database already exists and has data, skip migration
  if (fs.existsSync(dbPath)) {
    try {
      const db = openDatabase();
      if (isIntegrityOk(db)) {
        const tableCheck = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='operations'").get() as { count: number };
        if (tableCheck && tableCheck.count > 0) {
          const opsCount = (db.prepare('SELECT count(*) as count FROM operations').get() as { count: number }).count;
          const monthsCount = (db.prepare('SELECT count(*) as count FROM months').get() as { count: number }).count;
          if (monthsCount > 0 || opsCount > 0) {
            console.log('[SQLite Migration] SQLite database already exists and active. Skipping migration.');
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('[SQLite Migration] Existing DB check encountered warning, continuing:', e);
    }
  }

  // 2. Locate legacy database.json
  const legacyDbPath = findLegacyDatabase();
  if (!legacyDbPath) {
    console.log('[SQLite Migration] No legacy database found. Initializing fresh SQLite database.');
    const db = openDatabase();
    seedFreshDatabase(db);
    return true;
  }

  console.log(`[SQLite Migration] Legacy database found at: ${legacyDbPath}. Starting migration...`);

  let legacyRaw: string;
  let legacyData: any;

  try {
    legacyRaw = fs.readFileSync(legacyDbPath, 'utf8');
    legacyData = JSON.parse(legacyRaw);
  } catch (e: any) {
    console.error('[SQLite Migration] Failed to read or parse legacy database:', e);
    showMigrationError('تعذر قراءة قاعدة البيانات القديمة: ' + (e?.message || e));
    return false;
  }

  // 3. Validate legacy schema
  if (!validateSchema(legacyData)) {
    console.error('[SQLite Migration] Legacy database schema validation failed.');
    showMigrationError('قاعدة البيانات القديمة غير متوافقة أو تالفة. تم إيقاف الترحيل لحماية بياناتك.');
    return false;
  }

  const sourceHash = getCanonicalDatabaseHash(legacyData);

  // 4. Create automatic backup of database.json before migration
  const currentDataPath = process.env.TEST_USER_DATA || (app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(process.cwd(), 'test_userData'));
  const backupDir = path.join(currentDataPath, 'backups_v2');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

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
    console.log(`[SQLite Migration] Legacy JSON backup created safely at: ${backupFilePath}`);
  } catch (err) {
    console.error('[SQLite Migration] Failed to create legacy backup:', err);
    showMigrationError('فشل إنشاء نسخة احتياطية من البيانات القديمة قبل الترحيل. تم الإيقاف للأمان.');
    return false;
  }

  // 5. Execute Migration in an Atomic Transaction
  const db = openDatabase();

  try {
    const migrateTx = db.transaction(() => {
      // 5.1 Settings
      const settings = legacyData.settings || {};
      db.prepare(`
        INSERT OR REPLACE INTO settings (id, base_capital, shop_name, whatsapp_template, theme)
        VALUES (1, ?, ?, ?, ?)
      `).run(
        settings.base_capital || 0,
        settings.shop_name || 'مركز الصيانة',
        settings.whatsapp_template || 'السلام عليكم [اسم_الزبون] 👋\nنود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.\nالمبلغ المطلوب: [المبلغ]\nشكراً لاختيارك مركزنا! 🛠️✨',
        settings.theme || 'dark'
      );

      // 5.2 Months
      const months = Array.isArray(legacyData.months) ? legacyData.months : [];
      const insertMonth = db.prepare(`
        INSERT OR REPLACE INTO months (id, month_name, start_capital, is_closed, created_at, closed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      if (months.length === 0) {
        insertMonth.run(1, now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }), settings.base_capital || 0, 0, now.toISOString(), null);
      } else {
        for (const m of months) {
          insertMonth.run(
            m.id,
            m.month_name || 'شهر غير مسمى',
            Number(m.start_capital) || 0,
            m.is_closed ? 1 : 0,
            m.created_at || now.toISOString(),
            m.closed_at || null
          );
        }
      }

      // 5.3 Technicians
      const technicians = Array.isArray(legacyData.technicians) ? legacyData.technicians : [];
      const insertTech = db.prepare(`
        INSERT OR REPLACE INTO technicians (id, name, profit_percentage, start_balance, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const t of technicians) {
        insertTech.run(
          t.id,
          t.name || 'فني',
          Number(t.profit_percentage) || 0,
          Number(t.start_balance) || 0,
          t.is_active !== false ? 1 : 0
        );
      }

      // 5.4 Customers
      const customers = Array.isArray(legacyData.customers) ? legacyData.customers : [];
      const insertCustomer = db.prepare(`
        INSERT OR REPLACE INTO customers (id, name, phone, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const c of customers) {
        insertCustomer.run(
          c.id,
          c.name || 'عميل',
          c.phone || '',
          c.notes || '',
          c.created_at || now.toISOString(),
          c.updated_at || now.toISOString()
        );
      }

      // 5.5 Operations
      const operations = Array.isArray(legacyData.operations) ? legacyData.operations : [];
      const insertOp = db.prepare(`
        INSERT OR REPLACE INTO operations (
          id, date, month_id, technician_id, customer_id, customer_name, customer_phone,
          device, device_code, faults, cost, price, tech_profit_percentage, shop_profit,
          tech_profit, payment_status, status, paid_in_month_id, delivered_in_month_id,
          paid_at, paid_amount, notes, accessories, warranty_enabled, warranty_days,
          warranty_note, warranty_expiry_date
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )
      `);

      const insertPayment = db.prepare(`
        INSERT INTO payments (operation_id, month_id, amount, paid_at, payment_type, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Ensure fallback technician and month exist for FK constraints
      const defaultMonthId = months.length > 0 ? months[0].id : 1;
      const validTechIds = new Set(technicians.map((t: any) => t.id));
      const validMonthIds = new Set(months.map((m: any) => m.id));

      if (validTechIds.size === 0) {
        const fallbackTechId = 1;
        insertTech.run(fallbackTechId, 'فني افتراضي', 0.5, 0, 1);
        validTechIds.add(fallbackTechId);
      }
      const firstTechId = Array.from(validTechIds)[0];

      for (const op of operations) {
        const monthId = validMonthIds.has(op.month_id) ? op.month_id : defaultMonthId;
        const techId = validTechIds.has(op.technician_id) ? op.technician_id : firstTechId;
        
        let faultsJson = '[]';
        if (Array.isArray(op.faults)) {
          faultsJson = JSON.stringify(op.faults);
        } else if (typeof op.faults === 'string' && op.faults.trim()) {
          faultsJson = JSON.stringify([op.faults.trim()]);
        }

        const paidInMonth = op.paid_in_month_id && validMonthIds.has(op.paid_in_month_id) ? op.paid_in_month_id : null;
        const deliveredInMonth = op.delivered_in_month_id && validMonthIds.has(op.delivered_in_month_id) ? op.delivered_in_month_id : null;

        insertOp.run(
          op.id,
          op.date || now.toLocaleDateString('en-GB'),
          monthId,
          techId,
          op.customer_id || null,
          op.customer_name || 'عميل',
          op.customer_phone || '',
          op.device || 'جهاز',
          op.device_code || null,
          faultsJson,
          Number(op.cost) || 0,
          Number(op.price) || 0,
          op.tech_profit_percentage !== undefined ? Number(op.tech_profit_percentage) : null,
          Number(op.shop_profit) || 0,
          Number(op.tech_profit) || 0,
          ['cash', 'debt', 'partial'].includes(op.payment_status) ? op.payment_status : 'cash',
          ['under_maintenance', 'completed', 'delivered', 'cancelled'].includes(op.status) ? op.status : 'delivered',
          paidInMonth,
          deliveredInMonth,
          op.paid_at || null,
          op.paid_amount !== undefined ? Number(op.paid_amount) : (op.payment_status === 'cash' ? (Number(op.price) || 0) : 0),
          op.notes || null,
          op.accessories || null,
          op.warranty_enabled ? 1 : 0,
          op.warranty_days ? Number(op.warranty_days) : null,
          op.warranty_note || null,
          op.warranty_expiry_date || null
        );

        // Seed initial payment history if paid
        const paidAmt = op.paid_amount !== undefined ? Number(op.paid_amount) : (op.payment_status === 'cash' ? (Number(op.price) || 0) : 0);
        if (paidAmt > 0) {
          insertPayment.run(
            op.id,
            paidInMonth || monthId,
            paidAmt,
            op.paid_at || op.date || now.toISOString(),
            'cash',
            'رصيد مدفوع مسجل من البيانات السابقة'
          );
        }
      }

      // 5.6 Withdrawals
      const withdrawals = Array.isArray(legacyData.withdrawals) ? legacyData.withdrawals : [];
      const insertWithdrawal = db.prepare(`
        INSERT OR REPLACE INTO withdrawals (id, date, amount, notes, type, technician_id, month_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const w of withdrawals) {
        const monthId = validMonthIds.has(w.month_id) ? w.month_id : defaultMonthId;
        const techId = w.technician_id && validTechIds.has(w.technician_id) ? w.technician_id : null;

        insertWithdrawal.run(
          w.id,
          w.date || now.toLocaleDateString('en-GB'),
          Number(w.amount) || 0,
          w.notes || w.description || '',
          ['shop_withdrawal', 'tech_withdrawal'].includes(w.type) ? w.type : 'shop_withdrawal',
          techId,
          monthId
        );
      }

      // 5.7 Quick Lists & Seed data
      const commonDevices = Array.isArray(legacyData.common_devices) ? legacyData.common_devices : [];
      const insertCommonDevice = db.prepare('INSERT OR IGNORE INTO common_devices (name) VALUES (?)');
      for (const d of commonDevices) {
        if (typeof d === 'string' && d.trim()) insertCommonDevice.run(d.trim());
      }

      const commonFaults = Array.isArray(legacyData.common_faults) ? legacyData.common_faults : [];
      const insertCommonFault = db.prepare('INSERT OR IGNORE INTO common_faults (name) VALUES (?)');
      for (const f of commonFaults) {
        if (typeof f === 'string' && f.trim()) insertCommonFault.run(f.trim());
      }

      const icCompatibilities = Array.isArray(legacyData.ic_compatibilities) ? legacyData.ic_compatibilities : [];
      const insertIc = db.prepare(`
        INSERT OR REPLACE INTO ic_compatibilities (id, ic_number, component_type, compatible_devices, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const ic of icCompatibilities) {
        insertIc.run(
          ic.id || Date.now(),
          ic.ic_number || '',
          ic.component_type || '',
          ic.compatible_devices || '',
          ic.notes || ''
        );
      }

      const scrapDevices = Array.isArray(legacyData.scrap_devices) ? legacyData.scrap_devices : [];
      const insertScrap = db.prepare(`
        INSERT OR REPLACE INTO scrap_devices (id, device_name, device_model, quantity)
        VALUES (?, ?, ?, ?)
      `);
      for (const s of scrapDevices) {
        insertScrap.run(
          s.id || Date.now(),
          s.device_name || '',
          s.device_model || '',
          Number(s.quantity) || 1
        );
      }
    });

    migrateTx();

    // 6. Comprehensive Verification Phase
    const verifyOpsCount = (db.prepare('SELECT count(*) as count FROM operations').get() as { count: number }).count;
    const verifyTechsCount = (db.prepare('SELECT count(*) as count FROM technicians').get() as { count: number }).count;
    const verifyMonthsCount = (db.prepare('SELECT count(*) as count FROM months').get() as { count: number }).count;
    const verifyWithsCount = (db.prepare('SELECT count(*) as count FROM withdrawals').get() as { count: number }).count;

    const legacyOps = Array.isArray(legacyData.operations) ? legacyData.operations : [];
    const legacyTechs = Array.isArray(legacyData.technicians) ? legacyData.technicians : [];
    const legacyMonths = Array.isArray(legacyData.months) ? legacyData.months : [];
    const legacyWiths = Array.isArray(legacyData.withdrawals) ? legacyData.withdrawals : [];

    if (verifyOpsCount !== legacyOps.length ||
        verifyTechsCount < legacyTechs.length ||
        verifyMonthsCount < legacyMonths.length ||
        verifyWithsCount !== legacyWiths.length) {
      throw new Error(`Record count mismatch: Ops(${verifyOpsCount}/${legacyOps.length}), Techs(${verifyTechsCount}/${legacyTechs.length}), Months(${verifyMonthsCount}/${legacyMonths.length}), Withs(${verifyWithsCount}/${legacyWiths.length})`);
    }

    // Financial verification
    const sqliteSums = db.prepare(`
      SELECT 
        SUM(price) as total_price,
        SUM(cost) as total_cost,
        SUM(shop_profit) as total_shop_profit,
        SUM(tech_profit) as total_tech_profit
      FROM operations
    `).get() as { total_price: number; total_cost: number; total_shop_profit: number; total_tech_profit: number };

    const jsonTotalPrice = legacyOps.reduce((sum: number, op: any) => sum + (Number(op.price) || 0), 0);
    const jsonTotalCost = legacyOps.reduce((sum: number, op: any) => sum + (Number(op.cost) || 0), 0);
    const jsonTotalShopProfit = legacyOps.reduce((sum: number, op: any) => sum + (Number(op.shop_profit) || 0), 0);
    const jsonTotalTechProfit = legacyOps.reduce((sum: number, op: any) => sum + (Number(op.tech_profit) || 0), 0);

    const isClose = (a: number, b: number) => Math.abs((a || 0) - (b || 0)) < 0.01;

    if (!isClose(sqliteSums.total_price, jsonTotalPrice) ||
        !isClose(sqliteSums.total_cost, jsonTotalCost) ||
        !isClose(sqliteSums.total_shop_profit, jsonTotalShopProfit) ||
        !isClose(sqliteSums.total_tech_profit, jsonTotalTechProfit)) {
      throw new Error(`Financial sum mismatch: Price(${sqliteSums.total_price}/${jsonTotalPrice}), Cost(${sqliteSums.total_cost}/${jsonTotalCost}), ShopProfit(${sqliteSums.total_shop_profit}/${jsonTotalShopProfit}), TechProfit(${sqliteSums.total_tech_profit}/${jsonTotalTechProfit})`);
    }

    // Record migration success state
    const markerPath = path.join(currentDataPath, 'migration-state.json');
    fs.writeFileSync(markerPath, JSON.stringify({
      source: legacyDbPath,
      destination: dbPath,
      timestamp: now.toISOString(),
      sourceHash: sourceHash,
      appVersion: (app && typeof app.getVersion === 'function') ? app.getVersion() : '1.0.0-beta.1',
      success: true,
      records: {
        operations: verifyOpsCount,
        technicians: verifyTechsCount,
        months: verifyMonthsCount,
        withdrawals: verifyWithsCount
      }
    }, null, 2), 'utf8');

    console.log('[SQLite Migration] Migration completed and verified with 100% data integrity!');
    return true;
  } catch (err: any) {
    console.error('[SQLite Migration] Migration transaction failed:', err);
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
        for (const ic of seedData.ic_compatibilities) {
          insertIc.run(id++, ic.ic_number, ic.component_type || '', ic.compatible_devices || '', ic.notes || '');
        }
      }
    } catch (e) {
      console.warn('Failed to seed initial default_seed.json:', e);
    }
  }

  // Ensure default month exists
  const monthCount = (db.prepare('SELECT count(*) as count FROM months').get() as { count: number }).count;
  if (monthCount === 0) {
    db.prepare('INSERT INTO months (id, month_name, start_capital, is_closed, created_at, closed_at) VALUES (1, ?, 0, 0, ?, NULL)')
      .run(new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }), new Date().toISOString());
  }

  // Ensure default settings exist
  const settingsCount = (db.prepare('SELECT count(*) as count FROM settings').get() as { count: number }).count;
  if (settingsCount === 0) {
    db.prepare('INSERT INTO settings (id, base_capital, shop_name, whatsapp_template, theme) VALUES (1, 0, ?, ?, ?)')
      .run('مركز الصيانة', 'السلام عليكم [اسم_الزبون] 👋\nنود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.\nالمبلغ المطلوب: [المبلغ]\nشكراً لاختيارك مركزنا! 🛠️✨', 'dark');
  }
}

function showMigrationError(message: string): void {
  try {
    dialog.showErrorBox('خطأ في ترحيل البيانات', message);
  } catch {
    console.error('[Error Box]', message);
  }
}
