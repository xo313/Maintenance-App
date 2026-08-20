import fs from 'fs';
import path from 'path';
import { runAutomaticMigration } from './electron/db/migration.js';
import { getDB, openDatabase, closeDB } from './electron/db/connection.js';

// Setup Mock legacy database
const mockLegacyData = {
  settings: { base_capital: 0 },
  months: [{ id: 1, month_name: "July", start_capital: 0, is_closed: false, created_at: "2026-07-01T00:00:00Z" }],
  technicians: [{ id: 1, name: "Tech1", profit_percentage: 0.5, start_balance: 0, is_active: true }],
  customers: [],
  operations: [
    { id: 1, date: "2026-07-02", month_id: 1, technician_id: 1, customer_name: "C1", device: "D1", cost: 100, price: 200, shop_profit: 50, tech_profit: 50, payment_status: "cash", status: "delivered", paid_amount: 200 }
  ],
  withdrawals: [
    { id: 1, date: "2026-07-03", month_id: 1, amount: 50, type: "shop_withdrawal", technician_id: null }
  ]
};

function prepareTestDir(dirName: string) {
  const dirPath = path.join(process.cwd(), dirName);
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
  process.env.TEST_USER_DATA = dirPath;
  return dirPath;
}

function verifyFinancials(db: any, testName: string) {
  const cashOps = db.prepare('SELECT SUM(amount) as s FROM cash_transactions').get();
  const opsPrice = db.prepare('SELECT SUM(price) as s FROM operations').get();
  
  if (cashOps.s !== 250) { 
    throw new Error(`Financials Mismatch in ${testName}. Expected cash_transactions to sum 250, got ${cashOps.s}`);
  }
  console.log(`[${testName}] Financials OK. CashTxSum=${cashOps.s}, OpsPriceSum=${opsPrice.s}`);
}

async function runTests() {
  console.log('--- STARTING MIGRATION ARCHITECTURE TESTS ---\n');

  // TEST 1: Fresh Install
  try {
    console.log('TEST 1: Fresh Install');
    const dir = prepareTestDir('test_1_fresh');
    closeDB();
    const result = runAutomaticMigration();
    if (!result) throw new Error("Fresh install migration returned false.");
    const db = openDatabase();
    const state = db.prepare('SELECT * FROM legacy_migration_state WHERE id = 1').get() as any;
    if (state.status !== 'COMPLETED' || state.source_hash !== 'fresh_install') {
      throw new Error(`Fresh install state invalid: ${JSON.stringify(state)}`);
    }
    console.log('✔ TEST 1 PASSED\n');
  } catch(e) {
    console.error('✘ TEST 1 FAILED', e);
  }

  // TEST 2: Legacy Migration
  try {
    console.log('TEST 2: Legacy Migration');
    const dir = prepareTestDir('test_2_legacy');
    fs.writeFileSync(path.join(dir, 'database.json'), JSON.stringify(mockLegacyData));
    closeDB();
    const result = runAutomaticMigration();
    if (!result) throw new Error("Legacy migration returned false.");
    const db = openDatabase();
    const state = db.prepare('SELECT * FROM legacy_migration_state WHERE id = 1').get() as any;
    if (state.status !== 'COMPLETED') {
      throw new Error(`Legacy migration state invalid: ${JSON.stringify(state)}`);
    }
    verifyFinancials(db, 'TEST 2');
    console.log('✔ TEST 2 PASSED\n');
  } catch(e) {
    console.error('✘ TEST 2 FAILED', e);
  }

  // TEST 3: Safe Adoption (Missing state but valid V2 DB)
  try {
    console.log('TEST 3: Safe Adoption');
    const dir = prepareTestDir('test_3_adoption');
    closeDB();
    
    // Construct a fake V2 database without the state marker
    const db = openDatabase();
    db.prepare(`INSERT INTO settings (id, base_capital, shop_name) VALUES (1, 0, 'Test Shop')`).run();
    db.prepare(`INSERT INTO months (id, month_name, start_capital, is_closed, created_at) VALUES (1, 'July', 0, 0, '2026-07-01')`).run();
    db.prepare(`INSERT INTO technicians (id, name, profit_percentage, start_balance, is_active) VALUES (1, 'TestTech', 0.5, 0, 1)`).run();
    db.prepare(`DELETE FROM legacy_migration_state`).run(); // REMOVE marker completely!
    closeDB();

    const result = runAutomaticMigration(); // Should adopt it!
    if (!result) throw new Error("Safe adoption returned false.");
    
    const dbCheck = openDatabase();
    const state = dbCheck.prepare('SELECT * FROM legacy_migration_state WHERE id = 1').get() as any;
    if (state.status !== 'ADOPTED') {
      throw new Error(`Expected ADOPTED state, got: ${JSON.stringify(state)}`);
    }
    console.log('✔ TEST 3 PASSED\n');
  } catch(e) {
    console.error('✘ TEST 3 FAILED', e);
  }

  // TEST 4: Interrupt and Recovery
  try {
    console.log('TEST 4: Interrupted Recovery');
    const dir = prepareTestDir('test_4_recovery');
    fs.writeFileSync(path.join(dir, 'database.json'), JSON.stringify(mockLegacyData));
    closeDB();
    
    // Simulate a failed/interrupted migration by inserting FAILED state
    const db = openDatabase();
    db.prepare('INSERT INTO legacy_migration_state (id, status, error, updated_at) VALUES (1, \'FAILED\', \'Simulation error\', \'now\')').run();
    // Simulate partial data (which should be deleted)
    db.prepare('INSERT INTO months (id, month_name, start_capital, is_closed, created_at) VALUES (10, \'FakeMonth\', 0, 0, \'now\')').run();
    closeDB();

    const result = runAutomaticMigration();
    if (!result) throw new Error("Recovery migration returned false.");
    
    const dbCheck = openDatabase();
    const state = dbCheck.prepare('SELECT * FROM legacy_migration_state WHERE id = 1').get() as any;
    if (state.status !== 'COMPLETED') {
      throw new Error(`Expected COMPLETED after recovery, got: ${JSON.stringify(state)}`);
    }
    const fakeMonth = dbCheck.prepare('SELECT * FROM months WHERE id = 10').get();
    if (fakeMonth) throw new Error("Partial data was not cleared during idempotency reset!");
    
    verifyFinancials(dbCheck, 'TEST 4');
    console.log('✔ TEST 4 PASSED\n');
  } catch(e) {
    console.error('✘ TEST 4 FAILED', e);
  }

  console.log('--- ALL TESTS FINISHED ---');
}

runTests();
