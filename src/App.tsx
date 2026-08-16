import { useState, useEffect } from 'react';
import { Home, Wrench, Wallet, Settings, Cpu, Activity } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Operations from './components/Operations';
import Withdrawals from './components/Withdrawals';
import SettingsScreen from './components/Settings';
import CompatibilitySearch from './components/CompatibilitySearch';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [shopName, setShopName] = useState('مركز الصيانة');

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

  return (
    <div className="app-container fade-in" dir="rtl">
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Activity size={24} color="#fff" />
          </div>
          <h1>{shopName}</h1>
        </div>
        
        <div 
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Home size={20} />
          <span>لوحة التحكم</span>
        </div>
        
        <div 
          className={`nav-item ${activeTab === 'operations' ? 'active' : ''}`}
          onClick={() => setActiveTab('operations')}
        >
          <Wrench size={20} />
          <span>العمليات والصيانة</span>
        </div>
        
        <div 
          className={`nav-item ${activeTab === 'withdrawals' ? 'active' : ''}`}
          onClick={() => setActiveTab('withdrawals')}
        >
          <Wallet size={20} />
          <span>السحوبات والمصروفات</span>
        </div>

        <div 
          className={`nav-item ${activeTab === 'compatibilities' ? 'active' : ''}`}
          onClick={() => setActiveTab('compatibilities')}
        >
          <Cpu size={20} />
          <span>دليل التوافق</span>
        </div>
        
        <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} 
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>الإعدادات</span>
          </div>
        </div>
      </div>

      <div className="main-content">
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
