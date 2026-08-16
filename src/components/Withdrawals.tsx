import { useEffect, useState } from 'react';
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
    <div>
      <div className="header-flex">
        <h2>السحوبات والمصروفات</h2>
      </div>

      <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>{editingId ? 'تعديل السحب' : 'تسجيل سحب جديد'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: '1rem', alignItems: 'end' }}>
          
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
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn">{editingId ? 'تعديل' : 'حفظ'}</button>
            {editingId && (
              <button type="button" className="btn" style={{ background: 'var(--text-muted)' }} onClick={cancelEdit}>إلغاء</button>
            )}
          </div>
        </form>
      </div>

      <div className="glass table-container">
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
                <td>{w.id}</td>
                <td>{w.date}</td>
                <td>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '0.85rem',
                    background: w.type === 'shop_withdrawal' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    color: w.type === 'shop_withdrawal' ? 'var(--danger)' : 'var(--primary)'
                  }}>
                    {w.type === 'shop_withdrawal' ? 'سحب محل' : 'سحب فني'}
                  </span>
                </td>
                <td style={{ fontWeight: 'bold' }}>{w.amount.toFixed(2)}</td>
                <td>{w.technician_name || '-'}</td>
                <td>{w.description}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button onClick={() => handleEdit(w)} className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--primary)' }}>تعديل</button>
                    <button onClick={() => handleDelete(w.id)} className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--danger)' }}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center' }}>لا توجد سحوبات مسجلة</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
