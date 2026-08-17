import path from 'path';
import { app, dialog } from 'electron';
import fs from 'fs';
import { findLatestValidBackup, getCanonicalDatabaseHash } from './backup.js';

const isDev = !app.isPackaged;
export const userDataPath = isDev
  ? app.getAppPath()
  : path.join(app.getPath('appData'), 'maintenance_app');

const dbPath = path.join(userDataPath, 'database.json');

class SimpleDB {
  data: any = {
    settings: { 
      id: 1, 
      base_capital: 0, 
      shop_name: 'مركز الصيانة',
      whatsapp_template: 'السلام عليكم [اسم_الزبون] 👋\nنود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.\nالمبلغ المطلوب: [المبلغ]\nشكراً لاختيارك مركزنا! 🛠️✨',
      theme: 'dark'
    },
    months: [],
    technicians: [],
    operations: [],
    withdrawals: [],
    ic_compatibilities: [],
    scrap_devices: [],
    common_devices: [],
    common_faults: [],
    customers: []
  };

  constructor() {}

  load() {
    if (fs.existsSync(dbPath)) {
      try {
        this.data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        if (!this.isUsableDatabasePayload(this.data)) throw new Error('DATABASE_INVALID_SCHEMA');
      } catch {
        this.recoverFromCorruptDatabase();
      }

      const initialHash = getCanonicalDatabaseHash(this.data);
      if (!this.data.months) this.data.months = [];
      if (this.data.months.length === 0) {
        this.data.months.push({
          id: 1,
          month_name: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
          start_capital: this.data.settings.base_capital || 0,
          is_closed: false,
          created_at: new Date().toISOString(),
          closed_at: null
        });
      }

      if (!this.data.settings.whatsapp_template) {
        this.data.settings.whatsapp_template = 'السلام عليكم [اسم_الزبون] 👋\nنود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.\nالمبلغ المطلوب: [المبلغ]\nشكراً لاختيارك مركزنا! 🛠️✨';
      }
      if (!this.data.settings.theme) this.data.settings.theme = 'dark';

      const currentMonthId = this.getCurrentMonth().id;
      if (this.data.operations) {
        this.data.operations.forEach((op: any) => {
          if (!op.payment_status) op.payment_status = 'cash';
          if (!op.month_id) op.month_id = currentMonthId;
          if (op.faults === undefined && typeof op.device === 'string' && op.device.includes(' - ')) {
            const parts = op.device.split(' - ');
            op.device = parts[0].trim();
            op.faults = [parts.slice(1).join(' - ').trim()];
          } else if (op.faults === undefined) op.faults = [];
          if (!op.status) op.status = 'delivered';

          if (!this.data.customers) this.data.customers = [];
          if (op.customer_name) {
            const existing = this.data.customers.find((c: any) =>
              c.name === op.customer_name || (c.phone && c.phone === op.customer_phone)
            );
            if (!existing) {
              const newCustomer = {
                id: Date.now() + Math.floor(Math.random() * 10000),
                name: op.customer_name,
                phone: op.customer_phone || '',
                notes: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              this.data.customers.push(newCustomer);
              op.customer_id = newCustomer.id;
            } else if (!op.customer_id) op.customer_id = existing.id;
          }
        });
      }
      if (this.data.withdrawals) {
        this.data.withdrawals.forEach((w: any) => {
          if (!w.month_id) w.month_id = currentMonthId;
        });
      }
      if (this.data.technicians) {
        this.data.technicians.forEach((t: any) => {
          if (t.start_balance === undefined) t.start_balance = 0;
          if (t.is_active === undefined) t.is_active = true;
        });
      }
      if (!this.data.ic_compatibilities) this.data.ic_compatibilities = [];
      if (!this.data.scrap_devices) this.data.scrap_devices = [];
      if (!this.data.common_devices) this.data.common_devices = [];
      if (!this.data.common_faults) this.data.common_faults = [];
      if (!this.data.customers) this.data.customers = [];

      const seedPath = path.join(app.getAppPath(), 'default_seed.json');
      if (fs.existsSync(seedPath)) {
        try {
          const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
          if (seedData.common_devices) {
            const existingDevices = new Set(this.data.common_devices.map((d: string) => d.toLowerCase()));
            for (const d of seedData.common_devices) {
              if (!existingDevices.has(d.toLowerCase())) {
                this.data.common_devices.push(d);
                existingDevices.add(d.toLowerCase());
              }
            }
          }
          if (seedData.ic_compatibilities) {
            const seenIcs = new Set(this.data.ic_compatibilities.map((ic: any) =>
              `${ic.ic_number}-${ic.component_type}-${ic.compatible_devices}`.toLowerCase()
            ));
            let nextId = Date.now();
            for (const seedIC of seedData.ic_compatibilities) {
              const key = `${seedIC.ic_number}-${seedIC.component_type}-${seedIC.compatible_devices}`.toLowerCase();
              if (!seenIcs.has(key)) {
                seedIC.id = nextId++;
                this.data.ic_compatibilities.push(seedIC);
                seenIcs.add(key);
              }
            }
          }
        } catch (e) {
          console.error('Failed to merge default_seed.json', e);
        }
      }
      if (getCanonicalDatabaseHash(this.data) !== initialHash) this.save();
    } else {
      const seedPath = path.join(app.getAppPath(), 'default_seed.json');
      if (fs.existsSync(seedPath)) {
        try {
          this.data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        } catch (e) {
          console.error('Failed to parse default_seed.json', e);
        }
      }
      this.data.months = [{
        id: 1,
        month_name: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
        start_capital: this.data.settings?.base_capital || 0,
        is_closed: false,
        created_at: new Date().toISOString(),
        closed_at: null
      }];
      this.save();
    }
  }

  private isUsableDatabasePayload(data: any): boolean {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) return false;
    const collectionFields = [
      'months', 'technicians', 'operations', 'withdrawals',
      'ic_compatibilities', 'scrap_devices', 'common_devices', 'common_faults', 'customers'
    ];
    return collectionFields.every(field => data[field] === undefined || Array.isArray(data[field]));
  }

