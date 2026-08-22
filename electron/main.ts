import './pre-init.js';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';

// MUST BE SET BEFORE DB IS ACCESSED
if (process.env.VITE_APP_ENV === 'development') {
    app.setPath('userData', path.join(app.getPath('appData'), 'maintenance_app_dev'));
}

import fs from 'node:fs';
import { getDB, isIntegrityOk, closeDB } from './db/connection.js';
import { runAutomaticMigration } from './db/migration.js';
import { createSQLiteBackup, listSQLiteBackups, restoreSQLiteBackup } from './db/backup.js';
import * as settingsRepo from './db/repositories/settingsRepo.js';
import * as monthsRepo from './db/repositories/monthsRepo.js';
import * as techniciansRepo from './db/repositories/techniciansRepo.js';
import * as customersRepo from './db/repositories/customersRepo.js';
import * as operationsRepo from './db/repositories/operationsRepo.js';
import * as withdrawalsRepo from './db/repositories/withdrawalsRepo.js';
import * as quickListsRepo from './db/repositories/quickListsRepo.js';
import * as icRepo from './db/repositories/icRepo.js';
import * as scrapRepo from './db/repositories/scrapRepo.js';
import * as statsRepo from './db/repositories/statsRepo.js';
import * as cashRepo from './db/repositories/cashRepo.js';
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

  setupIPC();

  // Run daily backup check on startup and every hour
  createSQLiteBackup(false);
  setInterval(() => createSQLiteBackup(false), 1000 * 60 * 60);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function initializeApplication(): boolean {
  // Complete data migration before creating any renderer window.
  if (!runAutomaticMigration()) {
    console.error('[Startup] Migration failed. Halting application to protect user data.');
    return false;
  }

  const db = getDB();
  if (!isIntegrityOk(db)) {
    dialog.showErrorBox('خطأ في قاعدة البيانات', 'تم اكتشاف تلف في ملف قاعدة البيانات SQLite.');
    return false;
  }

  createWindow();
  return true;
}

app.whenReady().then(() => {
  if (!initializeApplication()) app.quit();
});

