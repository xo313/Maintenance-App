import { useEffect, useState } from 'react';
import { Wallet, Banknote, TrendingUp, AlertTriangle, FileText, CheckCircle2, Plus, Search, CalendarCheck } from 'lucide-react';
import type { DashboardStats, Operation } from '../types';
import { useDialog } from './ui/DialogProvider';
import { StatusBadge } from './ui/Badge';

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

  if (!stats) return (
    <div className="fade-in empty-state">
      <div className="spinner"></div>
      <span style={{ marginTop: 'var(--space-4)' }}>جاري تحميل البيانات...</span>
    </div>
  );

  return (
    <div className="fade-in">
      
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="section-title" style={{ marginBottom: 'var(--space-2)' }}>نظرة عامة على النشاط المالي</h2>
        <p className="caption">ملخص سريع للإيرادات والمصروفات للشهر الحالي.</p>
      </div>

      <div className="dashboard-stats-grid">
        <div className="stat-card" style={{ borderTop: '3px solid var(--info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title">الكاش المتوقع في الصندوق</div>
            <div style={{ padding: '8px', background: 'var(--info-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--info)' }}>
              <Wallet size={22} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>
            {stats.cashBox.toLocaleString()}
          </div>
          <div className="caption">
            رأس المال + الاستلام - السحوبات والتكاليف
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title">الأرباح الكلية</div>
            <div style={{ padding: '8px', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--success)' }}>
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {stats.totalProfit.toLocaleString()}
          </div>
          <div className="caption">
            صافي أرباح العمليات (الفرق بين السعر والتكلفة)
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title">إجمالي الديون</div>
            <div style={{ padding: '8px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--warning)' }}>
              <AlertTriangle size={22} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {stats.debtTotal.toLocaleString()}
          </div>
          <div className="caption">
            المبالغ المتبقية للعمليات غير المسددة
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '3px solid var(--danger)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stat-title">إجمالي السحوبات</div>
            <div style={{ padding: '8px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)' }}>
              <Banknote size={22} />
            </div>
          </div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {stats.totalWithdrawals.toLocaleString()}
          </div>
          <div className="caption">
            إجمالي مصروفات المحل والنثريات والفنيين
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>إجراءات سريعة</h2>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => document.querySelector<HTMLElement>('.nav-item:nth-child(4)')?.click()}>
            <Plus size={18} /> إضافة عملية صيانة
          </button>
          <button className="btn" onClick={() => document.querySelector<HTMLElement>('.nav-item:nth-child(6)')?.click()}>
            <Search size={18} /> بحث عن توافق آيسي
          </button>
          <button className="btn btn-secondary" style={{ color: 'var(--warning)' }} onClick={() => setShowSettlementModal(true)}>
            <CalendarCheck size={18} /> تصفية وإغلاق الشهر
          </button>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 className="section-title">سجل ديون العملاء</h2>
          <span className="badge badge-warning">الإجمالي: {stats.debtTotal.toFixed(2)}</span>
        </div>
        
        <div className="table-container">
          <table>
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
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{debt.customer_name || '-'}</td>
                  <td>{debt.technician_name}</td>
                  <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{debt.price ? debt.price.toFixed(2) : '0.00'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-secondary" style={{ color: 'var(--success)' }} onClick={() => handlePayDebt(debt.id)}>
                      <CheckCircle2 size={16} /> تسديد
                    </button>
                  </td>
                </tr>
              ))}
              {debts.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <div className="empty-state">
                      <CheckCircle2 className="empty-state-icon" />
                      <div className="empty-state-title">لا توجد ديون مسجلة!</div>
                      <div className="caption">جميع الحسابات مصفرة والعمليات مسددة.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSettlementModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--warning)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-4)' }}>
              <FileText size={24} /> كشف حساب وتصفية الشهر
            </h2>
            
            <div className="glass" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
              <div className="flex-between" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="caption">رأس المال الأساسي المخصص:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--text)' }}>{stats.baseCapital.toFixed(2)}</span>
              </div>
              <div className="flex-between" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="caption">رأس المال المعلق (ديون السوق):</span>
                <span style={{ color: 'var(--danger)' }}>- {stats.tiedCapital.toFixed(2)}</span>
              </div>
              <div className="flex-between" style={{ marginBottom: 'var(--space-4)', fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--info)' }}>
                <span>رأس المال المُسترد فعلياً بالدرج:</span>
                <span>{stats.availableCapital.toFixed(2)}</span>
              </div>
              
              <hr style={{ borderColor: 'var(--border-light)', margin: 'var(--space-4) 0' }} />

              <div className="flex-between" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="caption">أرباح المحل النقدية المحصلة:</span>
                <span style={{ color: 'var(--success)' }}>+ {stats.realizedShopProfit.toFixed(2)}</span>
              </div>
              <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
                <span className="caption">إجمالي سحوبات المحل الشخصية:</span>
                <span style={{ color: 'var(--danger)' }}>- {stats.totalShopWithdrawal.toFixed(2)}</span>
              </div>

              <div className="flex-between" style={{ marginTop: 'var(--space-4)', fontSize: '1.25rem', fontWeight: 'bold', padding: 'var(--space-4)', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text)' }}>الصافي النهائي للمحل:</span>
                <span style={{ color: stats.shopDue >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {stats.shopDue.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
              <label>لبدء شهر جديد، يرجى إدخال رأس المال المخصص له:</label>
              <input 
                type="number" 
                placeholder="مثال: 5000"
                min="0"
                value={newCapital}
                onChange={e => setNewCapital(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowSettlementModal(false)} disabled={isClosing}>
                إلغاء الأمر
              </button>
              <button className="btn btn-danger" style={{ flex: 2 }} onClick={confirmCloseMonth} disabled={isClosing}>
                {isClosing ? 'جاري التصفية...' : 'تأكيد الحفظ والتصفية'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
