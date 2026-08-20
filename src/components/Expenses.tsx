import { useEffect, useState } from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import type { ShopExpense } from '../types';
import { useDialog } from './ui/DialogContext';

export default function Expenses() {
  const [expenses, setExpenses] = useState<ShopExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const dialog = useDialog();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await (window as any).api.getShopExpenses();
      setExpenses(data);
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
    const amount = prompt('المبلغ:');
    if (!amount || isNaN(Number(amount))) return;
    
    const category = prompt('التصنيف (مثال: إيجار، كهرباء، ضيافة):');
    if (!category) return;

    const desc = prompt('ملاحظات (اختياري):');

    const res = await (window as any).api.addShopExpense({
      amount: Number(amount),
      category,
      description: desc || '',
      date: new Date().toLocaleDateString('en-GB')
    });
    
    if (res?.success === false) {
      dialog.error(res.reason || 'حدث خطأ');
    }
    loadData();
  };

  const handleDelete = async (id: number) => {
    const ok = await dialog.confirm('هل أنت متأكد من حذف هذا المصروف؟');
    if (!ok) return;

    const res = await (window as any).api.deleteShopExpense(id);
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
          <h2 className="section-title">مصروفات المحل</h2>
          <div className="caption">إدارة المصروفات التشغيلية التي تخفض من صافي أرباح المحل</div>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}>
          <Plus size={20} />
          إضافة مصروف
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner"></div></div>
      ) : expenses.length === 0 ? (
        <div className="empty-state">
          <FileText className="empty-state-icon" />
          <div className="empty-state-title">لا توجد مصروفات</div>
          <div className="caption">لم يتم تسجيل أي مصروفات في الشهر الحالي</div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>التصنيف</th>
                <th>المبلغ</th>
                <th>الوصف / ملاحظات</th>
                <th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td><span className="tag">{e.category}</span></td>
                  <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{e.amount.toLocaleString()}</td>
                  <td>{e.description || '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(e.id)}>
                      <Trash2 size={16} />
                    </button>
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
