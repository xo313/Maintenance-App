import { getDB } from '../connection.js';
import type { Customer } from '../../src/types.js';

export function getCustomers(): Customer[] {
  const db = getDB();

  // Get all registered customers
  const registered = db.prepare(
    'SELECT * FROM customers ORDER BY created_at DESC'
  ).all() as Customer[];

  // Get unique customers referenced in operations but not in customers table
  // (happens with data migrated from the old JSON-based database)
  const fromOps = db.prepare(`
    SELECT DISTINCT
      customer_name  AS name,
      customer_phone AS phone,
      NULL           AS notes,
      NULL           AS created_at,
      NULL           AS updated_at
    FROM operations
    WHERE customer_name IS NOT NULL
      AND customer_name != ''
      AND (
        customer_id IS NULL
        OR customer_id NOT IN (SELECT id FROM customers)
      )
      AND customer_phone NOT IN (SELECT phone FROM customers WHERE phone IS NOT NULL AND phone != '')
      AND customer_name NOT IN  (SELECT name  FROM customers)
    ORDER BY customer_name
  `).all() as any[];

  // Build virtual Customer objects for the orphan rows (negative IDs so they don't conflict)
  const orphans: Customer[] = fromOps.map((r, i) => ({
    id: -(i + 1),      // virtual negative ID — read-only, cannot be deleted/edited
    name:  r.name  || 'عميل غير معروف',
    phone: r.phone || '',
    notes: '',
    created_at: null,
    updated_at: null,
  }));

  return [...registered, ...orphans];
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
