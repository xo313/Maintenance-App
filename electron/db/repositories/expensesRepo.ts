import { getDB } from '../connection.js';

export interface ShopExpense {
  id?: number;
  month_id: number;
  date: string;
  amount: number;
  category: string;
  description?: string;
  created_at?: string;
}

export function getShopExpenses(monthId: number): ShopExpense[] {
  const db = getDB();
  return db.prepare('SELECT * FROM shop_expenses WHERE month_id = ? ORDER BY date DESC, id DESC').all(monthId) as ShopExpense[];
}

export function addShopExpense(e: ShopExpense): { success: boolean; data?: ShopExpense; reason?: string } {
  const db = getDB();
  const created_at = new Date().toISOString();
  
  try {
    let newExpenseId = 0;
    db.transaction(() => {
      const info = db.prepare('INSERT INTO shop_expenses (month_id, date, amount, category, description, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        e.month_id, e.date, e.amount, e.category, e.description || '', created_at
      );
      newExpenseId = info.lastInsertRowid as number;

      db.prepare('INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        'SHOP_EXPENSE', e.amount, e.date, e.month_id, newExpenseId, (e.category + (e.description ? ' - ' + e.description : '')), created_at
      );
    })();
    return { success: true, data: { ...e, id: newExpenseId, created_at } };
  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}

export function deleteShopExpense(id: number): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM cash_transactions WHERE type = ? AND reference_id = ?').run('SHOP_EXPENSE', id);
      db.prepare('DELETE FROM shop_expenses WHERE id = ?').run(id);
    })();
    return { success: true };
  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}
