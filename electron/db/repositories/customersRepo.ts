import { getDB } from '../connection.js';
import type { Customer } from '../../src/types.js';

export function getCustomers(): Customer[] {
  try {
    const db = getDB();
    return db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all() as Customer[];
  } catch (err) {
    console.error('[CustomersRepo] getCustomers failed:', err);
    return [];
  }
}

export function getCustomersWithOrphans(): Customer[] {
  try {
    const db = getDB();

    // Registered customers
    const registered = db.prepare(
      'SELECT * FROM customers ORDER BY created_at DESC'
    ).all() as Customer[];

    const registeredNames  = new Set(registered.map(c => c.name.trim()));
    const registeredPhones = new Set(registered.map(c => (c.phone || '').trim()).filter(Boolean));

    // All distinct customer_name/phone from operations
    const opsRows = db.prepare(`
      SELECT DISTINCT customer_name AS name, customer_phone AS phone
      FROM operations
      WHERE customer_name IS NOT NULL AND customer_name != ''
      ORDER BY customer_name
    `).all() as { name: string; phone: string | null }[];

    // Keep only those not already in the registered set
    const orphans: Customer[] = [];
    let virtualId = -1;
    for (const r of opsRows) {
      const nm = (r.name || '').trim();
      const ph = (r.phone || '').trim();
      if (!nm) continue;
      if (registeredNames.has(nm)) continue;
      if (ph && registeredPhones.has(ph)) continue;
      orphans.push({ id: virtualId--, name: nm, phone: ph, notes: '', created_at: null, updated_at: null });
    }

    return [...registered, ...orphans];
  } catch (err) {
    console.error('[CustomersRepo] getCustomersWithOrphans failed:', err);
    try {
      const db = getDB();
      return db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all() as Customer[];
    } catch {
      return [];
    }
  }
}

export function getCustomerById(id: number): Customer | null {
  const db = getDB();
  return (db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer) || null;
}

export function findCustomerByNameOrPhone(name: string, phone?: string): Customer | null {
  const db = getDB();
  if (phone && phone.trim()) {
    const byPhone = db.prepare('SELECT * FROM customers WHERE phone = ? LIMIT 1').get(phone.trim()) as Customer | undefined;
    if (byPhone) return byPhone;
  }
  if (name && name.trim()) {
    const byName = db.prepare('SELECT * FROM customers WHERE name = ? LIMIT 1').get(name.trim()) as Customer | undefined;
    if (byName) return byName;
  }
  return null;
}

export function addCustomer(customer: Partial<Customer>): { success: boolean; data?: Customer; reason?: string } {
  const db = getDB();
  const id = customer.id || (Date.now() + Math.floor(Math.random() * 1000));
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO customers (id, name, phone, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      customer.name?.trim() || 'عميل',
      customer.phone?.trim() || '',
      customer.notes?.trim() || '',
      customer.created_at || now,
      now
    );

    const created = getCustomerById(id);
    return { success: true, data: created || undefined };
  } catch (err: any) {
    console.error('[CustomersRepo] Add customer failed:', err);
    return { success: false, reason: err?.message || 'ADD_CUSTOMER_FAILED' };
  }
}

export function editCustomer(id: number, updatedData: Partial<Customer>): { success: boolean; data?: Customer; reason?: string } {
  const db = getDB();
  const current = getCustomerById(id);
  if (!current) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  const now = new Date().toISOString();
  const name = updatedData.name !== undefined ? updatedData.name.trim() : current.name;
  const phone = updatedData.phone !== undefined ? updatedData.phone.trim() : current.phone;
  const notes = updatedData.notes !== undefined ? updatedData.notes.trim() : (current.notes || '');

  try {
    db.prepare(`
      UPDATE customers
      SET name = ?, phone = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(name, phone, notes, now, id);

    const updated = getCustomerById(id);
    return { success: true, data: updated || undefined };
  } catch (err: any) {
    console.error('[CustomersRepo] Edit customer failed:', err);
    return { success: false, reason: err?.message || 'EDIT_CUSTOMER_FAILED' };
  }
}

export function deleteCustomer(id: number): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    const res = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    if (res.changes === 0) {
      return { success: false, reason: 'NOT_FOUND' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[CustomersRepo] Delete customer failed:', err);
    return { success: false, reason: err?.message || 'DELETE_CUSTOMER_FAILED' };
  }
}
