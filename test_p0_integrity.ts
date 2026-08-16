import fs from 'fs';
import path from 'path';

// This is a manual test suite to verify P0 integrity fixes.
// We will mock the database and run handlers manually.

const TEST_DB_PATH = path.join(__dirname, 'database.json');

// Reset test DB
const initialData = {
  settings: { base_capital: 1000 },
  months: [
    { id: 1, month_name: 'test', start_capital: 1000, is_closed: false, created_at: new Date().toISOString() }
  ],
  technicians: [
    { id: 1, name: 'Tech 1', profit_percentage: 0.3, is_active: true }
  ],
  operations: [
    {
      id: 1, month_id: 1, technician_id: 1, 
      price: 100, cost: 50, payment_status: 'debt', status: 'delivered',
      tech_profit: 15, shop_profit: 35
    }
  ],
  withdrawals: [],
  ic_compatibilities: [],
  scrap_devices: []
};
fs.writeFileSync(TEST_DB_PATH, JSON.stringify(initialData));

console.log('✅ Created test DB');

// Mock Electron environment so main.ts can run
(global as any).app = {
  getPath: () => __dirname,
  getAppPath: () => __dirname,
  whenReady: async () => {},
  on: () => {},
  quit: () => {},
  relaunch: () => {},
  exit: () => {}
} as any;
(global as any).ipcMain = {
  handle: (event: string, handler: any) => {
    (global as any).handlers = (global as any).handlers || {};
    (global as any).handlers[event] = handler;
  }
} as any;
(global as any).BrowserWindow = class {
  loadURL() {}
  once() {}
  webContents = { send: () => {} }
} as any;
(global as any).dialog = {
  showSaveDialog: async () => ({ canceled: true }),
  showOpenDialog: async () => ({ canceled: true })
} as any;

// Inject mocked modules
const mockElectron = {
  app: (global as any).app,
  ipcMain: (global as any).ipcMain,
  BrowserWindow: (global as any).BrowserWindow,
  dialog: (global as any).dialog
};
require('module').prototype.require = new Proxy(require('module').prototype.require, {
  apply(target, thisArg, argumentsList) {
    if (argumentsList[0] === 'electron') {
      return mockElectron;
    }
    return Reflect.apply(target, thisArg, argumentsList);
  }
});

import './electron/database';
import './electron/backup';
import './electron/main';

const handlers = (global as any).handlers;

async function runTests() {
  console.log('--- Starting P0 Integrity Tests ---');
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

  // Give database time to init (it reads async)
  await new Promise(r => setTimeout(r, 1000));

  // Test 1: add-operation with unknown tech
  console.log('\nTest 1: Unknown Tech Validation');
  const res1 = await handlers['add-operation']({}, {
    technician_id: 999, // Unknown
    price: 100, cost: 50, payment_status: 'cash', status: 'delivered'
  });
  assert(res1.success === false && res1.reason === 'UNKNOWN_TECHNICIAN', 'Should reject unknown tech ID in add-operation');

  // Test 2: edit-operation retroactively
  console.log('\nTest 2: Retroactive Edit Protection');
  // First we need to manually mock an operation in a past month
  const dbModule = require('./electron/database').default;
  dbModule.data.operations.push({
    id: 99, month_id: -1, technician_id: 1, 
    price: 100, cost: 50, payment_status: 'cash', status: 'delivered'
  });
  const res2 = await handlers['edit-operation']({}, 99, { price: 200 });
  assert(res2.success === false && res2.reason === 'CANNOT_EDIT_PAST_MONTH', 'Should reject edit-operation on past month');

  // Test 3: Save Failure Rollback
  console.log('\nTest 3: Save Failure Rollback (add-operation)');
  const origSave = dbModule.save;
  dbModule.save = () => false; // Inject failure
  const preLen = dbModule.data.operations.length;
  
  const res3 = await handlers['add-operation']({}, {
    technician_id: 1,
    price: 100, cost: 50, payment_status: 'cash', status: 'delivered'
  });
  assert(res3.success === false && res3.reason === 'DATABASE_SAVE_FAILED', 'Should return DATABASE_SAVE_FAILED on db.save() == false');
  assert(dbModule.data.operations.length === preLen, 'Should rollback memory state when save fails');
  
  dbModule.save = origSave; // Restore

  // Test 4: Invalid newCapital
  console.log('\nTest 4: Invalid Capital');
  const res4 = await handlers['close-month']({}, -500);
  assert(res4.success === false && res4.reason === 'INVALID_NEW_CAPITAL', 'Should reject negative capital in close-month');
  
  const res4b = await handlers['close-month-with-excel']({}, NaN);
  assert(res4b.success === false && res4b.reason === 'INVALID_NEW_CAPITAL', 'Should reject NaN capital in close-month-with-excel');

  // Test 5: Pay Debt already paid
  console.log('\nTest 5: Pay Debt Double Spend Protection');
  dbModule.data.operations.push({
    id: 101, month_id: 1, technician_id: 1, 
    price: 100, cost: 50, payment_status: 'cash', status: 'delivered' // ALREADY CASH
  });
  const res5 = await handlers['pay-debt']({}, 101);
  assert(res5.success === false && res5.reason === 'DEBT_ALREADY_PAID', 'Should reject paying a debt that is already paid/cash');

  console.log(`\n--- Test Summary ---`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests();
