import { getDB } from '../connection.js';
import type { ScrapDevice } from '../../src/types.js';

export function getScrapDevices(): ScrapDevice[] {
  const db = getDB();
  return db.prepare('SELECT * FROM scrap_devices ORDER BY id DESC').all() as ScrapDevice[];
}

export function getScrapDeviceById(id: number): ScrapDevice | null {
  const db = getDB();
  return (db.prepare('SELECT * FROM scrap_devices WHERE id = ?').get(id) as ScrapDevice) || null;
}

export function addScrapDevice(data: Partial<ScrapDevice>): { success: boolean; data?: ScrapDevice; reason?: string } {
  const db = getDB();
  const id = data.id || Date.now();

  try {
    db.prepare(`
      INSERT INTO scrap_devices (id, device_name, device_model, quantity)
      VALUES (?, ?, ?, ?)
    `).run(
      id,
      data.device_name?.trim() || 'جهاز سكراب',
      data.device_model?.trim() || '',
      Number(data.quantity) || 1
    );

    const created = getScrapDeviceById(id);
    return { success: true, data: created || undefined };
  } catch (err: any) {
    console.error('[ScrapRepo] Add scrap device failed:', err);
    return { success: false, reason: err?.message || 'ADD_SCRAP_FAILED' };
  }
}

export function editScrapDevice(id: number, data: Partial<ScrapDevice>): { success: boolean; data?: ScrapDevice; reason?: string } {
  const db = getDB();
  const current = getScrapDeviceById(id);
  if (!current) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  try {
    db.prepare(`
      UPDATE scrap_devices
      SET device_name = ?, device_model = ?, quantity = ?
      WHERE id = ?
    `).run(
      data.device_name !== undefined ? data.device_name.trim() : current.device_name,
      data.device_model !== undefined ? data.device_model.trim() : current.device_model,
      data.quantity !== undefined ? Number(data.quantity) : current.quantity,
      id
    );

    const updated = getScrapDeviceById(id);
    return { success: true, data: updated || undefined };
  } catch (err: any) {
    console.error('[ScrapRepo] Edit scrap device failed:', err);
    return { success: false, reason: err?.message || 'EDIT_SCRAP_FAILED' };
  }
}

export function deleteScrapDevice(id: number): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    const res = db.prepare('DELETE FROM scrap_devices WHERE id = ?').run(id);
    if (res.changes === 0) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[ScrapRepo] Delete scrap device failed:', err);
    return { success: false, reason: err?.message || 'DELETE_SCRAP_FAILED' };
  }
}
