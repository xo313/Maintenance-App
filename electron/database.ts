import path from 'path';
import { app } from 'electron';
import fs from 'fs';

const isDev = !app.isPackaged;
const dbPath = isDev 
  ? path.join(app.getAppPath(), 'database.json')
  : path.join(app.getPath('userData'), 'database.json');

class SimpleDB {
  data: any = {
    settings: { 
      id: 1, 
      base_capital: 0, 
      shop_name: 'مركز الصيانة',
      whatsapp_template: 'السلام عليكم [اسم_الزبون] 👋\nنود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.\nالمبلغ المطلوب: [المبلغ] دينار.\nشكراً لاختيارك مركزنا! 🛠️✨',
      theme: 'dark'
    },
    months: [], // { id, month_name, start_capital, is_closed, created_at, closed_at }
    technicians: [],
    operations: [], // Added: payment_status, month_id
    withdrawals: [], // Added: month_id
    ic_compatibilities: [],
    scrap_devices: [],
    common_devices: [],
    common_faults: []
  };

  constructor() {
    this.load();
  }

  load() {
    if (fs.existsSync(dbPath)) {
      this.data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      
      // Migration: Ensure existing data has month_id and payment_status
      if (!this.data.months) this.data.months = [];
      
      // Ensure at least one open month exists
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
      
      // Ensure settings have new fields
      if (!this.data.settings.whatsapp_template) {
        this.data.settings.whatsapp_template = 'السلام عليكم [اسم_الزبون] 👋\nنود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.\nالمبلغ المطلوب: [المبلغ] دينار.\nشكراً لاختيارك مركزنا! 🛠️✨';
      }
      if (!this.data.settings.theme) {
        this.data.settings.theme = 'dark';
      }

      const currentMonthId = this.getCurrentMonth().id;

      if (this.data.operations) {
        this.data.operations.forEach((op: any) => {
          if (!op.payment_status) op.payment_status = 'cash';
          if (!op.month_id) op.month_id = currentMonthId;
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
      if (!this.data.ic_compatibilities) {
        this.data.ic_compatibilities = [];
      }
      if (!this.data.scrap_devices) {
        this.data.scrap_devices = [];
      }
      if (!this.data.common_devices) {
        this.data.common_devices = [];
      }
      if (!this.data.common_faults) {
        this.data.common_faults = [];
      }
      
      // Auto-merge new seed data for existing users
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
          console.error("Failed to merge default_seed.json", e);
        }
      }

      this.save();
    } else {
      // First time init
      const seedPath = path.join(app.getAppPath(), 'default_seed.json');
      if (fs.existsSync(seedPath)) {
        try {
          this.data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        } catch (e) {
          console.error("Failed to parse default_seed.json", e);
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

  save() {
    const tmpPath = dbPath + '.tmp';
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmpPath, dbPath);
    } catch (err) {
      console.error('Failed to save database atomically', err);
      // Fallback
      fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2));
    }
  }

  getCurrentMonth() {
    return this.data.months.find((m: any) => !m.is_closed) || this.data.months[this.data.months.length - 1];
  }
}

export const db = new SimpleDB();

export function initDB() {
  db.load();
}
