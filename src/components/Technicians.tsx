import { useEffect, useState } from "react";
import type { TechnicianStats } from "../types";
import { useDialog } from './ui/DialogProvider';

export default function Technicians() {
  const [technicians, setTechnicians] = useState<TechnicianStats[]>([]);
  
  // Add state
  const [name, setName] = useState('');
  const [profitPercentage, setProfitPercentage] = useState('30');
  
  // Edit state
  const [editingTech, setEditingTech] = useState<TechnicianStats | null>(null);
  const [editName, setEditName] = useState('');
  const [editProfit, setEditProfit] = useState('');

  // Withdrawal state
  const [withdrawalTech, setWithdrawalTech] = useState<TechnicianStats | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  
  const dialog = useDialog();

  const loadData = async () => {
    const stats = await (window as any).api.getTechnicianStats();
    setTechnicians(stats);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    const res = await (window as any).api.addTechnician(name, parseFloat(profitPercentage) / 100);
    if (res && res.success === false) {
      await dialog.error(res.reason || 'فشل الحفظ');
      return;
    }
    setName('');
    setProfitPercentage('30');
    loadData();
  };

  const handleEditClick = (tech: TechnicianStats) => {
    setEditingTech(tech);
    setEditName(tech.name);
    setEditProfit((tech.profit_percentage * 100).toString());
    setWithdrawalTech(null); // close other modal
  };

  const handleSaveEdit = async () => {
    if (!editingTech) return;
    const res = await (window as any).api.editTechnician(
      editingTech.id, 
      editName, 
      parseFloat(editProfit) / 100
    );
    if (res && res.success === false) {
      await dialog.error(res.reason || 'فشل الحفظ');
      return;
    }
    setEditingTech(null);
    loadData();
  };

  const handleAddWithdrawalClick = (tech: TechnicianStats) => {
    setWithdrawalTech(tech);
    setWithdrawalAmount('');
    setEditingTech(null); // close other modal
  };

  const handleSaveWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawalTech || !withdrawalAmount) return;

    const res = await (window as any).api.addWithdrawal({
      type: 'tech_withdrawal',
      technician_id: withdrawalTech.id,
      amount: parseFloat(withdrawalAmount)
    });
    if (res && res.success === false) {
      await dialog.error(res.reason || 'فشل الحفظ');
      return;
    }

    setWithdrawalTech(null);
    loadData();
  };

  return (
    <div>
      <div className="header-flex">
        <h2>حسابات الفنيين</h2>
      </div>

      <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>إضافة فني جديد</h3>
        <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>اسم الفني</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>نسبة الربح (%)</label>
            <input type="number" step="1" min="0" max="100" value={profitPercentage} onChange={e => setProfitPercentage(e.target.value)} required />
          </div>
          
          <button type="submit" className="btn">حفظ</button>
        </form>
      </div>

      {editingTech && (
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>تعديل بيانات الفني</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '1rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>اسم الفني</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>نسبة الربح (%)</label>
              <input type="number" step="1" min="0" max="100" value={editProfit} onChange={e => setEditProfit(e.target.value)} required />
            </div>
            <button className="btn" onClick={handleSaveEdit}>حفظ التعديلات</button>
            <button className="btn" style={{ background: 'var(--text-muted)' }} onClick={() => setEditingTech(null)}>إلغاء</button>
          </div>
        </div>
      )}

      {withdrawalTech && (
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--danger)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--danger)' }}>تسجيل سحبة مالية للفني: {withdrawalTech.name}</h3>
          <form onSubmit={handleSaveWithdrawal} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>مبلغ السحب</label>
              <input type="number" step="0.01" min="0" value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)} required autoFocus />
            </div>
            <button type="submit" className="btn" style={{ background: 'var(--danger)' }}>تسجيل السحب</button>
            <button type="button" className="btn" style={{ background: 'var(--text-muted)' }} onClick={() => setWithdrawalTech(null)}>إلغاء</button>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {technicians.filter(t => t.is_active || t.remainingBalance !== 0 || t.unrealizedProfit !== 0).map(t => (
          <div key={t.id} className={`glass stat-card ${!t.is_active ? 'inactive-tech' : ''}`} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', opacity: t.is_active ? 1 : 0.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem' }}>
                  {t.name}
                  {!t.is_active && <span style={{ fontSize: '0.8rem', color: 'var(--danger)', marginRight: '0.5rem' }}>(موقوف)</span>}
                </h3>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>النسبة: {(t.profit_percentage * 100).toFixed(0)}%</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn" 
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }}
                  onClick={() => handleEditClick(t)}
                >
                  تعديل
                </button>
                <button 
                  className="btn" 
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                  onClick={async () => {
                    const confirmed = await dialog.confirm('هل أنت متأكد من حذف هذا الفني؟', 'تأكيد الحذف', true);
                    if (confirmed) {
                      const res = await (window as any).api.deleteTechnician(t.id);
                      if (res && res.success === false) {
                        await dialog.error(res.reason || 'فشل الحذف');
                        return;
                      }
                      loadData();
                    }
                  }}
                >
                  حذف
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1rem' }}>
              <span>الأرباح المحققة (كاش ومسدد):</span>
              <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>+ {t.totalProfit.toFixed(2)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '1rem' }}>
              <span>الأرباح المعلقة (ديون في السوق):</span>
              <span style={{ color: 'var(--text-muted)' }}>{t.unrealizedProfit.toFixed(2)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1rem' }}>
              <span>إجمالي السحوبات:</span>
              <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>- {t.totalWithdrawal.toFixed(2)}</span>
            </div>

            <hr style={{ borderColor: 'var(--border)', margin: '0.5rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>الصافي المستحق:</span>
              <span style={{ 
                fontSize: '1.4rem', 
                fontWeight: 'bold', 
                color: t.remainingBalance >= 0 ? 'var(--primary)' : 'var(--danger)' 
              }}>
                {t.remainingBalance.toFixed(2)}
              </span>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                className="btn" 
                style={{ width: '100%', background: 'var(--danger)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                onClick={() => handleAddWithdrawalClick(t)}
              >
                <span>تسجيل سحب نقدي</span>
              </button>
              
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                رأس المال (تكلفة القطع) المستهلك: {t.totalCost.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
        {technicians.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>لا يوجد فنيين مسجلين</div>
        )}
      </div>
    </div>
  );
}
