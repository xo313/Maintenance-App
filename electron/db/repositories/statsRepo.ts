import { getDB } from '../connection.js';
import { getCurrentMonth } from './monthsRepo.js';
import { getAllTechnicians } from './techniciansRepo.js';
import type { DashboardStats, TechnicianStats } from '../../src/types.js';

export function getDashboardStats(): DashboardStats {
  const db = getDB();
  const currentMonth = getCurrentMonth();
  const monthId = currentMonth.id;

  // 1. TRUE Cash Balance (Current Month Drawer)
  // When a month is closed, start_capital is set to the physical cash left in the drawer.
  // Therefore, cashBox must only sum transactions for the CURRENT month.
  let baseCapital = Number(currentMonth.start_capital) || 0;
  
  const cashRes = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN type IN ('CUSTOMER_PAYMENT', 'OTHER_IN', 'OPENING_BALANCE') THEN amount
      ELSE -amount END
    ), 0) as cashFlow
    FROM cash_transactions
    WHERE month_id = ?
  `).get(monthId) as { cashFlow: number };
  
  const cashBox = baseCapital + (Number(cashRes.cashFlow) || 0);

  // 2. Accrued Profit (Income Statement based on Delivered operations this month)
  // Paying an old debt does NOT increase this (it only increases cash flow above)
  const profitRes = db.prepare(`
    SELECT 
      COALESCE(SUM(price), 0) as totalSales,
      COALESCE(SUM(cost), 0) as totalCost,
      COALESCE(SUM(price - cost), 0) as grossProfit,
      COALESCE(SUM(shop_profit), 0) as shopOperationProfit,
      COALESCE(SUM(tech_profit), 0) as techShare
    FROM operations
    WHERE status = 'delivered' AND COALESCE(delivered_in_month_id, month_id) = ?
  `).get(monthId) as { totalSales: number; totalCost: number; grossProfit: number; shopOperationProfit: number; techShare: number };

  // 2.b REALIZED Shop Profit (Cash Collected THIS MONTH from Delivered Operations)
  // Matches Golden Reference: a (Cash delivered this month) + o (Debt paid this month)
  // In V2, we calculate proportional profit based on what was paid THIS month.
  const realizedRes = db.prepare(`
    SELECT COALESCE(SUM(
      CASE 
        WHEN price > 0 THEN (paid_amount * 1.0 / price) * shop_profit
        ELSE shop_profit
      END
    ), 0) as realizedShopProfit
    FROM operations
    WHERE status = 'delivered' 
      AND (
        (payment_status = 'cash' AND month_id = ?) OR
        (paid_in_month_id = ?) OR
        (payment_status = 'partial' AND COALESCE(paid_in_month_id, month_id) = ?)
      )
  `).get(monthId, monthId, monthId) as { realizedShopProfit: number };

  const netShopProfit = Number(realizedRes.realizedShopProfit) || 0;

  // 3. Receivables (Customer Debt - All Time)
  const debtRes = db.prepare(`
    SELECT COALESCE(SUM(price - COALESCE(paid_amount, 0)), 0) as debtTotal
    FROM operations
    WHERE status = 'delivered' AND payment_status != 'cash' AND (price - COALESCE(paid_amount, 0)) > 0
  `).get() as { debtTotal: number };
  const debtTotal = Number(debtRes.debtTotal) || 0;

  // 4. Tied Capital (Cost of Delivered Operations in Debt - Current Month)
  const tiedRes = db.prepare(`
    SELECT COALESCE(SUM(cost), 0) as tiedCapital
    FROM operations
    WHERE status = 'delivered' 
      AND payment_status != 'cash' 
      AND (price - COALESCE(paid_amount, 0)) > 0
      AND COALESCE(delivered_in_month_id, month_id) = ?
  `).get(monthId) as { tiedCapital: number };

  const tiedCapital = Number(tiedRes.tiedCapital) || 0;

  // 5. Payables (Technicians - All Time)
  const techPayablesRes = db.prepare(`
    SELECT 
      (SELECT COALESCE(SUM(tech_profit), 0) FROM operations WHERE status = 'delivered') -
      (SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE type = 'TECHNICIAN_PAYMENT') as techPayables
  `).get() as { techPayables: number };
  const technicianPayables = Number(techPayablesRes.techPayables) || 0;

  // Additional stats
  const opsCostRes = db.prepare(`SELECT COUNT(id) as c FROM operations WHERE COALESCE(delivered_in_month_id, month_id) = ?`).get(monthId) as { c: number };
  
  // Shop Withdrawals (Current Month - for Dashboard)
  const shopWithResMonth = db.prepare(`SELECT COALESCE(SUM(amount), 0) as w FROM cash_transactions WHERE type = 'SHOP_WITHDRAWAL' AND month_id = ?`).get(monthId) as { w: number };
  const totalShopWithdrawalMonth = Number(shopWithResMonth.w) || 0;

  // Shop Withdrawals (All Time - for calculating Net Shop Due)
  const shopWithResAllTime = db.prepare(`SELECT COALESCE(SUM(amount), 0) as w FROM cash_transactions WHERE type = 'SHOP_WITHDRAWAL'`).get() as { w: number };
  const totalShopWithdrawalAllTime = Number(shopWithResAllTime.w) || 0;

  // Total shop profit all time
  const allTimeProfitRes = db.prepare(`SELECT COALESCE(SUM(shop_profit), 0) as p FROM operations WHERE status = 'delivered'`).get() as { p: number };
  const allTimeShopProfit = Number(allTimeProfitRes.p) || 0;

  return {
    cashBox,
    totalSales: Number(profitRes.totalSales) || 0,
    grossProfit: Number(profitRes.grossProfit) || 0,
    techShare: Number(profitRes.techShare) || 0,
    shopOperationProfit: Number(profitRes.shopOperationProfit) || 0,
    totalExpenses: 0,
    netShopProfit,
    debtTotal,
    supplierPayables: 0,
    technicianPayables,
    receivedDevicesCount: opsCostRes.c,
    totalProfit: Number(profitRes.grossProfit) || 0,
    totalWithdrawals: totalShopWithdrawalMonth,
    totalTechProfit: Number(profitRes.techShare) || 0,
    totalShopProfit: Number(profitRes.shopOperationProfit) || 0,
    uncollectedProfit: 0,
    baseCapital,
    availableCapital: cashBox,
    tiedCapital,
    realizedShopProfit: netShopProfit,
    totalShopWithdrawal: totalShopWithdrawalMonth,
    shopDue: allTimeShopProfit - totalShopWithdrawalAllTime
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
