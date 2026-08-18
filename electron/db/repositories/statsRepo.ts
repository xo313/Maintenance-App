import { getDB } from '../connection.js';
import { getCurrentMonth } from './monthsRepo.js';
import { getAllTechnicians } from './techniciansRepo.js';
import type { DashboardStats, TechnicianStats } from '../../src/types.js';

export function getDashboardStats(): DashboardStats {
  const db = getDB();
  const currentMonth = getCurrentMonth();
  const monthId = currentMonth.id;
  const baseCapital = Number(currentMonth.start_capital) || 0;

  // 1. Withdrawals
  const withRes = db.prepare(`
    SELECT 
      COALESCE(SUM(amount), 0) as totalWithdrawals,
      COALESCE(SUM(CASE WHEN type = 'shop_withdrawal' THEN amount ELSE 0 END), 0) as totalShopWithdrawal
    FROM withdrawals
    WHERE month_id = ?
  `).get(monthId) as { totalWithdrawals: number; totalShopWithdrawal: number };

  const totalWithdrawals = Number(withRes.totalWithdrawals) || 0;
  const totalShopWithdrawal = Number(withRes.totalShopWithdrawal) || 0;

  // 2. Current Month Created Operations Cost & Device Count
  const opsCostRes = db.prepare(`
    SELECT 
      COALESCE(SUM(cost), 0) as totalOpsCost,
      COUNT(id) as receivedDevicesCount
    FROM operations
    WHERE month_id = ?
  `).get(monthId) as { totalOpsCost: number; receivedDevicesCount: number };

  const totalOpsCost = Number(opsCostRes.totalOpsCost) || 0;
  const receivedDevicesCount = Number(opsCostRes.receivedDevicesCount) || 0;

  // 3. Cash inflow in current month
  // (Cash ops created this month + Partial ops created this month + Past debts paid this month)
  const cashInflowRes = db.prepare(`
    SELECT 
      COALESCE(SUM(
        CASE 
          WHEN month_id = ? AND payment_status = 'cash' THEN (CASE WHEN paid_amount IS NOT NULL THEN paid_amount ELSE price END)
          WHEN month_id = ? AND payment_status = 'partial' THEN COALESCE(paid_amount, 0)
          WHEN paid_in_month_id = ? AND month_id != ? THEN COALESCE(paid_amount, 0)
          ELSE 0
        END
      ), 0) as totalCashReceived
    FROM operations
    WHERE month_id = ? OR paid_in_month_id = ?
  `).get(monthId, monthId, monthId, monthId, monthId, monthId) as { totalCashReceived: number };

  const totalCashReceived = Number(cashInflowRes.totalCashReceived) || 0;
  const cashBox = baseCapital + totalCashReceived - totalOpsCost - totalWithdrawals;

  // 4. Realized Profits (Delivered in this month)
  const realizedProfitRes = db.prepare(`
    SELECT 
      COALESCE(SUM(price - cost), 0) as totalProfit,
      COALESCE(SUM(shop_profit), 0) as totalShopProfit,
      COALESCE(SUM(tech_profit), 0) as totalTechProfit
    FROM operations
    WHERE delivered_in_month_id = ?
  `).get(monthId) as { totalProfit: number; totalShopProfit: number; totalTechProfit: number };

  const totalProfit = Number(realizedProfitRes.totalProfit) || 0;
  const totalShopProfit = Number(realizedProfitRes.totalShopProfit) || 0;
  const totalTechProfit = Number(realizedProfitRes.totalTechProfit) || 0;

  // 5. Total Market Debts
  const debtRes = db.prepare(`
    SELECT COALESCE(SUM(price - COALESCE(paid_amount, 0)), 0) as debtTotal
    FROM operations
    WHERE (price - COALESCE(paid_amount, 0)) > 0
  `).get() as { debtTotal: number };

  const debtTotal = Number(debtRes.debtTotal) || 0;

  // 6. Uncollected Profit (Active in-progress devices created this month)
  const uncollectedRes = db.prepare(`
    SELECT COALESCE(SUM(price - cost), 0) as uncollectedProfit
    FROM operations
    WHERE month_id = ? AND status NOT IN ('delivered', 'cancelled')
  `).get(monthId) as { uncollectedProfit: number };

  const uncollectedProfit = Number(uncollectedRes.uncollectedProfit) || 0;
  const shopDue = totalShopProfit - totalShopWithdrawal;

  return {
    cashBox,
    totalProfit,
    debtTotal,
    totalWithdrawals,
    totalTechProfit,
    totalShopProfit,
    uncollectedProfit,
    receivedDevicesCount,
    baseCapital,
    availableCapital: cashBox,
    tiedCapital: totalOpsCost,
    realizedShopProfit: totalShopProfit,
    totalShopWithdrawal,
    shopDue
  };
}

export function getTechnicianStats(): TechnicianStats[] {
  const db = getDB();
  const currentMonth = getCurrentMonth();
  const monthId = currentMonth.id;
  const technicians = getAllTechnicians();

  return technicians.map(tech => {
    // 1. Cost of parts for ops created in this month
    const costRes = db.prepare(`
      SELECT COALESCE(SUM(cost), 0) as totalCost
      FROM operations
      WHERE technician_id = ? AND month_id = ?
    `).get(tech.id, monthId) as { totalCost: number };

    // 2. Realized profit (Delivered in this month)
    const profitRes = db.prepare(`
      SELECT COALESCE(SUM(tech_profit), 0) as totalProfit
      FROM operations
      WHERE technician_id = ? AND delivered_in_month_id = ?
    `).get(tech.id, monthId) as { totalProfit: number };

    // 3. Unrealized profit on outstanding debts
    const unrealizedRes = db.prepare(`
      SELECT COALESCE(SUM(tech_profit), 0) as unrealizedProfit
      FROM operations
      WHERE technician_id = ? 
        AND payment_status IN ('debt', 'partial')
        AND (price - COALESCE(paid_amount, 0)) > 0
    `).get(tech.id) as { unrealizedProfit: number };

    // 4. Withdrawals in this month
    const withRes = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalWithdrawal
      FROM withdrawals
      WHERE technician_id = ? AND month_id = ? AND type = 'tech_withdrawal'
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
