import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, 'database.json');

// Reset test DB
const initialData = {
  settings: { base_capital: 1000 },
  months: [
    { id: 1, month_name: 'Month 1', start_capital: 1000, is_closed: false, created_at: new Date().toISOString(), closed_at: null }
  ],
  technicians: [
    { id: 1, name: 'Tech 1', profit_percentage: 0.3, is_active: true }
  ],
  operations: [],
  withdrawals: [],
  ic_compatibilities: [],
  scrap_devices: []
};
fs.writeFileSync(TEST_DB_PATH, JSON.stringify(initialData));
console.log('✅ Created test DB');

// Mock Electron environment
let readyCallback: any;
(global as any).app = {
  getPath: () => __dirname,
  getAppPath: () => __dirname,
  whenReady: () => ({ then: (cb: any) => readyCallback = cb }),
  on: () => {},
  quit: () => {},
  relaunch: () => {},
  exit: () => {}
};
(global as any).ipcMain = {
  handle: (event: string, handler: any) => {
    (global as any).handlers = (global as any).handlers || {};
    (global as any).handlers[event] = handler;
  }
};
(global as any).BrowserWindow = class {
  loadURL() {}
  once() {}
  setMenuBarVisibility() {}
  maximize() {}
  loadFile() {}
  webContents = { send: () => {} }
};
(global as any).dialog = {
  showSaveDialog: async () => ({ canceled: true }),
  showOpenDialog: async () => ({ canceled: true })
};

const mockElectron = {
  app: (global as any).app,
  ipcMain: (global as any).ipcMain,
  BrowserWindow: (global as any).BrowserWindow,
  dialog: (global as any).dialog
};
require('module').prototype.require = new Proxy(require('module').prototype.require, {
  apply(target, thisArg, argumentsList) {
    if (argumentsList[0] === 'electron') return mockElectron;
    if (argumentsList[0] === './database.js') return Reflect.apply(target, thisArg, ['./database.ts']);
    if (argumentsList[0] === './backup.js') return Reflect.apply(target, thisArg, ['./backup.ts']);
    return Reflect.apply(target, thisArg, argumentsList);
  }
});

import './electron/database';
import './electron/backup';
import './electron/main';

const handlers = (global as any).handlers;

