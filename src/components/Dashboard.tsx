import { useEffect, useState } from 'react';
import { Wallet, Banknote, TrendingUp, AlertTriangle, CheckCircle2, Plus, Wrench, Smartphone, Cpu } from 'lucide-react';
import type { DashboardStats, Operation } from '../types';
import { useDialog } from './ui/DialogContext';
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
        <h2 className="section-title" style={{ marginBottom: 'var(--space-4)' }}>النظام المالي الموحد</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderTop: '4px solid var(--success)' }} title="يشمل: رأس المال + مقبوضات الشهر + تسديد ديون سابقة - السحوبات">
            <div className="caption" style={{ marginBottom: '4px' }}>الصندوق (السيولة النقدية)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.cashBox.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderTop: '4px solid var(--info)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>إجمالي المبيعات</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--info)' }}>{stats.totalSales.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderTop: '4px solid var(--primary)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>الربح الإجمالي</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.grossProfit.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>أرباح الفنيين</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{stats.techShare.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderTop: '4px solid var(--accent)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>أرباح تشغيل المحل</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent)' }}>{stats.shopOperationProfit.toLocaleString()}</div>
          </div>

          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderTop: '4px solid var(--success)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>صافي أرباح المحل</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)' }}>{stats.netShopProfit.toLocaleString()}</div>
          </div>
          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>ذمم العملاء (ديون)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.debtTotal.toLocaleString()}</div>
          </div>

          <div className="glass" style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            <div className="caption" style={{ marginBottom: '4px' }}>ذمم الفنيين (التزامات)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--warning)' }}>{stats.technicianPayables.toLocaleString()}</div>
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
            <div className="stat-title" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>عمليات الشهر الحالي</div>
            <div className="caption">{operations.length} عملية (لا يشمل العمليات المسلمة سابقاً)</div>
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
                  <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                    {((debt.price || 0) - (debt.paid_amount || 0)).toFixed(2)}
                  </td>
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
