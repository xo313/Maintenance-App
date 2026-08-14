import { useEffect, useState } from 'react';
import type { DashboardStats, Operation } from '../types';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [debts, setDebts] = useState<Operation[]>([]);
  const [newCapital, setNewCapital] = useState<string>('');
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const loadData = async () => {
    const data = await (window as any).api.getDashboardStats();
    const debtsData = await (window as any).api.getDebts();
    setStats(data);
    setDebts(debtsData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePayDebt = async (id: number) => {
    const ok = confirm("هل أنت متأكد من سداد هذا الدين؟");
    if (!ok) return;
    
    await (window as any).api.payDebt(id);
    loadData();
  };

  const confirmCloseMonth = async () => {
    if (!newCapital) {
      alert('الرجاء إدخال رأس المال للشهر الجديد قبل التصفية');
      return;
    }
    
    if (isClosing) return;
    setIsClosing(true);

    const res = await (window as any).api.closeMonthWithExcel(parseFloat(newCapital));
    
    if (res.success) {
      alert('تم حفظ النسخة الاحتياطية وتصفية الشهر بنجاح!');
      setNewCapital('');
      setShowSettlementModal(false);
      loadData();
    } else {
      if (res.reason === 'cancelled') {
        alert('تم إلغاء عملية التصفية لأنك لم تقم بحفظ ملف النسخة الاحتياطية.');
      } else {
        alert('حدث خطأ أثناء حفظ الملف: ' + res.message);
      }
    }
    setIsClosing(false);
  };

  if (!stats) return <div>جاري التحميل...</div>;

  const finalDue = stats.availableCapital + stats.realizedShopProfit - stats.totalShopWithdrawal;

  return (
    <div>
      <div className="header-flex">
        <h2>لوحة التحكم</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn" style={{ background: '#ef4444' }} onClick={() => setShowSettlementModal(true)}>
            تصفية الشهر الحالي
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-title">المبلغ الحالي (الصندوق الكاش)</div>
          <div className="stat-value" style={{ color: 'var(--text)' }}>
            {stats.actualShopBalance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            الكاش الفعلي الموجود بالدرج
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'var(--primary)' }}>
          <div className="stat-title">الصافي المستحق (للمحل)</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {finalDue.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            رأس المال + أرباح نقدية - السحوبات
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'var(--success)' }}>
          <div className="stat-title">إجمالي أرباح المحل الكلية</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {stats.totalShopProfit.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            منها محصل ({stats.realizedShopProfit.toFixed(2)}) وفي السوق ({stats.unrealizedShopProfit.toFixed(2)})
          </div>
        </div>

        <div className="stat-card" style={{ borderColor: 'var(--danger)' }}>
          <div className="stat-title">ديون السوق المتبقية</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {stats.debtTotal.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            إجمالي الفواتير غير المسددة
          </div>
        </div>
      </div>

      <div className="glass table-container" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>العملاء الذين عليهم دين (إجمالي الديون: {stats.debtTotal.toFixed(2)})</h3>
        <table>
          <thead>
            <tr>
              <th>رقم العملية</th>
              <th>التاريخ</th>
              <th>اسم الزبون</th>
              <th>الفني</th>
              <th>المبلغ المتبقي (السعر)</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {debts.map(debt => (
              <tr key={debt.id}>
                <td>{debt.id}</td>
                <td>{debt.date}</td>
                <td>{debt.customer_name || '-'}</td>
                <td>{debt.technician_name}</td>
                <td>{debt.price ? debt.price.toFixed(2) : '0.00'}</td>
                <td>
                  <button className="btn" style={{ padding: '0.4rem 1rem' }} onClick={() => handlePayDebt(debt.id)}>
                    تسديد الدين
                  </button>
                </td>
              </tr>
            ))}
            {debts.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>لا توجد ديون مسجلة</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showSettlementModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass" style={{ padding: '2rem', width: '500px', maxWidth: '90%' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--danger)', textAlign: 'center' }}>كشف حساب وتصفية الشهر</h2>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>رأس المال الأساسي:</span>
              <span>{stats.baseCapital.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--danger)' }}>
              <span>رأس المال المعلق (تكلفة قطع لديون):</span>
              <span>- {stats.tiedCapital.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              <span>رأس المال المُسترد فعلياً:</span>
              <span>{stats.availableCapital.toFixed(2)}</span>
            </div>
            
            <hr style={{ borderColor: 'var(--border)', margin: '1rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--success)' }}>
              <span>أرباح المحل النقدية المحصلة:</span>
              <span>+ {stats.realizedShopProfit.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--danger)' }}>
              <span>إجمالي سحوبات المحل الشخصية:</span>
              <span>- {stats.totalShopWithdrawal.toFixed(2)}</span>
            </div>

            <hr style={{ borderColor: 'var(--border)', margin: '1rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', fontSize: '1.3rem', fontWeight: 'bold' }}>
              <span>الصافي النهائي المستحق لمالك المحل:</span>
              <span style={{ color: finalDue >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {finalDue.toFixed(2)}
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label>لتصفية الشهر، أدخل رأس المال للشهر الجديد:</label>
              <input 
                type="number" 
                placeholder="مثال: 5000"
                min="0"
                value={newCapital}
                onChange={e => setNewCapital(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn" style={{ flex: 1, background: 'var(--danger)' }} onClick={confirmCloseMonth} disabled={isClosing}>
                {isClosing ? 'جاري المعالجة...' : 'تأكيد وإغلاق الشهر'}
              </button>
              <button className="btn" style={{ flex: 1, background: 'var(--text-muted)' }} onClick={() => setShowSettlementModal(false)} disabled={isClosing}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
