import React, { useState, useEffect, useMemo } from 'react';
import * as xlsx from 'xlsx';
import { Search, Plus, Edit, Trash2, Cpu, FileUp, ChevronRight, ChevronLeft, PackageSearch, Box, CheckCircle2 } from 'lucide-react';
import type { IcCompatibility, ScrapDevice } from '../types';
import { useDialog } from './ui/DialogProvider';

export default function CompatibilitySearch() {
  const [compatibilities, setCompatibilities] = useState<IcCompatibility[]>([]);
  const [scrapDevices, setScrapDevices] = useState<ScrapDevice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [isScrapModalOpen, setIsScrapModalOpen] = useState(false);
  const [scrapEditingId, setScrapEditingId] = useState<number | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [scrapCurrentPage, setScrapCurrentPage] = useState(1);
  const scrapItemsPerPage = 10;

  // IC Form state
  const [icNumber, setIcNumber] = useState('');
  const [componentType, setComponentType] = useState('');
  const [compatibleDevices, setCompatibleDevices] = useState('');
  const [notes, setNotes] = useState('');

  // Scrap Form state
  const [scrapName, setScrapName] = useState('');
  const [scrapModel, setScrapModel] = useState('');
  const [scrapQuantity, setScrapQuantity] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const dialog = useDialog();

  const loadData = async () => {
    const data = await (window as any).api.getIcCompatibilities();
    const scrapData = await (window as any).api.getScrapDevices();
    setCompatibilities(data);
    setScrapDevices(scrapData);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Filter - Hidden by default if search is empty
  const filtered = useMemo(() => {
    if (debouncedSearchTerm.trim() === '') return []; 
    return compatibilities.filter(c => {
      const term = debouncedSearchTerm.toLowerCase();
      return c.ic_number.toLowerCase().includes(term) ||
             c.compatible_devices.toLowerCase().includes(term) ||
             c.component_type.toLowerCase().includes(term);
    });
  }, [compatibilities, debouncedSearchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Cross-reference Logic
  const getMatchingScrap = (icDevicesStr: string): ScrapDevice | null => {
    if (!icDevicesStr) return null;
    const icDeviceList = icDevicesStr.split(/[,=]/).map(d => d.trim().toLowerCase()).filter(Boolean);
    
    for (const scrap of scrapDevices) {
      if (scrap.quantity <= 0) continue; 
      const scrapNameLower = scrap.device_name.trim().toLowerCase();
      const scrapModelLower = (scrap.device_model || '').trim().toLowerCase();
      
      for (const icD of icDeviceList) {
        if (
          icD.includes(scrapNameLower) || scrapNameLower.includes(icD) ||
          (scrapModelLower && (icD.includes(scrapModelLower) || scrapModelLower.includes(icD)))
        ) {
          return scrap;
        }
      }
    }
    return null;
  };

  const paginatedItemsWithScrap = useMemo(() => {
    return paginatedItems.map(c => ({
      ...c,
      matchingScrap: getMatchingScrap(c.compatible_devices)
    }));
  }, [paginatedItems, scrapDevices]);

  // ----------------
  // IC Logic
  // ----------------
  const handleSubmitIC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!icNumber || !componentType || !compatibleDevices) {
      await dialog.warning('الرجاء إكمال الحقول الإجبارية');
      return;
    }
    
    const data = { ic_number: icNumber, component_type: componentType, compatible_devices: compatibleDevices, notes };
    let res;
    if (editingId) {
      res = await (window as any).api.editIcCompatibility(editingId, data);
    } else {
      res = await (window as any).api.addIcCompatibility(data);
    }
    
    if (res && res.success === false) {
      await dialog.error(res.reason || 'فشل الحفظ');
      return;
    }
    
    closeModal();
    loadData();
  };

  const handleEditIC = (c: IcCompatibility) => {
    setEditingId(c.id);
    setIcNumber(c.ic_number);
    setComponentType(c.component_type);
    setCompatibleDevices(c.compatible_devices);
    setNotes(c.notes || '');
    setIsModalOpen(true);
  };

  const handleDeleteIC = async (id: number) => {
    const confirmed = await dialog.confirm('هل أنت متأكد من حذف هذا المكون؟', 'تأكيد الحذف', true);
    if (confirmed) {
      const res = await (window as any).api.deleteIcCompatibility(id);
      if (res && res.success === false) {
        await dialog.error(res.reason || 'فشل الحذف');
        return;
      }
      loadData();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isImporting) return;
    setIsImporting(true);

    try {
      dialog.loading('جاري استيراد التوافقية...');
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      const res = await (window as any).api.importIcExcelData(data);
      
      dialog.close();
      
      if (res.success) {
        await dialog.success(`تم الانتهاء! إضافة ${res.added} آيسي جديد، تحديث ${res.updated} آيسي موجود (بأجهزة جديدة)، وتجاهل ${res.ignored} سجل مكرر تماماً.`);
        loadData();
      } else {
        await dialog.error('حدث خطأ أثناء الاستيراد: ' + res.message);
      }
    } catch (err: any) {
      dialog.close();
      await dialog.error('حدث خطأ غير متوقع: ' + err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setIcNumber('');
    setComponentType('');
    setCompatibleDevices('');
    setNotes('');
  };

  // ----------------
  // Scrap Logic
  // ----------------
  const handleSubmitScrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapName) {
      await dialog.warning('يجب إدخال اسم الجهاز');
      return;
    }
    
    const data = { device_name: scrapName, device_model: scrapModel, quantity: Number(scrapQuantity) || 1 };
    
    let res;
    if (scrapEditingId) {
      res = await (window as any).api.editScrapDevice(scrapEditingId, data);
    } else {
      res = await (window as any).api.addScrapDevice(data);
    }
    
    if (res && res.success === false) {
      await dialog.error(res.reason || 'فشل الحفظ');
      return;
    }
    
    setScrapName('');
    setScrapModel('');
    setScrapQuantity('');
    setScrapEditingId(null);
    loadData();
  };

  const handleEditScrap = (s: ScrapDevice) => {
    setScrapEditingId(s.id);
    setScrapName(s.device_name);
    setScrapModel(s.device_model || '');
    setScrapQuantity(s.quantity.toString());
  };

  const handleDeleteScrap = async (id: number) => {
    const confirmed = await dialog.confirm('هل أنت متأكد من حذف هذه البوردة؟', 'تأكيد الحذف', true);
    if (confirmed) {
      const res = await (window as any).api.deleteScrapDevice(id);
      if (res && res.success === false) {
        await dialog.error(res.reason || 'فشل الحذف');
        return;
      }
      loadData();
    }
  };

  // Helper to split devices nicely into tags
  const renderDevices = (deviceStr: string) => {
    return deviceStr.split(/[,=]/).map(d => d.trim()).filter(d => d).map((d, i) => (
      <span key={i} className="tag">{d}</span>
    ));
  };

  const totalScrapPages = Math.ceil(scrapDevices.length / scrapItemsPerPage) || 1;
  const paginatedScrap = scrapDevices.slice((scrapCurrentPage - 1) * scrapItemsPerPage, scrapCurrentPage * scrapItemsPerPage);


  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="header-flex">
        <h2 className="page-title">
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
            <Cpu size={22} color="#fff" />
          </div>
          دليل التوافق
        </h2>
        
        <div style={{ display: 'flex', gap: '1rem', flex: 1, margin: '0 3rem', maxWidth: '600px' }}>
          <div className="search-container">
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="ابحث برقم الآيسي، أو اسم الجهاز، أو النوع..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="btn btn-secondary" onClick={() => setIsScrapModalOpen(true)}>
            <PackageSearch size={18} /> إدارة مخزن التفصيخ
          </button>
          <label className="btn" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success-bg)', cursor: isImporting ? 'not-allowed' : 'pointer', margin: 0 }}>
            <FileUp size={18} /> استيراد إكسل
            <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isImporting} />
          </label>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> إضافة مكون
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem' }}>
        <div className="grid">
          {paginatedItemsWithScrap.map(c => {
            const matchingScrap = c.matchingScrap;
            
            return (
              <div key={c.id} className="stat-card" style={{ 
                  padding: '1.5rem', 
                  minHeight: '280px', 
                  display: 'flex', 
                  flexDirection: 'column',
                  border: matchingScrap ? '2px solid var(--success)' : '1px solid var(--border-color)',
                  background: matchingScrap ? 'var(--success-bg)' : 'var(--bg-surface)'
                }}>
                
                {/* Status Banner */}
                {matchingScrap ? (
                  <div style={{ marginBottom: '1rem', color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ✅ متوفر لديك في بوردة: {matchingScrap.device_name}{matchingScrap.device_model ? ` - ${matchingScrap.device_model}` : ''} (الكمية: {matchingScrap.quantity})
                  </div>
                ) : (
                  <div style={{ marginBottom: '1rem', color: 'var(--danger)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ❌ غير متوفر في مخزنك. ابحث عن الأجهزة التالية:
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif" }}>
                      {c.ic_number}
                    </h3>
                    <span className="tag" style={{ margin: 0, backgroundColor: 'var(--primary-light)', borderColor: 'transparent', color: 'var(--primary)' }}>
                      {c.component_type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-icon" onClick={() => handleEditIC(c)} title="تعديل">
                      <Edit size={16} />
                    </button>
                    <button className="btn btn-icon danger" onClick={() => handleDeleteIC(c.id)} title="حذف">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', marginBottom: '0.8rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>الأجهزة المتوافقة:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', paddingRight: '5px' }}>
                    {renderDevices(c.compatible_devices)}
                  </div>
                </div>
                
                {c.notes && (
                  <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '12px', fontSize: '0.9rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                    <strong style={{ color: 'var(--text-main)' }}>ملاحظات: </strong> {c.notes}
                  </div>
                )}
              </div>
            );
          })}
          
          {filtered.length === 0 && searchTerm.trim() !== '' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state">
                <Cpu className="empty-state-icon" />
                <div className="empty-state-title">لا يوجد نتائج مطابقة للبحث</div>
                <div className="caption">جرب البحث بكلمات مختلفة أو قم بإضافة المكون.</div>
              </div>
            </div>
          )}

          {searchTerm.trim() === '' && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state">
                <Search className="empty-state-icon" style={{ opacity: 0.1, color: 'var(--primary)' }} />
                <div className="empty-state-title" style={{ fontSize: '1.5rem' }}>مساعد جرد التفصيخ الذكي</div>
                <div className="caption" style={{ fontSize: '1.1rem' }}>ابدأ بالكتابة في مربع البحث للبحث عن أي آيسي واستخراج أماكن توافره في بوردات التفصيخ.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem 0', gap: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button 
            className="btn" 
            style={{ padding: '0.5rem 1rem' }}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            <ChevronRight size={20} /> السابق
          </button>
          
          <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
            صفحة <strong style={{ color: 'var(--text-main)' }}>{currentPage}</strong> من {totalPages}
          </span>
          
          <button 
            className="btn" 
            style={{ padding: '0.5rem 1rem' }}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            التالي <ChevronLeft size={20} />
          </button>
        </div>
      )}

      {/* IC Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <Edit size={22} color="var(--primary)" />
              {editingId ? 'تعديل بيانات المكون' : 'إضافة مكون جديد'}
            </h2>
            <form onSubmit={handleSubmitIC} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>رقم الآيسي / اسم القطعة *</label>
                <input required type="text" value={icNumber} onChange={e => setIcNumber(e.target.value)} placeholder="مثال: BQ24193" />
              </div>
              <div className="form-group">
                <label>الفئة / النوع *</label>
                <input required type="text" value={componentType} onChange={e => setComponentType(e.target.value)} placeholder="مثال: آيسي شحن، Power IC" />
              </div>
              <div className="form-group">
                <label>الأجهزة المتوافقة * (افصل بينها بـ = أو فاصلة)</label>
                <textarea required rows={4} value={compatibleDevices} onChange={e => setCompatibleDevices(e.target.value)} placeholder="مثال: Redmi Note 4 = Mi Max 2" />
              </div>
              <div className="form-group">
                <label>ملاحظات إضافية (اختياري)</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="أرقام بديلة، معلومات فنية..." />
              </div>
              
              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={closeModal}>إلغاء الأمر</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingId ? 'حفظ التعديلات' : 'إضافة للقاعدة'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scrap Inventory Modal */}
      {isScrapModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', width: '100%' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <Box size={22} color="var(--primary)" />
              مخزن بوردات التفصيخ
            </h2>
            
            <form onSubmit={handleSubmitScrap} style={{ display: 'flex', gap: '1rem', alignItems: 'end', margin: '1.5rem 0', padding: '1rem', background: 'var(--primary-light)', borderRadius: '12px' }}>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label>اسم الجهاز</label>
                <input required type="text" value={scrapName} onChange={e => setScrapName(e.target.value)} placeholder="مثال: Samsung Galaxy S22" />
              </div>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label>رقم الموديل (اختياري)</label>
                <input type="text" value={scrapModel} onChange={e => setScrapModel(e.target.value)} placeholder="مثال: SM-S901B" />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>الكمية</label>
                <input required type="number" min="1" value={scrapQuantity} onChange={e => setScrapQuantity(e.target.value)} placeholder="1" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ height: '48px' }}>
                {scrapEditingId ? 'تعديل' : 'إضافة'}
              </button>
              {scrapEditingId && (
                <button type="button" className="btn" style={{ height: '48px' }} onClick={() => { setScrapEditingId(null); setScrapName(''); setScrapModel(''); setScrapQuantity(''); }}>
                  إلغاء
                </button>
              )}
            </form>

            <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
              <table style={{ margin: 0 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elevated)', zIndex: 1 }}>
                  <tr>
                    <th>اسم الجهاز</th>
                    <th>الموديل</th>
                    <th style={{ textAlign: 'center' }}>الكمية</th>
                    <th style={{ textAlign: 'center' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedScrap.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.device_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.device_model || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="tag" style={{ background: s.quantity > 0 ? 'var(--success-bg)' : 'var(--danger-bg)', color: s.quantity > 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {s.quantity}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button className="btn btn-icon" onClick={() => handleEditScrap(s)} title="تعديل">
                            <Edit size={16} />
                          </button>
                          <button className="btn btn-icon danger" onClick={() => handleDeleteScrap(s.id)} title="حذف">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {scrapDevices.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <div className="empty-state">
                          <CheckCircle2 className="empty-state-icon" />
                          <div className="empty-state-title">لا توجد بوردات مسجلة في المخزن</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Scrap Pagination Controls */}
            {scrapDevices.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem 0', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  className="btn" 
                  style={{ padding: '0.5rem 1rem' }}
                  disabled={scrapCurrentPage === 1}
                  onClick={() => setScrapCurrentPage(p => Math.max(1, p - 1))}
                >
                  <ChevronRight size={20} /> السابق
                </button>
                
                <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
                  صفحة <strong style={{ color: 'var(--text-main)' }}>{scrapCurrentPage}</strong> من {totalScrapPages}
                </span>
                
                <button 
                  className="btn" 
                  style={{ padding: '0.5rem 1rem' }}
                  disabled={scrapCurrentPage === totalScrapPages}
                  onClick={() => setScrapCurrentPage(p => Math.min(totalScrapPages, p + 1))}
                >
                  التالي <ChevronLeft size={20} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn" onClick={() => setIsScrapModalOpen(false)}>إغلاق النافذة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
