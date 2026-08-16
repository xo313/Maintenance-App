import { useEffect, useState } from 'react';
import { Wallet, Banknote, TrendingUp, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import type { DashboardStats, Operation } from '../types';
import { useDialog } from './ui/DialogProvider';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [debts, setDebts] = useState<Operation[]>([]);
  const [newCapital, setNewCapital] = useState<string>('');
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dialog = useDialog();

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
    const ok = await dialog.confirm("هل أنت متأكد من سداد هذا الدين؟", "تأكيد السداد");
    if (!ok) return;
    
    const res = await (window as any).api.payDebt(id);
    if (res && res.success === false) {
      await dialog.error(res.reason || 'فشل السداد');
      return;
    }
    loadData();
  };

  const confirmCloseMonth = async () => {
    if (!newCapital) {
      await dialog.warning('الرجاء إدخال رأس المال للشهر الجديد قبل التصفية');
      return;
    }
    
    if (isClosing) return;
    setIsClosing(true);
    
    dialog.loading('جاري التصفية وإنشاء ملف الإكسل والنسخة الاحتياطية...');
    
    try {
      const res = await (window as any).api.closeMonthWithExcel(parseFloat(newCapital));
      
      dialog.close();
      
      if (res.success) {
        await dialog.success('تم حفظ النسخة الاحتياطية وتصفية الشهر بنجاح!');
        setNewCapital('');
        setShowSettlementModal(false);
        loadData();
      } else {
        if (res.reason === 'cancelled') {
          await dialog.warning('تم إلغاء عملية التصفية لأنك لم تقم بحفظ ملف النسخة الاحتياطية.');
        } else {
          await dialog.error('حدث خطأ أثناء حفظ الملف: ' + res.message);
        }
      }
    } catch (err: any) {
      dialog.close();
      await dialog.error('حدث خطأ غير متوقع: ' + err.message);
    } finally {
      setIsClosing(false);
    }
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
        {/* Card 1: Expected Cash (الكاش المتوقع في الصندوق) */}
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6', background: 'linear-gradient(to right, rgba(59, 130, 246, 0.05), transparent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>الكاش المتوقع في الصندوق</div>
            <div style={{ padding: '10px', background: '#3b82f620', borderRadius: '12px', color: '#3b82f6' }}>
              <Wallet size={26} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#3b82f6', display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.5rem' }}>
            {stats.cashBox.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            رأس المال + إجمالي المبالغ المستلمة - إجمالي التكاليف والسحوبات
          </div>
        </div>

        {/* Card 2: Total Profits (الأرباح الكلية) */}
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981', background: 'linear-gradient(to right, rgba(16, 185, 129, 0.05), transparent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>الأرباح الكلية</div>
            <div style={{ padding: '10px', background: '#10b98120', borderRadius: '12px', color: '#10b981' }}>
              <TrendingUp size={26} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#10b981', display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.5rem' }}>
            {stats.totalProfit.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            صافي الأرباح الكلية لجميع العمليات (الفرق بين سعر البيع والتكلفة)
          </div>
        </div>

        {/* Card 3: Total Debts (إجمالي الديون) */}
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b', background: 'linear-gradient(to right, rgba(245, 158, 11, 0.05), transparent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>إجمالي الديون</div>
            <div style={{ padding: '10px', background: '#f59e0b20', borderRadius: '12px', color: '#f59e0b' }}>
              <AlertTriangle size={26} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#f59e0b', display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.5rem' }}>
            {stats.debtTotal.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            مجموع المبالغ المتبقية في ذمة الزبائن للعمليات غير المسددة
          </div>
        </div>

        {/* Card 4: Total Withdrawals (إجمالي السحوبات) */}
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444', background: 'linear-gradient(to right, rgba(239, 68, 68, 0.05), transparent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title" style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>إجمالي السحوبات</div>
            <div style={{ padding: '10px', background: '#ef444420', borderRadius: '12px', color: '#ef4444' }}>
              <Banknote size={26} />
            </div>
          </div>
          <div className="stat-value" style={{ color: '#ef4444', display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.5rem' }}>
            {stats.totalWithdrawals.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            إجمالي السحوبات والمصروفات النقدية (الإدارة، النثريات، الفنيين)
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
                {isClosing ? 'جاري التصفية...' : 'تأكيد وحفظ نسخة احتياطية وإغلاق'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
