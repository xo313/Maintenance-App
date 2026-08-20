import { getDB } from '../connection.js';
import { getCurrentMonth } from './monthsRepo.js';
import type { Withdrawal } from '../../src/types.js';

function formatWithdrawalRow(row: any): Withdrawal {
  return {
    ...row,
    amount: Number(row.amount) || 0,
    description: row.notes || row.description || '',
    technician_name: row.technician_name || null
  };
}

export function getWithdrawals(): Withdrawal[] {
  const db = getDB();
  const currentMonth = getCurrentMonth();

  const rows = db.prepare(`
    SELECT w.*, t.name as technician_name
    FROM withdrawals w
    LEFT JOIN technicians t ON w.technician_id = t.id
    WHERE w.month_id = ?
    ORDER BY w.id DESC
  `).all(currentMonth.id) as any[];

  return rows.map(formatWithdrawalRow);
}

export function getAllWithdrawals(): Withdrawal[] {
  const db = getDB();
  const rows = db.prepare(`
    SELECT w.*, t.name as technician_name
    FROM withdrawals w
    LEFT JOIN technicians t ON w.technician_id = t.id
    ORDER BY w.id DESC
  `).all() as any[];

  return rows.map(formatWithdrawalRow);
}

export function getWithdrawalById(id: number): Withdrawal | null {
  const db = getDB();
  const row = db.prepare(`
    SELECT w.*, t.name as technician_name
    FROM withdrawals w
    LEFT JOIN technicians t ON w.technician_id = t.id
    WHERE w.id = ?
  `).get(id) as any;

  return row ? formatWithdrawalRow(row) : null;
}

export function addWithdrawal(w: Partial<Withdrawal>): { success: boolean; data?: Withdrawal; reason?: string } {
  const db = getDB();
  const currentMonth = getCurrentMonth();
  const id = w.id || Date.now();
  const type = w.type === 'tech_withdrawal' ? 'tech_withdrawal' : 'shop_withdrawal';
  const cashType = w.type === 'tech_withdrawal' ? 'TECHNICIAN_PAYMENT' : 'SHOP_WITHDRAWAL';
  const techId = type === 'tech_withdrawal' ? (Number(w.technician_id) || null) : null;
  const monthId = w.month_id || currentMonth.id;
  const amount = Number(w.amount) || 0;
  const notes = w.notes || (w as any).description || '';
  const dateStr = w.date || new Date().toLocaleDateString('en-GB');

  try {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO withdrawals (id, date, amount, notes, type, technician_id, month_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        dateStr,
        amount,
        notes,
        type,
        techId,
        monthId
      );

      db.prepare(`
        INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(cashType, amount, dateStr, monthId, id, notes, new Date().toISOString());
    })();

    const created = getWithdrawalById(id);
    return { success: true, data: created || undefined };
  } catch (err: any) {
    console.error('[WithdrawalsRepo] Add withdrawal failed:', err);
    return { success: false, reason: err?.message || 'ADD_WITHDRAWAL_FAILED' };
  }
}

export function editWithdrawal(id: number, updatedW: Partial<Withdrawal>): { success: boolean; data?: Withdrawal; reason?: string } {
  const db = getDB();
  const current = getWithdrawalById(id);
  if (!current) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  const type = updatedW.type !== undefined ? updatedW.type : current.type;
  const cashType = type === 'tech_withdrawal' ? 'TECHNICIAN_PAYMENT' : 'SHOP_WITHDRAWAL';
  const techId = type === 'tech_withdrawal' 
    ? (updatedW.technician_id !== undefined ? updatedW.technician_id : current.technician_id) 
    : null;
  const amount = updatedW.amount !== undefined ? Number(updatedW.amount) : current.amount;
  const notes = updatedW.notes !== undefined ? updatedW.notes : (updatedW.description !== undefined ? updatedW.description : current.description);
  const date = updatedW.date || current.date;

  try {
    db.transaction(() => {
      db.prepare(`
        UPDATE withdrawals
        SET date = ?, amount = ?, notes = ?, type = ?, technician_id = ?
        WHERE id = ?
      `).run(date, amount, notes, type, techId, id);

      db.prepare(`
        UPDATE cash_transactions
        SET amount = ?, date = ?, description = ?, type = ?
        WHERE reference_id = ? AND type IN ('SHOP_WITHDRAWAL', 'TECHNICIAN_PAYMENT')
      `).run(amount, date, notes, cashType, id);
    })();

    const updated = getWithdrawalById(id);
    return { success: true, data: updated || undefined };
  } catch (err: any) {
    console.error('[WithdrawalsRepo] Edit withdrawal failed:', err);
    return { success: false, reason: err?.message || 'EDIT_WITHDRAWAL_FAILED' };
  }
}

export function deleteWithdrawal(id: number): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    let success = false;
    db.transaction(() => {
      db.prepare(`DELETE FROM cash_transactions WHERE reference_id = ? AND type IN ('SHOP_WITHDRAWAL', 'TECHNICIAN_PAYMENT')`).run(id);
      const res = db.prepare('DELETE FROM withdrawals WHERE id = ?').run(id);
      success = res.changes > 0;
    })();
    if (!success) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[WithdrawalsRepo] Delete withdrawal failed:', err);
    return { success: false, reason: err?.message || 'DELETE_WITHDRAWAL_FAILED' };
  }
}
