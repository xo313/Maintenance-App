import path from 'node:path';
import fs from 'node:fs';
import { openDatabase, getDB, isIntegrityOk, closeDB } from './electron/db/connection.js';
import * as settingsRepo from './electron/db/repositories/settingsRepo.js';
import * as monthsRepo from './electron/db/repositories/monthsRepo.js';
import * as techniciansRepo from './electron/db/repositories/techniciansRepo.js';
import * as customersRepo from './electron/db/repositories/customersRepo.js';
import * as operationsRepo from './electron/db/repositories/operationsRepo.js';
import * as withdrawalsRepo from './electron/db/repositories/withdrawalsRepo.js';
import * as statsRepo from './electron/db/repositories/statsRepo.js';
import { createSQLiteBackup, listSQLiteBackups, restoreSQLiteBackup } from './electron/db/backup.js';
import { runAutomaticMigration } from './electron/db/migration.js';

const TEST_DIR = path.join(process.cwd(), 'test_sqlite_env');

function setupTestEnv() {
  closeDB();
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
  process.env.TEST_USER_DATA = TEST_DIR;
}

function cleanupTestEnv() {
  closeDB();
  if (fs.existsSync(TEST_DIR)) {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  }
}

async function runTests() {
  console.log('🚀 [Test Suite] Starting comprehensive SQLite architecture tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Fresh Database Initialization & Integrity
    // -------------------------------------------------------------
    console.log('📦 Test 1: Fresh Database Initialization & Integrity');
    setupTestEnv();
    const db = openDatabase();
    assert(fs.existsSync(path.join(TEST_DIR, 'maintenance.db')), 'maintenance.db created on disk');
    assert(isIntegrityOk(db), 'PRAGMA integrity_check returns ok');

    // -------------------------------------------------------------
    // Test 2: Settings Repository
    // -------------------------------------------------------------
    console.log('\n⚙️ Test 2: Settings Repository');
    const defaultSettings = settingsRepo.getSettings();
    assert(defaultSettings.shop_name === 'مركز الصيانة', 'Default settings initialized');
    settingsRepo.updateSettings({ shop_name: 'مركز النجوم', base_capital: 500000 });
    const updatedSettings = settingsRepo.getSettings();
    assert(updatedSettings.shop_name === 'مركز النجوم', 'Settings updated shop_name');
    assert(updatedSettings.base_capital === 500000, 'Settings updated base_capital');

    // -------------------------------------------------------------
    // Test 3: Months & Technicians Repository
    // -------------------------------------------------------------
    console.log('\n👨‍🔧 Test 3: Months & Technicians Repository');
    const currentMonth = monthsRepo.getCurrentMonth();
    assert(currentMonth.id === 1, 'Initial month has id = 1');

    const addTech1 = techniciansRepo.addTechnician('Ali Eng', 0.6);
    const addTech2 = techniciansRepo.addTechnician('Hassan Tech', 0.5);
    assert(addTech1.success && addTech1.data?.name === 'Ali Eng', 'Technician Ali added');
    assert(addTech2.success && addTech2.data?.profit_percentage === 0.5, 'Technician Hassan added');

    const activeTechs = techniciansRepo.getTechnicians();
    assert(activeTechs.length === 2, '2 active technicians listed');

    techniciansRepo.deleteTechnician(addTech2.data!.id);
    const activeAfterDelete = techniciansRepo.getTechnicians();
    assert(activeAfterDelete.length === 1 && activeAfterDelete[0].name === 'Ali Eng', 'Soft delete technician works');

    // -------------------------------------------------------------
    // Test 4: Customers & Operations Repository (Cash, Partial, Debt)
    // -------------------------------------------------------------
    console.log('\n📱 Test 4: Customers & Operations Lifecycle (Cash, Partial, Debt)');
    const custRes = customersRepo.addCustomer({ name: 'أحمد جاسم', phone: '07700000000' });
    assert(custRes.success && custRes.data?.name === 'أحمد جاسم', 'Customer created');

    const aliTechId = addTech1.data!.id;

    // Op 1: Cash operation delivered immediately (Price: 100, Cost: 40 -> Profit: 60, Tech 60%: 36, Shop: 24)
    const op1Res = operationsRepo.addOperation({
      id: 101,
      customer_name: 'أحمد جاسم',
      customer_phone: '07700000000',
      device: 'iPhone 13',
      faults: ['تبديل شاشة'],
      price: 100,
      cost: 40,
      technician_id: aliTechId,
      payment_status: 'cash',
      status: 'delivered'
    });
    assert(op1Res.success, 'Cash delivered operation created');
    assert(op1Res.data?.shop_profit === 24 && op1Res.data?.tech_profit === 36, 'Cash op profit split is accurate');

    // Op 2: Partial payment operation (Price: 100, Cost: 30, Paid: 40 -> Remaining debt: 60)
    const op2Res = operationsRepo.addOperation({
      id: 102,
      customer_name: 'محمد كريم',
      customer_phone: '07800000000',
      device: 'Samsung S22',
      faults: ['تبديل مدخل شحن'],
      price: 100,
      cost: 30,
      paid_amount: 40,
      technician_id: aliTechId,
      payment_status: 'partial',
      status: 'completed'
    });
    assert(op2Res.success, 'Partial payment operation created');
    assert(op2Res.data?.paid_amount === 40, 'Partial paid amount is 40');

    // Op 3: Debt operation (Price: 80, Cost: 20 -> Debt: 80)
    const op3Res = operationsRepo.addOperation({
      id: 103,
      customer_name: 'علي حسين',
      device: 'Redmi Note 11',
      price: 80,
      cost: 20,
      technician_id: aliTechId,
      payment_status: 'debt',
      status: 'delivered'
    });
    assert(op3Res.success, 'Debt operation created');

    // Check debts query
    const debts = operationsRepo.getDebts();
    assert(debts.length === 2, '2 active debts found (partial + debt)');

    // -------------------------------------------------------------
    // Test 5: Dashboard Statistics & Financial Math Verification
    // -------------------------------------------------------------
    console.log('\n📊 Test 5: Financial Statistics Verification');
    const stats1 = statsRepo.getDashboardStats();
    // Cash received: Op1 (100) + Op2 (40) = 140
    // Total ops cost: Op1 (40) + Op2 (30) + Op3 (20) = 90
    // Base capital: 0
    // CashBox: 140 - 90 = 50
    assert(stats1.cashBox === 50, `Cashbox balance correct: ${stats1.cashBox} === 50`);
    
    // Total profit realized (Delivered Ops: Op1 (60) + Op3 (60) = 120)
    assert(stats1.totalProfit === 120, `Realized total profit correct: ${stats1.totalProfit} === 120`);
    
    // Total Debt: Op2 (60) + Op3 (80) = 140
    assert(stats1.debtTotal === 140, `Market debt total correct: ${stats1.debtTotal} === 140`);

    // Pay Op2 debt (Clear remaining 60)
    operationsRepo.payDebt(102);
    const statsAfterDebtPay = statsRepo.getDashboardStats();
    // New CashBox: 50 + 60 = 110
    // New Debt Total: 140 - 60 = 80
    assert(statsAfterDebtPay.cashBox === 110, `Cashbox after debt payment: ${statsAfterDebtPay.cashBox} === 110`);
    assert(statsAfterDebtPay.debtTotal === 80, `Market debt after payment: ${statsAfterDebtPay.debtTotal} === 80`);

    // -------------------------------------------------------------
    // Test 6: Withdrawals & Monthly Settlement
    // -------------------------------------------------------------
    console.log('\n💰 Test 6: Withdrawals & Monthly Settlement');
    const withRes = withdrawalsRepo.addWithdrawal({
      amount: 30,
      notes: 'سحب شخصي',
      type: 'shop_withdrawal'
    });
    assert(withRes.success, 'Shop withdrawal added');

    const statsAfterWith = statsRepo.getDashboardStats();
    assert(statsAfterWith.cashBox === 80, `CashBox after withdrawal: ${statsAfterWith.cashBox} === 80`);

    const closeRes = monthsRepo.closeMonth(500);
    assert(closeRes.success && closeRes.newMonth?.id === 2, 'Month 1 closed and Month 2 opened with new capital');
    const currentMonth2 = monthsRepo.getCurrentMonth();
    assert(currentMonth2.id === 2 && currentMonth2.start_capital === 500, 'Current active month is now Month 2');

    // -------------------------------------------------------------
    // Test 7: SQLite Backup & Restore Verification
    // -------------------------------------------------------------
    console.log('\n💾 Test 7: SQLite Backup & Restore System');
    const backupRes = await createSQLiteBackup(true);
    assert(backupRes.success && !!backupRes.filename, `Backup created: ${backupRes.filename}`);
    
    const backupsList = listSQLiteBackups();
    assert(backupsList.length >= 1, 'Backup listed in catalog');

    // Add a dummy operation then restore
    operationsRepo.addOperation({
      id: 999,
      customer_name: 'زائر للتجربة',
      device: 'Pixel 8',
      price: 200,
      cost: 50,
      technician_id: aliTechId,
      payment_status: 'cash',
      status: 'delivered'
    });
    assert(operationsRepo.getAllOperations().length === 4, '4 operations before restore');

    const restoreRes = await restoreSQLiteBackup(backupRes.filename!);
    assert(restoreRes.success, 'Database restored successfully');
    assert(operationsRepo.getAllOperations().length === 3, 'Restored operations count matches pre-backup state');
    assert(isIntegrityOk(), 'Integrity check passes after restore');

    // -------------------------------------------------------------
    // Test 8: Legacy database.json Migration & Verification
    // -------------------------------------------------------------
    console.log('\n🔄 Test 8: Legacy database.json Migration & Verification');
    closeDB();
    setupTestEnv();

    // Copy original database.json from workspace into TEST_DIR
    const sourceDbJson = path.join(process.cwd(), 'database.json');
    const targetDbJson = path.join(TEST_DIR, 'database.json');
    fs.copyFileSync(sourceDbJson, targetDbJson);

    const originalJsonData = JSON.parse(fs.readFileSync(sourceDbJson, 'utf8'));
    const migrationSuccess = runAutomaticMigration();
    assert(migrationSuccess, 'Automatic migration from database.json succeeded');

    const migratedDb = openDatabase();
    assert(isIntegrityOk(migratedDb), 'Migrated database integrity is ok');

    const migratedOps = operationsRepo.getAllOperations();
    const migratedTechs = techniciansRepo.getAllTechnicians();
    const migratedMonths = monthsRepo.getAllMonths();
    const migratedWiths = withdrawalsRepo.getAllWithdrawals();

    assert(migratedOps.length === (originalJsonData.operations || []).length, `Operations count match: ${migratedOps.length}`);
    assert(migratedTechs.length >= (originalJsonData.technicians || []).length, `Technicians count match: ${migratedTechs.length}`);
    assert(migratedMonths.length >= (originalJsonData.months || []).length, `Months count match: ${migratedMonths.length}`);
    assert(migratedWiths.length === (originalJsonData.withdrawals || []).length, `Withdrawals count match: ${migratedWiths.length}`);

    // Test Idempotency
    const secondMigration = runAutomaticMigration();
    assert(secondMigration, 'Idempotent re-run does not error');
    assert(operationsRepo.getAllOperations().length === migratedOps.length, 'Data was not duplicated on second run');

    // -------------------------------------------------------------
    // Test 9: High Volume 10,000 Operations Performance Test
    // -------------------------------------------------------------
    console.log('\n⚡ Test 9: 10,000 Operations Performance Test');
    const bulkDb = getDB();
    const startInsert = Date.now();

    const insertTx = bulkDb.transaction(() => {
      const stmt = bulkDb.prepare(`
        INSERT INTO operations (
          id, date, month_id, technician_id, customer_name, device, cost, price,
          shop_profit, tech_profit, payment_status, status, paid_amount
        ) VALUES (?, '18/08/2026', 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 10000; i < 20000; i++) {
        stmt.run(
          i,
          `Customer ${i}`,
          `Device ${i % 50}`,
          20,
          100,
          32,
          48,
          i % 3 === 0 ? 'debt' : (i % 3 === 1 ? 'partial' : 'cash'),
          'delivered',
          i % 3 === 0 ? 0 : (i % 3 === 1 ? 40 : 100)
        );
      }
    });

    insertTx();
    const insertDuration = Date.now() - startInsert;
    console.log(`  ⏱️ Inserted 10,000 operations in ${insertDuration}ms (${(insertDuration / 10000).toFixed(2)}ms / op)`);
    assert(insertDuration < 2000, `Bulk insert under 2000ms (took ${insertDuration}ms)`);

    const startStats = Date.now();
    const bulkStats = statsRepo.getDashboardStats();
    const statsDuration = Date.now() - startStats;
    console.log(`  ⏱️ Dashboard stats computed across 10,000+ ops in ${statsDuration}ms`);
    assert(statsDuration < 50, `Dashboard stats computed in < 50ms (took ${statsDuration}ms)`);
    assert(bulkStats.debtTotal > 0, 'Bulk debts calculated correctly');

    const startSearch = Date.now();
    const searchRes = bulkDb.prepare("SELECT * FROM operations WHERE customer_name LIKE 'Customer 15%'").all();
    const searchDuration = Date.now() - startSearch;
    console.log(`  ⏱️ Indexed search returned ${searchRes.length} records in ${searchDuration}ms`);
    assert(searchDuration < 20, `Search query in < 20ms (took ${searchDuration}ms)`);

  } catch (err: any) {
    console.error('💥 Test suite encountered unhandled exception:', err);
    failed++;
  } finally {
    cleanupTestEnv();
  }

  console.log(`\n========================================`);
  console.log(`📊 Test Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
