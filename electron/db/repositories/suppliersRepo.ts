import { getDB } from '../connection.js';

export interface Supplier {
  id?: number;
  name: string;
  phone?: string;
  notes?: string;
  created_at?: string;
  // Computed fields
  total_purchases?: number;
  total_payments?: number;
  balance?: number;
}

export interface SupplierPurchase {
  id?: number;
  supplier_id: number;
  month_id: number;
  date: string;
  amount: number;
  description?: string;
  created_at?: string;
}

export interface SupplierPayment {
  id?: number;
  supplier_id: number;
  month_id: number;
  date: string;
  amount: number;
  description?: string;
  created_at?: string;
}

export function getSuppliers(): Supplier[] {
  const db = getDB();
  return db.prepare(`
    SELECT 
      s.*,
      COALESCE((SELECT SUM(amount) FROM supplier_purchases WHERE supplier_id = s.id), 0) as total_purchases,
      COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = s.id), 0) as total_payments,
      COALESCE((SELECT SUM(amount) FROM supplier_purchases WHERE supplier_id = s.id), 0) - COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = s.id), 0) as balance
    FROM suppliers s
    ORDER BY s.name ASC
  `).all() as Supplier[];
}

export function addSupplier(s: Partial<Supplier>): { success: boolean; data?: Supplier; reason?: string } {
  const db = getDB();
  const created_at = new Date().toISOString();
  try {
    const info = db.prepare('INSERT INTO suppliers (name, phone, notes, created_at) VALUES (?, ?, ?, ?)').run(
      s.name, s.phone || '', s.notes || '', created_at
    );
    return { success: true, data: { ...s, id: info.lastInsertRowid as number, created_at } as Supplier };
  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}

export function editSupplier(id: number, s: Partial<Supplier>): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    db.prepare('UPDATE suppliers SET name = ?, phone = ?, notes = ? WHERE id = ?').run(s.name, s.phone || '', s.notes || '', id);
    return { success: true };
  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}

export function deleteSupplier(id: number): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    // Should ensure no active purchases/payments
    const check = db.prepare('SELECT count(*) as c FROM supplier_purchases WHERE supplier_id = ?').get(id) as { c: number };
    if (check.c > 0) return { success: false, reason: 'لا يمكن حذف المورد لوجود عمليات شراء مسجلة' };
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}

export function getSupplierPurchases(supplierId: number): SupplierPurchase[] {
  const db = getDB();
  return db.prepare('SELECT * FROM supplier_purchases WHERE supplier_id = ? ORDER BY date DESC, id DESC').all(supplierId) as SupplierPurchase[];
}

export function getSupplierPayments(supplierId: number): SupplierPayment[] {
  const db = getDB();
  return db.prepare('SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY date DESC, id DESC').all(supplierId) as SupplierPayment[];
}

export function addSupplierPurchase(p: SupplierPurchase): { success: boolean; data?: SupplierPurchase; reason?: string } {
  const db = getDB();
  const created_at = new Date().toISOString();
  try {
    const info = db.prepare('INSERT INTO supplier_purchases (supplier_id, month_id, date, amount, description, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      p.supplier_id, p.month_id, p.date, p.amount, p.description || '', created_at
    );
    return { success: true, data: { ...p, id: info.lastInsertRowid as number, created_at } };
  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}

export function addSupplierPayment(p: SupplierPayment): { success: boolean; data?: SupplierPayment; reason?: string } {
  const db = getDB();
  const created_at = new Date().toISOString();
  try {
    let newPaymentId: number = 0;
    db.transaction(() => {
      const info = db.prepare('INSERT INTO supplier_payments (supplier_id, month_id, date, amount, description, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        p.supplier_id, p.month_id, p.date, p.amount, p.description || '', created_at
      );
      newPaymentId = info.lastInsertRowid as number;

      db.prepare('INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        'SUPPLIER_PAYMENT', p.amount, p.date, p.month_id, newPaymentId, p.description || 'دفعة لمورد', created_at
      );
    })();
    return { success: true, data: { ...p, id: newPaymentId, created_at } };
  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}