app.on('window-all-closed', () => {
  closeDB();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIPC() {
  // Settings
  ipcMain.handle('get-settings', () => {
    return settingsRepo.getSettings();
  });

  ipcMain.handle('update-settings', (_, settings) => {
    return settingsRepo.updateSettings(settings);
  });

  ipcMain.handle('restart-app', () => {
    if (process.env.VITE_APP_ENV === 'development') {
      app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });
    } else {
      app.relaunch();
    }
    app.quit();
  });

  // Technicians
  ipcMain.handle('get-technicians', () => {
    return techniciansRepo.getTechnicians();
  });

  ipcMain.handle('add-technician', (_, name, profit_percentage) => {
    return techniciansRepo.addTechnician(name, profit_percentage);
  });

  ipcMain.handle('edit-technician', (_, id, name, profit_percentage) => {
    return techniciansRepo.editTechnician(id, name, profit_percentage);
  });

  ipcMain.handle('delete-technician', (_, id) => {
    return techniciansRepo.deleteTechnician(id);
  });

  // Customers
  ipcMain.handle('get-customers', () => {
    try {
      return customersRepo.getCustomersWithOrphans();
    } catch (err) {
      console.error('[IPC get-customers] Unexpected error:', err);
      return [];
    }
  });

  ipcMain.handle('add-customer', (_, customer) => {
    return customersRepo.addCustomer(customer);
  });

  ipcMain.handle('edit-customer', (_, id, updatedData) => {
    return customersRepo.editCustomer(id, updatedData);
  });

  ipcMain.handle('delete-customer', (_, id) => {
    return customersRepo.deleteCustomer(id);
  });

  ipcMain.handle('get-customer-operations', (_, customerId, customerPhone) => {
    return operationsRepo.getCustomerOperations(customerId, customerPhone);
  });

  // Operations
  ipcMain.handle('get-operations', () => {
    return operationsRepo.getOperations();
  });

  ipcMain.handle('get-all-operations', () => {
    return operationsRepo.getAllOperations();
  });

  ipcMain.handle('add-operation', (_, op) => {
    return operationsRepo.addOperation(op);
  });

  ipcMain.handle('edit-operation', (_, opId, updatedOp) => {
    return operationsRepo.editOperation(opId, updatedOp);
  });

  ipcMain.handle('delete-operation', (_, opId) => {
    return operationsRepo.deleteOperation(opId);
  });

  // Debts
  ipcMain.handle('get-debts', () => {
    return operationsRepo.getDebts();
  });

  ipcMain.handle('pay-debt', (_, operation_id) => {
    return operationsRepo.payDebt(operation_id);
  });

  // Withdrawals
  ipcMain.handle('get-withdrawals', () => {
    return withdrawalsRepo.getWithdrawals();
  });

  ipcMain.handle('add-withdrawal', (_, w) => {
    return withdrawalsRepo.addWithdrawal(w);
  });

  ipcMain.handle('edit-withdrawal', (_, id, updatedW) => {
    return withdrawalsRepo.editWithdrawal(id, updatedW);
  });

  ipcMain.handle('delete-withdrawal', (_, id) => {
    return withdrawalsRepo.deleteWithdrawal(id);
  });



  // Cash Ledger
  ipcMain.handle('get-cash-transactions', () => {
    const currentMonth = monthsRepo.getCurrentMonth();
    return cashRepo.getCashTransactionsByMonth(currentMonth.id);
  });
  ipcMain.handle('add-cash-transaction', (_, tx) => {
    const currentMonth = monthsRepo.getCurrentMonth();
    return cashRepo.addCashTransaction({ ...tx, month_id: currentMonth.id });
  });
  ipcMain.handle('delete-cash-transaction', (_, id) => cashRepo.deleteCashTransaction(id));

  // Stats
  ipcMain.handle('get-dashboard-stats', () => {
    return statsRepo.getDashboardStats();
  });

  ipcMain.handle('get-technician-stats', () => {
    return statsRepo.getTechnicianStats();
  });

  // IC Compatibility
  ipcMain.handle('get-ic-compatibilities', () => {
    return icRepo.getIcCompatibilities();
  });

  ipcMain.handle('add-ic-compatibility', (_, ic) => {
    return icRepo.addIcCompatibility(ic);
  });

  ipcMain.handle('edit-ic-compatibility', (_, id, ic) => {
    return icRepo.editIcCompatibility(id, ic);
  });

  ipcMain.handle('delete-ic-compatibility', (_, id) => {
    return icRepo.deleteIcCompatibility(id);
  });

  // Scrap Devices
  ipcMain.handle('get-scrap-devices', () => {
    return scrapRepo.getScrapDevices();
  });

  ipcMain.handle('add-scrap-device', (_, data) => {
    return scrapRepo.addScrapDevice(data);
  });

  ipcMain.handle('edit-scrap-device', (_, id, data) => {
    return scrapRepo.editScrapDevice(id, data);
  });

  ipcMain.handle('delete-scrap-device', (_, id) => {
    return scrapRepo.deleteScrapDevice(id);
  });

  // Quick Lists
  ipcMain.handle('get-quick-lists', () => {
    return quickListsRepo.getQuickLists();
  });

  ipcMain.handle('add-quick-list-item', (_, type: 'device' | 'fault', item: string) => {
    return quickListsRepo.addQuickListItem(type, item);
  });

  ipcMain.handle('remove-quick-list-item', (_, type: 'device' | 'fault', item: string) => {
    return quickListsRepo.removeQuickListItem(type, item);
  });

  // Months
  ipcMain.handle('close-month', (_, newCapital) => {
    return monthsRepo.closeMonth(newCapital);
  });

  // Excel Operations Import
  ipcMain.handle('import-operations-excel-data', async (_, data: any[]) => {
    try {
      const db = getDB();
      const currentMonth = monthsRepo.getCurrentMonth();
      const technicians = techniciansRepo.getAllTechnicians();
      let added = 0;
      let ignored = 0;

      const importTx = db.transaction(() => {
        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || row.length < 3) continue;

          const date = row[0] ? String(row[0]).trim() : new Date().toLocaleDateString('en-GB');
          const opId = row[1] ? Number(row[1]) : null;
          const customerName = String(row[2] || '').trim();
          const device = String(row[3] || '').trim();
          const techName = String(row[10] || '').trim();

          const tech = technicians.find(t => t.name === techName);
          if (!tech) {
            ignored++;
            continue;
          }

          // Deduplication
          let isDuplicate = false;
          if (opId) {
            const existing = db.prepare('SELECT id FROM operations WHERE id = ?').get(opId);
            if (existing) isDuplicate = true;
          }
          if (!isDuplicate) {
            const existing = db.prepare('SELECT id FROM operations WHERE customer_name = ? AND device = ? AND date = ?')
              .get(customerName, device, date);
            if (existing) isDuplicate = true;
          }

          if (isDuplicate) {
            ignored++;
            continue;
          }

          const price = Math.max(0, Number(row[6]) || 0);
          const cost = Math.max(0, Number(row[5]) || 0);
          const shopProfit = Math.max(0, Number(row[8]) || 0);
          const techProfit = Math.max(0, Number(row[9]) || 0);
          const paymentStatus = String(row[4]).includes('دين') ? 'debt' : 'cash';

          const safeId = (opId && !db.prepare('SELECT id FROM operations WHERE id = ?').get(opId)) ? opId : (Date.now() + i);

          operationsRepo.addOperation({
            id: safeId,
            date,
            month_id: currentMonth.id,
            technician_id: tech.id,
            customer_name: customerName,
            device,
            status: 'delivered',
            payment_status: paymentStatus,
            cost,
            price,
            shop_profit: shopProfit,
            tech_profit: techProfit
          });
          added++;
        }
      });

      importTx();
      return { success: true, added, ignored };
    } catch (err: any) {
      console.error('[Excel Import] Error:', err);
      return { success: false, reason: 'error', message: err?.message || String(err) };
    }
  });

  ipcMain.handle('import-operations-excel', async () => {
    const dialogOptions = {
      title: 'استيراد ملف إكسل للعمليات',
      properties: ['openFile' as const],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    };

    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return { success: false, reason: 'cancelled' };
    }

    try {
      const workbook = xlsx.readFile(filePaths[0]);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

      const db = getDB();
      const currentMonth = monthsRepo.getCurrentMonth();
      const technicians = techniciansRepo.getAllTechnicians();
      let added = 0;
      let ignored = 0;

      const importTx = db.transaction(() => {
        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || row.length < 3) continue;

          const date = row[0] ? String(row[0]).trim() : new Date().toLocaleDateString('en-GB');
          const opId = row[1] ? Number(row[1]) : null;
          const customerName = String(row[2] || '').trim();
          const device = String(row[3] || '').trim();
          const techName = String(row[10] || '').trim();

          const tech = technicians.find(t => t.name === techName);
          if (!tech) {
            ignored++;
            continue;
          }

          let isDuplicate = false;
          if (opId) {
            const existing = db.prepare('SELECT id FROM operations WHERE id = ?').get(opId);
            if (existing) isDuplicate = true;
          }
          if (!isDuplicate) {
            const existing = db.prepare('SELECT id FROM operations WHERE customer_name = ? AND device = ? AND date = ?')
              .get(customerName, device, date);
            if (existing) isDuplicate = true;
          }

          if (isDuplicate) {
            ignored++;
            continue;
          }

          const price = Math.max(0, Number(row[6]) || 0);
          const cost = Math.max(0, Number(row[5]) || 0);
          const shopProfit = Math.max(0, Number(row[8]) || 0);
          const techProfit = Math.max(0, Number(row[9]) || 0);
          const paymentStatus = String(row[4]).includes('دين') ? 'debt' : 'cash';

          const safeId = (opId && !db.prepare('SELECT id FROM operations WHERE id = ?').get(opId)) ? opId : (Date.now() + i);

          operationsRepo.addOperation({
            id: safeId,
            date,
            month_id: currentMonth.id,
            technician_id: tech.id,
            customer_name: customerName,
            device,
            status: 'delivered',
            payment_status: paymentStatus,
            cost,
            price,
            shop_profit: shopProfit,
            tech_profit: techProfit
          });
          added++;
        }
      });

      importTx();
      return { success: true, added, ignored };
    } catch (err: any) {
      console.error('[Excel File Import] Error:', err);
      return { success: false, reason: 'error', message: err?.message || String(err) };
    }
  });

  // IC Import
  ipcMain.handle('import-ic-excel-data', async (_, data: any[]) => {
    try {
      const db = getDB();
      let added = 0;
      let ignored = 0;

      const importTx = db.transaction(() => {
        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || row.length < 1) continue;

          const icNumber = String(row[0] || '').trim();
          if (!icNumber) {
            ignored++;
            continue;
          }

          const componentType = row[1] ? String(row[1]).trim() : '';
          const compatibleDevices = row[2] ? String(row[2]).trim() : '';
          const notes = row[3] ? String(row[3]).trim() : '';

          const exists = db.prepare('SELECT id FROM ic_compatibilities WHERE ic_number = ? AND component_type = ? AND compatible_devices = ?')
            .get(icNumber, componentType, compatibleDevices);

          if (exists) {
            ignored++;
            continue;
          }

          icRepo.addIcCompatibility({
            ic_number: icNumber,
            component_type: componentType,
            compatible_devices: compatibleDevices,
            notes
          });
          added++;
        }
      });

      importTx();
      return { success: true, added, ignored };
    } catch (err: any) {
      console.error('[IC Import] Error:', err);
      return { success: false, reason: 'error', message: err?.message || String(err) };
    }
  });

  ipcMain.handle('import-ic-excel', async () => {
    const dialogOptions = {
      title: 'استيراد ملف إكسل لبدائل الآيسيات',
      properties: ['openFile' as const],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    };

    const { canceled, filePaths } = mainWindow
      ? await dialog.showOpenDialog(mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return { success: false, reason: 'cancelled' };
    }

    try {
      const workbook = xlsx.readFile(filePaths[0]);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

      const db = getDB();
      let added = 0;
      let ignored = 0;

      const importTx = db.transaction(() => {
        for (let i = 1; i < data.length; i++) {
          const row = data[i] as any[];
          if (!row || row.length < 1) continue;

          const icNumber = String(row[0] || '').trim();
          if (!icNumber) {
            ignored++;
            continue;
          }

          const componentType = row[1] ? String(row[1]).trim() : '';
          const compatibleDevices = row[2] ? String(row[2]).trim() : '';
          const notes = row[3] ? String(row[3]).trim() : '';

          const exists = db.prepare('SELECT id FROM ic_compatibilities WHERE ic_number = ? AND component_type = ? AND compatible_devices = ?')
            .get(icNumber, componentType, compatibleDevices);

          if (exists) {
            ignored++;
            continue;
          }

          icRepo.addIcCompatibility({
            ic_number: icNumber,
            component_type: componentType,
            compatible_devices: compatibleDevices,
            notes
          });
          added++;
        }
      });

      importTx();
      return { success: true, added, ignored };
    } catch (err: any) {
      console.error('[IC File Import] Error:', err);
      return { success: false, reason: 'error', message: err?.message || String(err) };
    }
  });

  // Update Current Month Capital
  ipcMain.handle('update-month-capital', (_, newCapital) => {
    return monthsRepo.updateCurrentMonthCapital(newCapital);
  });

  // Close Month with Excel
  ipcMain.handle('close-month-with-excel', async (_, newCapital) => {
    try {
      const currentMonth = monthsRepo.getCurrentMonth();
      const allOps = operationsRepo.getAllOperations().filter(op => op.month_id === currentMonth.id);
      const allWiths = withdrawalsRepo.getWithdrawals();

      const opsFormatted = allOps.map(op => {
        const paidAmt = op.paid_amount !== undefined ? op.paid_amount : (op.payment_status === 'cash' ? op.price : 0);
        const remAmt = Math.max(0, op.price - paidAmt);
        return {
          "رقم العملية": op.id,
          "التاريخ": op.date,
          "اسم العميل": op.customer_name,
          "الجهاز": op.device,
          "اسم الفني": op.technician_name || '-',
          "حالة الدفع": op.payment_status === 'cash' ? 'نقدي' : (op.payment_status === 'partial' ? 'مدفوع جزئياً' : 'دين'),
          "المبلغ الإجمالي": op.price,
          "التكلفة": op.cost,
          "المدفوع": paidAmt,
          "المتبقي (الدين)": remAmt,
          "صافي الربح": op.price - op.cost,
          "حصة الفني": op.tech_profit,
          "حصة المحل": op.shop_profit
        };
      });

      const withFormatted = allWiths.map(w => ({
        "رقم السحب": w.id,
        "التاريخ": w.date,
        "النوع": w.type === 'shop_withdrawal' ? 'سحب محل' : 'سحب فني',
        "اسم الفني": w.technician_name || '-',
        "المبلغ": w.amount,
        "الملاحظات": w.description || '-'
      }));

      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(opsFormatted), "سجل العمليات");
      xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(withFormatted), "سجل السحوبات");

      const defaultFilename = `تقرير_إغلاق_${currentMonth.month_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const dialogOptions = {
        title: 'حفظ تقرير إغلاق الشهر (Excel)',
        defaultPath: defaultFilename,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      };

      const { canceled, filePath } = mainWindow
        ? await dialog.showSaveDialog(mainWindow, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (canceled || !filePath) {
        return { success: false, reason: 'cancelled' };
      }

      xlsx.writeFile(wb, filePath);

      // Close the month in SQLite
      const closeResult = monthsRepo.closeMonth(newCapital);
      return closeResult;
    } catch (err: any) {
      console.error('[Close Month with Excel] Error:', err);
      return { success: false, reason: 'error', message: err?.message || String(err) };
    }
  });

  // Full Backup (5-sheet Arabic Excel + JSON snapshot)
  ipcMain.handle('create-full-backup', async () => {
    try {
      const allOps = operationsRepo.getAllOperations();
      const allWiths = withdrawalsRepo.getAllWithdrawals();
      const allTechs = techniciansRepo.getAllTechnicians();
      const allCusts = customersRepo.getCustomers();
      const dashStats = statsRepo.getDashboardStats();
      const techStats = statsRepo.getTechnicianStats();

      const getPaidAmount = (op: any) => op.paid_amount ?? (op.payment_status === 'cash' ? (op.price || 0) : 0);
      const getRemainingAmount = (op: any) => Math.max(0, (op.price || 0) - getPaidAmount(op));

      const getStatusLabel = (status: string) => {
        switch (status) {
          case 'under_maintenance': return 'قيد الصيانة';
          case 'completed': return 'جاهز / مكتمل';
          case 'delivered': return 'تم التسليم';
          case 'cancelled': return 'ملغى';
          default: return status || '-';
        }
      };

      const getPaymentStatusLabel = (pStatus: string, paidAmt?: number, price?: number) => {
        if (pStatus === 'cash' || (paidAmt !== undefined && price !== undefined && paidAmt >= price)) {
          return 'نقدي (مدفوع بالكامل)';
        }
        if (pStatus === 'partial' || (paidAmt !== undefined && price !== undefined && paidAmt > 0 && paidAmt < price)) {
          return 'مدفوع جزئياً';
        }
        if (pStatus === 'debt') {
          return 'دين (آجل)';
        }
        return pStatus || '-';
      };

      const summaryData: any[][] = [
        ["التقرير المالي العام وخلاصة الكاش والأرباح"],
        ["تاريخ التصدير", new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' })],
        [""],
        ["=== حركة الكاش والصندوق ==="],
        ["رأس المال الافتتاحي للشهر", dashStats.baseCapital],
        ["إجمالي سحوبات الشهر", dashStats.totalWithdrawals],
        ["صافي رصيد الكاش / الصندوق الحالي", dashStats.cashBox],
        [""],
        ["=== ملخص الأرباح ==="],
        ["إجمالي الأرباح الكلية (للأجهزة المسلمة)", dashStats.totalProfit],
        ["إجمالي أرباح المحل (الصافية)", dashStats.totalShopProfit],
        ["إجمالي سحوبات المحل", dashStats.totalShopWithdrawal],
        ["الصافي المستحق للمحل", dashStats.shopDue],
        ["أرباح متوقعة قيد الإنجاز (أجهزة لم تُسلّم)", dashStats.uncollectedProfit],
        [""],
        ["=== ملخص الديون بالسوق ==="],
        ["إجمالي الديون المتبقية بذمة العملاء", dashStats.debtTotal],
        [""],
        ["=== ملخص مستحقات وأرباح الفنيين ==="],
        ["إجمالي أرباح جميع الفنيين", dashStats.totalTechProfit],
        [""],
        ["جدول تفصيلي بأرصدة وأرباح كل فني:"],
        ["اسم الفني", "نسبة الربح", "إجمالي التكلفة", "إجمالي الأرباح المحققة", "إجمالي السحوبات", "الرصيد المتبقي المستحق", "الحالة"]
      ];

      techStats.forEach(t => {
        summaryData.push([
          t.name,
          `${((t.profit_percentage || 0) * 100).toFixed(0)}%`,
          t.totalCost,
          t.totalProfit,
          t.totalWithdrawal,
          t.remainingBalance,
          t.is_active ? 'نشط' : 'غير نشط'
        ]);
      });

      const wb = xlsx.utils.book_new();

      // Sheet 1: Summary
      const wsSummary = xlsx.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 15 }];
      xlsx.utils.book_append_sheet(wb, wsSummary, "التقرير المالي والخلاصة");

      // Sheet 2: Operations
      const opsFormatted = allOps.map(op => ({
        "رقم العملية": op.id,
        "التاريخ": op.date,
        "اسم العميل": op.customer_name || '-',
        "هاتف العميل": op.customer_phone || '-',
        "الجهاز": op.device || '-',
        "الأعطال": Array.isArray(op.faults) ? op.faults.join('، ') : (op.faults || '-'),
        "اسم الفني": op.technician_name || '-',
        "حالة الجهاز": getStatusLabel(op.status),
        "حالة الدفع": getPaymentStatusLabel(op.payment_status, op.paid_amount, op.price),
        "المبلغ الإجمالي": op.price,
        "التكلفة": op.cost,
        "المبلغ الواصل (المدفوع)": getPaidAmount(op),
        "المبلغ المتبقي (الدين)": getRemainingAmount(op),
        "صافي الربح": op.price - op.cost,
        "حصة الفني": op.tech_profit,
        "حصة المحل": op.shop_profit,
        "نسبة الفني": op.tech_profit_percentage !== undefined ? `${(op.tech_profit_percentage * 100).toFixed(0)}%` : '-',
        "الضمان": op.warranty_enabled ? (op.warranty_days ? `${op.warranty_days} يوم` : 'مفعل') : 'بدون ضمان',
        "تاريخ انتهاء الضمان": op.warranty_expiry_date || '-',
        "ملاحظات الضمان": op.warranty_note || '-',
        "ملاحظات عامة": op.notes || '-'
      }));

      const wsOps = xlsx.utils.json_to_sheet(opsFormatted);
      wsOps['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 18 },
        { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 16 },
        { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
        { wch: 22 }
      ];
      xlsx.utils.book_append_sheet(wb, wsOps, "سجل العمليات");

      // Sheet 3: Withdrawals
      const withdrawalsFormatted = allWiths.map(w => ({
        "رقم السحب": w.id,
        "التاريخ": w.date,
        "نوع السحب": w.type === 'shop_withdrawal' ? 'سحب محل' : 'سحب فني',
        "اسم الفني": w.technician_name || '-',
        "المبلغ": w.amount,
        "البيان / الملاحظات": w.description || '-'
      }));
      const wsWith = xlsx.utils.json_to_sheet(withdrawalsFormatted);
      wsWith['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 30 }];
      xlsx.utils.book_append_sheet(wb, wsWith, "سجل السحوبات");

      // Sheet 4: Technicians
      const techFormatted = techStats.map(tech => ({
        "رقم الفني": tech.id,
        "اسم الفني": tech.name,
        "نسبة الفني": `${((tech.profit_percentage || 0) * 100).toFixed(0)}%`,
        "الحالة": tech.is_active ? 'نشط' : 'غير نشط',
        "أرباح الشهر الحالي": tech.totalProfit,
        "سحوبات الشهر الحالي": tech.totalWithdrawal,
        "الرصيد المستحق": tech.remainingBalance
      }));
      const wsTech = xlsx.utils.json_to_sheet(techFormatted);
      wsTech['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
      xlsx.utils.book_append_sheet(wb, wsTech, "سجل الفنيين");

      // Sheet 5: Customers
      if (allCusts && allCusts.length > 0) {
        const custFormatted = allCusts.map(c => ({
          "رقم العميل": c.id,
          "اسم العميل": c.name || '-',
          "رقم الهاتف": c.phone || '-',
          "ملاحظات": c.notes || '-',
          "تاريخ الإضافة": c.created_at || '-'
        }));
        const wsCust = xlsx.utils.json_to_sheet(custFormatted);
        wsCust['!cols'] = [{ wch: 16 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 25 }];
        xlsx.utils.book_append_sheet(wb, wsCust, "سجل العملاء");
      }

      const defaultPath = `Full_Backup_${new Date().toISOString().split('T')[0]}.xlsx`;
      const dialogOptions = {
        title: 'حفظ نسخة احتياطية كاملة (Excel & JSON)',
        defaultPath: defaultPath,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      };

      const { canceled, filePath } = mainWindow
        ? await dialog.showSaveDialog(mainWindow, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);

      if (canceled || !filePath) {
        return { success: false, reason: 'cancelled' };
      }

      // Save Excel
      xlsx.writeFile(wb, filePath);

      // Save companion JSON
      const jsonFilePath = filePath.toLowerCase().endsWith('.xlsx') 
        ? filePath.slice(0, -5) + '.json' 
        : `${filePath}.json`;
      
      const fullSnapshot = {
        settings: settingsRepo.getSettings(),
        months: monthsRepo.getAllMonths(),
        technicians: allTechs,
        customers: allCusts,
        operations: allOps,
        withdrawals: allWiths,
        quick_lists: quickListsRepo.getQuickLists(),
        ic_compatibilities: icRepo.getIcCompatibilities(),
        scrap_devices: scrapRepo.getScrapDevices()
      };
      fs.writeFileSync(jsonFilePath, JSON.stringify(fullSnapshot, null, 2), 'utf-8');

      return { success: true };
    } catch (err: any) {
      console.error('[Full Backup] Error:', err);
      return { success: false, reason: 'error', message: err?.message || String(err) };
    }
  });

  // SQLite Backups
  ipcMain.handle('backup:create', async () => {
    return createSQLiteBackup(true);
  });

  ipcMain.handle('backup:list', () => {
    return listSQLiteBackups();
  });

  ipcMain.handle('backup:restore', async (_, filename) => {
    return restoreSQLiteBackup(filename);
  });

  // Factory Reset
  ipcMain.handle('factory-reset', async () => {
    try {
      // 1. Mandatory SQLite Backup before wipe
      const backupResult = await createSQLiteBackup(true);
      if (!backupResult.success) {
        return { success: false, reason: 'FACTORY_RESET_BACKUP_FAILED', message: 'فشل إنشاء نسخة احتياطية إجبارية. تم إيقاف عملية التصفير لحماية البيانات.' };
      }

      const db = getDB();
      const resetTx = db.transaction(() => {
        db.prepare('DELETE FROM payments').run();
        db.prepare('DELETE FROM operations').run();
        db.prepare('DELETE FROM withdrawals').run();
        db.prepare('UPDATE technicians SET start_balance = 0').run();
        db.prepare('DELETE FROM months WHERE id > 1').run();

        const now = new Date();
        const settings = settingsRepo.getSettings();
        db.prepare(`
          UPDATE months
          SET month_name = ?, start_capital = ?, is_closed = 0, created_at = ?, closed_at = NULL
          WHERE id = 1
        `).run(
          now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
          settings.base_capital || 0,
          now.toISOString()
        );
      });

      resetTx();
      return { success: true };
    } catch (err: any) {
      console.error('[Factory Reset] Error:', err);
      return { success: false, reason: 'FACTORY_RESET_FAILED', message: err?.message || String(err) };
    }
  });
}
