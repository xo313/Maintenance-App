import { getDB } from '../connection.js';
import type { Settings } from '../../src/types.js';

export function getSettings(): Settings {
  const db = getDB();
  let row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Settings | undefined;
  if (!row) {
    db.prepare(`
      INSERT INTO settings (id, base_capital, shop_name, whatsapp_template, theme)
      VALUES (1, 0, 'مركز الصيانة', 'السلام عليكم [اسم_الزبون] 👋\nنود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.\nالمبلغ المطلوب: [المبلغ]\nشكراً لاختيارك مركزنا! 🛠️✨', 'dark')
    `).run();
    row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Settings;
  }
  return row;
}

export function updateSettings(settings: Partial<Settings>): { success: boolean; reason?: string } {
  const db = getDB();
  const current = getSettings();
  const updated = { ...current, ...settings };

  try {
    db.prepare(`
      UPDATE settings
      SET base_capital = ?, shop_name = ?, whatsapp_template = ?, theme = ?
      WHERE id = 1
    `).run(
      Number(updated.base_capital) || 0,
      updated.shop_name || 'مركز الصيانة',
      updated.whatsapp_template || '',
      updated.theme || 'dark'
    );
    return { success: true };
  } catch (err: any) {
    console.error('[SettingsRepo] Update failed:', err);
    return { success: false, reason: 'DATABASE_SAVE_FAILED' };
  }
}
