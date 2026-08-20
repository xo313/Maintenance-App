import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Truck, Activity } from 'lucide-react';
import type { Supplier, SupplierPurchase, SupplierPayment } from '../types';
import { useDialog } from './ui/DialogContext';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const dialog = useDialog();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await (window as any).api.getSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async () => {
    // Basic implementation for adding supplier
    // You could replace this with a proper modal if needed
    const name = prompt('اسم المورد:');
    if (!name) return;
    const phone = prompt('رقم الهاتف:');
    
    await (window as any).api.addSupplier({ name, phone });
    loadData();
  };

  const handleAddPurchase = async (id: number) => {
    const amount = prompt('مبلغ الشراء:');
    if (!amount || isNaN(Number(amount))) return;
    const desc = prompt('وصف الفاتورة:');

    const res = await (window as any).api.addSupplierPurchase({
      supplier_id: id,
      amount: Number(amount),
      description: desc || 'فاتورة مشتريات',
      date: new Date().toLocaleDateString('en-GB')
    });
    
    if (res?.success === false) {
      dialog.error(res.reason || 'حدث خطأ');
    }
    loadData();
  };

  const handleAddPayment = async (id: number) => {
    const amount = prompt('مبلغ الدفعة المستددة (سيتم خصمه من الصندوق النردي):');
    if (!amount || isNaN(Number(amount))) return;
    const desc = prompt('ملاحظات الدفعة:');

    const res = await (window as any).api.addSupplierPayment({
      supplier_id: id,
      amount: Number(amount),
      description: desc || 'دفعة لمورد',
      date: new Date().toLocaleDateString('en-GB')
    });

    if (res?.success === false) {
      dialog.error(res.reason || 'حدث خطأ');
    }
    loadData();
  };

  const handleDelete = async (id: number) => {
    const ok = await dialog.confirm('هل أنت متأكد من حذف هذا المورد؟');
    if (!ok) return;

    const res = await (window as any).api.deleteSupplier(id);
    if (!res?.success) {
      dialog.error(res.reason || 'فشل الحذف');
    } else {
      loadData();
    }
  };

  return (
    <div className="fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h2 className="section-title">الموردين</h2>
          <div className="caption">إدارة الموردين ومشتريات قطع الغيار</div>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}>
          <Plus size={20} />
          إضافة مورد
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner"></div></div>
      ) : suppliers.length === 0 ? (
        <div className="empty-state">
          <Truck className="empty-state-icon" />
          <div className="empty-state-title">لا يوجد موردين</div>
          <div className="caption">انقر على "إضافة مورد" للبدء</div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>اسم المورد</th>
                <th>الهاتف</th>
                <th>إجمالي المشتريات</th>
                <th>الدفعات المسددة</th>
                <th>الرصيد المتبقي (ذمم)</th>
                <th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 'bold' }}>{s.name}</td>
                  <td dir="ltr" style={{ textAlign: 'right' }}>{s.phone || '-'}</td>
                  <td>{s.total_purchases?.toLocaleString() || 0}</td>
                  <td style={{ color: 'var(--success)' }}>{s.total_payments?.toLocaleString() || 0}</td>
                  <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{s.balance?.toLocaleString() || 0}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.85rem' }} onClick={() => handleAddPurchase(s.id)}>
                        + فاتورة
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.85rem', color: 'var(--success)' }} onClick={() => handleAddPayment(s.id)}>
                        + سداد
                      </button>
                      <button className="btn btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
