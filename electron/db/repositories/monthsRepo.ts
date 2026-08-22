import { getDB } from '../connection.js';
import type { Month } from '../../src/types.js';

export function getAllMonths(): Month[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM months ORDER BY id ASC').all() as any[];
  return rows.map(r => ({
    ...r,
    is_closed: Boolean(r.is_closed)
  }));
}

export function getCurrentMonth(): Month {
  const db = getDB();
  let row = db.prepare('SELECT * FROM months WHERE is_closed = 0 ORDER BY id DESC LIMIT 1').get() as any;
  if (!row) {
    row = db.prepare('SELECT * FROM months ORDER BY id DESC LIMIT 1').get() as any;
  }
  if (!row) {
    const now = new Date();
    db.prepare(`
      INSERT INTO months (id, month_name, start_capital, is_closed, created_at, closed_at)
      VALUES (1, ?, 0, 0, ?, NULL)
    `).run(
      now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
      now.toISOString()
    );
    row = db.prepare('SELECT * FROM months WHERE id = 1').get() as any;
  }
  return {
    ...row,
    is_closed: Boolean(row.is_closed)
  };
}

export function getNextMonthId(): number {
  const db = getDB();
  const res = db.prepare('SELECT MAX(id) as maxId FROM months').get() as { maxId: number | null };
  return (res && res.maxId) ? res.maxId + 1 : 1;
}

export function updateCurrentMonthCapital(newCapital: number): { success: boolean; reason?: string } {
  const db = getDB();
  const currentMonth = getCurrentMonth();
  try {
    db.prepare('UPDATE months SET start_capital = ? WHERE id = ?').run(Number(newCapital) || 0, currentMonth.id);
    return { success: true };
  } catch (err: any) {
    console.error('[MonthsRepo] Update capital failed:', err);
    return { success: false, reason: err?.message || 'UPDATE_CAPITAL_FAILED' };
  }
}

export function closeMonth(newCapital: number): { success: boolean; newMonth?: Month; reason?: string } {
  const db = getDB();
  const currentMonth = getCurrentMonth();

  try {
    const closeTx = db.transaction(() => {
      const now = new Date();
      // 1. Close current month
      db.prepare('UPDATE months SET is_closed = 1, closed_at = ? WHERE id = ?')
        .run(now.toISOString(), currentMonth.id);

      // 2. Open new month
      const nextId = getNextMonthId();
      const nextMonthName = now.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

      db.prepare(`
        INSERT INTO months (id, month_name, start_capital, is_closed, created_at, closed_at)
        VALUES (?, ?, ?, 0, ?, NULL)
      `).run(
        nextId,
        nextMonthName,
        Number(newCapital) || 0,
        now.toISOString()
      );

      return {
        id: nextId,
        month_name: nextMonthName,
        start_capital: Number(newCapital) || 0,
        is_closed: false,
        created_at: now.toISOString(),
        closed_at: null
      };
    });

    const newMonth = closeTx();
    return { success: true, newMonth };
  } catch (err: any) {
    console.error('[MonthsRepo] Close month transaction failed:', err);
    return { success: false, reason: err?.message || 'CLOSE_MONTH_FAILED' };
  }
}
