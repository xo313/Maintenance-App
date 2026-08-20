import { getDB } from '../connection.js';
import { getCurrentMonth } from './monthsRepo.js';
import { getAllTechnicians } from './techniciansRepo.js';
import type { DashboardStats, TechnicianStats } from '../../src/types.js';

export function getDashboardStats(): DashboardStats {
  const db = getDB();
  const currentMonth = getCurrentMonth();
  const monthId = currentMonth.id;

  // 1. Cash Balance (From Unified Ledger)
  const cashRes = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN type IN ('CUSTOMER_PAYMENT', 'OTHER_IN') THEN amount
      ELSE -amount END
    ), 0) as cashBox
    FROM cash_transactions
    WHERE month_id = ?
  `).get(monthId) as { cashBox: number };
  
  const cashBox = (Number(currentMonth.start_capital) || 0) + (Number(cashRes.cashBox) || 0);

  // 2. Sales and Gross Profit (Realized from Delivered operations)
  const profitRes = db.prepare(`
    SELECT 
      COALESCE(SUM(price), 0) as totalSales,
      COALESCE(SUM(cost), 0) as totalCost,
      COALESCE(SUM(price - cost), 0) as grossProfit,
      COALESCE(SUM(shop_profit), 0) as shopOperationProfit,
      COALESCE(SUM(tech_profit), 0) as techShare
    FROM operations
    WHERE delivered_in_month_id = ?
  `).get(monthId) as { totalSales: number; totalCost: number; grossProfit: number; shopOperationProfit: number; techShare: number };

  // 3. Shop Expenses
  const expRes = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as totalExpenses
    FROM shop_expenses
    WHERE month_id = ?
  `).get(monthId) as { totalExpenses: number };

  const totalExpenses = Number(expRes.totalExpenses) || 0;
  const netShopProfit = (Number(profitRes.shopOperationProfit) || 0) - totalExpenses;

  // 4. Receivables (Customer Debt)
  const debtRes = db.prepare(`
    SELECT COALESCE(SUM(price - COALESCE(paid_amount, 0)), 0) as debtTotal
    FROM operations
    WHERE payment_status != 'cash' AND (price - COALESCE(paid_amount, 0)) > 0
  `).get() as { debtTotal: number };
  const debtTotal = Number(debtRes.debtTotal) || 0;

  // 5. Payables (Suppliers)
  const suppRes = db.prepare(`
    SELECT 
      (SELECT COALESCE(SUM(amount), 0) FROM supplier_purchases) - 
      (SELECT COALESCE(SUM(amount), 0) FROM supplier_payments) as supplierPayables
  `).get() as { supplierPayables: number };
  const supplierPayables = Number(suppRes.supplierPayables) || 0;

  // 6. Payables (Technicians) - using historical total earned vs paid
  const techPayablesRes = db.prepare(`
    SELECT 
      (SELECT COALESCE(SUM(tech_profit), 0) FROM operations WHERE status = 'delivered') -
      (SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE type = 'TECHNICIAN_PAYMENT') as techPayables
  `).get() as { techPayables: number };
  const technicianPayables = Number(techPayablesRes.techPayables) || 0;

  // Additional backwards-compatible stats
  const opsCostRes = db.prepare(`SELECT COUNT(id) as c FROM operations WHERE month_id = ?`).get(monthId) as { c: number };
  
  return {
    cashBox,
    totalSales: Number(profitRes.totalSales) || 0,
    grossProfit: Number(profitRes.grossProfit) || 0,
    techShare: Number(profitRes.techShare) || 0,
    shopOperationProfit: Number(profitRes.shopOperationProfit) || 0,
    totalExpenses,
    netShopProfit,
    debtTotal,
    supplierPayables,
    technicianPayables,
    receivedDevicesCount: opsCostRes.c,
    // Keep old properties so React doesn't break entirely if missed somewhere, but their values are mapped to the new reality
    totalProfit: Number(profitRes.grossProfit) || 0,
    totalWithdrawals: totalExpenses, // approximated mapping
    totalTechProfit: Number(profitRes.techShare) || 0,
    totalShopProfit: Number(profitRes.shopOperationProfit) || 0,
    uncollectedProfit: 0,
    baseCapital: Number(currentMonth.start_capital) || 0,
    availableCapital: cashBox,
    tiedCapital: Number(profitRes.totalCost) || 0,
    realizedShopProfit: netShopProfit,
    totalShopWithdrawal: 0,
    shopDue: netShopProfit
  } as any;
}

export function getTechnicianStats(): TechnicianStats[] {
  const db = getDB();
  const currentMonth = getCurrentMonth();
  const monthId = currentMonth.id;
  const technicians = getAllTechnicians();

  return technicians.map(tech => {
    const costRes = db.prepare(`
      SELECT COALESCE(SUM(cost), 0) as totalCost
      FROM operations
      WHERE technician_id = ? AND month_id = ?
    `).get(tech.id, monthId) as { totalCost: number };

    const profitRes = db.prepare(`
      SELECT COALESCE(SUM(tech_profit), 0) as totalProfit
      FROM operations
      WHERE technician_id = ? AND delivered_in_month_id = ?
    `).get(tech.id, monthId) as { totalProfit: number };

    const unrealizedRes = db.prepare(`
      SELECT COALESCE(SUM(tech_profit), 0) as unrealizedProfit
      FROM operations
      WHERE technician_id = ? 
        AND payment_status IN ('debt', 'partial')
        AND (price - COALESCE(paid_amount, 0)) > 0
    `).get(tech.id) as { unrealizedProfit: number };

    const withRes = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalWithdrawal
      FROM cash_transactions
      WHERE reference_id = ? AND month_id = ? AND type = 'TECHNICIAN_PAYMENT'
    `).get(tech.id, monthId) as { totalWithdrawal: number };

    const totalCost = Number(costRes.totalCost) || 0;
    const totalProfit = Number(profitRes.totalProfit) || 0;
    const unrealizedProfit = Number(unrealizedRes.unrealizedProfit) || 0;
    const totalWithdrawal = Number(withRes.totalWithdrawal) || 0;
    const remainingBalance = totalProfit - totalWithdrawal;

    return {
      id: tech.id,
      name: tech.name,
      profit_percentage: tech.profit_percentage,
      is_active: tech.is_active,
      totalCost,
      totalProfit,
      unrealizedProfit,
      totalWithdrawal,
      remainingBalance
    };
  });
}
