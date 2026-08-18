import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, Sliders, List, Save, Download, AlertTriangle, Moon, Sun, Database, RefreshCw, RotateCcw, FileBox, FileText, Wallet } from 'lucide-react';
import type { BackupMetadata, DashboardStats } from '../types';
import Technicians from './Technicians';
import QuickLists from './QuickLists';
import * as XLSX from 'xlsx';
import { useDialog } from './ui/DialogProvider';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('technicians');
  const [settings, setSettings] = useState<any>(null);
  const [shopName, setShopName] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState('');
  const [theme, setTheme] = useState<'light'|'dark'>('dark');
  
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const dialog = useDialog();

  const [newCapital, setNewCapital] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (activeTab === 'monthly_closing') {
      (window as any).api.getDashboardStats().then((data: DashboardStats) => setStats(data));
    }
  }, [activeTab]);

  useEffect(() => {
    loadSettings();
    loadBackups();
  }, []);

  const loadBackups = async () => {
    try {
      const data = await (window as any).api.listBackups();
      setBackups(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSettings = async () => {
    const data = await (window as any).api.getSettings();
    setSettings(data);
    setShopName(data.shop_name || 'مركز الصيانة');
    setWhatsappTemplate(data.whatsapp_template || '');
    setTheme(data.theme || 'dark');
  };

  const [saveMessage, setSaveMessage] = useState('');

  const handleSaveSettings = async () => {
    const res = await (window as any).api.updateSettings({
      shop_name: shopName,
      whatsapp_template: whatsappTemplate,
      theme: theme
    });
    
    if (res && res.success === false) {
      await dialog.error(res.reason || 'فشل الحفظ');
      return;
    }
    
    // Apply theme immediately
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    
    setSaveMessage('تم حفظ الإعدادات بنجاح. جاري إعادة تحميل التطبيق لتطبيق التغييرات...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleExcelExport = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      dialog.loading('جاري تصدير ملف الإكسل...');

      // Try Electron backend IPC first if available
      let res: any = null;
      if (typeof (window as any).api?.createFullBackup === 'function') {
        try {
          res = await (window as any).api.createFullBackup();
        } catch (ipcErr) {
          console.warn('IPC createFullBackup failed, falling back to direct export:', ipcErr);
        }
      }

      if (res && res.success) {
        dialog.close();
        await dialog.success('تم تصدير ملف الإكسل والنسخة الاحتياطية بنجاح!');
        return;
      }

      if (res && res.reason === 'cancelled') {
        dialog.close();
        return;
      }

      // Fallback: Generate and download directly in frontend via XLSX
      const [allOps, allTechs, allWiths, allCusts, dashStats, techStats] = await Promise.all([
        (window as any).api?.getAllOperations?.() || (window as any).api?.getOperations?.() || [],
        (window as any).api?.getTechnicians?.() || [],
        (window as any).api?.getWithdrawals?.() || [],
        (window as any).api?.getCustomers?.() || [],
        (window as any).api?.getDashboardStats?.() || null,
        (window as any).api?.getTechnicianStats?.() || []
      ]);

      const getPaidAmount = (op: any) => op.paid_amount ?? (op.payment_status === 'cash' ? (op.price || 0) : 0);
      const getRemainingAmount = (op: any) => Math.max(0, (op.price || 0) - getPaidAmount(op));

      const getStatusLabel = (status: string) => {
        switch (status) {
          case 'under_maintenance': return 'قيد الصيانة';
          case 'completed': return 'جاهز / مكتمل';
          case 'delivered': return 'تم التسليم';
          case 'cancelled': return 'ملغى';
          default: return status || '-';
        }
      };

      const getPaymentStatusLabel = (pStatus: string, paidAmt?: number, price?: number) => {
        if (pStatus === 'cash' || (paidAmt !== undefined && price !== undefined && paidAmt >= price)) {
          return 'نقدي (مدفوع بالكامل)';
        }
        if (pStatus === 'partial' || (paidAmt !== undefined && price !== undefined && paidAmt > 0 && paidAmt < price)) {
          return 'مدفوع جزئياً';
        }
        if (pStatus === 'debt') {
          return 'دين (آجل)';
        }
        return pStatus || '-';
      };

      const summaryData: any[][] = [
        ["التقرير المالي العام وخلاصة الكاش والأرباح"],
        ["تاريخ التصدير", new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' })],
        [""],
        ["=== حركة الكاش والصندوق ==="],
        ["رأس المال الافتتاحي للشهر", dashStats?.baseCapital ?? 0],
        ["إجمالي سحوبات الشهر", dashStats?.totalWithdrawals ?? 0],
        ["صافي رصيد الكاش / الصندوق الحالي", dashStats?.cashBox ?? 0],
        [""],
        ["=== ملخص الأرباح ==="],
        ["إجمالي الأرباح الكلية (للأجهزة المسلمة)", dashStats?.totalProfit ?? 0],
        ["إجمالي أرباح المحل (الصافية)", dashStats?.totalShopProfit ?? 0],
        ["إجمالي سحوبات المحل", dashStats?.totalShopWithdrawal ?? 0],
        ["الصافي المستحق للمحل", dashStats?.shopDue ?? 0],
        ["أرباح متوقعة قيد الإنجاز (أجهزة لم تُسلّم)", dashStats?.uncollectedProfit ?? 0],
        [""],
        ["=== ملخص الديون بالسوق ==="],
        ["إجمالي الديون المتبقية بذمة العملاء", dashStats?.debtTotal ?? 0],
        [""],
        ["=== ملخص مستحقات وأرباح الفنيين ==="],
        ["إجمالي أرباح جميع الفنيين", dashStats?.totalTechProfit ?? 0],
        [""],
        ["جدول تفصيلي بأرصدة وأرباح كل فني:"],
        ["اسم الفني", "نسبة الربح", "إجمالي التكلفة", "إجمالي الأرباح المحققة", "إجمالي السحوبات", "الرصيد المتبقي المستحق", "الحالة"]
      ];

      (techStats || []).forEach((t: any) => {
        summaryData.push([
          t.name,
          `${((t.profit_percentage || 0) * 100).toFixed(0)}%`,
          t.totalCost || 0,
          t.totalProfit || 0,
          t.totalWithdrawal || 0,
          t.remainingBalance || 0,
          t.is_active !== false ? 'نشط' : 'غير نشط'
        ]);
      });

      const wb = XLSX.utils.book_new();

      // Sheet 1: الخلاصة
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 24 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "التقرير المالي والخلاصة");

      // Sheet 2: العمليات
      const opsFormatted = (allOps || []).map((op: any) => ({
        "رقم العملية": op.id,
        "التاريخ": op.date || '-',
        "اسم العميل": op.customer_name || '-',
        "هاتف العميل": op.customer_phone || '-',
        "الجهاز": op.device || '-',
        "الأعطال": Array.isArray(op.faults) ? op.faults.join('، ') : (op.faults || '-'),
        "اسم الفني": op.technician_name || '-',
        "حالة الجهاز": getStatusLabel(op.status),
        "حالة الدفع": getPaymentStatusLabel(op.payment_status, op.paid_amount, op.price),
        "المبلغ الإجمالي": op.price || 0,
        "التكلفة": op.cost || 0,
        "المبلغ الواصل (المدفوع)": getPaidAmount(op),
        "المبلغ المتبقي (الدين)": getRemainingAmount(op),
        "صافي الربح": (op.price || 0) - (op.cost || 0),
        "حصة الفني": op.tech_profit || 0,
        "حصة المحل": op.shop_profit || 0,
        "نسبة الفني": op.tech_profit_percentage !== undefined ? `${(op.tech_profit_percentage * 100).toFixed(0)}%` : '-',
        "الضمان": op.warranty_enabled ? (op.warranty_days ? `${op.warranty_days} يوم` : 'مفعل') : 'بدون ضمان',
        "تاريخ انتهاء الضمان": op.warranty_expiry_date || '-',
        "ملاحظات الضمان": op.warranty_note || '-',
        "ملاحظات عامة": op.notes || '-'
      }));

      const wsOps = XLSX.utils.json_to_sheet(opsFormatted);
      wsOps['!cols'] = [
        { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 18 },
        { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 16 },
        { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
        { wch: 22 }
      ];
      XLSX.utils.book_append_sheet(wb, wsOps, "سجل العمليات");

      // Sheet 3: السحوبات
      const withdrawalsFormatted = (allWiths || []).map((w: any) => ({
        "رقم السحب": w.id,
        "التاريخ": w.date || '-',
        "نوع السحب": w.type === 'shop_withdrawal' ? 'سحب محل' : 'سحب فني',
        "اسم الفني": w.technician_name || '-',
        "المبلغ": w.amount || 0,
        "البيان / الملاحظات": w.notes || '-'
      }));
      const wsWith = XLSX.utils.json_to_sheet(withdrawalsFormatted);
      wsWith['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsWith, "سجل السحوبات");

      // Sheet 4: الفنيين
      const techFormatted = (techStats || allTechs || []).map((tech: any) => ({
        "رقم الفني": tech.id,
        "اسم الفني": tech.name,
        "نسبة الفني": `${((tech.profit_percentage || 0) * 100).toFixed(0)}%`,
        "الرصيد الافتتاحي": tech.start_balance || 0,
        "الحالة": tech.is_active !== false ? 'نشط' : 'غير نشط',
        "أرباح الشهر الحالي": tech.totalProfit || 0,
        "سحوبات الشهر الحالي": tech.totalWithdrawal || 0,
        "الرصيد المستحق": tech.remainingBalance || 0
      }));
      const wsTech = XLSX.utils.json_to_sheet(techFormatted);
      wsTech['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsTech, "سجل الفنيين");

      // Sheet 5: العملاء
      if (allCusts && allCusts.length > 0) {
        const custFormatted = allCusts.map((c: any) => ({
          "رقم العميل": c.id,
          "اسم العميل": c.name || '-',
          "رقم الهاتف": c.phone || '-',
          "ملاحظات": c.notes || '-',
          "تاريخ الإضافة": c.created_at || '-'
        }));
        const wsCust = XLSX.utils.json_to_sheet(custFormatted);
        wsCust['!cols'] = [{ wch: 16 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, wsCust, "سجل العملاء");
      }

      // Download file directly
      const filename = `Full_Backup_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      dialog.close();
      await dialog.success('تم تصدير ملف الإكسل بنجاح وحفظه!');
    } catch (err: any) {
      dialog.close();
      console.error('Excel export error:', err);
      await dialog.error('حدث خطأ أثناء تصدير الإكسل: ' + (err?.message || String(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackup = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      dialog.loading('جاري إنشاء النسخة الاحتياطية...');
      const res = await (window as any).api.createBackup();
      
      dialog.close();
      
      if (res.success) {
        await dialog.success('تم إنشاء نسخة احتياطية كاملة للبيانات بنجاح!');
        loadBackups();
      } else {
        await dialog.error('تعذر إنشاء النسخة الاحتياطية، لذلك لم يتم تنفيذ العملية.');
      }
    } catch (err) {
      dialog.close();
      await dialog.error('حدث خطأ أثناء تصدير النسخة الاحتياطية.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (isProcessing) return;
    
    const confirmed = await dialog.confirm(
      'سيتم استبدال بيانات البرنامج الحالية ببيانات هذه النسخة.\nهل تريد المتابعة؟',
      'استعادة البيانات'
    );
    if (!confirmed) return;

    setIsProcessing(true);
    dialog.loading('جاري استعادة البيانات...');
    
    try {
      const res = await (window as any).api.restoreBackup(filename);
      
      dialog.close();
      
      if (res.success) {
        await dialog.success('تمت استعادة النسخة الاحتياطية بنجاح.');
        (window as any).api.restartApp();
      } else {
        if (res.reason === 'BACKUP_HASH_MISMATCH') {
          await dialog.error('BACKUP_HASH_MISMATCH');
        } else if (res.reason === 'RESTORE_VERIFY_FAILED' || res.reason === 'RESTORE_ROLLBACK_FAILED') {
          await dialog.error('فشلت الاستعادة وتمت إعادة البيانات السابقة.');
        } else {
          await dialog.error('فشلت عملية الاستعادة. لم يتم تغيير البيانات الحالية.');
        }
      }
    } catch (err: any) {
      dialog.close();
      await dialog.error('فشلت عملية الاستعادة. لم يتم تغيير البيانات الحالية.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFactoryReset = async () => {
    if (isProcessing) return;
    
    const confirmed = await dialog.confirm(
      'سيتم حذف جميع بيانات الورشة الحالية.\nسيتم إنشاء نسخة احتياطية تلقائية قبل الحذف.\nهل أنت متأكد؟',
      'تصفير بيانات البرنامج',
      true
    );
    
    if (!confirmed) return;

    setIsProcessing(true);
    dialog.loading('جاري تصفير النظام...');
    
    try {
      const res = await (window as any).api.factoryReset();
      
      dialog.close();
      
      if (res.success) {
        await dialog.success('تم إنشاء نسخة احتياطية قبل التصفير.\nتم تصفير النظام بنجاح!');
        (window as any).api.restartApp();
      } else {
        if (res.reason === 'FACTORY_RESET_BACKUP_FAILED') {
          await dialog.error('تعذر إنشاء النسخة الاحتياطية، لذلك لم يتم تنفيذ العملية.');
        } else {
          await dialog.error('فشل التصفير وتمت إعادة البيانات السابقة.');
        }
      }
    } catch (err: any) {
      dialog.close();
      console.error(err);
      await dialog.error('فشل التصفير وتمت إعادة البيانات السابقة.');
    } finally {
      setIsProcessing(false);
    }
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
        const data = await (window as any).api.getDashboardStats();
        setStats(data);
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

  return (
    <div className="fade-in">
      <div className="header-flex">
        <h2 className="page-title">
          <SettingsIcon size={28} color="var(--primary)" />
          الإعدادات
        </h2>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-6)', minHeight: '600px' }}>
        {/* Settings Sidebar */}
        <div style={{ width: '240px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <button 
            className={`btn ${activeTab === 'technicians' ? 'active' : ''}`}
            onClick={() => setActiveTab('technicians')}
            style={{ 
              justifyContent: 'flex-start', 
              background: activeTab === 'technicians' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'technicians' ? 'var(--primary)' : 'var(--text-main)',
              border: 'none',
              boxShadow: 'none',
              padding: 'var(--space-3) var(--space-4)'
            }}
          >
            <Users size={18} />
            إدارة الفنيين
          </button>
          
          <button 
            className={`btn ${activeTab === 'quicklists' ? 'active' : ''}`}
            onClick={() => setActiveTab('quicklists')}
            style={{ 
              justifyContent: 'flex-start', 
              background: activeTab === 'quicklists' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'quicklists' ? 'var(--primary)' : 'var(--text-main)',
              border: 'none',
              boxShadow: 'none',
              padding: 'var(--space-3) var(--space-4)'
            }}
          >
            <List size={18} />
            إدارة القوائم السريعة
          </button>

          <button 
            className={`btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
            style={{ 
              justifyContent: 'flex-start', 
              background: activeTab === 'general' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'general' ? 'var(--primary)' : 'var(--text-main)',
              border: 'none',
              boxShadow: 'none',
              padding: 'var(--space-3) var(--space-4)'
            }}
          >
            <Sliders size={18} />
            إعدادات عامة
          </button>

          <button 
            className={`btn ${activeTab === 'monthly_closing' ? 'active' : ''}`}
            onClick={() => setActiveTab('monthly_closing')}
            style={{ 
              justifyContent: 'flex-start', 
              background: activeTab === 'monthly_closing' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'monthly_closing' ? 'var(--primary)' : 'var(--text-main)',
              border: 'none',
              boxShadow: 'none',
              padding: 'var(--space-3) var(--space-4)'
            }}
          >
            <FileBox size={18} />
            تصفية الشهر
          </button>
        </div>

        {/* Settings Content */}
        <div style={{ flex: 1, padding: '0 var(--space-4)' }}>
          {activeTab === 'technicians' && <Technicians />}
          {activeTab === 'quicklists' && <QuickLists />}
          
          {activeTab === 'monthly_closing' && stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '800px' }}>
              <div className="stat-card fade-in" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                  <FileText size={24} /> كشف حساب وتصفية الشهر
                </h3>
                
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
                  />
                </div>

                <div className="alert alert-warning" style={{ marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <strong>تحذير:</strong> عملية التصفية ستقوم بحفظ المعاملات الحالية في الأرشيف (النسخة الاحتياطية)، وبدء سجلات جديدة بالكامل للشهر القادم. يرجى التأكد من أنك قمت بمراجعة جميع الحسابات.
                </div>

                <button className="btn btn-primary" style={{ width: '100%', background: 'var(--warning)', borderColor: 'var(--warning)', padding: 'var(--space-3)' }} onClick={confirmCloseMonth} disabled={isClosing}>
                  {isClosing ? 'جاري التصفية...' : 'تأكيد تصفية الشهر'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'general' && settings && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '800px' }}>
              <div className="stat-card fade-in" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={20} color="var(--primary)" /> الإعدادات العامة للمركز
                </h3>
                
                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label>اسم المركز (Shop Name)</label>
                  <input 
                    type="text" 
                    defaultValue={settings.shop_name || 'مركز الصيانة'}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="مثال: مركز الصيانة المتقدم"
                  />
                  <small style={{ color: 'var(--text-muted)' }}>سيتم عرض هذا الاسم في أعلى لوحة التحكم.</small>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label>قالب رسالة الواتساب (WhatsApp Template)</label>
                  <textarea 
                    rows={4}
                    defaultValue={settings.whatsapp_template || ''}
                    onChange={(e) => setWhatsappTemplate(e.target.value)}
                    placeholder="اكتب رسالة الواتساب هنا..."
                  />
                  <div style={{ marginTop: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-muted)', background: 'var(--surface-elevated)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                    <strong>المتغيرات المتاحة للاستخدام:</strong><br />
                    - <code>[اسم_الزبون]</code> : يتم استبداله باسم صاحب الجهاز.<br />
                    - <code>[اسم_الجهاز]</code> : يتم استبداله باسم الجهاز المصلح.<br />
                    - <code>[المشكلة]</code> : يتم استبداله بالأعطال المسجلة للجهاز.<br />
                    - <code>[المبلغ]</code> : يتم استبداله بالسعر النهائي المطلوب.<br />
                    - <code>[المبلغ_الواصل]</code> : يتم استبداله بالمبلغ الذي دفعه العميل.<br />
                    - <code>[المبلغ_المتبقي]</code> : يتم استبداله بالمبلغ المتبقي على العميل.<br />
                    - <code>[اسم_المحل]</code> : يتم استبداله باسم المركز الخاص بك.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
                  <label>مظهر التطبيق (Theme)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <button 
                      className="btn" 
                      onClick={handleToggleTheme}
                      style={{ background: theme === 'dark' ? 'var(--surface-elevated)' : 'var(--primary-light)', borderColor: theme === 'light' ? 'var(--primary)' : 'var(--border-color)', color: theme === 'light' ? 'var(--primary)' : 'var(--text-main)' }}
                    >
                      <Sun size={18} /> نهاري
                    </button>
                    <button 
                      className="btn" 
                      onClick={handleToggleTheme}
                      style={{ background: theme === 'light' ? 'var(--surface-elevated)' : 'var(--primary-light)', borderColor: theme === 'dark' ? 'var(--primary)' : 'var(--border-color)', color: theme === 'dark' ? 'var(--primary)' : 'var(--text-main)' }}
                    >
                      <Moon size={18} /> ليلي
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {saveMessage && (
                    <div style={{ padding: 'var(--space-3)', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--success)', fontSize: '0.95rem' }}>
                      {saveMessage}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-primary" onClick={handleSaveSettings}>
                      <Save size={18} /> حفظ الإعدادات
                    </button>
                  </div>
                </div>
              </div>

              {/* Backup and Restore Section */}
              <div className="stat-card fade-in" style={{ padding: 'var(--space-6)' }}>
                <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                  <Database size={20} /> النسخ الاحتياطية
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>تصدير إلى Excel</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>تصدير جميع بيانات العمليات والفنيين والسحوبات إلى ملف إكسل.</span>
                  </div>
                  <button className="btn" onClick={handleExcelExport} disabled={isProcessing} style={{ color: 'var(--text-main)', borderColor: 'var(--border-color)' }}>
                    <Download size={18} /> تصدير Excel
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>نسخة احتياطية شاملة (JSON)</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>حفظ كامل بيانات النظام للاسترجاع الآمن</span>
                  </div>
                  <button className="btn btn-primary" onClick={handleBackup} disabled={isProcessing}>
                    <Database size={20} />
                    إنشاء نسخة احتياطية الآن
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>النسخ المتوفرة ({backups.length}/30):</strong>
                  {backups.length === 0 ? (
                    <div className="empty-state" style={{ minHeight: 'auto', padding: 'var(--space-4)' }}>
                      <div className="empty-state-title" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>لا توجد نسخ احتياطية مسجلة</div>
                    </div>
                  ) : (
                    backups.map(b => (
                      <div key={b.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <strong>{new Date(b.created_at).toLocaleString('ar-EG')}</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {b.size_kb} KB | {b.operations_count} عملية | {b.months_count} شهر | {b.technicians_count} فني
                          </span>
                        </div>
                        <button className="btn btn-secondary" style={{ color: 'var(--warning)' }} onClick={() => handleRestore(b.filename)} title="استعادة هذه النسخة" disabled={isProcessing}>
                          <RotateCcw size={18} /> استعادة
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="stat-card fade-in" style={{ padding: 'var(--space-6)', border: '1px solid var(--danger-bg)' }}>
                <h3 style={{ marginBottom: 'var(--space-4)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={20} /> منطقة الخطر (Danger Zone)
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--danger-bg)', padding: 'var(--space-4)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.2rem', color: 'var(--danger)' }}>تصفير النظام بالكامل</strong>
                      <span style={{ fontSize: '0.9rem', color: 'var(--danger)' }}>مسح جميع البيانات الحالية وإعادتها للوضع الافتراضي. سيتم إنشاء نسخة احتياطية أولاً.</span>
                    </div>
                    <button className="btn btn-danger" onClick={handleFactoryReset} disabled={isProcessing}>
                      <AlertTriangle size={20} />
                      تصفير البرنامج بالكامل
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


