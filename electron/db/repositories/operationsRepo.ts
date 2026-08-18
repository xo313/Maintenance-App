import { getDB } from '../connection.js';
import { getCurrentMonth } from './monthsRepo.js';
import { getTechnicianById } from './techniciansRepo.js';
import { findCustomerByNameOrPhone, addCustomer } from './customersRepo.js';
import type { Operation } from '../../src/types.js';

function formatOperationRow(row: any): Operation {
  let faults: string[] = [];
  if (row.faults) {
    try {
      faults = JSON.parse(row.faults);
      if (!Array.isArray(faults)) faults = [String(row.faults)];
    } catch {
      faults = typeof row.faults === 'string' ? [row.faults] : [];
    }
  }

  const price = Number(row.price) || 0;
  const cost = Number(row.cost) || 0;
  let paid_amount = row.paid_amount !== null && row.paid_amount !== undefined ? Number(row.paid_amount) : (row.payment_status === 'cash' ? price : 0);

  return {
    ...row,
    price,
    cost,
    shop_profit: Number(row.shop_profit) || 0,
    tech_profit: Number(row.tech_profit) || 0,
    tech_profit_percentage: row.tech_profit_percentage !== null ? Number(row.tech_profit_percentage) : undefined,
    paid_amount,
    faults,
    warranty_enabled: Boolean(row.warranty_enabled),
    warranty_days: row.warranty_days ? Number(row.warranty_days) : undefined,
    technician_name: row.technician_name || undefined
  };
}

export function getOperations(): Operation[] {
  const db = getDB();
  const currentMonth = getCurrentMonth();

  const rows = db.prepare(`
    SELECT o.*, t.name as technician_name
    FROM operations o
    LEFT JOIN technicians t ON o.technician_id = t.id
    WHERE o.month_id = ?
       OR o.status IN ('under_maintenance', 'completed')
       OR (o.payment_status IN ('debt', 'partial') AND (o.price - COALESCE(o.paid_amount, 0)) > 0)
    ORDER BY o.id DESC
  `).all(currentMonth.id) as any[];

  return rows.map(formatOperationRow);
}

export function getAllOperations(): Operation[] {
  const db = getDB();
  const rows = db.prepare(`
    SELECT o.*, t.name as technician_name
    FROM operations o
    LEFT JOIN technicians t ON o.technician_id = t.id
    ORDER BY o.id DESC
  `).all() as any[];

  return rows.map(formatOperationRow);
}

export function getOperationById(id: number): Operation | null {
  const db = getDB();
  const row = db.prepare(`
    SELECT o.*, t.name as technician_name
    FROM operations o
    LEFT JOIN technicians t ON o.technician_id = t.id
    WHERE o.id = ?
  `).get(id) as any;

  return row ? formatOperationRow(row) : null;
}

export function getCustomerOperations(customerId?: number, customerPhone?: string): Operation[] {
  const db = getDB();
  let rows: any[] = [];

  if (customerId) {
    rows = db.prepare(`
      SELECT o.*, t.name as technician_name
      FROM operations o
      LEFT JOIN technicians t ON o.technician_id = t.id
      WHERE o.customer_id = ?
      ORDER BY o.id DESC
    `).all(customerId) as any[];
  } else if (customerPhone && customerPhone.trim()) {
    rows = db.prepare(`
      SELECT o.*, t.name as technician_name
      FROM operations o
      LEFT JOIN technicians t ON o.technician_id = t.id
      WHERE o.customer_phone = ?
      ORDER BY o.id DESC
    `).all(customerPhone.trim()) as any[];
  }

  return rows.map(formatOperationRow);
}

export function getNextOperationId(): number {
  const db = getDB();
  const res = db.prepare('SELECT MAX(id) as maxId FROM operations WHERE id < 100000000000').get() as { maxId: number | null };
  const nextId = (res && res.maxId) ? res.maxId + 1 : 1;
  return nextId;
}