async function runTests() {
  console.log('\n====================================');
  console.log('FINAL P0 PATCH TESTS');
  console.log('====================================');
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      failed++;
    }
  };

  const dbModule = require('./electron/database');
  await new Promise(r => setTimeout(r, 1000)); // wait for initDB
  if (readyCallback) await readyCallback();

  const handlers = (global as any).handlers;

  // ---------------------------------------------------------
  // 1. Month ID Generation Test
  // ---------------------------------------------------------
  console.log('\n--- Test 1: Month ID Generation ---');
  dbModule.db.data.months = [
    { id: 1, is_closed: true },
    { id: 2, is_closed: true },
    { id: 3, is_closed: false }
  ];
  await handlers['close-month']({}, 1500);
  assert(dbModule.db.data.months.length === 4, 'Should have 4 months after close');
  assert(dbModule.db.data.months[3].id === 4, 'Next month ID should be 4');
  
  // Simulate missing ID
  dbModule.db.data.months = [
    { id: 1, is_closed: true },
    { id: 2, is_closed: true },
    { id: 4, is_closed: false }
  ];
  await handlers['close-month']({}, 1500);
  assert(dbModule.db.data.months[3].id === 5, 'Next month ID should be 5, resolving correctly when missing IDs exist');
  
  // Reset for next test
  dbModule.db.data.months = [
    { id: 1, month_name: 'Month 1', start_capital: 1000, is_closed: false, created_at: new Date().toISOString(), closed_at: null }
  ];
  dbModule.db.data.operations = [];

  // ---------------------------------------------------------
  // 2. Two-Month Financial Test
  // ---------------------------------------------------------
  console.log('\n--- Test 2: Two-Month Financials ---');
  // Month 1
  await handlers['add-operation']({}, {
    technician_id: 1, customer_name: 'Cash Guy', device: 'Phone A', 
    price: 100000, cost: 40000, shop_profit: 42000, tech_profit: 18000, payment_status: 'cash', status: 'delivered'
  }); // Cash: Net profit 60k -> Shop 42k, Tech 18k
  
  await handlers['add-operation']({}, {
    technician_id: 1, customer_name: 'Debt Guy', device: 'Phone B', 
    price: 200000, cost: 80000, shop_profit: 84000, tech_profit: 36000, payment_status: 'debt', status: 'delivered'
  }); // Debt: Net profit 120k -> Shop 84k, Tech 36k

  // Validate Month 1 before close
  let statsM1 = await handlers['get-dashboard-stats']({});
  assert(statsM1.cashBox === -19000, `Cashbox should be -19000, is ${statsM1.cashBox}`);
  assert(statsM1.debtTotal === 200000, `Debt total should be 200000, is ${statsM1.debtTotal}`);
  assert(statsM1.tiedCapital === 80000, `Tied capital should be 80000, is ${statsM1.tiedCapital}`);
  assert(statsM1.realizedShopProfit === 42000, `Realized Shop profit should be 42000, is ${statsM1.realizedShopProfit}`);
  
  // Close Month 1
  await handlers['close-month']({}, 1500);
  assert(dbModule.db.data.months[0].is_closed === true, 'Month 1 closed');
  assert(dbModule.db.data.months[1].id === 2, 'Month 2 created');

  // Month 2
  // Pay debt B
  const debts = await handlers['get-debts']({});
  const debtOp = debts[0];
  await handlers['pay-debt']({}, debtOp.id); // Get real ID

  // Add new operation
  await handlers['add-operation']({}, {
    technician_id: 1, customer_name: 'Month 2 Guy', device: 'Phone C', 
    price: 50000, cost: 20000, shop_profit: 21000, tech_profit: 9000, payment_status: 'cash', status: 'delivered'
  }); // Cash: Net profit 30k -> Shop 21k, Tech 9k

  // Validate Month 2
  let statsM2 = await handlers['get-dashboard-stats']({});
  console.log(`Month 2 Realized Profit: ${statsM2.realizedShopProfit}`);
  console.log(`Month 2 Debt Total: ${statsM2.debtTotal}`);
  console.log(`Month 2 Tied Capital: ${statsM2.tiedCapital}`);
  
  // Realized profit in M2 = M2 cash ops (21000) + paid debts from M1 (84000) = 105000
  assert(statsM2.realizedShopProfit === 105000, `Realized shop profit should be 105000, is ${statsM2.realizedShopProfit}`);
  assert(statsM2.debtTotal === 0, `Debt total should be 0, is ${statsM2.debtTotal}`);
  assert(statsM2.tiedCapital === 0, `Tied capital should be 0, is ${statsM2.tiedCapital}`); // only M2 debts count for tied capital in M2 close

  // Close Month 2
  await handlers['close-month']({}, 2000);

  // ---------------------------------------------------------
  // 3. Month Close Failure Test
  // ---------------------------------------------------------
  console.log('\n--- Test 3: Month Close Failure ---');
  let currentMonthBefore = dbModule.db.data.months[2];
  assert(currentMonthBefore.is_closed === false, 'Month 3 is open');
  
  const origSave = dbModule.db.save;
  dbModule.db.save = () => false; // Simulate failure
  
  const resClose = await handlers['close-month']({}, 3000);
  assert(resClose.success === false && resClose.reason === 'MONTH_CLOSE_SAVE_FAILED', 'Should catch save failure during close');
  
  // Verify state wasn't partially committed
  assert(dbModule.db.data.months.length === 3, 'Should still only have 3 months');
  assert(dbModule.db.data.months[2].is_closed === false, 'Month 3 should still be open');
  
  dbModule.db.save = origSave; // Restore

  console.log(`\n====================================`);
  console.log(`Test Summary: Passed: ${passed} | Failed: ${failed}`);
  console.log(`====================================`);
  
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests();
