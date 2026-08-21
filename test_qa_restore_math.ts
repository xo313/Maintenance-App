import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const TEST_DIR = path.join(process.cwd(), 'test_qa_restore');
process.env.TEST_USER_DATA = TEST_DIR;
process.env.VITE_APP_ENV = 'development'; // Ensure we don't touch stable

import { getDB, closeDB, isIntegrityOk } from './electron/db/connection.js';
import * as customersRepo from './electron/db/repositories/customersRepo.js';
import * as techniciansRepo from './electron/db/repositories/techniciansRepo.js';
import * as operationsRepo from './electron/db/repositories/operationsRepo.js';
import * as withdrawalsRepo from './electron/db/repositories/withdrawalsRepo.js';
import * as statsRepo from './electron/db/repositories/statsRepo.js';
import { createSQLiteBackup, restoreSQLiteBackup, listSQLiteBackups } from './electron/db/backup.js';

if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Ensure clean slate
try { fs.unlinkSync(path.join(TEST_DIR, 'maintenance.db')); } catch {}
try { fs.unlinkSync(path.join(TEST_DIR, 'maintenance.db-wal')); } catch {}
try { fs.unlinkSync(path.join(TEST_DIR, 'maintenance.db-shm')); } catch {}

// Initialize
getDB();

console.log('--- STARTING FORENSIC TEST ---');

// 1. Create Tech & Customer
const techRes = techniciansRepo.addTechnician('Test Tech', 0.5);
const custRes = customersRepo.addCustomer({ name: 'Test Customer', phone: '12345' });

const tech = techRes.data!;
const cust = custRes.data!;

console.log(`Created Tech ID: ${tech.id}, Cust ID: ${cust.id}`);

// 2. Create 3 ops + withdrawal
// Op 1: 100k Cash, Cost 20k
operationsRepo.addOperation({
  date: new Date().toISOString(),
  month_id: 1,
  technician_id: tech.id,
  customer_name: cust.name,
  device: 'Device 1',
  status: 'delivered',
  payment_status: 'cash',
  cost: 20000,
  price: 100000,
  shop_profit: 40000,
  tech_profit: 40000
});

// Op 2: 200k Partial (paid 100k), Cost 50k
const op2Res = operationsRepo.addOperation({
  date: new Date().toISOString(),
  month_id: 1,
  technician_id: tech.id,
  customer_name: cust.name,
  device: 'Device 2',
  status: 'delivered',
  payment_status: 'partial',
  cost: 50000,
  price: 200000,
  paid_amount: 100000,
  shop_profit: 75000,
  tech_profit: 75000
});
const op2 = op2Res.data!;


// Op 3: 100k Debt, Cost 10k
operationsRepo.addOperation({
  date: new Date().toISOString(),
  month_id: 1,
  technician_id: tech.id,
  customer_name: cust.name,
  device: 'Device 3',
  status: 'delivered',
  payment_status: 'debt',
  cost: 10000,
  price: 100000,
  shop_profit: 45000,
  tech_profit: 45000
});

// Withdrawal 30k
withdrawalsRepo.addWithdrawal({
  type: 'shop_withdrawal',
  amount: 30000,
  date: new Date().toISOString(),
  notes: 'Test withdraw'
});

// Check pre-backup stats
const preStats = statsRepo.getDashboardStats();
console.log('Pre-Backup Cash:', preStats.cashBox);
console.log('Pre-Backup Accrued Shop Profit:', preStats.shopOperationProfit);
console.log('Pre-Backup Debt:', preStats.debtTotal);

if (preStats.cashBox !== 90000) {
    console.error('FATAL: Pre-Backup Cash is wrong! Expected 90000, got ' + preStats.cashBox);
    process.exit(1);
}

if (preStats.debtTotal !== 200000) {
    console.error('FATAL: Pre-Backup Debt is wrong! Expected 200000, got ' + preStats.debtTotal);
    process.exit(1);
}

console.log('--- CREATING BACKUP ---');
createSQLiteBackup(true).then((bRes) => {
    console.log('Backup Result:', bRes.success);
    if (!bRes.success) process.exit(1);

    // Add 4th Op AFTER backup
    operationsRepo.addOperation({
      date: new Date().toISOString(),
      month_id: 1,
      technician_id: tech.id,
      customer_name: cust.name,
      device: 'Device 4 POST BACKUP',
      status: 'delivered',
      payment_status: 'cash',
      cost: 10000,
      price: 50000,
      shop_profit: 20000,
      tech_profit: 20000
    });

    const postStats = statsRepo.getDashboardStats();
    console.log('Post-Op4 Cash (Expect 220000):', postStats.cashBox);

    if (postStats.cashBox !== 130000) {
        console.error('FATAL: Post-Backup Cash is wrong! Expected 130000, got ' + postStats.cashBox);
        process.exit(1);
    }

    console.log('--- RESTORING BACKUP ---');
    restoreSQLiteBackup(bRes.filename!).then((rRes) => {
        console.log('Restore Result:', rRes.success);
        if (!rRes.success) {
            console.error('RESTORE FAILED:', rRes.reason);
            process.exit(1);
        }

        const restoredStats = statsRepo.getDashboardStats();
        console.log('Restored Cash (Expect 170000):', restoredStats.cashBox);

        if (restoredStats.cashBox !== 90000) {
            console.error('FATAL: Restored Cash is wrong! Expected 90000, got ' + restoredStats.cashBox);
            process.exit(1);
        }

        const allOps = getDB().prepare('SELECT * FROM operations').all();
        console.log('Restored Ops Count (Expect 3):', allOps.length);

        if (allOps.length !== 3) {
            console.error('FATAL: Restore failed to rollback operations properly! Found ' + allOps.length);
            process.exit(1);
        }

        console.log('SUCCESS! ALL TESTS PASSED.');
        process.exit(0);
    });
});
