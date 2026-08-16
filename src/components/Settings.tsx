import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, Sliders, List, Save, Download, AlertTriangle, Moon, Sun, Database, RefreshCw, RotateCcw } from 'lucide-react';
import type { BackupMetadata } from '../types';
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
      const res = await (window as any).api.createFullBackup();
      
      dialog.close();
      
      if (res.success) {
        await dialog.success('تم تصدير ملف الإكسل بنجاح!');
      } else if (res.reason !== 'cancelled') {
        await dialog.error('حدث خطأ أثناء التصدير: ' + res.message);
      }
    } catch (err) {
      dialog.close();
      await dialog.error('حدث خطأ أثناء تصدير الإكسل.');
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
        </div>

        {/* Settings Content */}
        <div style={{ flex: 1, padding: '0 var(--space-4)' }}>
          {activeTab === 'technicians' && <Technicians />}
          {activeTab === 'quicklists' && <QuickLists />}
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


