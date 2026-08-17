import { useEffect, useState } from 'react';
import { Wallet, Banknote, TrendingUp, AlertTriangle, FileText, CheckCircle2, Plus, Search, CalendarCheck, Users, Wrench, Smartphone, FileBox, Cpu } from 'lucide-react';
import type { DashboardStats, Operation } from '../types';
import { useDialog } from './ui/DialogProvider';
import { StatusBadge } from './ui/Badge';
export default function Dashboard({ onNavigate }: { onNavigate?: (tab: string, filter?: any, mode?: 'list' | 'add') => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [debts, setDebts] = useState<Operation[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const dialog = useDialog();

  const loadData = async () => {
    const data = await (window as any).api.getDashboardStats();
    const debtsData = await (window as any).api.getDebts();
    const ops = await (window as any).api.getOperations();
    setStats(data);
    setDebts(debtsData);
    setOperations(ops);
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
            مصروفات المحل وسلف الفنيين خلال الشهر الحالي
          </div>
        </div>
      </div>

      {/* New Reports Section */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>التقرير المالي للشهر الحالي</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)' }}>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>إجمالي الأرباح</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.totalProfit.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>أرباح الفنيين</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--info)' }}>{stats.totalTechProfit.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>أرباح المحل</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent)' }}>{stats.totalShopProfit.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>أرباح معلقة (غير مسلمة)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.uncollectedProfit.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>إجمالي ديون العملاء</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger)' }}>{stats.debtTotal.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>عدد الأجهزة المستلمة</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.receivedDevicesCount}</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>الوصول السريع</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
          {/* 1. إضافة عملية */}
          <div className="stat-card" style={{ cursor: 'pointer', borderTop: '3px solid var(--primary)', display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={() => onNavigate && onNavigate('operations', null, 'add')}>
            <div style={{ padding: '8px', background: 'var(--primary-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)', width: 'fit-content' }}>
              <Plus size={24} />
            </div>
            <div className="stat-title" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>إضافة عملية</div>
            <div className="caption">عملية صيانة جديدة</div>
          </div>

          {/* 2. العمليات */}
          <div className="stat-card" style={{ cursor: 'pointer', borderTop: '3px solid var(--info)', display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={() => onNavigate && onNavigate('operations')}>
            <div style={{ padding: '8px', background: 'var(--info-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--info)', width: 'fit-content' }}>
              <Wrench size={24} />
            </div>
            <div className="stat-title" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>العمليات</div>
            <div className="caption">{operations.length} عملية (الشهر الحالي)</div>
          </div>

          {/* 3. قيد الصيانة */}
          <div className="stat-card" style={{ cursor: 'pointer', borderTop: '3px solid var(--warning)', display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={() => onNavigate && onNavigate('operations', { status: 'not_delivered' })}>
            <div style={{ padding: '8px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--warning)', width: 'fit-content' }}>
              <Smartphone size={24} />
            </div>
            <div className="stat-title" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>غير مسلّمة</div>
            <div className="caption">{operations.filter(op => op.status === 'under_maintenance' || op.status === 'completed').length} جهاز</div>
          </div>

          {/* 4. الديون */}
          <div className="stat-card" style={{ cursor: 'pointer', borderTop: '3px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={() => onNavigate && onNavigate('operations', { paymentStatus: 'debt' })}>
            <div style={{ padding: '8px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', width: 'fit-content' }}>
              <AlertTriangle size={24} />
            </div>
            <div className="stat-title" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>الديون</div>
            <div className="caption">{debts.length} جهاز</div>
          </div>

          {/* 5. بحث IC */}
          <div className="stat-card" style={{ cursor: 'pointer', borderTop: '3px solid var(--success)', display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={() => onNavigate && onNavigate('compatibilities')}>
            <div style={{ padding: '8px', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--success)', width: 'fit-content' }}>
              <Cpu size={24} />
            </div>
            <div className="stat-title" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>بحث IC</div>
            <div className="caption">البحث عن توافقية الأيسيات</div>
          </div>

          {/* 6. المصروفات */}
          <div className="stat-card" style={{ cursor: 'pointer', borderTop: '3px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={() => onNavigate && onNavigate('withdrawals')}>
            <div style={{ padding: '8px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', width: 'fit-content' }}>
              <Banknote size={24} />
            </div>
            <div className="stat-title" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>المصروفات</div>
            <div className="caption">مصروفات المحل وسلف الفنيين</div>
          </div>
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
    </div>
  );
}
