import React, { useState } from 'react';
import { Settings as SettingsIcon, Users, Sliders, List } from 'lucide-react';
import Technicians from './Technicians';
import QuickLists from './QuickLists';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('technicians');

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
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="stat-card fade-in" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>إعدادات النظام (قريباً)</h3>
                <p style={{ color: 'var(--text-muted)' }}>سيتم إضافة خيارات تخصيص اسم المحل، النسخ الاحتياطي التلقائي، والمزيد هنا لاحقاً.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