export function addOperation(op: Partial<Operation>): { success: boolean; data?: Operation; reason?: string } {
  const db = getDB();
  const currentMonth = getCurrentMonth();

  const price = Number(op.price) || 0;
  const cost = Number(op.cost) || 0;
  const profit = price - cost;

  // Resolve technician
  const techId = Number(op.technician_id) || 1;
  const tech = getTechnicianById(techId);
  const techPercentage = op.tech_profit_percentage !== undefined 
    ? Number(op.tech_profit_percentage) 
    : (tech ? tech.profit_percentage : 0.5);

  const techProfit = profit * techPercentage;
  const shopProfit = profit - techProfit;

  // Payment calculations
  const paymentStatus = ['cash', 'debt', 'partial'].includes(op.payment_status as string) 
    ? (op.payment_status as 'cash' | 'debt' | 'partial') 
    : 'cash';

  let paidAmount = 0;
  if (paymentStatus === 'cash') {
    paidAmount = price;
  } else if (paymentStatus === 'partial') {
    paidAmount = Math.max(0, Math.min(price, Number(op.paid_amount) || 0));
  }

  const status = ['under_maintenance', 'completed', 'delivered', 'cancelled'].includes(op.status as string)
    ? (op.status as 'under_maintenance' | 'completed' | 'delivered' | 'cancelled')
    : 'under_maintenance';

  const monthId = op.month_id || currentMonth.id;
  const deliveredInMonth = status === 'delivered' ? currentMonth.id : null;
  const paidInMonth = paidAmount > 0 ? currentMonth.id : null;

  try {
    const addTx = db.transaction(() => {
      // Resolve or create customer
      let custId = op.customer_id;
      if (op.customer_name && op.customer_name.trim()) {
        const existingCust = findCustomerByNameOrPhone(op.customer_name, op.customer_phone);
        if (existingCust) {
          custId = existingCust.id;
        } else {
          const createRes = addCustomer({
            name: op.customer_name.trim(),
            phone: op.customer_phone?.trim() || ''
          });
          if (createRes.success && createRes.data) {
            custId = createRes.data.id;
          }
        }
      }

      const id = op.id || getNextOperationId();
      const faultsJson = JSON.stringify(Array.isArray(op.faults) ? op.faults : (op.faults ? [op.faults] : []));
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO operations (
          id, date, month_id, technician_id, customer_id, customer_name, customer_phone,
          device, device_code, faults, cost, price, tech_profit_percentage, shop_profit,
          tech_profit, payment_status, status, paid_in_month_id, delivered_in_month_id,
          paid_at, paid_amount, notes, accessories, warranty_enabled, warranty_days,
          warranty_note, warranty_expiry_date
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )
      `).run(
        id,
        op.date || new Date().toLocaleDateString('en-GB'),
        monthId,
        techId,
        custId || null,
        op.customer_name?.trim() || 'عميل',
        op.customer_phone?.trim() || '',
        op.device?.trim() || 'جهاز',
        op.device_code?.trim() || null,
        faultsJson,
        cost,
        price,
        techPercentage,
        shopProfit,
        techProfit,
        paymentStatus,
        status,
        paidInMonth,
        deliveredInMonth,
        paidAmount > 0 ? (op.paid_at || now) : null,
        paidAmount,
        op.notes?.trim() || null,
        op.accessories?.trim() || null,
        op.warranty_enabled ? 1 : 0,
        op.warranty_days ? Number(op.warranty_days) : null,
        op.warranty_note?.trim() || null,
        op.warranty_expiry_date?.trim() || null
      );

      // Record in payments table if any paid amount
      if (paidAmount > 0) {
        db.prepare(`
          INSERT INTO payments (operation_id, month_id, amount, paid_at, payment_type, notes)
          VALUES (?, ?, ?, ?, 'cash', 'دفعة تسجيل العملية')
        `).run(id, currentMonth.id, paidAmount, now);
      }

      return id;
    });

    const newOpId = addTx();
    const created = getOperationById(newOpId);
    return { success: true, data: created || undefined };
  } catch (err: any) {
    console.error('[OperationsRepo] Add operation failed:', err);
    return { success: false, reason: err?.message || 'ADD_OPERATION_FAILED' };
  }
}

export function editOperation(opId: number, updatedOp: Partial<Operation>): { success: boolean; data?: Operation; reason?: string } {
  const db = getDB();
  const current = getOperationById(opId);
  if (!current) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  const currentMonth = getCurrentMonth();

  const price = updatedOp.price !== undefined ? Number(updatedOp.price) : current.price;
  const cost = updatedOp.cost !== undefined ? Number(updatedOp.cost) : current.cost;
  const profit = price - cost;

  const techId = updatedOp.technician_id !== undefined ? Number(updatedOp.technician_id) : current.technician_id;
  const tech = getTechnicianById(techId);
  const techPercentage = updatedOp.tech_profit_percentage !== undefined 
    ? Number(updatedOp.tech_profit_percentage)
    : (current.tech_profit_percentage !== undefined ? current.tech_profit_percentage : (tech ? tech.profit_percentage : 0.5));

  const techProfit = profit * techPercentage;
  const shopProfit = profit - techProfit;

  const paymentStatus = (updatedOp.payment_status || current.payment_status) as 'cash' | 'debt' | 'partial';
  let paidAmount = current.paid_amount || 0;

  if (paymentStatus === 'cash') {
    paidAmount = price;
  } else if (paymentStatus === 'debt') {
    paidAmount = 0;
  } else if (paymentStatus === 'partial') {
    paidAmount = updatedOp.paid_amount !== undefined ? Number(updatedOp.paid_amount) : (current.paid_amount || 0);
    paidAmount = Math.max(0, Math.min(price, paidAmount));
  }

  const status = (updatedOp.status || current.status) as 'under_maintenance' | 'completed' | 'delivered' | 'cancelled';
  let deliveredInMonth = current.delivered_in_month_id;

  if (status === 'delivered') {
    if (!deliveredInMonth) {
      deliveredInMonth = currentMonth.id;
    }
  } else {
    deliveredInMonth = undefined;
  }

  let paidInMonth = current.paid_in_month_id;
  if (paidAmount > 0 && !paidInMonth) {
    paidInMonth = currentMonth.id;
  } else if (paidAmount === 0) {
    paidInMonth = undefined;
  }

  try {
    const editTx = db.transaction(() => {
      const faultsJson = JSON.stringify(Array.isArray(updatedOp.faults) ? updatedOp.faults : (current.faults || []));

      db.prepare(`
        UPDATE operations
        SET
          date = ?, technician_id = ?, customer_id = ?, customer_name = ?, customer_phone = ?,
          device = ?, device_code = ?, faults = ?, cost = ?, price = ?,
          tech_profit_percentage = ?, shop_profit = ?, tech_profit = ?,
          payment_status = ?, status = ?, paid_in_month_id = ?, delivered_in_month_id = ?,
          paid_at = ?, paid_amount = ?, notes = ?, accessories = ?,
          warranty_enabled = ?, warranty_days = ?, warranty_note = ?, warranty_expiry_date = ?
        WHERE id = ?
      `).run(
        updatedOp.date || current.date,
        techId,
        updatedOp.customer_id !== undefined ? updatedOp.customer_id : current.customer_id,
        updatedOp.customer_name?.trim() || current.customer_name,
        updatedOp.customer_phone?.trim() || current.customer_phone,
        updatedOp.device?.trim() || current.device,
        updatedOp.device_code !== undefined ? updatedOp.device_code : current.device_code,
        faultsJson,
        cost,
        price,
        techPercentage,
        shopProfit,
        techProfit,
        paymentStatus,
        status,
        paidInMonth || null,
        deliveredInMonth || null,
        paidAmount > 0 ? (updatedOp.paid_at || current.paid_at || new Date().toISOString()) : null,
        paidAmount,
        updatedOp.notes !== undefined ? updatedOp.notes : current.notes,
        updatedOp.accessories !== undefined ? updatedOp.accessories : current.accessories,
        (updatedOp.warranty_enabled !== undefined ? updatedOp.warranty_enabled : current.warranty_enabled) ? 1 : 0,
        updatedOp.warranty_days !== undefined ? updatedOp.warranty_days : current.warranty_days,
        updatedOp.warranty_note !== undefined ? updatedOp.warranty_note : current.warranty_note,
        updatedOp.warranty_expiry_date !== undefined ? updatedOp.warranty_expiry_date : current.warranty_expiry_date,
        opId
      );

      // Record difference in payments table
      const previousPaid = current.paid_amount || 0;
      if (paidAmount > previousPaid) {
        db.prepare(`
          INSERT INTO payments (operation_id, month_id, amount, paid_at, payment_type, notes)
          VALUES (?, ?, ?, ?, 'cash', 'دفعة إضافية من تعديل العملية')
        `).run(opId, currentMonth.id, paidAmount - previousPaid, new Date().toISOString());
      }
    });

    editTx();
    const updated = getOperationById(opId);
    return { success: true, data: updated || undefined };
  } catch (err: any) {
    console.error('[OperationsRepo] Edit operation failed:', err);
    return { success: false, reason: err?.message || 'EDIT_OPERATION_FAILED' };
  }
}

export function deleteOperation(opId: number): { success: boolean; reason?: string } {
  const db = getDB();
  try {
    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM payments WHERE operation_id = ?').run(opId);
      const res = db.prepare('DELETE FROM operations WHERE id = ?').run(opId);
      if (res.changes === 0) {
        throw new Error('NOT_FOUND');
      }
    });

    deleteTx();
    return { success: true };
  } catch (err: any) {
    console.error('[OperationsRepo] Delete operation failed:', err);
    return { success: false, reason: err?.message || 'DELETE_OPERATION_FAILED' };
  }
}

export function getDebts(): Operation[] {
  const db = getDB();
  const rows = db.prepare(`
    SELECT o.*, t.name as technician_name
    FROM operations o
    LEFT JOIN technicians t ON o.technician_id = t.id
    WHERE o.payment_status IN ('debt', 'partial')
      AND (o.price - COALESCE(o.paid_amount, 0)) > 0
    ORDER BY o.id DESC
  `).all() as any[];

  return rows.map(formatOperationRow);
}

export function payDebt(operationId: number): { success: boolean; data?: Operation; reason?: string } {
  const db = getDB();
  const current = getOperationById(operationId);
  if (!current) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  const currentMonth = getCurrentMonth();
  const remainingDebt = Math.max(0, current.price - (current.paid_amount || 0));

  try {
    const payTx = db.transaction(() => {
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE operations
        SET payment_status = 'cash',
            paid_amount = price,
            paid_at = ?,
            paid_in_month_id = ?
        WHERE id = ?
      `).run(now, currentMonth.id, operationId);

      if (remainingDebt > 0) {
        db.prepare(`
          INSERT INTO payments (operation_id, month_id, amount, paid_at, payment_type, notes)
          VALUES (?, ?, ?, ?, 'cash', 'تسديد دين بالكامل')
        `).run(operationId, currentMonth.id, remainingDebt, now);
      }
    });

    payTx();
    const updated = getOperationById(operationId);
    return { success: true, data: updated || undefined };
  } catch (err: any) {
    console.error('[OperationsRepo] Pay debt failed:', err);
    return { success: false, reason: err?.message || 'PAY_DEBT_FAILED' };
  }
}
