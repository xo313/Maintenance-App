import { getDB } from '../connection.js';
import type { IcCompatibility } from '../../src/types.js';

export function getIcCompatibilities(): IcCompatibility[] {
  const db = getDB();
  return db.prepare('SELECT * FROM ic_compatibilities ORDER BY id DESC').all() as IcCompatibility[];
}

export function getIcById(id: number): IcCompatibility | null {
  const db = getDB();
  return (db.prepare('SELECT * FROM ic_compatibilities WHERE id = ?').get(id) as IcCompatibility) || null;
}

export function addIcCompatibility(ic: Partial<IcCompatibility>): { success: boolean; data?: IcCompatibility; reason?: string } {
  const db = getDB();
  const id = ic.id || Date.now();

  try {
    db.prepare(`
      INSERT INTO ic_compatibilities (id, ic_number, component_type, compatible_devices, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      ic.ic_number?.trim() || '',
      ic.component_type?.trim() || '',
      ic.compatible_devices?.trim() || '',
      ic.notes?.trim() || ''
    );

    const created = getIcById(id);
    return { success: true, data: created || undefined };
  } catch (err: any) {
    console.error('[IcRepo] Add IC failed:', err);
    return { success: false, reason: err?.message || 'ADD_IC_FAILED' };
  }
}

export function editIcCompatibility(id: number, ic: Partial<IcCompatibility>): { success: boolean; data?: IcCompatibility; reason?: string } {
  const db = getDB();
  const current = getIcById(id);
  if (!current) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  try {
    db.prepare(`
      UPDATE ic_compatibilities
      SET ic_number = ?, component_type = ?, compatible_devices = ?, notes = ?
      WHERE id = ?
    `).run(
      ic.ic_number !== undefined ? ic.ic_number.trim() : current.ic_number,
      ic.component_type !== undefined ? ic.component_type.trim() : current.component_type,
      ic.compatible_devices !== undefined ? ic.compatible_devices.trim() : current.compatible_devices,
      ic.notes !== undefined ? ic.notes.trim() : current.notes,
      id
    );

    const updated = getIcById(id);
    return { success: true, data: updated || undefined };
  } catch (err: any) {
    console.error('[IcRepo] Edit IC failed:', err);
    return { success: false, reason: err?.message || 'EDIT_IC_FAILED' };
  }
}

export function deleteIcCompatibility(id: number): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    const res = db.prepare('DELETE FROM ic_compatibilities WHERE id = ?').run(id);
    if (res.changes === 0) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[IcRepo] Delete IC failed:', err);
    return { success: false, reason: err?.message || 'DELETE_IC_FAILED' };
  }
}
