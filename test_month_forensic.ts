import path from 'node:path';
import fs from 'node:fs';

// Setup test environment
process.env.TEST_USER_DATA = path.join(process.cwd(), 'test_month_db');
if (fs.existsSync(process.env.TEST_USER_DATA)) {
  fs.rmSync(process.env.TEST_USER_DATA, { recursive: true, force: true });
}

import { openDatabase, closeDB, getDB } from './electron/db/connection.js';
import { addOperation } from './electron/db/repositories/operationsRepo.js';
import { addTechnician } from './electron/db/repositories/techniciansRepo.js';
import { getCurrentMonth, closeMonth } from './electron/db/repositories/monthsRepo.js';
import { getDashboardStats } from './electron/db/repositories/statsRepo.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
}

async function run() {
  openDatabase();

  const db = getDB();
  const m1 = getCurrentMonth();
  
  let tech = addTechnician('TestTech', 0.5);
  const techId = tech.data!.id;

  // Month 1 Operations
  addOperation({ customer_name: 'M1_OP', status: 'delivered', price: 1000, cost: 200, payment_status: 'cash', technician_id: techId });
  addOperation({ customer_name: 'M1_DEBT', status: 'delivered', price: 500, cost: 100, payment_status: 'debt', technician_id: techId });
  addOperation({ customer_name: 'M1_UNDER_MAINT', status: 'under_maintenance', price: 0, cost: 0, payment_status: 'debt', technician_id: techId });

  const stats1 = getDashboardStats();
  assert(stats1.cashBox === 700, 'Cash should be 700');
  assert(stats1.grossProfit === 800 + 400, 'Profit should be 1200'); // both delivered
  assert(stats1.debtTotal === 500, 'Debt should be 500');

  // Close Month with carry over cash (500)
  closeMonth(500);

  const m2 = getCurrentMonth();
  assert(m2.id !== m1.id, 'Should be in a new month');
  assert(m2.start_capital === 500, 'New month start capital should be 500');

  const stats2 = getDashboardStats();
  assert(stats2.cashBox === 500, 'M2 Cash should be 500');
  assert(stats2.grossProfit === 0, 'M2 Profit should be 0');
  assert(stats2.debtTotal === 500, 'M2 Debt should STILL be 500');

  closeDB();
  console.log('\n✅ FORENSIC MONTH TEST PASSED');
}

run().catch(console.error);
