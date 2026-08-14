import { useState } from 'react';
import { Home, Wrench, Wallet, Users, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Operations from './components/Operations';
import Withdrawals from './components/Withdrawals';
import Technicians from './components/Technicians';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'operations': return <Operations />;
      case 'withdrawals': return <Withdrawals />;
      case 'technicians': return <Technicians />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-container" dir="rtl">
      <div className="sidebar glass">
        <h1>مركز الصيانة</h1>
        
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
          className={`nav-item ${activeTab === 'technicians' ? 'active' : ''}`}
          onClick={() => setActiveTab('technicians')}
        >
          <Users size={20} />
          <span>حسابات الفنيين</span>
        </div>
      </div>

      <div className="main-content">
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
