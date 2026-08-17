import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import * as xlsx from 'xlsx';
import { db, initDB } from './database.js';
import type { Operation, Withdrawal, Technician } from '../src/types';
import { createBackup, listBackups, readBackup, getCanonicalDatabaseHash } from './backup.js';
import { runAutomaticMigration } from './migration.js';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#f8fafc',
    },
    autoHideMenuBar: true
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.maximize();

  // Run automatic migration from legacy paths if necessary
  const migrationSuccess = runAutomaticMigration();
  if (!migrationSuccess) {
    console.error('Migration failed. Halting application startup to prevent data loss.');
    app.quit();
    return;
  }

  initDB();
  setupIPC();

  // Run daily backup check on startup and every hour
  createBackup(db.data, false);
  setInterval(() => createBackup(db.data, false), 1000 * 60 * 60);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function getCurrentMonth() {
  const m = db.data.months[db.data.months.length - 1];
  if (!m) {
    const nextMonthName = new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    db.data.months.push({ 
      id: 1, 
      start_capital: 0, 
      month_name: nextMonthName,
      is_closed: false,
      created_at: new Date().toISOString(),
      closed_at: null
    });
    db.save();
    return db.data.months[0];
  }
  return m;
}

function generateMonthId() {
  if (!db.data.months || db.data.months.length === 0) return 1;
  return Math.max(...db.data.months.map((m: any) => m.id)) + 1;
}

// Old autoBackupDaily logic replaced by centralized backup service

