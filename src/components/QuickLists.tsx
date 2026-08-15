import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Smartphone, Wrench } from 'lucide-react';

export default function QuickLists() {
  const [devices, setDevices] = useState<string[]>([]);
  const [faults, setFaults] = useState<string[]>([]);
  
  const [newDevice, setNewDevice] = useState('');
  const [newFault, setNewFault] = useState('');

  const loadLists = async () => {
    const data = await (window as any).api.getQuickLists();
    setDevices(data.devices || []);
    setFaults(data.faults || []);
  };

  useEffect(() => {
    loadLists();
  }, []);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevice.trim()) return;
    await (window as any).api.addQuickListItem('device', newDevice.trim());
    setNewDevice('');
    loadLists();
  };

  const handleAddFault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFault.trim()) return;
    await (window as any).api.addQuickListItem('fault', newFault.trim());
    setNewFault('');
    loadLists();
  };

  const handleRemoveDevice = async (item: string) => {
    if (confirm(`هل أنت متأكد من حذف "${item}"؟`)) {
      await (window as any).api.removeQuickListItem('device', item);
      loadLists();
    }
  };

  const handleRemoveFault = async (item: string) => {
    if (confirm(`هل أنت متأكد من حذف "${item}"؟`)) {
      await (window as any).api.removeQuickListItem('fault', item);
      loadLists();
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', gap: '2rem' }}>
      {/* Devices Column */}
      <div className="stat-card" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
          <Smartphone size={20} />
          الأجهزة الشائعة
        </h3>
        
        <form onSubmit={handleAddDevice} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input 
            type="text" 
            value={newDevice}
            onChange={e => setNewDevice(e.target.value)}
            placeholder="مثال: iPhone 13" 
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0 1rem' }}>
            <Plus size={20} />
          </button>
        </form>

        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', paddingRight: '0.5rem' }}>
          {devices.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 500 }}>{d}</span>
              <button className="btn btn-icon danger" onClick={() => handleRemoveDevice(d)} title="حذف">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {devices.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>لا توجد أجهزة مضافة</div>
          )}
        </div>
      </div>

      {/* Faults Column */}
      <div className="stat-card" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
          <Wrench size={20} />
          الأعطال الشائعة
        </h3>
        
        <form onSubmit={handleAddFault} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input 
            type="text" 
            value={newFault}
            onChange={e => setNewFault(e.target.value)}
            placeholder="مثال: تغيير شاشة" 
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0 1rem' }}>
            <Plus size={20} />
          </button>
        </form>

        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', paddingRight: '0.5rem' }}>
          {faults.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 500 }}>{f}</span>
              <button className="btn btn-icon danger" onClick={() => handleRemoveFault(f)} title="حذف">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {faults.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>لا توجد أعطال مضافة</div>
          )}
        </div>
      </div>
    </div>
  );
}