  private recoverFromCorruptDatabase() {
    const diagnosticPath = this.preserveCorruptDatabase();
    const currentDataPath = process.env.TEST_USER_DATA || userDataPath;
    const recovery = findLatestValidBackup([
      path.join(path.dirname(dbPath), 'backups_v2'),
      path.join(currentDataPath, 'backups_v2')
    ]);
    if (recovery) {
      this.data = recovery.data;
      const saved = this.save();
      if (saved) {
        this.showRecoveryMessage('تم اكتشاف تلف في قاعدة البيانات واستعادة آخر نسخة احتياطية صالحة تلقائيًا.', diagnosticPath, path.basename(recovery.sourcePath));
        return;
      }
      this.showRecoveryMessage('تم اكتشاف تلف في قاعدة البيانات. وُجدت نسخة احتياطية صالحة لكن تعذر حفظ الاستعادة على القرص؛ تم فتحها مؤقتًا في الذاكرة.', diagnosticPath, path.basename(recovery.sourcePath));
      return;
    }
    this.data = this.createSafeRecoveryData();
    const saved = this.save();
    this.showRecoveryMessage(
      saved ? 'تم اكتشاف تلف في قاعدة البيانات ولم توجد نسخة احتياطية صالحة. بدأ التطبيق ببيانات آمنة جديدة.' : 'تم اكتشاف تلف في قاعدة البيانات ولم توجد نسخة احتياطية صالحة. تعذر أيضًا إنشاء قاعدة بيانات بديلة على القرص.',
      diagnosticPath
    );
  }

  private preserveCorruptDatabase(): string | null {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const diagnosticPath = `${dbPath}.corrupt-${timestamp}`;
    try {
      fs.copyFileSync(dbPath, diagnosticPath, fs.constants.COPYFILE_EXCL);
      return diagnosticPath;
    } catch (error) {
      console.error('Failed to preserve corrupt database for diagnostics', error);
      return null;
    }
  }

  private createSafeRecoveryData() {
    const seedPath = path.join(app.getAppPath(), 'default_seed.json');
    if (fs.existsSync(seedPath)) {
      try {
        return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      } catch (error) {
        console.error('Failed to parse default seed during database recovery', error);
      }
    }
    return {
      settings: { id: 1, base_capital: 0, shop_name: 'مركز الصيانة', theme: 'dark' },
      months: [], technicians: [], operations: [], withdrawals: [],
      ic_compatibilities: [], scrap_devices: [], common_devices: [], common_faults: []
    };
  }

  private showRecoveryMessage(message: string, diagnosticPath: string | null, backupName?: string) {
    const details = [
      diagnosticPath ? `حُفظت نسخة تشخيصية: ${path.basename(diagnosticPath)}` : 'تعذر حفظ نسخة تشخيصية من الملف التالف.',
      backupName ? `النسخة المستخدمة: ${backupName}` : ''
    ].filter(Boolean).join('\n');
    console.error('[Database Recovery]', message, details);
    dialog.showErrorBox('استعادة قاعدة البيانات', `${message}\n\n${details}`);
  }

  save(): boolean {
    const tmpPath = dbPath + '.tmp';
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmpPath, dbPath);
      return true;
    } catch (err) {
      console.error('Failed to save database atomically', err);
      return false;
    }
  }

  getCurrentMonth() {
    const months = Array.isArray(this.data.months) ? this.data.months : [];
    return [...months].reverse().find((m: any) => !m.is_closed) || months[months.length - 1];
  }
}

export const db = new SimpleDB();

export function initDB() {
  db.load();
}