function setupIPC() {
  const getCurrentMonth = () => db.getCurrentMonth();

  ipcMain.handle('get-settings', () => {
    return db.data.settings;
  });

  ipcMain.handle('update-settings', (_, settings) => {
    const oldSettings = { ...db.data.settings };
    db.data.settings = { ...db.data.settings, ...settings };
    if (!db.save()) {
      db.data.settings = oldSettings;
      db.load();
      return { success: false, reason: 'DATABASE_SAVE_FAILED' };
    }
    return { success: true };
  });

  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });

  // Technicians
  ipcMain.handle('get-technicians', () => {
    return db.data.technicians.filter((t: any) => t.is_active !== false);
  });

  ipcMain.handle('add-technician', (_, name, profit_percentage) => {
    const newId = Date.now();
    const newTech = { id: newId, name, profit_percentage: Math.max(0, profit_percentage), is_active: true };
    db.data.technicians.push(newTech);
    if (!db.save()) {
      db.data.technicians.pop();
      db.load();
      return { success: false, reason: 'DATABASE_SAVE_FAILED' };
    }
    return { success: true };
  });

  ipcMain.handle('edit-technician', (_, id, name, profit_percentage) => {
    const tech = db.data.technicians.find((t: any) => t.id === id);
    if (tech) {
      const oldName = tech.name;
      const oldProfit = tech.profit_percentage;
      tech.name = name;
      tech.profit_percentage = Math.max(0, profit_percentage);
      if (!db.save()) {
        tech.name = oldName;
        tech.profit_percentage = oldProfit;
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  ipcMain.handle('delete-technician', (_, id) => {
    const tech = db.data.technicians.find((t: any) => t.id === id);
    if (tech) {
      const oldActive = tech.is_active;
      tech.is_active = false;
      if (!db.save()) {
        tech.is_active = oldActive;
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  function calculateProfits(price: number, cost: number, techPercentage: number) {
    const netProfit = Math.max(0, price - cost);
    const techProfit = Number((netProfit * techPercentage).toFixed(2));
    const shopProfit = Number((netProfit - techProfit).toFixed(2));
    return { techProfit, shopProfit };
  }

  // Operations
  ipcMain.handle('get-operations', () => {
    return db.data.operations
      .filter((op: any) => op.month_id === getCurrentMonth().id)
      .map((op: any) => {
        const tech = db.data.technicians.find((t: any) => t.id === op.technician_id);
        return { ...op, technician_name: tech ? tech.name : 'Unknown' };
      }).reverse();
  });

  ipcMain.handle('get-all-operations', () => {
    return db.data.operations.map((op: any) => {
      const tech = db.data.technicians.find((t: any) => t.id === op.technician_id);
      return { ...op, technician_name: tech ? tech.name : 'Unknown' };
    }).reverse();
  });

  ipcMain.handle('add-operation', (_, op) => {
    const newId = Date.now(); // Prevents ID conflicts
    
    // Validate Technician
    const techExists = db.data.technicians.find((t: any) => t.id === op.technician_id);
    if (!techExists) {
      return { success: false, reason: 'UNKNOWN_TECHNICIAN' };
    }

    // Strict Validation
    op.price = Number(op.price) || 0;
    op.cost = Number(op.cost) || 0;
    if (op.price < 0) op.price = 0;
    if (op.cost < 0) op.cost = 0;
    
    // Validate enums
    if (!['under_maintenance', 'completed', 'delivered'].includes(op.status)) {
      op.status = 'under_maintenance';
    }
    if (!['cash', 'debt'].includes(op.payment_status)) {
      op.payment_status = 'cash';
    }
    // Calculate profits backend-side
    const techPercentage = Number(techExists.profit_percentage) || 0;
    const { techProfit, shopProfit } = calculateProfits(op.price, op.cost, techPercentage);
    
    const newOp = {
      id: newId,
      date: new Date().toLocaleDateString('en-GB'),
      month_id: getCurrentMonth().id,
      ...op,
      tech_profit_percentage: techPercentage,
      tech_profit: techProfit,
      shop_profit: shopProfit
    };
    db.data.operations.push(newOp);
    
    if (!db.save()) {
      db.data.operations.pop();
      db.load();
      return { success: false, reason: 'DATABASE_SAVE_FAILED' };
    }
    return { success: true };
  });

  ipcMain.handle('edit-operation', (_, opId, updatedOp) => {
    const idx = db.data.operations.findIndex((o:any) => o.id === opId);
    if (idx !== -1) {
      // Prevent retroactive edits
      if (db.data.operations[idx].month_id !== getCurrentMonth().id) {
        return { success: false, reason: 'CANNOT_EDIT_PAST_MONTH' };
      }
      
      // Validate Technician
      if (updatedOp.technician_id) {
        const techExists = db.data.technicians.find((t: any) => t.id === updatedOp.technician_id);
        if (!techExists) {
          return { success: false, reason: 'UNKNOWN_TECHNICIAN' };
        }
      }

      // Strict Validation
      updatedOp.price = Number(updatedOp.price) || 0;
      updatedOp.cost = Number(updatedOp.cost) || 0;
      if (updatedOp.price < 0) updatedOp.price = 0;
      if (updatedOp.cost < 0) updatedOp.cost = 0;
      
      if (updatedOp.status && !['under_maintenance', 'completed', 'delivered'].includes(updatedOp.status)) {
        updatedOp.status = 'under_maintenance';
      }
      if (updatedOp.payment_status && !['cash', 'debt'].includes(updatedOp.payment_status)) {
        updatedOp.payment_status = 'cash';
      }
      
      const oldOp = { ...db.data.operations[idx] };
      // Protect immutable fields from being overwritten by spread
      delete updatedOp.id;
      delete updatedOp.month_id;
      delete updatedOp.created_at;
      delete updatedOp.paid_in_month_id;
      delete updatedOp.paid_at;
      
      // Do not trust profit values from frontend
      delete updatedOp.shop_profit;
      delete updatedOp.tech_profit;
      delete updatedOp.tech_profit_percentage;

      if (updatedOp.technician_id !== undefined && updatedOp.technician_id !== oldOp.technician_id) {
        return { success: false, reason: 'TECHNICIAN_CHANGE_NOT_ALLOWED' };
      }

      let isFinancialEdit = false;

      if (updatedOp.price !== undefined && updatedOp.price !== oldOp.price) isFinancialEdit = true;
      if (updatedOp.cost !== undefined && updatedOp.cost !== oldOp.cost) isFinancialEdit = true;

      const mergedOp = { ...oldOp, ...updatedOp };

      if (isFinancialEdit) {
        let techPercentageToUse = oldOp.tech_profit_percentage;

        if (techPercentageToUse === undefined) {
           const techExists = db.data.technicians.find((t: any) => t.id === mergedOp.technician_id);
           techPercentageToUse = Number(techExists?.profit_percentage) || 0;
           mergedOp.tech_profit_percentage = techPercentageToUse;
        }

        const { techProfit, shopProfit } = calculateProfits(mergedOp.price, mergedOp.cost, techPercentageToUse);
        mergedOp.tech_profit = techProfit;
        mergedOp.shop_profit = shopProfit;
      }

      db.data.operations[idx] = mergedOp;
      if (!db.save()) {
        db.data.operations[idx] = oldOp;
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  ipcMain.handle('delete-operation', (_, opId) => {
    const idx = db.data.operations.findIndex((o: any) => o.id === opId);
    if (idx !== -1) {
      // Prevent retroactive deletion
      if (db.data.operations[idx].month_id !== getCurrentMonth().id) {
        return { success: false, reason: 'CANNOT_DELETE_PAST_MONTH' };
      }
      const removed = db.data.operations[idx];
      db.data.operations.splice(idx, 1);
      if (!db.save()) {
        db.data.operations.splice(idx, 0, removed);
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  // Debts
  ipcMain.handle('get-debts', () => {
    return db.data.operations
      .filter((op: any) => op.payment_status === 'debt')
      .map((op: any) => {
        const tech = db.data.technicians.find((t: any) => t.id === op.technician_id);
        return { ...op, technician_name: tech ? tech.name : 'Unknown' };
      }).reverse();
  });

  ipcMain.handle('pay-debt', (_, operation_id) => {
    const op = db.data.operations.find((o: any) => o.id === operation_id);
    if (op) {
      if (op.payment_status !== 'debt') {
        return { success: false, reason: 'DEBT_ALREADY_PAID' };
      }
      
      const oldStatus = op.payment_status;
      const oldPaidInMonth = op.paid_in_month_id;
      const oldPaidAt = op.paid_at;

      op.payment_status = 'cash';
      op.paid_in_month_id = getCurrentMonth().id;
      op.paid_at = new Date().toISOString();
      
      if (!db.save()) {
        op.payment_status = oldStatus;
        op.paid_in_month_id = oldPaidInMonth;
        op.paid_at = oldPaidAt;
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  // Withdrawals
  ipcMain.handle('get-withdrawals', () => {
    return db.data.withdrawals.map((w: any) => {
      const tech = db.data.technicians.find((t: any) => t.id === w.technician_id);
      return { ...w, technician_name: tech ? tech.name : null };
    }).reverse();
  });

  ipcMain.handle('add-withdrawal', (_, w) => {
    const newId = Date.now();
    
    // Sanitize and Validate
    if (typeof w.amount !== 'number' || !Number.isFinite(w.amount)) {
      w.amount = Number(w.amount) || 0;
    }
    if (w.amount < 0) w.amount = 0;
    
    if (!['shop_withdrawal', 'tech_withdrawal'].includes(w.type)) {
      w.type = 'shop_withdrawal';
    }

    if (w.type === 'tech_withdrawal') {
      const techExists = db.data.technicians.find((t: any) => t.id === w.technician_id);
      if (!techExists) {
        return { success: false, reason: 'UNKNOWN_TECHNICIAN' };
      }
    }
    
    const newWithdrawal = {
      id: newId,
      date: new Date().toLocaleDateString('en-GB'),
      month_id: getCurrentMonth().id,
      ...w
    };
    db.data.withdrawals.push(newWithdrawal);
    if (!db.save()) {
      db.data.withdrawals.pop();
      db.load();
      return { success: false, reason: 'DATABASE_SAVE_FAILED' };
    }
    return { success: true };
  });

  ipcMain.handle('edit-withdrawal', (_, id, updatedW) => {
    const idx = db.data.withdrawals.findIndex((w: any) => w.id === id);
    if (idx !== -1) {
      if (db.data.withdrawals[idx].month_id !== getCurrentMonth().id) {
        return { success: false, reason: 'CANNOT_EDIT_PAST_MONTH' };
      }
      
      if (typeof updatedW.amount !== 'undefined') {
        updatedW.amount = Math.max(0, Number(updatedW.amount) || 0);
      }
      
      const oldW = { ...db.data.withdrawals[idx] };
      delete updatedW.id;
      delete updatedW.month_id;
      delete updatedW.date;
      
      db.data.withdrawals[idx] = { ...oldW, ...updatedW };
      
      if (!db.save()) {
        db.data.withdrawals[idx] = oldW;
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  ipcMain.handle('delete-withdrawal', (_, id) => {
    const idx = db.data.withdrawals.findIndex((w: any) => w.id === id);
    if (idx !== -1) {
      if (db.data.withdrawals[idx].month_id !== getCurrentMonth().id) {
        return { success: false, reason: 'CANNOT_DELETE_PAST_MONTH' };
      }
      const removed = db.data.withdrawals[idx];
      db.data.withdrawals.splice(idx, 1);
      if (!db.save()) {
        db.data.withdrawals.splice(idx, 0, removed);
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  // Dashboard Stats
  ipcMain.handle('get-dashboard-stats', () => {
    const currentMonth = getCurrentMonth();

    // Profit of the current month
    const currentMonthOps = db.data.operations.filter((op: any) => op.month_id === currentMonth.id);
    const deliveredOps = currentMonthOps.filter((op: any) => op.status === 'delivered');

    // Total profit ONLY for delivered operations
    const totalProfit = deliveredOps.reduce((sum: number, op: any) => sum + ((op.price || 0) - (op.cost || 0)), 0);

    // Realized vs Unrealized
    const cashOps = deliveredOps.filter((op: any) => op.payment_status === 'cash' && !op.paid_in_month_id);
    const paidDebts = db.data.operations.filter((op: any) => op.paid_in_month_id === currentMonth.id && op.status === 'delivered');
    const unpaidDebts = deliveredOps.filter((op: any) => op.payment_status === 'debt');

    const totalCashReceived = cashOps.reduce((sum: number, op: any) => sum + (op.price || 0), 0) +
      paidDebts.reduce((sum: number, op: any) => sum + (op.price || 0), 0);

    // Cost of ALL operations created this month is deducted from the drawer (as parts are bought with cash)
    const totalOpsCost = currentMonthOps.reduce((sum: number, op: any) => sum + (op.cost || 0), 0);

    // Withdrawals (ALL withdrawals in the current month)
    const currentMonthWithdrawals = db.data.withdrawals.filter((w: any) => w.month_id === currentMonth.id);
    const totalWithdrawals = currentMonthWithdrawals.reduce((sum: number, w: any) => sum + (w.amount || 0), 0);

    // EXACT EQUATIONS FROM USER:
    // 1. cashBox = start_capital + totalCashReceived - totalOpsCost - totalWithdrawals
    const cashBox = currentMonth.start_capital + totalCashReceived - totalOpsCost - totalWithdrawals;

    // 3. debtTotal = unpaidDebts.reduce(sum of prices)
    const debtTotal = unpaidDebts.reduce((sum: number, op: any) => sum + (op.price || 0), 0);

    return {
      cashBox,
      totalProfit,
      debtTotal,
      totalWithdrawals,
      // For compatibility if modal still uses them:
      baseCapital: currentMonth.start_capital,
      tiedCapital: unpaidDebts.reduce((sum: number, op: any) => sum + (op.cost || 0), 0),
      availableCapital: currentMonth.start_capital - unpaidDebts.reduce((sum: number, op: any) => sum + (op.cost || 0), 0),
      realizedShopProfit: cashOps.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0) + paidDebts.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0),
      totalShopWithdrawal: currentMonthWithdrawals.filter((w: any) => w.type === 'shop_withdrawal').reduce((sum: number, w: any) => sum + (w.amount || 0), 0),
      shopDue: (currentMonth.start_capital - unpaidDebts.reduce((sum: number, op: any) => sum + (op.cost || 0), 0)) + deliveredOps.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0)
    };
  });

  // Technician Stats
  ipcMain.handle('get-technician-stats', () => {
    const currentMonth = getCurrentMonth();

    return db.data.technicians
      .map((tech: any) => {
        const techOpsThisMonth = db.data.operations.filter((op: any) => op.technician_id === tech.id && op.month_id === currentMonth.id);
        const totalCost = techOpsThisMonth.reduce((sum: number, op: any) => sum + (op.cost || 0), 0);

        const cashOps = techOpsThisMonth.filter((op: any) => op.payment_status === 'cash' && !op.paid_in_month_id);
        const paidDebts = db.data.operations.filter((op: any) => op.technician_id === tech.id && op.paid_in_month_id === currentMonth.id);

        const realizedProfit = cashOps.reduce((sum: number, op: any) => sum + (op.tech_profit || 0), 0) +
          paidDebts.reduce((sum: number, op: any) => sum + (op.tech_profit || 0), 0);

        const unpaidDebts = db.data.operations.filter((op: any) => op.technician_id === tech.id && op.payment_status === 'debt');
        const unrealizedProfit = unpaidDebts.reduce((sum: number, op: any) => sum + (op.tech_profit || 0), 0);

        const techWithdrawal = db.data.withdrawals
          .filter((w: any) => w.type === 'tech_withdrawal' && w.technician_id === tech.id && w.month_id === currentMonth.id)
          .reduce((sum: number, w: any) => sum + (w.amount || 0), 0);

        return {
          id: tech.id,
          name: tech.name,
          profit_percentage: tech.profit_percentage,
          is_active: tech.is_active,
          totalCost,
          totalProfit: realizedProfit,
          unrealizedProfit: unrealizedProfit,
          totalWithdrawal: techWithdrawal,
          remainingBalance: realizedProfit - techWithdrawal
        };
      });
  });

  // IC Compatibilities
  ipcMain.handle('get-ic-compatibilities', () => {
    return db.data.ic_compatibilities || [];
  });

  ipcMain.handle('add-ic-compatibility', (_, ic) => {
    const newIc = { ...ic, id: Date.now() };
    if (!db.data.ic_compatibilities) db.data.ic_compatibilities = [];
    db.data.ic_compatibilities.unshift(newIc);
    if (!db.save()) {
      db.data.ic_compatibilities.shift();
      db.load();
      return { success: false, reason: 'DATABASE_SAVE_FAILED' };
    }
    return { success: true };
  });

  ipcMain.handle('edit-ic-compatibility', (_, id, ic) => {
    const idx = db.data.ic_compatibilities.findIndex((i: any) => i.id === id);
    if (idx !== -1) {
      const oldIc = { ...db.data.ic_compatibilities[idx] };
      db.data.ic_compatibilities[idx] = { ...oldIc, ...ic };
      if (!db.save()) {
        db.data.ic_compatibilities[idx] = oldIc;
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  ipcMain.handle('delete-ic-compatibility', (_, id) => {
    const idx = db.data.ic_compatibilities.findIndex((i: any) => i.id === id);
    if (idx !== -1) {
      const removed = db.data.ic_compatibilities[idx];
      db.data.ic_compatibilities.splice(idx, 1);
      if (!db.save()) {
        db.data.ic_compatibilities.splice(idx, 0, removed);
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  ipcMain.handle('import-operations-excel-data', async (_, data: any[]) => {
    try {
      let added = 0;
      let ignored = 0;
      const currentMonth = getCurrentMonth();
      let currentTimestamp = Date.now();

      for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length < 3) continue;

        const date = row[0] ? String(row[0]).trim() : new Date().toLocaleDateString('en-GB');
        const opId = row[1] ? Number(row[1]) : null;
        const customerName = String(row[2] || '').trim();
        const device = String(row[3] || '').trim();

        const techName = String(row[10] || '').trim();
        let tech = db.data.technicians.find((t: any) => t.name === techName);
        if (!tech) {
          ignored++;
          continue; // P0-5: reject unknown technician
        }
        let techId = tech.id;

        const isDuplicate = db.data.operations.some((op: any) =>
          (opId && op.id === opId) ||
          (op.customer_name === customerName && op.device === device && op.date === date)
        );

        if (isDuplicate) {
          ignored++;
          continue;
        }

        const safeId = (opId && !db.data.operations.some((o:any)=>o.id === opId)) ? opId : currentTimestamp++;

        db.data.operations.push({
          id: safeId,
          date: date,
          month_id: currentMonth.id,
          customer_name: customerName,
          device: device,
          status: 'delivered', // Added default status
          payment_status: String(row[4]).includes('دين') ? 'debt' : 'cash',
          cost: Math.max(0, Number(row[5]) || 0),
          price: Math.max(0, Number(row[6]) || 0),
          shop_profit: Math.max(0, Number(row[8]) || 0),
          tech_profit: Math.max(0, Number(row[9]) || 0),
          technician_id: techId
        });
        added++;
      }

      if (added > 0) {
        if (!db.save()) {
          db.data.operations = db.data.operations.slice(0, db.data.operations.length - added);
          db.load();
          return { success: false, reason: 'DATABASE_SAVE_FAILED' };
        }
      }
      return { success: true, added, ignored };
    } catch (err: any) {
      return { success: false, reason: 'error', message: err.message };
    }
  });
  ipcMain.handle('import-operations-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'استيراد ملف إكسل للعمليات',
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, reason: 'cancelled' };
    }

    try {
      const workbook = xlsx.readFile(filePaths[0]);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      let added = 0;
      let ignored = 0;
      const currentMonth = getCurrentMonth();
      let currentTimestamp = Date.now();

      for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length < 3) continue;

        const date = row[0] ? String(row[0]).trim() : new Date().toLocaleDateString('en-GB');
        const opId = row[1] ? Number(row[1]) : null;
        const customerName = String(row[2] || '').trim();
        const device = String(row[3] || '').trim();

        const techName = String(row[10] || '').trim();
        let tech = db.data.technicians.find((t: any) => t.name === techName);
        if (!tech) {
          ignored++;
          continue; // P0-5: reject unknown technician
        }
        let techId = tech.id;

        const isDuplicate = db.data.operations.some((op: any) =>
          (opId && op.id === opId) ||
          (op.customer_name === customerName && op.device === device && op.date === date)
        );

        if (isDuplicate) {
          ignored++;
          continue;
        }

        const safeId = (opId && !db.data.operations.some((o:any)=>o.id === opId)) ? opId : currentTimestamp++;

        db.data.operations.push({
          id: safeId,
          date: date,
          month_id: currentMonth.id,
          customer_name: customerName,
          device: device,
          status: 'delivered', // Added default status
          payment_status: String(row[4]).includes('دين') ? 'debt' : 'cash',
          cost: Math.max(0, Number(row[5]) || 0),
          price: Math.max(0, Number(row[6]) || 0),
          shop_profit: Math.max(0, Number(row[8]) || 0),
          tech_profit: Math.max(0, Number(row[9]) || 0),
          technician_id: techId
        });
        added++;
      }

      if (added > 0) {
        if (!db.save()) {
          db.data.operations = db.data.operations.slice(0, db.data.operations.length - added);
          db.load();
          return { success: false, reason: 'DATABASE_SAVE_FAILED' };
        }
      }
      return { success: true, added, ignored };
    } catch (err: any) {
      return { success: false, reason: 'error', message: err.message };
    }
  });


  ipcMain.handle('import-ic-excel-data', async (_, data: any[]) => {
    try {
      let added = 0;
      let updated = 0;
      let ignored = 0;
      if (!db.data.ic_compatibilities) db.data.ic_compatibilities = [];
      const previousCompatibilities = JSON.parse(JSON.stringify(db.data.ic_compatibilities));
      let maxId = db.data.ic_compatibilities.reduce((max: number, ic: any) => Math.max(max, ic.id), 0);

      // Process rows: assume standard Category, IC, Devices format
      // Skip header row
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length < 2) continue;

        const category = row[0] ? String(row[0]).trim() : 'General';
        const icCode = String(row[1]).trim();
        const devicesStr = row[2] ? String(row[2]).trim() : '';

        if (!icCode) continue;

        const existingIdx = db.data.ic_compatibilities.findIndex((ic: any) => String(ic.ic_number || '').toLowerCase() === icCode.toLowerCase());

        if (existingIdx !== -1) {
          const existingDevices = String(db.data.ic_compatibilities[existingIdx].compatible_devices || '').split(/[,=]/).map((d: string) => d.trim()).filter(Boolean);
          const newDevices = String(devicesStr || '').split(/[,=]/).map((d: string) => d.trim()).filter(Boolean);

          const deviceMap = new Map<string, string>();
          [...existingDevices, ...newDevices].forEach(d => {
            deviceMap.set(d.toLowerCase(), d);
          });
          const uniqueDevices = Array.from(deviceMap.values());

          if (uniqueDevices.length > existingDevices.length) {
            // New devices were found
            db.data.ic_compatibilities[existingIdx].compatible_devices = uniqueDevices.join(' = ');
            updated++;
          } else {
            // All devices already exist
            ignored++;
          }
        } else {
          maxId++;
          db.data.ic_compatibilities.unshift({
            id: maxId,
            ic_number: icCode,
            component_type: category,
            compatible_devices: String(devicesStr || '').split(/[,=]/).map(d => d.trim()).filter(Boolean).join(' = '),
            notes: ''
          });
          added++;
        }
      }

      if (!db.save()) {
        db.data.ic_compatibilities = previousCompatibilities;
        db.load();
        return { success: false, reason: 'IC_IMPORT_SAVE_FAILED' };
      }
      return { success: true, added, updated, ignored };
    } catch (err: any) {
      return { success: false, reason: 'error', message: err.message };
    }
  });

  ipcMain.handle('import-ic-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'استيراد ملف إكسل للآيسيات',
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, reason: 'cancelled' };
    }

    try {
      const workbook = xlsx.readFile(filePaths[0]);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      let added = 0;
      let updated = 0;
      let ignored = 0;
      if (!db.data.ic_compatibilities) db.data.ic_compatibilities = [];
      let maxId = db.data.ic_compatibilities.reduce((max: number, ic: any) => Math.max(max, ic.id), 0);

      // Process rows: assume standard Category, IC, Devices format
      // Skip header row
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[];
        if (!row || row.length < 2) continue;

        const category = row[0] ? String(row[0]).trim() : 'General';
        const icCode = String(row[1]).trim();
        const devicesStr = row[2] ? String(row[2]).trim() : '';

        if (!icCode) continue;

        const existingIdx = db.data.ic_compatibilities.findIndex((ic: any) => String(ic.ic_number || '').toLowerCase() === icCode.toLowerCase());

        if (existingIdx !== -1) {
          const existingDevices = String(db.data.ic_compatibilities[existingIdx].compatible_devices || '').split(/[,=]/).map((d: string) => d.trim()).filter(Boolean);
          const newDevices = String(devicesStr || '').split(/[,=]/).map((d: string) => d.trim()).filter(Boolean);

          const deviceMap = new Map<string, string>();
          [...existingDevices, ...newDevices].forEach(d => {
            deviceMap.set(d.toLowerCase(), d);
          });
          const uniqueDevices = Array.from(deviceMap.values());

          if (uniqueDevices.length > existingDevices.length) {
            // New devices were found
            db.data.ic_compatibilities[existingIdx].compatible_devices = uniqueDevices.join(' = ');
            updated++;
          } else {
            // All devices already exist
            ignored++;
          }
        } else {
          maxId++;
          db.data.ic_compatibilities.unshift({
            id: maxId,
            ic_number: icCode,
            component_type: category,
            compatible_devices: String(devicesStr || '').split(/[,=]/).map(d => d.trim()).filter(Boolean).join(' = '),
            notes: ''
          });
          added++;
        }
      }

      db.save();
      return { success: true, added, updated, ignored };
    } catch (err: any) {
      return { success: false, reason: 'error', message: err.message };
    }
  });

  // Monthly Settlement
  ipcMain.handle('close-month', (_, newCapital) => {
    // Validate newCapital
    if (typeof newCapital !== 'number' || !Number.isFinite(newCapital) || Number.isNaN(newCapital) || newCapital < 0) {
      return { success: false, reason: 'INVALID_NEW_CAPITAL' };
    }

    const currentMonth = getCurrentMonth();
    const oldIsClosed = currentMonth.is_closed;
    const oldClosedAt = currentMonth.closed_at;
    
    currentMonth.is_closed = true;
    currentMonth.closed_at = new Date().toISOString();

    const newMonthId = generateMonthId();
    const newMonth = {
      id: newMonthId,
      month_name: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
      start_capital: newCapital,
      is_closed: false,
      created_at: new Date().toISOString(),
      closed_at: null
    };
    db.data.months.push(newMonth);

    if (!db.save()) {
      currentMonth.is_closed = oldIsClosed;
      currentMonth.closed_at = oldClosedAt;
      db.data.months.pop();
      db.load();
      return { success: false, reason: 'MONTH_CLOSE_SAVE_FAILED' };
    }
    return { success: true };
  });

  ipcMain.handle('close-month-with-excel', async (_, newCapital) => {
    // Validate newCapital
    if (typeof newCapital !== 'number' || !Number.isFinite(newCapital) || Number.isNaN(newCapital) || newCapital < 0) {
      return { success: false, reason: 'INVALID_NEW_CAPITAL' };
    }

    const currentMonth = getCurrentMonth();

    const ops = db.data.operations.filter((op: any) => op.month_id === currentMonth.id || op.paid_in_month_id === currentMonth.id);
    const allDebts = db.data.operations.filter((op: any) => op.payment_status === 'debt');
    const currentMonthDebts = allDebts.filter((op: any) => op.month_id === currentMonth.id);
    const tiedCapital = currentMonthDebts.reduce((sum: number, op: any) => sum + (op.cost || 0), 0);
    const availableCapital = currentMonth.start_capital - tiedCapital;

    const cashOps = ops.filter((op: any) => op.payment_status === 'cash' && !op.paid_in_month_id);
    const paidDebts = db.data.operations.filter((op: any) => op.paid_in_month_id === currentMonth.id);
    const realizedShopProfit = cashOps.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0) +
      paidDebts.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0);

    const shopWithdrawals = db.data.withdrawals
      .filter((w: any) => w.type === 'shop_withdrawal' && w.month_id === currentMonth.id)
      .reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
    const totalTechWithdrawals = db.data.withdrawals
      .filter((w: any) => w.type === 'tech_withdrawal' && w.month_id === currentMonth.id)
      .reduce((sum: number, w: any) => sum + (w.amount || 0), 0);

    const totalTechProfit = ops.reduce((sum: number, op: any) => sum + (op.tech_profit || 0), 0);
    const debtTotal = allDebts.reduce((sum: number, op: any) => sum + (op.price || 0), 0);

    const summaryData = [
      ["تقرير شهر", currentMonth.month_name || currentMonth.date || ''],
      [""],
      ["رأس المال الأساسي", currentMonth.start_capital],
      ["رأس المال المسترد فعلياً", availableCapital],
      ["إجمالي الأرباح الصافية للمحل (المحصلة)", realizedShopProfit],
      ["إجمالي سحوبات المحل", shopWithdrawals],
      ["الصافي المستحق للمحل", availableCapital + realizedShopProfit - shopWithdrawals],
      [""],
      ["إجمالي أرباح الفنيين", totalTechProfit],
      ["إجمالي سحوبات الفنيين", totalTechWithdrawals],
      [""],
      ["إجمالي الديون المتبقية (السوق)", debtTotal]
    ];

    const opsLogData = ops.map((op: any) => ({
      "التاريخ": op.date,
      "رقم العملية": op.id,
      "اسم العميل": op.customer_name || '-',
      "الجهاز/الأعطال": (op.device || '') + (op.faults && op.faults.length > 0 ? ` (${op.faults.join(', ')})` : ''),
      "حالة الدفع": op.payment_status === 'debt' ? 'دين' : 'نقدي',
      "التكلفة": op.cost || 0,
      "المبلغ الإجمالي": op.price || 0,
      "صافي الربح": (op.price || 0) - (op.cost || 0),
      "حصة المحل": op.shop_profit || 0,
      "حصة الفني": op.tech_profit || 0,
      "اسم الفني": op.technician_name
    }));

    const wb = xlsx.utils.book_new();
    const wsSummary = xlsx.utils.aoa_to_sheet(summaryData);
    const wsOps = xlsx.utils.json_to_sheet(opsLogData);

    wsSummary['!cols'] = [{ wch: 40 }, { wch: 20 }];
    wsOps['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 20 }
    ];

    xlsx.utils.book_append_sheet(wb, wsSummary, "الخلاصة");
    xlsx.utils.book_append_sheet(wb, wsOps, "سجل العمليات");

    const defaultPath = `Settlement_${currentMonth.month_name || currentMonth.date || 'unknown'}.xlsx`.replace(/\//g, '-');
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'حفظ نسخة احتياطية للتقفيل الشهري',
      defaultPath: defaultPath,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) {
      return { success: false, reason: 'cancelled' };
    }

    try {
      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(filePath, buf);
    } catch (err: any) {
      return { success: false, reason: 'error', message: err.message };
    }

    // Perform month reset
    const oldIsClosed = currentMonth.is_closed;
    const oldClosedAt = currentMonth.closed_at;
    
    currentMonth.is_closed = true;
    currentMonth.closed_at = new Date().toISOString();

    const newMonthId = generateMonthId();
    const newMonth = {
      id: newMonthId,
      month_name: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
      start_capital: newCapital,
      is_closed: false,
      created_at: new Date().toISOString(),
      closed_at: null
    };
    db.data.months.push(newMonth);

    if (!db.save()) {
      currentMonth.is_closed = oldIsClosed;
      currentMonth.closed_at = oldClosedAt;
      db.data.months.pop();
      db.load();
      return { success: false, reason: 'MONTH_CLOSE_SAVE_FAILED' };
    }
    return { success: true };
  });

  // Scrap Devices
  ipcMain.handle('get-scrap-devices', () => {
    return db.data.scrap_devices || [];
  });

  ipcMain.handle('add-scrap-device', (_, data) => {
    if (!db.data.scrap_devices) db.data.scrap_devices = [];
    const newId = Date.now();
    db.data.scrap_devices.push({ id: newId, ...data });
    if (!db.save()) {
      db.data.scrap_devices.pop();
      db.load();
      return { success: false, reason: 'DATABASE_SAVE_FAILED' };
    }
    return { success: true };
  });

  ipcMain.handle('edit-scrap-device', (_, id, data) => {
    const idx = db.data.scrap_devices.findIndex((d: any) => d.id === id);
    if (idx !== -1) {
      const oldD = { ...db.data.scrap_devices[idx] };
      db.data.scrap_devices[idx] = { ...oldD, ...data };
      if (!db.save()) {
        db.data.scrap_devices[idx] = oldD;
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  ipcMain.handle('delete-scrap-device', (_, id) => {
    const idx = db.data.scrap_devices.findIndex((d: any) => d.id === id);
    if (idx !== -1) {
      const deletedItem = db.data.scrap_devices[idx];
      db.data.scrap_devices.splice(idx, 1);
      
      if (!db.save()) {
        db.data.scrap_devices.splice(idx, 0, deletedItem);
        db.load();
        return { success: false, reason: 'SCRAP_DEVICE_DELETE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  // Quick Lists
  ipcMain.handle('get-quick-lists', () => {
    return {
      devices: db.data.common_devices || [],
      faults: db.data.common_faults || []
    };
  });

  ipcMain.handle('add-quick-list-item', (_, type: 'device' | 'fault', item: string) => {
    const targetArray = type === 'device' ? 'common_devices' : 'common_faults';
    if (!db.data[targetArray]) db.data[targetArray] = [];
    if (!db.data[targetArray].includes(item)) {
      db.data[targetArray].push(item);
      if (!db.save()) {
        db.data[targetArray].pop();
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'ALREADY_EXISTS' };
  });

  ipcMain.handle('remove-quick-list-item', (_, type: 'device' | 'fault', item: string) => {
    const targetArray = type === 'device' ? 'common_devices' : 'common_faults';
    if (db.data[targetArray]) {
      const oldArray = [...db.data[targetArray]];
      db.data[targetArray] = db.data[targetArray].filter((i: string) => i !== item);
      if (!db.save()) {
        db.data[targetArray] = oldArray;
        db.load();
        return { success: false, reason: 'DATABASE_SAVE_FAILED' };
      }
      return { success: true };
    }
    return { success: false, reason: 'NOT_FOUND' };
  });

  ipcMain.handle('create-full-backup', async () => {
    try {
      const wb = xlsx.utils.book_new();
      
      const wsOps = xlsx.utils.json_to_sheet(db.data.operations || []);
      xlsx.utils.book_append_sheet(wb, wsOps, "العمليات");

      const wsWith = xlsx.utils.json_to_sheet(db.data.withdrawals || []);
      xlsx.utils.book_append_sheet(wb, wsWith, "السحوبات");

      const wsTech = xlsx.utils.json_to_sheet(db.data.technicians || []);
      xlsx.utils.book_append_sheet(wb, wsTech, "الفنيين");

      const defaultPath = `Full_Backup_${new Date().toISOString().split('T')[0]}.xlsx`;
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'حفظ نسخة احتياطية كاملة (Excel & JSON)',
        defaultPath: defaultPath,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) {
        return { success: false, reason: 'cancelled' };
      }

      // Save Excel for User
      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(filePath, buf);
      
      // Save JSON for System Restore / Safety
      const jsonFilePath = filePath.replace('.xlsx', '.json');
      fs.writeFileSync(jsonFilePath, JSON.stringify(db.data, null, 2));

      return { success: true };
    } catch (err: any) {
      return { success: false, reason: 'error', message: err.message };
    }
  });

  ipcMain.handle('backup:create', () => {
    return createBackup(db.data, true);
  });

  ipcMain.handle('backup:list', () => {
    return listBackups();
  });

  ipcMain.handle('backup:restore', (_, filename) => {
    try {
      const originalHash = getCanonicalDatabaseHash(db.data);
      
      // 1. Read and validate
      let restoreResult: { data: any, fileHash?: string };
      try {
        restoreResult = readBackup(filename);
      } catch (err: any) {
        return { success: false, reason: err.message, message: 'الملف غير صالح أو معطوب.' };
      }

      const restoredData = restoreResult.data;
      const expectedHash = getCanonicalDatabaseHash(restoredData);

      // 2. Backup current DB
      const preRestoreBackup = createBackup(db.data, true);
      if (!preRestoreBackup.success) {
        return { success: false, reason: 'CURRENT_BACKUP_FAILED', message: 'تعذر إنشاء نسخة احتياطية من البيانات الحالية، لذلك لم يتم تنفيذ الاستعادة.' };
      }

      // 3. Restore to Memory
      db.data = restoredData;
      
      // 4. Save Atomically
      const saveSuccess = db.save();
      if (!saveSuccess) {
        db.load(); // Re-sync memory from original file on disk
        const rollbackHash = getCanonicalDatabaseHash(db.data);
        if (rollbackHash !== originalHash) {
          return { success: false, reason: 'RESTORE_ROLLBACK_SAVE_FAILED', message: 'CRITICAL RECOVERY ERROR' };
        }
        return { success: false, reason: 'DATABASE_SAVE_FAILED', message: 'فشل حفظ قاعدة البيانات إلى القرص.' };
      }

      // 5. Verify Restore
      db.load();
      const actualHash = getCanonicalDatabaseHash(db.data);
      const opsMatch = db.data.operations?.length === restoredData.operations?.length;
      const monthsMatch = db.data.months?.length === restoredData.months?.length;
      const techsMatch = db.data.technicians?.length === restoredData.technicians?.length;
      const withsMatch = db.data.withdrawals?.length === restoredData.withdrawals?.length;

      if (actualHash !== expectedHash || !opsMatch || !monthsMatch || !techsMatch || !withsMatch) {
        // ROLLBACK
        try {
          const rollbackFilename = path.basename(preRestoreBackup.filename!);
          const rollbackData = readBackup(rollbackFilename).data;
          db.data = rollbackData;
          const rbSave = db.save();
          db.load();
          const rollbackHash = getCanonicalDatabaseHash(db.data);
          
          if (!rbSave || rollbackHash !== originalHash) {
            return { success: false, reason: 'RESTORE_ROLLBACK_FAILED', message: 'CRITICAL RECOVERY ERROR' };
          }
        } catch (e) {
          return { success: false, reason: 'RESTORE_ROLLBACK_FAILED', message: 'CRITICAL RECOVERY ERROR' };
        }
        return { success: false, reason: 'RESTORE_VERIFY_FAILED', message: 'فشلت عملية الاستعادة. تم التراجع بنجاح.' };
      }

      return { success: true };
    } catch (e: any) {
      db.load(); // Failsafe
      return { success: false, reason: 'RESTORE_FAILED', message: e.message };
    }
  });

  ipcMain.handle('factory-reset', () => {
    const originalHash = getCanonicalDatabaseHash(db.data);
    
    // 1. Mandatory Full JSON Backup before wipe
    const backupResult = createBackup(db.data, true);
    if (!backupResult.success) {
      return { success: false, reason: 'FACTORY_RESET_BACKUP_FAILED', message: 'فشل إنشاء نسخة احتياطية إجبارية. تم إيقاف عملية التصفير لحماية البيانات.' };
    }

    // 2. Wipe data securely
    db.data.operations = [];
    db.data.withdrawals = [];
    if (db.data.technicians) {
      db.data.technicians.forEach((t: any) => {
        t.start_balance = 0;
      });
    }

    db.data.months = [{
      id: 1,
      month_name: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
      start_capital: db.data.settings.base_capital || 0,
      is_closed: false,
      created_at: new Date().toISOString(),
      closed_at: null
    }];

    const saveSuccess = db.save();
    if (!saveSuccess) {
      // Rollback
      try {
        const rollbackFilename = path.basename(backupResult.filename!);
        const rollbackData = readBackup(rollbackFilename).data;
        db.data = rollbackData;
        const rbSave = db.save();
        if (!rbSave) return { success: false, reason: 'FACTORY_RESET_ROLLBACK_SAVE_FAILED', message: 'CRITICAL RECOVERY ERROR' };
        db.load();
        
        const rollbackHash = getCanonicalDatabaseHash(db.data);
        if (rollbackHash !== originalHash) {
           return { success: false, reason: 'FACTORY_RESET_ROLLBACK_FAILED', message: 'CRITICAL RECOVERY ERROR' };
        }
      } catch (e) {
        return { success: false, reason: 'FACTORY_RESET_ROLLBACK_FAILED', message: 'CRITICAL RECOVERY ERROR' };
      }
      return { success: false, reason: 'FACTORY_RESET_FAILED', message: 'فشل التصفير أثناء الحفظ. تم الاحتفاظ بالبيانات.' };
    }

    // Verify
    db.load();
    if (db.data.operations.length !== 0 || db.data.months.length !== 1) {
      // Rollback
      try {
        const rollbackFilename = path.basename(backupResult.filename!);
        const rollbackData = readBackup(rollbackFilename).data;
        db.data = rollbackData;
        const rbSave = db.save();
        if (!rbSave) return { success: false, reason: 'FACTORY_RESET_ROLLBACK_SAVE_FAILED', message: 'CRITICAL RECOVERY ERROR' };
        db.load();
        
        const rollbackHash = getCanonicalDatabaseHash(db.data);
        if (rollbackHash !== originalHash) {
           return { success: false, reason: 'FACTORY_RESET_ROLLBACK_FAILED', message: 'CRITICAL RECOVERY ERROR' };
        }
      } catch (e) {
        return { success: false, reason: 'FACTORY_RESET_ROLLBACK_FAILED', message: 'CRITICAL RECOVERY ERROR' };
      }
      return { success: false, reason: 'FACTORY_RESET_FAILED', message: 'فشل التحقق من التصفير. تم التراجع.' };
    }

    return { success: true };
  });
}
