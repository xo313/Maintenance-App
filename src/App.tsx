import { useState, useEffect } from 'react';
import { Home, Wrench, Wallet, Settings, Cpu, Activity, Menu, ChevronRight, ChevronLeft } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Operations from './components/Operations';
import Withdrawals from './components/Withdrawals';
import SettingsScreen from './components/Settings';
import CompatibilitySearch from './components/CompatibilitySearch';
import { DialogProvider } from './components/ui/DialogProvider';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [shopName, setShopName] = useState('مركز الصيانة');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    (window as any).api.getSettings().then((settings: any) => {
      if (settings?.shop_name) setShopName(settings.shop_name);
      if (settings?.theme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    });
  }, []);

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'operations': return <Operations />;
      case 'withdrawals': return <Withdrawals />;
      case 'compatibilities': return <CompatibilitySearch />;
      case 'settings': return <SettingsScreen />;
      default: return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    switch(activeTab) {
      case 'dashboard': return 'لوحة التحكم';
      case 'operations': return 'العمليات والصيانة';
      case 'withdrawals': return 'السحوبات والمصروفات';
      case 'compatibilities': return 'دليل التوافق';
      case 'settings': return 'الإعدادات';
      default: return '';
    }
  };

  return (
    <DialogProvider>
      <div className="app-container fade-in" dir="rtl">
        {/* Sidebar */}
        <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : 'expanded'}`}>
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Activity size={24} color="#fff" />
            </div>
            {!isSidebarCollapsed && <h1>{shopName}</h1>}
          </div>
          
          <button 
            className="sidebar-toggle" 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            {isSidebarCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
          
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            title={isSidebarCollapsed ? 'لوحة التحكم' : ''}
          >
            <Home size={20} />
            {!isSidebarCollapsed && <span>لوحة التحكم</span>}
          </div>
          
          <div 
            className={`nav-item ${activeTab === 'operations' ? 'active' : ''}`}
            onClick={() => setActiveTab('operations')}
            title={isSidebarCollapsed ? 'العمليات والصيانة' : ''}
          >
            <Wrench size={20} />
            {!isSidebarCollapsed && <span>العمليات والصيانة</span>}
          </div>
          
          <div 
            className={`nav-item ${activeTab === 'withdrawals' ? 'active' : ''}`}
            onClick={() => setActiveTab('withdrawals')}
            title={isSidebarCollapsed ? 'السحوبات والمصروفات' : ''}
          >
            <Wallet size={20} />
            {!isSidebarCollapsed && <span>السحوبات والمصروفات</span>}
          </div>

          <div 
            className={`nav-item ${activeTab === 'compatibilities' ? 'active' : ''}`}
            onClick={() => setActiveTab('compatibilities')}
            title={isSidebarCollapsed ? 'دليل التوافق' : ''}
          >
            <Cpu size={20} />
            {!isSidebarCollapsed && <span>دليل التوافق</span>}
          </div>
          
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <div 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} 
              onClick={() => setActiveTab('settings')}
              title={isSidebarCollapsed ? 'الإعدادات' : ''}
            >
              <Settings size={20} />
              {!isSidebarCollapsed && <span>الإعدادات</span>}
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <div className="main-content">
          {/* Header */}
          <header className="app-header">
            <div className="header-title">{getPageTitle()}</div>
            <div className="header-actions">
              {/* Future actions can go here */}
            </div>
          </header>
          
          {/* Page Content Container */}
          <div className="page-container">
            {renderContent()}
          </div>
        </div>
      </div>
    </DialogProvider>
  );
}

export default App;
