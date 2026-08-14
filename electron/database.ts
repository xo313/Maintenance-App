import path from 'path';
import { app } from 'electron';
import fs from 'fs';

const isDev = !app.isPackaged;
const dbPath = isDev 
  ? path.join(app.getAppPath(), 'database.json')
  : path.join(app.getPath('userData'), 'database.json');

class SimpleDB {
  data: any = {
    settings: { id: 1, base_capital: 0, shop_name: 'مركز الصيانة' },
    months: [], // { id, month_name, start_capital, is_closed, created_at, closed_at }
    technicians: [],
    operations: [], // Added: payment_status, month_id
    withdrawals: [] // Added: month_id
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
      this.save();
    } else {
      // First time init
      this.data.months = [{
        id: 1,
        month_name: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
        start_capital: 0,
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
