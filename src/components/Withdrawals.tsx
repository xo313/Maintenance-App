import { useEffect, useState } from 'react';
import { Edit, Trash2, PlusCircle, CheckCircle2 } from 'lucide-react';
import type { Withdrawal, Technician } from '../types';
import { useDialog } from './ui/DialogProvider';

export default function Withdrawals() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const [type, setType] = useState<'shop_withdrawal' | 'tech_withdrawal'>('shop_withdrawal');
  const [techId, setTechId] = useState<number | ''>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const dialog = useDialog();

  const loadData = async () => {
    const ws = await window.api.getWithdrawals();
    const techs = await window.api.getTechnicians();
    setWithdrawals(ws);
    setTechnicians(techs);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    if (type === 'tech_withdrawal' && !techId) return;

    if (editingId) {
      const res = await (window as any).api.editWithdrawal(editingId, {
        type,
        technician_id: type === 'tech_withdrawal' ? Number(techId) : null,
        amount: parseFloat(amount),
        description
      });
      if (res && res.success === false) {
        await dialog.error(res.reason || 'فشل الحفظ');
        return;
      }
      setEditingId(null);
    } else {
      const res = await (window as any).api.addWithdrawal({
        type,
        technician_id: type === 'tech_withdrawal' ? Number(techId) : null,
        amount: parseFloat(amount),
        description
      });
      if (res && res.success === false) {
        await dialog.error(res.reason || 'فشل الحفظ');
        return;
      }
    }

    setAmount('');
    setDescription('');
    setTechId('');
    loadData();
  };

  const handleEdit = (w: Withdrawal) => {
    setEditingId(w.id);
    setType(w.type);
    setTechId(w.technician_id || '');
    setAmount(w.amount.toString());
    setDescription(w.description || '');
  };

  const handleDelete = async (id: number) => {
    const confirmed = await dialog.confirm('هل أنت متأكد من حذف هذا السحب؟', 'تأكيد الحذف', true);
    if (confirmed) {
      const res = await (window as any).api.deleteWithdrawal(id);
      if (res && res.success === false) {
        await dialog.error(res.reason || 'فشل الحذف');
        return;
      }
      loadData();
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount('');
    setDescription('');
    setTechId('');
  };

  return (
    <div className="fade-in">
      <div className="header-flex">
        <h2 className="page-title">السحوبات والمصروفات</h2>
      </div>

      <div className="stat-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
          {editingId ? (
            <><Edit size={20} color="var(--primary)" /> تعديل السحب</>
          ) : (
            <><PlusCircle size={20} color="var(--primary)" /> تسجيل سحب جديد</>
          )}
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>نوع السحب</label>
            <select value={type} onChange={e => setType(e.target.value as any)}>
              <option value="shop_withdrawal">مصروفات محل</option>
              <option value="tech_withdrawal">سلفة / سحب فني</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>الفني</label>
            <select 
              value={techId} 
              onChange={e => setTechId(Number(e.target.value))} 
              disabled={type === 'shop_withdrawal'}
              required={type === 'tech_withdrawal'}
            >
              <option value="" disabled>اختر الفني...</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>المبلغ</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>البيان / الوصف</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} required />
          </div>
          
          <div className="flex-center gap-2">
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingId ? 'حفظ التعديل' : 'إضافة سحب'}</button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>إلغاء</button>
            )}
          </div>
        </form>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>رقم</th>
              <th>التاريخ</th>
              <th>النوع</th>
              <th>المبلغ</th>
              <th>الفني (إن وجد)</th>
              <th>البيان</th>
              <th style={{ textAlign: 'center' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map(w => (
              <tr key={w.id}>
                <td><span className="tag">#{w.id}</span></td>
                <td style={{ color: 'var(--text-muted)' }}>{w.date}</td>
                <td>
                  <span className={`badge ${w.type === 'shop_withdrawal' ? 'badge-danger' : 'badge-primary'}`}>
                    {w.type === 'shop_withdrawal' ? 'سحب محل' : 'سحب فني'}
                  </span>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text)' }}>{w.amount.toFixed(2)}</td>
                <td style={{ fontWeight: 500 }}>{w.technician_name || '-'}</td>
                <td style={{ color: 'var(--text-muted)' }}>{w.description}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button onClick={() => handleEdit(w)} className="btn btn-icon" title="تعديل">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDelete(w.id)} className="btn btn-icon danger" title="حذف">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 0 }}>
                  <div className="empty-state">
                    <CheckCircle2 className="empty-state-icon" />
                    <div className="empty-state-title">لا توجد سحوبات مسجلة</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
