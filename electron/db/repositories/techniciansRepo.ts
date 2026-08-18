import { getDB } from '../connection.js';
import type { Technician } from '../../src/types.js';

export function getTechnicians(): Technician[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM technicians WHERE is_active = 1 ORDER BY id ASC').all() as any[];
  return rows.map(t => ({
    ...t,
    is_active: Boolean(t.is_active)
  }));
}

export function getAllTechnicians(): Technician[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM technicians ORDER BY id ASC').all() as any[];
  return rows.map(t => ({
    ...t,
    is_active: Boolean(t.is_active)
  }));
}

export function getTechnicianById(id: number): Technician | null {
  const db = getDB();
  const row = db.prepare('SELECT * FROM technicians WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    ...row,
    is_active: Boolean(row.is_active)
  };
}

export function addTechnician(name: string, profit_percentage: number): { success: boolean; data?: Technician; reason?: string } {
  const db = getDB();
  const id = Date.now();
  const percentage = Number(profit_percentage) || 0;

  try {
    db.prepare(`
      INSERT INTO technicians (id, name, profit_percentage, start_balance, is_active)
      VALUES (?, ?, ?, 0, 1)
    `).run(id, name.trim(), percentage);

    return {
      success: true,
      data: {
        id,
        name: name.trim(),
        profit_percentage: percentage,
        start_balance: 0,
        is_active: true
      }
    };
  } catch (err: any) {
    console.error('[TechniciansRepo] Add technician failed:', err);
    return { success: false, reason: err?.message || 'ADD_TECHNICIAN_FAILED' };
  }
}

export function editTechnician(id: number, name: string, profit_percentage: number): { success: boolean; data?: Technician; reason?: string } {
  const db = getDB();
  const percentage = Number(profit_percentage) || 0;

  try {
    const res = db.prepare(`
      UPDATE technicians
      SET name = ?, profit_percentage = ?
      WHERE id = ?
    `).run(name.trim(), percentage, id);

    if (res.changes === 0) {
      return { success: false, reason: 'NOT_FOUND' };
    }

    const updated = getTechnicianById(id);
    return { success: true, data: updated || undefined };
  } catch (err: any) {
    console.error('[TechniciansRepo] Edit technician failed:', err);
    return { success: false, reason: err?.message || 'EDIT_TECHNICIAN_FAILED' };
  }
}

export function deleteTechnician(id: number): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    // Soft delete so historical operations retain technician association
    const res = db.prepare('UPDATE technicians SET is_active = 0 WHERE id = ?').run(id);
    if (res.changes === 0) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[TechniciansRepo] Delete technician failed:', err);
    return { success: false, reason: err?.message || 'DELETE_TECHNICIAN_FAILED' };
  }
}
