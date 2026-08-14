import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import * as xlsx from 'xlsx';
import { db, initDB } from './database.js';
import type { Operation, Withdrawal, Technician } from '../src/types';

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
    }
  });

  mainWindow.maximize();

  initDB();
  setupIPC();

  // Run daily backup check on startup and every hour
  autoBackupDaily();
  setInterval(autoBackupDaily, 1000 * 60 * 60);

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
    const nextDate = new Date().toLocaleDateString('en-GB');
    db.data.months.push({ id: 1, start_capital: 0, date: nextDate });
    db.save();
    return db.data.months[0];
  }
  return m;
}

function autoBackupDaily() {
  try {
    const currentMonth = getCurrentMonth();
    const monthNameSafe = currentMonth.month_name ? currentMonth.month_name.replace(/\//g, '-').replace(/ /g, '_') : 'Unknown';
    const todayStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    const userDataPath = app.getPath('userData');
    const backupDir = path.join(userDataPath, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupFilePath = path.join(backupDir, `Backup_${monthNameSafe}.xlsx`);
    
    // Generate data
    const ops = db.data.operations.filter((op:any) => op.month_id === currentMonth.id || op.paid_in_month_id === currentMonth.id);
    const debts = db.data.operations.filter((op:any) => op.payment_status === 'debt');
    const tiedCapital = debts.reduce((sum:number, op:any) => sum + (op.cost||0), 0);
    const availableCapital = currentMonth.start_capital - tiedCapital;
    
    const cashOps = ops.filter((op: any) => op.payment_status === 'cash' && !op.paid_in_month_id);
    const paidDebts = db.data.operations.filter((op: any) => op.paid_in_month_id === currentMonth.id);
    const realizedShopProfit = cashOps.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0) +
                               paidDebts.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0);
    
    const shopWithdrawals = db.data.withdrawals
        .filter((w:any) => w.type === 'shop_withdrawal' && w.month_id === currentMonth.id)
        .reduce((sum:number, w:any) => sum + (w.amount||0), 0);
    
    const totalTechProfit = ops.reduce((sum:number, op:any) => sum + (op.tech_profit||0), 0);
    const debtTotal = debts.reduce((sum:number, op:any) => sum + (op.price||0), 0);

    const summaryData = [
      ["تقرير يوم", todayStr],
      [""],
      ["رأس المال المسترد فعلياً", availableCapital],
      ["إجمالي الأرباح الصافية للمحل (المحصلة)", realizedShopProfit],
      ["الصافي المستحق للمحل", availableCapital + realizedShopProfit - shopWithdrawals],
      ["إجمالي أرباح الفنيين", totalTechProfit],
      ["إجمالي الديون المتبقية (السوق)", debtTotal]
    ];

    const opsLogData = ops.map((op:any) => ({
      "التاريخ": op.date,
      "رقم العملية": op.id,
      "اسم العميل": op.customer_name || '-',
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

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(backupFilePath, buf);
    console.log("Daily backup created:", backupFilePath);
  } catch(e) {
    console.error("Failed daily backup", e);
  }
}

function setupIPC() {
  const getCurrentMonth = () => db.getCurrentMonth();

  ipcMain.handle('get-settings', () => {
    return db.data.settings;
  });
  
  ipcMain.handle('update-settings', (_, capital, name) => {
    db.data.settings.base_capital = capital;
    db.data.settings.shop_name = name;
    db.save();
    return true;
  });

  // Technicians
  ipcMain.handle('get-technicians', () => {
    return db.data.technicians.filter((t: any) => t.is_active !== false);
  });
  
  ipcMain.handle('add-technician', (_, name, profit_percentage) => {
    const newId = db.data.technicians.length > 0 ? Math.max(...db.data.technicians.map((t:any) => t.id)) + 1 : 1;
    db.data.technicians.push({ id: newId, name, profit_percentage: Math.max(0, profit_percentage), is_active: true });
    db.save();
    return true;
  });

  ipcMain.handle('edit-technician', (_, id, name, profit_percentage) => {
    const tech = db.data.technicians.find((t:any) => t.id === id);
    if (tech) {
      tech.name = name;
      tech.profit_percentage = Math.max(0, profit_percentage);
      db.save();
      return true;
    }
    return false;
  });

  ipcMain.handle('delete-technician', (_, id) => {
    const tech = db.data.technicians.find((t:any) => t.id === id);
    if (tech) {
      tech.is_active = false;
      db.save();
      return true;
    }
    return false;
  });

  // Operations
  ipcMain.handle('get-operations', () => {
    return db.data.operations.map((op:any) => {
      const tech = db.data.technicians.find((t:any) => t.id === op.technician_id);
      return { ...op, technician_name: tech ? tech.name : 'Unknown' };
    }).reverse(); 
  });

  ipcMain.handle('add-operation', (_, op) => {
    const newId = db.data.operations.length > 0 ? Math.max(...db.data.operations.map((o:any) => o.id)) + 1 : 1;
    
    // Sanitize
    op.price = Math.max(0, op.price || 0);
    op.cost = Math.max(0, op.cost || 0);
    
    db.data.operations.push({
      id: newId,
      date: new Date().toLocaleDateString('en-GB'),
      month_id: getCurrentMonth().id,
      ...op
    });
    db.save();
    return true;
  });

  ipcMain.handle('edit-operation', (_, opId, updatedOp) => {
    const idx = db.data.operations.findIndex((o:any) => o.id === opId);
    if (idx !== -1) {
      // Prevent retroactive edits
      if (db.data.operations[idx].month_id !== getCurrentMonth().id) {
        return false;
      }
      updatedOp.price = Math.max(0, updatedOp.price || 0);
      updatedOp.cost = Math.max(0, updatedOp.cost || 0);
      
      db.data.operations[idx] = { ...db.data.operations[idx], ...updatedOp };
      db.save();
      return true;
    }
    return false;
  });

  ipcMain.handle('delete-operation', (_, opId) => {
    const idx = db.data.operations.findIndex((o:any) => o.id === opId);
    if (idx !== -1) {
      // Prevent retroactive deletion
      if (db.data.operations[idx].month_id !== getCurrentMonth().id) {
        return false;
      }
      db.data.operations.splice(idx, 1);
      db.save();
      return true;
    }
    return false;
  });

  // Debts
  ipcMain.handle('get-debts', () => {
    return db.data.operations
      .filter((op: any) => op.payment_status === 'debt')
      .map((op:any) => {
        const tech = db.data.technicians.find((t:any) => t.id === op.technician_id);
        return { ...op, technician_name: tech ? tech.name : 'Unknown' };
      }).reverse();
  });

  ipcMain.handle('pay-debt', (_, operation_id) => {
    const op = db.data.operations.find((o: any) => o.id === operation_id);
    if (op) {
      op.payment_status = 'cash';
      op.paid_in_month_id = getCurrentMonth().id;
      db.save();
      return true;
    }
    return false;
  });

  // Withdrawals
  ipcMain.handle('get-withdrawals', () => {
    return db.data.withdrawals.map((w:any) => {
      const tech = db.data.technicians.find((t:any) => t.id === w.technician_id);
      return { ...w, technician_name: tech ? tech.name : null };
    }).reverse();
  });

  ipcMain.handle('add-withdrawal', (_, w) => {
    const newId = db.data.withdrawals.length > 0 ? Math.max(...db.data.withdrawals.map((o:any) => o.id)) + 1 : 1;
    
    // Sanitize
    w.amount = Math.max(0, w.amount || 0);
    
    db.data.withdrawals.push({
      id: newId,
      date: new Date().toLocaleDateString('en-GB'),
      month_id: getCurrentMonth().id,
      ...w
    });
    db.save();
    return true;
  });

  ipcMain.handle('edit-withdrawal', (_, id, updatedW) => {
    const idx = db.data.withdrawals.findIndex((w:any) => w.id === id);
    if (idx !== -1) {
      if (db.data.withdrawals[idx].month_id !== getCurrentMonth().id) {
        return false;
      }
      updatedW.amount = Math.max(0, updatedW.amount || 0);
      db.data.withdrawals[idx] = { ...db.data.withdrawals[idx], ...updatedW };
      db.save();
      return true;
    }
    return false;
  });

  ipcMain.handle('delete-withdrawal', (_, id) => {
    const idx = db.data.withdrawals.findIndex((w:any) => w.id === id);
    if (idx !== -1) {
      if (db.data.withdrawals[idx].month_id !== getCurrentMonth().id) {
        return false;
      }
      db.data.withdrawals.splice(idx, 1);
      db.save();
      return true;
    }
    return false;
  });

  // Dashboard Stats
  ipcMain.handle('get-dashboard-stats', () => {
    const currentMonth = getCurrentMonth();
    
    // Profit of the current month
    const currentMonthOps = db.data.operations.filter((op: any) => op.month_id === currentMonth.id);
    const totalShopProfit = currentMonthOps.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0);
    
    // Realized vs Unrealized
    const cashOps = currentMonthOps.filter((op: any) => op.payment_status === 'cash' && !op.paid_in_month_id);
    const paidDebts = db.data.operations.filter((op: any) => op.paid_in_month_id === currentMonth.id);
    const unpaidDebts = db.data.operations.filter((op: any) => op.payment_status === 'debt');
    
    const realizedShopProfit = cashOps.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0) +
                               paidDebts.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0);
    const unrealizedShopProfit = totalShopProfit - realizedShopProfit; // roughly, within this month

    // Capital Revolving Logic
    const tiedCapital = unpaidDebts.reduce((sum: number, op: any) => sum + (op.cost || 0), 0);
    const availableCapital = currentMonth.start_capital - tiedCapital;
    
    // Withdrawals
    const currentMonthWithdrawals = db.data.withdrawals.filter((w: any) => w.month_id === currentMonth.id);
    const totalShopWithdrawal = currentMonthWithdrawals
      .filter((w:any) => w.type === 'shop_withdrawal')
      .reduce((sum: number, w: any) => sum + (w.amount || 0), 0);

    // Calculate Actual Box (Physical Cash)
    const cashOpsPrice = cashOps.reduce((sum: number, op: any) => sum + (op.price || 0), 0);
    const paidDebtsThisMonthPrice = paidDebts.reduce((sum: number, op: any) => sum + (op.price || 0), 0);

    const totalOpsCost = currentMonthOps.reduce((sum: number, op: any) => sum + (op.cost || 0), 0);
    const totalAllWithdrawals = currentMonthWithdrawals.reduce((sum: number, w: any) => sum + (w.amount || 0), 0);

    const actualShopBalance = currentMonth.start_capital + cashOpsPrice + paidDebtsThisMonthPrice - totalOpsCost - totalAllWithdrawals;

    const debtTotal = unpaidDebts.reduce((sum: number, op: any) => sum + (op.price || 0), 0);

    return {
      baseCapital: currentMonth.start_capital,
      availableCapital,
      tiedCapital,
      totalShopProfit,
      realizedShopProfit,
      unrealizedShopProfit,
      totalShopWithdrawal,
      actualShopBalance,
      debtTotal
    };
  });

  // Technician Stats
  ipcMain.handle('get-technician-stats', () => {
    const currentMonth = getCurrentMonth();
    
    return db.data.technicians
      .map((tech: any) => {
        const techOpsThisMonth = db.data.operations.filter((op:any) => op.technician_id === tech.id && op.month_id === currentMonth.id);
        const totalCost = techOpsThisMonth.reduce((sum: number, op: any) => sum + (op.cost || 0), 0);

        const cashOps = techOpsThisMonth.filter((op:any) => op.payment_status === 'cash' && !op.paid_in_month_id);
        const paidDebts = db.data.operations.filter((op:any) => op.technician_id === tech.id && op.paid_in_month_id === currentMonth.id);
        
        const realizedProfit = cashOps.reduce((sum: number, op: any) => sum + (op.tech_profit || 0), 0) +
                               paidDebts.reduce((sum: number, op: any) => sum + (op.tech_profit || 0), 0);
        
        const unpaidDebts = db.data.operations.filter((op:any) => op.technician_id === tech.id && op.payment_status === 'debt');
        const unrealizedProfit = unpaidDebts.reduce((sum: number, op: any) => sum + (op.tech_profit || 0), 0);

        const techWithdrawal = db.data.withdrawals
          .filter((w:any) => w.type === 'tech_withdrawal' && w.technician_id === tech.id && w.month_id === currentMonth.id)
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

  // Monthly Settlement
  ipcMain.handle('close-month', (_, newCapital) => {
    const currentMonth = getCurrentMonth();
    currentMonth.is_closed = true;
    currentMonth.closed_at = new Date().toISOString();

    const newMonthId = Math.max(...db.data.months.map((m:any) => m.id)) + 1;
    db.data.months.push({
      id: newMonthId,
      month_name: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
      start_capital: newCapital,
      is_closed: false,
      created_at: new Date().toISOString(),
      closed_at: null
    });

    db.save();
    return true;
  });

  ipcMain.handle('close-month-with-excel', async (_, newCapital) => {
    const currentMonth = getCurrentMonth();
    
    const ops = db.data.operations.filter((op:any) => op.month_id === currentMonth.id || op.paid_in_month_id === currentMonth.id);
    const debts = db.data.operations.filter((op:any) => op.payment_status === 'debt');
    const tiedCapital = debts.reduce((sum:number, op:any) => sum + (op.cost||0), 0);
    const availableCapital = currentMonth.start_capital - tiedCapital;
    
    const cashOps = ops.filter((op: any) => op.payment_status === 'cash' && !op.paid_in_month_id);
    const paidDebts = db.data.operations.filter((op: any) => op.paid_in_month_id === currentMonth.id);
    const realizedShopProfit = cashOps.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0) +
                               paidDebts.reduce((sum: number, op: any) => sum + (op.shop_profit || 0), 0);
    
    const shopWithdrawals = db.data.withdrawals
        .filter((w:any) => w.type === 'shop_withdrawal' && w.month_id === currentMonth.id)
        .reduce((sum:number, w:any) => sum + (w.amount||0), 0);
    const totalTechWithdrawals = db.data.withdrawals
        .filter((w:any) => w.type === 'tech_withdrawal' && w.month_id === currentMonth.id)
        .reduce((sum:number, w:any) => sum + (w.amount||0), 0);
    
    const totalTechProfit = ops.reduce((sum:number, op:any) => sum + (op.tech_profit||0), 0);
    const debtTotal = debts.reduce((sum:number, op:any) => sum + (op.price||0), 0);

    const summaryData = [
      ["تقرير شهر", currentMonth.date],
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

    const opsLogData = ops.map((op:any) => ({
      "التاريخ": op.date,
      "رقم العملية": op.id,
      "اسم العميل": op.customer_name || '-',
      "نوع العطل/الجهاز": op.device || '-',
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

    const defaultPath = `Settlement_${currentMonth.date}.xlsx`.replace(/\//g, '-');
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
    } catch(err: any) {
      return { success: false, reason: 'error', message: err.message };
    }

    // Perform month reset
    currentMonth.is_closed = true;
    currentMonth.closed_at = new Date().toISOString();

    const newMonthId = Math.max(...db.data.months.map((m:any) => m.id)) + 1;
    db.data.months.push({
      id: newMonthId,
      month_name: new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
      start_capital: newCapital,
      is_closed: false,
      created_at: new Date().toISOString(),
      closed_at: null
    });

    db.save();
    return { success: true };
  });
}
