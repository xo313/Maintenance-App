import { getDB } from '../connection.js';

export function getQuickLists(): { common_devices: string[]; common_faults: string[] } {
  const db = getDB();
  const devices = (db.prepare('SELECT name FROM common_devices ORDER BY id ASC').all() as { name: string }[]).map(r => r.name);
  const faults = (db.prepare('SELECT name FROM common_faults ORDER BY id ASC').all() as { name: string }[]).map(r => r.name);

  return {
    common_devices: devices,
    common_faults: faults
  };
}

export function addQuickListItem(type: 'device' | 'fault', item: string): { success: boolean; data?: { common_devices: string[]; common_faults: string[] }; reason?: string } {
  const db = getDB();
  const val = item.trim();
  if (!val) return { success: false, reason: 'EMPTY_VALUE' };

  try {
    const table = type === 'device' ? 'common_devices' : 'common_faults';
    db.prepare(`INSERT OR IGNORE INTO ${table} (name) VALUES (?)`).run(val);
    return { success: true, data: getQuickLists() };
  } catch (err: any) {
    console.error('[QuickListsRepo] Add quick list item failed:', err);
    return { success: false, reason: err?.message || 'ADD_ITEM_FAILED' };
  }
}

export function removeQuickListItem(type: 'device' | 'fault', item: string): { success: boolean; data?: { common_devices: string[]; common_faults: string[] }; reason?: string } {
  const db = getDB();
  const val = item.trim();

  try {
    const table = type === 'device' ? 'common_devices' : 'common_faults';
    db.prepare(`DELETE FROM ${table} WHERE name = ?`).run(val);
    return { success: true, data: getQuickLists() };
  } catch (err: any) {
    console.error('[QuickListsRepo] Remove quick list item failed:', err);
    return { success: false, reason: err?.message || 'REMOVE_ITEM_FAILED' };
  }
}
