import { getDB } from '../connection.js';

export interface CashTransaction {
  id?: number;
  type: 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT' | 'SHOP_EXPENSE' | 'SHOP_WITHDRAWAL' | 'TECHNICIAN_PAYMENT' | 'OTHER_IN' | 'OTHER_OUT';
  amount: number;
  date: string;
  month_id: number;
  reference_id?: number;
  description?: string;
  created_at?: string;
}

export function addCashTransaction(tx: CashTransaction): { success: boolean; data?: CashTransaction; reason?: string } {
  const db = getDB();
  const created_at = new Date().toISOString();

  try {
    const info = db.prepare(`
      INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      tx.type,
      tx.amount,
      tx.date,
      tx.month_id,
      tx.reference_id || null,
      tx.description || '',
      created_at
    );
    
    return { success: true, data: { ...tx, id: info.lastInsertRowid as number, created_at } };
  } catch (err: any) {
    console.error('[CashRepo] Error adding cash transaction:', err);
    return { success: false, reason: err.message };
  }
}

export function deleteCashTransaction(id: number): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    const info = db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(id);
    if (info.changes > 0) return { success: true };
    return { success: false, reason: 'NOT_FOUND' };
  } catch (err: any) {
    console.error('[CashRepo] Error deleting cash transaction:', err);
    return { success: false, reason: err.message };
  }
}

export function getCashTransactionsByMonth(monthId: number): CashTransaction[] {
  const db = getDB();
  return db.prepare('SELECT * FROM cash_transactions WHERE month_id = ? ORDER BY date DESC, id DESC').all(monthId) as CashTransaction[];
}
