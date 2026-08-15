import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, Sliders, List, Save, Download, AlertTriangle, Moon, Sun } from 'lucide-react';
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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await (window as any).api.getSettings();
    setSettings(data);
    setShopName(data.shop_name || 'مركز الصيانة');
    setWhatsappTemplate(data.whatsapp_template || '');
    setTheme(data.theme || 'dark');
  };

  const handleSaveSettings = async () => {
    await (window as any).api.updateSettings({
      shop_name: shopName,
      whatsapp_template: whatsappTemplate,
      theme: theme
    });
    
    // Apply theme immediately
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    
    alert('تم حفظ الإعدادات بنجاح. قد تحتاج لإعادة تشغيل التطبيق لتطبيق بعض التغييرات (مثل اسم المركز في الشريط الجانبي).');
  };

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleBackup = async () => {
    try {
      const allOps = await (window as any).api.getAllOperations();
      if (!allOps || allOps.length === 0) {
        alert('لا توجد عمليات لتصديرها.');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(allOps);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "العمليات");
      
      const fileName = `نسخة_احتياطية_العمليات_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تصدير النسخة الاحتياطية.');
    }
  };

  const handleFactoryReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await (window as any).api.factoryReset();
      alert('تم تصفير بيانات العمليات والمصروفات والديون بنجاح!');
      setShowResetConfirm(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تصفير النظام.');
    }
    setIsResetting(false);
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
                    - <code>[المبلغ]</code> : يتم استبداله بمبلغ التكلفة/السعر المطلوب.
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

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-primary" onClick={handleSaveSettings}>
                    <Save size={18} /> حفظ الإعدادات
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="stat-card fade-in" style={{ padding: '2rem', border: '1px solid var(--danger-bg)' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={20} /> منطقة الخطر (Danger Zone)
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.2rem' }}>نسخة احتياطية للإكسل</strong>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>تصدير جميع العمليات في النظام إلى ملف Excel للحفظ الآمن.</span>
                    </div>
                    <button className="btn" onClick={handleBackup} style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                      <Download size={18} /> تصدير Excel
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--danger-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.2rem', color: 'var(--danger)' }}>تصفير النظام الذكي</strong>
                      <span style={{ fontSize: '0.9rem', color: 'var(--danger)' }}>مسح جميع بيانات العمليات، المصروفات، والديون (بدون مسح التوافقات والفنيين).</span>
                    </div>
                    <button className="btn" onClick={() => setShowResetConfirm(true)} style={{ background: 'var(--danger)', color: 'white', border: 'none' }}>
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
              هل أنت متأكد من رغبتك في <strong>مسح جميع العمليات والديون والمصروفات</strong> بالكامل؟
              <br/><br/>
              هذا الإجراء سيقوم بتصفير أرباح الفنيين وصندوق المركز ليبدأ من جديد. (لا يمكن التراجع عن هذه الخطوة).
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
    </div>
  );
}

