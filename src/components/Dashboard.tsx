import { useEffect, useState } from 'react';
import { Wallet, Banknote, TrendingUp, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
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

  if (!stats) return <div className="fade-in" style={{ padding: '2rem', textAlign: 'center' }}>جاري تحميل البيانات...</div>;

  return (
    <div className="fade-in">
      <div className="header-flex">
        <h2 className="page-title">لوحة التحكم</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }} onClick={() => setShowSettlementModal(true)}>
            <FileText size={20} /> تصفية الشهر الحالي
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Card 1: Cash Box */}
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title">المبلغ الحالي (الصندوق)</div>
            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: '#f8fafc' }}>
              <Wallet size={24} />
            </div>
          </div>
          <div className="stat-value">{stats.cashBox.toFixed(2)}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            (رأس المال + أرباح العمليات النقدية - السحوبات)
          </div>
        </div>

        {/* Card 2: Final Due */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title">المبلغ المستحق (مستحقات المحل)</div>
            <div style={{ padding: '10px', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary)' }}>
              <Banknote size={24} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{stats.shopDue.toFixed(2)}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            (رأس المال المتوفر + أرباح المحل الصافية)
          </div>
        </div>

        {/* Card 3: Total Profit */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title">الأرباح الكلية</div>
            <div style={{ padding: '10px', background: 'var(--success-bg)', borderRadius: '12px', color: 'var(--success)' }}>
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.totalProfit.toFixed(2)}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            (إجمالي أرباح جميع العمليات نقدية أو دين)
          </div>
        </div>

        {/* Card 4: Debts */}
        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title">ديون السوق المتبقية</div>
            <div style={{ padding: '10px', background: 'var(--danger-bg)', borderRadius: '12px', color: 'var(--danger)' }}>
              <AlertTriangle size={24} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.debtTotal.toFixed(2)}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            إجمالي المبالغ غير المسددة للعمليات (دين)
          </div>
        </div>
      </div>

      <div className="table-container" style={{ marginTop: '2rem' }}>
        <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <AlertTriangle color="var(--danger)" size={20} />
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>سجل العملاء الذين عليهم دين (إجمالي: {stats.debtTotal.toFixed(2)})</h3>
        </div>
        <table style={{ border: 'none' }}>
          <thead>
            <tr>
              <th>رقم العملية</th>
              <th>التاريخ</th>
              <th>اسم الزبون</th>
              <th>الفني</th>
              <th>المبلغ المتبقي</th>
              <th style={{ textAlign: 'center' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {debts.map(debt => (
              <tr key={debt.id}>
                <td><span className="tag">#{debt.id}</span></td>
                <td>{debt.date}</td>
                <td style={{ fontWeight: 500 }}>{debt.customer_name || '-'}</td>
                <td>{debt.technician_name}</td>
                <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{debt.price ? debt.price.toFixed(2) : '0.00'}</td>
                <td style={{ textAlign: 'center' }}>
                  <button className="btn" style={{ padding: '0.4rem 1rem', background: 'var(--success-bg)', color: 'var(--success)', border: 'none' }} onClick={() => handlePayDebt(debt.id)}>
                    <CheckCircle2 size={16} /> تسديد الدين
                  </button>
                </td>
              </tr>
            ))}
            {debts.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <div>لا توجد ديون مسجلة حالياً، كل الحسابات مصفرة!</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showSettlementModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--danger)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <FileText size={24} /> كشف حساب وتصفية الشهر
            </h2>
            
            <div style={{ background: 'var(--bg-base)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>رأس المال الأساسي المخصص:</span>
                <span style={{ fontWeight: 'bold' }}>{stats.baseCapital.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', color: 'var(--danger)' }}>
                <span>رأس المال المعلق (ديون السوق):</span>
                <span>- {stats.tiedCapital.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.1rem' }}>
                <span>رأس المال المُسترد فعلياً بالدرج:</span>
                <span>{stats.availableCapital.toFixed(2)}</span>
              </div>
              
              <hr style={{ borderColor: 'var(--border-light)', margin: '1rem 0', borderStyle: 'solid', borderWidth: '1px' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', color: 'var(--success)' }}>
                <span>أرباح المحل النقدية المحصلة:</span>
                <span>+ {stats.realizedShopProfit.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'var(--danger)' }}>
                <span>إجمالي سحوبات المحل الشخصية:</span>
                <span>- {stats.totalShopWithdrawal.toFixed(2)}</span>
              </div>

              <hr style={{ borderColor: 'var(--border-light)', margin: '1rem 0', borderStyle: 'solid', borderWidth: '1px' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', fontSize: '1.4rem', fontWeight: 'bold', padding: '1rem', background: 'var(--primary-light)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-main)' }}>الصافي النهائي للمحل:</span>
                <span style={{ color: stats.shopDue >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {stats.shopDue.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '1.05rem' }}>لبدء شهر جديد، يرجى إدخال رأس المال المخصص له:</label>
              <input 
                type="number" 
                placeholder="مثال: 5000"
                min="0"
                value={newCapital}
                onChange={e => setNewCapital(e.target.value)}
                autoFocus
                style={{ fontSize: '1.2rem', padding: '1rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowSettlementModal(false)} disabled={isClosing}>
                إلغاء الأمر
              </button>
              <button className="btn btn-primary" style={{ flex: 2, background: 'var(--danger)' }} onClick={confirmCloseMonth} disabled={isClosing}>
                {isClosing ? 'جاري المعالجة وإنشاء ملف الإكسل...' : 'تأكيد وحفظ نسخة احتياطية وإغلاق'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
