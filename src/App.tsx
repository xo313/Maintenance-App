import { useState, useEffect } from 'react';
import { Home, Wrench, Wallet, Settings, Activity, ChevronRight, ChevronLeft, Users, Menu, X } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Operations from './components/Operations';
import Withdrawals from './components/Withdrawals';
import Customers from './components/Customers';
import SettingsScreen from './components/Settings';
import CompatibilitySearch from './components/CompatibilitySearch';
import { DialogProvider } from './components/ui/DialogProvider';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [shopName, setShopName] = useState('مركز الصيانة');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [initialOperationsFilter, setInitialOperationsFilter] = useState<any>(null);
  const [operationsMode, setOperationsMode] = useState<'list' | 'add'>('list');

  useEffect(() => {
    (window as any).api.getSettings().then((settings: any) => {
      if (settings?.shop_name) setShopName(settings.shop_name);
      document.documentElement.classList.toggle('light', settings?.theme === 'light');
    });
  }, []);

  const handleNavigate = (tab: string, filter?: any, mode: 'list' | 'add' = 'list') => {
    if (tab === 'operations') {
      setInitialOperationsFilter(filter);
      setOperationsMode(mode);
    }
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigate} />;
      case 'operations': return <Operations initialFilter={initialOperationsFilter} initialMode={operationsMode} clearInitialFilter={() => setInitialOperationsFilter(null)} />;
      case 'customers': return <Customers />;
      case 'withdrawals': return <Withdrawals />;
      case 'compatibilities': return <CompatibilitySearch />;
      case 'settings': return <SettingsScreen />;
      default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'لوحة التحكم';
      case 'operations': return 'العمليات والصيانة';
      case 'customers': return 'العملاء';
      case 'withdrawals': return 'السحوبات والمصروفات';
      case 'compatibilities': return 'دليل التوافق';
      case 'settings': return 'الإعدادات';
      default: return '';
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: Home },
    { id: 'operations', label: 'العمليات والصيانة', icon: Wrench },
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'withdrawals', label: 'السحوبات والمصروفات', icon: Wallet },
  ];

  return (
    <DialogProvider>
      <div className="app-container fade-in" dir="rtl">
        {isMobileMenuOpen && <div className="sidebar-backdrop" onClick={() => setIsMobileMenuOpen(false)} />}

        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : 'expanded'} ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon"><Activity size={24} /></div>
            {!isSidebarCollapsed && <div className="sidebar-brand"><h1>{shopName}</h1><small>إدارة الصيانة</small></div>}
            <button className="mobile-close" onClick={() => setIsMobileMenuOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button>
          </div>

          <button className="sidebar-toggle" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} title={isSidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'} aria-label="تبديل القائمة">
            {isSidebarCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>

          <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => handleNavigate(id)} title={isSidebarCollapsed ? label : undefined}>
                <Icon size={20} />
                {!isSidebarCollapsed && <span>{label}</span>}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => handleNavigate('settings')} title={isSidebarCollapsed ? 'الإعدادات' : undefined}>
              <Settings size={20} />
              {!isSidebarCollapsed && <span>الإعدادات</span>}
            </button>
          </div>
        </aside>

        <div className="main-content">
          <header className="app-header">
            <div className="header-leading">
              <button className="mobile-menu-button" onClick={() => setIsMobileMenuOpen(true)} aria-label="فتح القائمة"><Menu size={22} /></button>
              <div><div className="header-kicker">مركز الصيانة</div><div className="header-title">{getPageTitle()}</div></div>
            </div>
            <div className="header-actions" />
          </header>

          <main className="page-container">{renderContent()}</main>
        </div>
      </div>
    </DialogProvider>
  );
}

export default App;
