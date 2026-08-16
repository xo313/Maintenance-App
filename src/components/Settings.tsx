import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, Sliders, List, Save, Download, AlertTriangle, Moon, Sun, Database, RefreshCw } from 'lucide-react';
import type { BackupMetadata } from '../types';
import Technicians from './Technicians';
import QuickLists from './QuickLists';
import * as XLSX from 'xlsx';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('technicians');
  const [settings, setSettings] = useState<any>(null);
  const [shopName, setShopName] = useState('');
  const [whatsappTemplate, setWhatsappTemplate] = useState('');
  const [theme, setTheme] = useState<'light'|'dark'>('dark');
  
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

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
      alert('حدث خطأ: ' + (res.reason || 'فشل الحفظ'));
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
    try {
      const res = await (window as any).api.createFullBackup(); // this still does Excel export + JSON
      if (res.success) {
        alert('تم تصدير ملف الإكسل بنجاح!');
      } else if (res.reason !== 'cancelled') {
        alert('حدث خطأ أثناء التصدير: ' + res.message);
      }
    } catch (err) {
      alert('حدث خطأ أثناء تصدير الإكسل.');
    }
  };

  const handleBackup = async () => {
    try {
      const res = await (window as any).api.createBackup();
      if (res.success) {
        alert('تم إنشاء نسخة احتياطية كاملة للبيانات بنجاح!');
        loadBackups();
      } else {
        alert('تعذر إنشاء النسخة الاحتياطية، لذلك لم يتم تنفيذ العملية.');
      }
    } catch (err) {
      alert('حدث خطأ أثناء تصدير النسخة الاحتياطية.');
    }
  };

  const handleRestore = async () => {
    if (!showRestoreConfirm || isRestoring) return;
    setIsRestoring(true);
    try {
      const res = await (window as any).api.restoreBackup(showRestoreConfirm);
      if (res.success) {
        alert('تمت استعادة النسخة الاحتياطية بنجاح.');
        (window as any).api.restartApp();
      } else {
        if (res.reason === 'BACKUP_HASH_MISMATCH') {
          alert('النسخة الاحتياطية تالفة أو تم تعديلها، لذلك لم يتم تنفيذ الاستعادة.');
        } else if (res.reason === 'RESTORE_VERIFY_FAILED' || res.reason === 'RESTORE_ROLLBACK_FAILED') {
          alert('فشلت الاستعادة وتمت إعادة البيانات السابقة.');
        } else {
          alert('فشلت عملية الاستعادة. لم يتم تغيير البيانات الحالية.');
        }
      }
    } catch (err: any) {
      alert('فشلت عملية الاستعادة. لم يتم تغيير البيانات الحالية.');
    }
    setIsRestoring(false);
    setShowRestoreConfirm(null);
  };

  const handleFactoryReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      const res = await (window as any).api.factoryReset();
      if (res.success) {
        alert('تم إنشاء نسخة احتياطية قبل التصفير.\nتم تصفير النظام بنجاح!');
        (window as any).api.restartApp();
      } else {
        if (res.reason === 'FACTORY_RESET_BACKUP_FAILED') {
          alert('تعذر إنشاء النسخة الاحتياطية، لذلك لم يتم تنفيذ العملية.');
        } else {
          alert('فشل التصفير وتمت إعادة البيانات السابقة.');
        }
      }
    } catch (err: any) {
      console.error(err);
      alert('فشل التصفير وتمت إعادة البيانات السابقة.');
    }
    setIsResetting(false);
    setShowResetConfirm(false);
  };

  return (
    <div className="fade-in">
      <div className="header-flex">
        <h2 className="page-title">
          <SettingsIcon size={28} color="var(--primary)" />
          الإعدادات
        </h2>
      </div>

      <div style={{ display: 'flex', gap: '2rem', minHeight: '600px' }}>
        {/* Settings Sidebar */}
        <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button 
            className={`btn ${activeTab === 'technicians' ? 'active' : ''}`}
            onClick={() => setActiveTab('technicians')}
            style={{ 
              justifyContent: 'flex-start', 
              background: activeTab === 'technicians' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'technicians' ? 'var(--primary)' : 'var(--text-main)',
              border: 'none',
              boxShadow: 'none'
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
              boxShadow: 'none'
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
              boxShadow: 'none'
            }}
          >
            <Sliders size={18} />
            إعدادات عامة
          </button>
        </div>

        {/* Settings Content */}
        <div style={{ flex: 1, padding: '0 1rem' }}>
          {activeTab === 'technicians' && <Technicians />}
          {activeTab === 'quicklists' && <QuickLists />}
          {activeTab === 'general' && settings && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
              <div className="stat-card fade-in" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={20} color="var(--primary)" /> الإعدادات العامة للمركز
                </h3>
                
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>اسم المركز (Shop Name)</label>
                  <input 
                    type="text" 
                    defaultValue={settings.shop_name || 'مركز الصيانة'}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="مثال: مركز الصيانة المتقدم"
                  />
                  <small style={{ color: 'var(--text-muted)' }}>سيتم عرض هذا الاسم في أعلى لوحة التحكم.</small>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label>قالب رسالة الواتساب (WhatsApp Template)</label>
                  <textarea 
                    rows={4}
                    defaultValue={settings.whatsapp_template || ''}
                    onChange={(e) => setWhatsappTemplate(e.target.value)}
                    placeholder="اكتب رسالة الواتساب هنا..."
                  />
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', background: 'var(--bg-base)', padding: '0.8rem', borderRadius: '8px' }}>
                    <strong>المتغيرات المتاحة للاستخدام:</strong><br />
                    - <code>[اسم_الزبون]</code> : يتم استبداله باسم صاحب الجهاز.<br />
                    - <code>[اسم_الجهاز]</code> : يتم استبداله باسم الجهاز المصلح.<br />
                    - <code>[المشكلة]</code> : يتم استبداله بالأعطال المسجلة للجهاز.<br />
                    - <code>[المبلغ]</code> : يتم استبداله بالسعر النهائي المطلوب.<br />
                    - <code>[اسم_المحل]</code> : يتم استبداله باسم المركز الخاص بك.
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '2rem' }}>
                  <label>مظهر التطبيق (Theme)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                    <button 
                      className="btn" 
                      onClick={handleToggleTheme}
                      style={{ background: theme === 'dark' ? 'var(--bg-elevated)' : 'var(--primary-light)', borderColor: theme === 'light' ? 'var(--primary)' : 'var(--border-color)', color: theme === 'light' ? 'var(--primary)' : 'var(--text-main)' }}
                    >
                      <Sun size={18} /> نهاري
                    </button>
                    <button 
                      className="btn" 
                      onClick={handleToggleTheme}
                      style={{ background: theme === 'light' ? 'var(--bg-elevated)' : 'var(--primary-light)', borderColor: theme === 'dark' ? 'var(--primary)' : 'var(--border-color)', color: theme === 'dark' ? 'var(--primary)' : 'var(--text-main)' }}
                    >
                      <Moon size={18} /> ليلي
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {saveMessage && (
                    <div style={{ padding: '0.75rem', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: '8px', border: '1px solid var(--success)', fontSize: '0.95rem' }}>
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
              <div className="stat-card fade-in" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                  <Database size={20} /> النسخ الاحتياطية
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>تصدير إلى Excel</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>تصدير جميع بيانات العمليات والفنيين والسحوبات إلى ملف إكسل.</span>
                  </div>
                  <button className="btn" onClick={handleExcelExport} style={{ color: 'var(--text-main)', borderColor: 'var(--border-color)' }}>
                    <Download size={18} /> تصدير Excel
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.2rem' }}>نسخة احتياطية شاملة (JSON)</strong>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>حفظ كامل بيانات النظام للاسترجاع الآمن</span>
                  </div>
                  <button className="btn" onClick={handleBackup} style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                    <Save size={18} /> إنشاء نسخة احتياطية
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem' }}>النسخ المتوفرة ({backups.length}/30):</strong>
                  {backups.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-base)', borderRadius: '8px' }}>لا توجد نسخ احتياطية مسجلة</div>
                  ) : (
                    backups.map(b => (
                      <div key={b.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <strong>{new Date(b.created_at).toLocaleString('ar-EG')}</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {b.size_kb} KB | {b.operations_count} عملية | {b.months_count} شهر | {b.technicians_count} فني
                          </span>
                        </div>
                        <button className="btn btn-outline" onClick={() => setShowRestoreConfirm(b.filename)}>
                          <RefreshCw size={16} /> استعادة
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="stat-card fade-in" style={{ padding: '2rem', border: '1px solid var(--danger-bg)' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={20} /> منطقة الخطر (Danger Zone)
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--danger-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.2rem', color: 'var(--danger)' }}>تصفير النظام بالكامل</strong>
                      <span style={{ fontSize: '0.9rem', color: 'var(--danger)' }}>مسح جميع البيانات الحالية وإعادتها للوضع الافتراضي. سيتم إنشاء نسخة احتياطية أولاً.</span>
                    </div>
                    <button 
                      className="btn" 
                      onClick={() => setShowResetConfirm(true)} 
                      style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                    >
                      <AlertTriangle size={18} /> تصفير البيانات
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showResetConfirm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center' }}>
            <div style={{ color: 'var(--danger)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
              <AlertTriangle size={48} />
            </div>
            <h2 style={{ color: 'var(--danger)' }}>تحذير خطير!</h2>
            <p style={{ marginBottom: '1rem', fontSize: '1.1rem', lineHeight: 1.6 }}>
              سيتم حذف جميع بيانات الورشة الحالية.
              <br/><br/>
              سيتم إنشاء نسخة احتياطية تلقائية قبل الحذف.
              <br/>
              هل أنت متأكد؟
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowResetConfirm(false)} disabled={isResetting}>
                تراجع وإلغاء
              </button>
              <button className="btn btn-primary" style={{ flex: 1, background: 'var(--danger)' }} onClick={handleFactoryReset} disabled={isResetting}>
                {isResetting ? 'جاري المسح...' : 'نعم، قم بتصفير النظام'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestoreConfirm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center' }}>
            <div style={{ color: 'var(--warning)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
              <RefreshCw size={48} />
            </div>
            <h2 style={{ color: 'var(--warning)' }}>استعادة البيانات</h2>
            <p style={{ marginBottom: '1rem', fontSize: '1.1rem', lineHeight: 1.6 }}>
              سيتم استبدال بيانات البرنامج الحالية ببيانات هذه النسخة.
              <br/>
              هل تريد المتابعة؟
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowRestoreConfirm(null)} disabled={isRestoring}>
                إلغاء
              </button>
              <button className="btn btn-primary" style={{ flex: 1, background: 'var(--warning)', color: 'var(--bg-elevated)' }} onClick={handleRestore} disabled={isRestoring}>
                {isRestoring ? 'جاري الاستعادة...' : 'استعادة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

