import React, { useEffect, useState } from "react";
import * as xlsx from 'xlsx';
import { Edit, Trash2, PlusCircle, PenTool, CheckCircle2, ChevronRight, ChevronLeft, MessageCircle, Eye, Info } from "lucide-react";
import type { Operation, Technician, Customer } from "../types";
import { useDialog } from "./ui/DialogContext";
import { StatusBadge } from "./ui/Badge";
import { FileUp } from "lucide-react";

export default function Operations({ initialFilter, clearInitialFilter, initialMode }: { initialFilter?: any, clearInitialFilter?: () => void, initialMode?: 'list' | 'add' }) {
  const [viewMode, setViewMode] = useState<'list' | 'add'>(initialMode || 'list');
  const [operations, setOperations] = useState<Operation[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Quick Lists
  const [quickDevices, setQuickDevices] = useState<string[]>([]);
  const [quickFaults, setQuickFaults] = useState<string[]>([]);

  const [settings, setSettings] = useState<any>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'partial' | 'debt'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'under_maintenance' | 'completed' | 'delivered' | 'not_delivered'>('all');
  const [warrantyFilter, setWarrantyFilter] = useState<'all' | 'active'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Form state
  const [techId, setTechId] = useState<number | ''>('');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  const [deviceName, setDeviceName] = useState<string>('');
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [faultType, setFaultType] = useState<string>('');
  const [faults, setFaults] = useState<string[]>([]);

  const [price, setPrice] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [status, setStatus] = useState<'under_maintenance' | 'completed' | 'delivered' | 'cancelled'>('under_maintenance');

  const [notes, setNotes] = useState<string>('');
  const [accessories, setAccessories] = useState<string>('');
  const [costPaid, setCostPaid] = useState<string>('');
  const [warrantyEnabled, setWarrantyEnabled] = useState<boolean>(false);
  const [warrantyDays, setWarrantyDays] = useState<string>('');
  const [warrantyNote, setWarrantyNote] = useState<string>('');

  // Edit state
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [editTechId, setEditTechId] = useState<number | ''>('');
  const [editCustomerId, setEditCustomerId] = useState<number | ''>('');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>('');

  const [editDeviceName, setEditDeviceName] = useState<string>('');
  const [editDeviceCode, setEditDeviceCode] = useState<string>('');
  const [editFaultType, setEditFaultType] = useState<string>('');
  const [editFaults, setEditFaults] = useState<string[]>([]);

  const [editPrice, setEditPrice] = useState<string>('');
  const [editCost, setEditCost] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'under_maintenance' | 'completed' | 'delivered' | 'cancelled'>('under_maintenance');

  const [editNotes, setEditNotes] = useState<string>('');
  const [editAccessories, setEditAccessories] = useState<string>('');
  const [editCostPaid, setEditCostPaid] = useState<string>('');
  const [editWarrantyEnabled, setEditWarrantyEnabled] = useState<boolean>(false);
  const [editWarrantyDays, setEditWarrantyDays] = useState<string>('');
  const [editWarrantyNote, setEditWarrantyNote] = useState<string>('');

  const [viewingOp, setViewingOp] = useState<Operation | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const dialog = useDialog();

  const loadData = async () => {
    const ops = await (window as any).api.getOperations();
    const techs = await (window as any).api.getTechnicians();
    const custs = await (window as any).api.getCustomers();
    const qLists = await (window as any).api.getQuickLists();
    const sets = await (window as any).api.getSettings();
    setOperations(ops);
    setTechnicians(techs);
    setCustomers(custs);
    setQuickDevices(qLists.devices || []);
    setQuickFaults(qLists.faults || []);
    setSettings(sets);

    setTechId(prev => {
      if (prev) return prev;
      if (ops.length > 0) return ops[0].technician_id;
      if (techs.length === 1) return techs[0].id;
      return '';
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialFilter) {
      if (initialFilter.paymentStatus) setPaymentFilter(initialFilter.paymentStatus);
      if (initialFilter.status) setStatusFilter(initialFilter.status);
      if (clearInitialFilter) clearInitialFilter();
    }
  }, [initialFilter, clearInitialFilter]);

  useEffect(() => {
    if (initialMode) setViewMode(initialMode);
  }, [initialMode]);

  // Refresh technicians when switching to 'add' mode to ensure list is up-to-date
  useEffect(() => {
    if (viewMode === 'add') {
      (window as any).api.getTechnicians().then((techs: Technician[]) => setTechnicians(techs));
    }
  }, [viewMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techId || !price) return;

    const selectedTech = technicians.find(t => t.id === Number(techId));
    if (!selectedTech) return;

    const s = parseFloat(price);
    const p = parseFloat(cost || '0');

    const executeSubmit = async () => {
      let finalFaults = [...faults];
      if (faultType.trim() && !finalFaults.includes(faultType.trim())) {
        finalFaults.push(faultType.trim());
      }

      const res = await (window as any).api.addOperation({
        technician_id: Number(techId),
        customer_id: customerId !== '' ? Number(customerId) : undefined,
        customer_name: customerName,
        customer_phone: customerPhone,
        device: deviceName.trim(),
        device_code: deviceCode.trim() || undefined,
        faults: finalFaults,
        price: s,
        cost: p,
        paid_amount: costPaid ? parseFloat(costPaid) : undefined,
        status: status,
        notes: notes.trim() || undefined,
        accessories: accessories.trim() || undefined,
        warranty_enabled: warrantyEnabled,
        warranty_days: warrantyEnabled && warrantyDays ? parseInt(warrantyDays) : undefined,
        warranty_note: warrantyEnabled ? warrantyNote.trim() : undefined,
      });
      if (res && res.success === false) {
        await dialog.error(res.reason || 'فشل الحفظ');
        return;
      }

      // Auto-add device to quick list if not already present
      const trimmedDevice = deviceName.trim();
      if (trimmedDevice && !quickDevices.includes(trimmedDevice)) {
        await (window as any).api.addQuickListItem('device', trimmedDevice);
      }

      // Auto-add any new faults to the quick list
      for (const fault of finalFaults) {
        if (fault.trim() && !quickFaults.includes(fault.trim())) {
          await (window as any).api.addQuickListItem('fault', fault.trim());
        }
      }

      setDeviceName('');
      setDeviceCode('');
      setFaultType('');
      setFaults([]);
      setPrice('');
      setCost('');
      setCostPaid('');
      setCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setStatus('under_maintenance');
      setNotes('');
      setAccessories('');
      setWarrantyEnabled(false);
      setWarrantyDays('');
      setWarrantyNote('');

      loadData();
      setViewMode('list');
      setToastMessage('تمت إضافة العملية بنجاح');
      setTimeout(() => setToastMessage(null), 3000);
    };

    if (p > s) {
      const confirmed = await dialog.confirm('تنبيه: التكلفة (المشتريات) أعلى من المبيعات! هل أنت متأكد من تسجيل العملية بخسارة؟', 'تأكيد التسجيل', true);
      if (confirmed) {
        executeSubmit();
      }
      return;
    }

    executeSubmit();
  };

  const handleEditClick = (op: Operation) => {
    try {
      setEditingOp(op);
      setEditTechId(op.technician_id);
      setEditCustomerId(op.customer_id || '');
      setEditCustomerName(op.customer_name || '');
      setEditCustomerPhone(op.customer_phone || '');

      let dName = String(op.device || '');
      let fList: string[] = [];
      if (Array.isArray(op.faults)) {
        fList = op.faults;
      } else if (typeof op.faults === 'string') {
        fList = [op.faults];
      } else if (typeof (op as any).fault === 'string') {
        fList = [(op as any).fault];
      }

      if (fList.length === 0 && dName.includes(' - ')) {
        const parts = dName.split(' - ');
        dName = parts[0];
        fList = [parts.slice(1).join(' - ')];
      }

      setEditDeviceName(dName);
      setEditDeviceCode(op.device_code || '');
      setEditFaultType('');
      setEditFaults(fList);
      setEditPrice(op.price ? String(op.price) : '0');
      setEditCost(op.cost ? String(op.cost) : (typeof (op as any).spare_parts_cost === 'number' ? String((op as any).spare_parts_cost) : '0'));
      setEditCostPaid(op.paid_amount !== undefined ? String(op.paid_amount) : '');
      let initialStatus = op.status;
      if (!initialStatus) {
        initialStatus = 'completed';
      }
      setEditStatus(initialStatus);

      setEditNotes(op.notes || '');
      setEditAccessories(op.accessories || '');
      setEditWarrantyEnabled(op.warranty_enabled || false);
      setEditWarrantyDays(op.warranty_days ? String(op.warranty_days) : '');
      setEditWarrantyNote(op.warranty_note || '');
    } catch (err: any) {
      dialog.error("خطأ أثناء فتح النافذة: " + err.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingOp || !editTechId || !editPrice) return;

    const selectedTech = technicians.find(t => t.id === Number(editTechId));
    if (!selectedTech) return;

    const s = parseFloat(editPrice);
    const p = parseFloat(editCost || '0');

    // WARNING CHECKS
    let isFinancialEdit = s !== editingOp.price || p !== (editingOp.cost || 0);
    let isLegacy = editingOp.tech_profit_percentage === undefined;

    if (isFinancialEdit && isLegacy) {
      const confirmed = await dialog.confirm('هذه عملية قديمة. تعديلها مالياً سيؤدي إلى إعادة حساب الأرباح بناءً على نسبة الفني الحالية. هل تود الاستمرار؟', 'تأكيد التعديل المالي', true);
      if (!confirmed) return;
    }

    const executeEdit = async () => {
      let finalEditFaults = [...editFaults];
      if (editFaultType.trim() && !finalEditFaults.includes(editFaultType.trim())) {
        finalEditFaults.push(editFaultType.trim());
      }

      const res = await (window as any).api.editOperation(editingOp.id, {
        technician_id: Number(editTechId),
        customer_id: editCustomerId !== '' ? Number(editCustomerId) : undefined,
        customer_name: editCustomerName,
        customer_phone: editCustomerPhone,
        device: editDeviceName.trim(),
        faults: finalEditFaults,
        price: s,
        cost: p,
        paid_amount: editCostPaid ? parseFloat(editCostPaid) : undefined,
        status: editStatus,
        notes: editNotes.trim() || undefined,
        accessories: editAccessories.trim() || undefined,
        warranty_enabled: editWarrantyEnabled,
        warranty_days: editWarrantyEnabled && editWarrantyDays ? parseInt(editWarrantyDays) : undefined,
        warranty_note: editWarrantyEnabled ? editWarrantyNote.trim() : undefined,
      });
      if (res && res.success === false) {
        await dialog.error(res.reason || 'فشل التعديل');
        return;
      }

      setEditingOp(null);
      loadData();
    };

    if (p > s) {
      const confirmed = await dialog.confirm('تنبيه: التكلفة (المشتريات) أعلى من المبيعات! هل أنت متأكد من حفظ العملية بخسارة؟', 'تأكيد الحفظ', true);
      if (confirmed) {
        executeEdit();
      }
      return;
    }

    executeEdit();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isImporting) return;
    setIsImporting(true);

    try {
      dialog.loading('جاري استيراد العمليات...');
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      const res = await (window as any).api.importOperationsExcelData(data);

      dialog.close();

      if (res.success) {
        await dialog.success(`تم استيراد ${res.added} سجلات بنجاح، وتم تجاهل ${res.ignored} سجلات مكررة.`);
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

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('07')) {
      cleaned = '964' + cleaned.substring(1);
    }
    return cleaned;
  };

  const sendWhatsApp = async (op: Operation) => {
    const formattedPhone = formatPhoneNumber(op.customer_phone || '');
    if (!formattedPhone) {
      await dialog.warning('لا يوجد رقم هاتف صالح لإرسال الرسالة.');
      return;
    }

    let text = settings?.whatsapp_template || `السلام عليكم [اسم_الزبون]
نود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.
المشكلة: [المشكلة]
المبلغ المطلوب: [المبلغ]
المبلغ الواصل: [المبلغ_الواصل]
المبلغ المتبقي: [المبلغ_المتبقي]
شكراً لاختيارك [اسم_المحل]!`;

    text = text.replace(/\[اسم_الزبون\]/g, op.customer_name || 'عميلنا العزيز');
    text = text.replace(/\[اسم_الجهاز\]/g, op.device || '-');

    const faultsText = op.faults && op.faults.length > 0 ? op.faults.join('، ') : 'غير محدد';
    text = text.replace(/\[المشكلة\]/g, faultsText);

    const pAmt = op.paid_amount !== undefined ? op.paid_amount : (op.payment_status === 'cash' ? (op.price || 0) : 0);
    const remAmt = (op.price || 0) - pAmt;

    text = text.replace(/\[المبلغ\]/g, op.price ? op.price.toString() : '0');
    text = text.replace(/\[المبلغ_الواصل\]/g, pAmt.toString());
    text = text.replace(/\[المبلغ_المتبقي\]/g, remAmt.toString());
    text = text.replace(/\[اسم_المحل\]/g, settings?.shop_name || 'مركز الصيانة');

    const encodedMessage = encodeURIComponent(text);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(url, '_blank');
  };

  const filteredOperations = operations.filter(op => {
    // Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        String(op.id).includes(term) ||
        (op.customer_name || '').toLowerCase().includes(term) ||
        (op.customer_phone || '').includes(term) ||
        (op.device || '').toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // Payment filter
    if (paymentFilter !== 'all') {
      const pAmt = op.paid_amount;
      const isCash = pAmt !== undefined ? pAmt >= (op.price || 0) : op.payment_status === 'cash';
      const isPartial = pAmt !== undefined && pAmt > 0 && pAmt < (op.price || 0);
      const isDebt = pAmt !== undefined ? pAmt === 0 : op.payment_status === 'debt';

      if (paymentFilter === 'cash' && !isCash) return false;
      if (paymentFilter === 'partial' && !isPartial) return false;
      if (paymentFilter === 'debt' && !isDebt) return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'not_delivered') {
        if (op.status === 'delivered') return false;
      } else if (op.status !== statusFilter) {
        return false;
      }
    }

    // Warranty filter
    if (warrantyFilter === 'active') {
      if (!op.warranty_enabled) return false;
      if (op.warranty_end) {
        const parts = op.warranty_end.split('/');
        if (parts.length === 3) {
          const end = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          end.setHours(23, 59, 59, 999);
          if (new Date() > end) return false;
        }
      }
    }

    // Date filter
    if (dateFrom || dateTo) {
      const parts = op.date.split('/');
      if (parts.length === 3) {
        const opDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        if (dateFrom) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          if (opDate < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          if (opDate > to) return false;
        }
      }
    }

    return true;
  });

  const totalPages = Math.ceil(filteredOperations.length / itemsPerPage) || 1;
  const paginatedOperations = filteredOperations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="fade-in">
      <div className="header-flex">
        <h2 className="page-title">
          {viewMode === 'add' ? 'إضافة عملية جديدة' : 'العمليات والصيانة'}
        </h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {viewMode === 'list' && (
            <>
              <button className="btn btn-primary" onClick={() => setViewMode('add')}>
                <PlusCircle size={20} /> عملية جديدة
              </button>
              <label className="btn" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success-bg)', cursor: isImporting ? 'not-allowed' : 'pointer', margin: 0 }}>
                <FileUp size={20} /> استيراد إكسل
                <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileUpload} disabled={isImporting} />
              </label>
            </>
          )}
          {viewMode === 'add' && (
            <button className="btn btn-secondary" onClick={() => setViewMode('list')}>
              <ChevronRight size={20} /> رجوع للعمليات
            </button>
          )}
        </div>
      </div>

      {viewMode === 'add' ? (
        <div className="stat-card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
          {/* Datalists for quick lists */}
          <datalist id="quick-devices">
            {quickDevices.map((d, idx) => <option key={idx} value={d} />)}
          </datalist>
          <datalist id="quick-faults">
            {quickFaults.map((f, idx) => <option key={idx} value={f} />)}
          </datalist>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* بيانات الزبون والجهاز */}
            <div>
              <h4 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>بيانات الصيانة</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>الفني</label>
                  <select value={techId} onChange={e => setTechId(Number(e.target.value))} required>
                    <option value="" disabled>اختر الفني...</option>
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({(t.profit_percentage * 100).toFixed(0)}%)</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>العميل</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" list="customers-list" value={customerName} onChange={e => {
                      setCustomerName(e.target.value);
                      const found = customers.find(c => c.name === e.target.value || c.phone === e.target.value);
                      if (found) {
                        setCustomerId(found.id);
                        setCustomerName(found.name);
                        setCustomerPhone(found.phone);
                      } else {
                        setCustomerId('');
                      }
                    }} placeholder="اختر عميلاً أو اكتب اسماً جديداً..." />
                    <datalist id="customers-list">
                      {customers.map(c => <option key={c.id} value={c.name}>{c.phone}</option>)}
                    </datalist>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>رقم الهاتف (اختياري)</label>
                  <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="مثال: 01012345678" disabled={customerId !== ''} />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>اسم الجهاز</label>
                  <input type="text" list="quick-devices" value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="مثال: iPhone 13" />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>كود الجهاز (اختياري)</label>
                  <input type="text" value={deviceCode} onChange={e => setDeviceCode(e.target.value)} placeholder="IMEI / Serial" />
                </div>

                <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label>الأعطال (اضغط Enter للإضافة)</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      list="quick-faults"
                      value={faultType}
                      onChange={e => setFaultType(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (faultType.trim() && !faults.includes(faultType.trim())) {
                            setFaults([...faults, faultType.trim()]);
                            setFaultType('');
                          }
                        }
                      }}
                      placeholder="اختر أو اكتب العطل"
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (faultType.trim() && !faults.includes(faultType.trim())) {
                          setFaults([...faults, faultType.trim()]);
                          setFaultType('');
                        }
                      }}
                    >
                      إضافة
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {faults.map((f, i) => (
                      <span key={i} className="badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 8px', borderRadius: '4px' }}>
                        {f}
                        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 4px', fontSize: '1.2rem', lineHeight: 1 }} onClick={() => setFaults(faults.filter(x => x !== f))}>&times;</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* البيانات المالية */}
            <div>
              <h4 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--success)' }}>البيانات المالية</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>المبيعات (السعر)</label>
                  <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} required placeholder="0.00" />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>المشتريات (التكلفة)</label>
                  <input type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>المبلغ الواصل من الزبون (اختياري)</label>
                  <input type="number" step="0.01" min="0" max={price || undefined} value={costPaid} onChange={e => setCostPaid(e.target.value)} placeholder={price ? `الحد الأقصى: ${price}` : "0.00"} />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>المبلغ المتبقي</label>
                  <input type="text" readOnly value={Math.max(0, (parseFloat(price || '0') - parseFloat(costPaid || '0'))).toFixed(2)} style={{ background: 'var(--bg)', color: 'var(--text-main)', opacity: 0.8 }} />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>حالة الدفع</label>
                  <select value={
                     (parseFloat(costPaid || '0') >= parseFloat(price || '0') && price !== '') ? 'cash' :
                     parseFloat(costPaid || '0') > 0 ? 'partial' : 'debt'
                  } onChange={e => {
                     if (e.target.value === 'cash') {
                       setCostPaid(price);
                     } else if (e.target.value === 'debt') {
                       setCostPaid('');
                     }
                  }} style={{ fontWeight: 'bold' }}>
                    <option value="cash">نقدي (مدفوع بالكامل) 💵</option>
                    <option value="partial">مدفوع جزئياً 🪙</option>
                    <option value="debt">دين (آجل) ⏳</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>حالة الجهاز</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} required style={{ fontWeight: 'bold', color: status === 'under_maintenance' ? 'var(--warning)' : status === 'completed' ? '#3b82f6' : status === 'delivered' ? 'var(--success)' : 'var(--danger)' }}>
                    <option value="under_maintenance">تحت الصيانة 🛠️</option>
                    <option value="completed">مكتمل 🔵</option>
                    <option value="delivered">تم تسليمه ✅</option>
                    <option value="cancelled">ملغى ❌</option>
                  </select>
                </div>
              </div>

              {/* Warning if paid more than price */}
              {parseFloat(costPaid || '0') > parseFloat(price || '0') && (
                <div style={{ marginTop: '0.5rem', color: 'var(--warning)', fontSize: '0.9rem' }}>
                  ⚠️ تنبيه: المبلغ الواصل يتجاوز سعر الصيانة المدخل.
                </div>
              )}
            </div>

            {/* تفاصيل إضافية */}
            <div>
              <h4 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--info)' }}>تفاصيل إضافية</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>اللحقات المستلمة</label>
                  <input type="text" value={accessories} onChange={e => setAccessories(e.target.value)} placeholder="مثال: جهاز + شاحن" />
                </div>
                <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label>ملاحظات</label>
                  <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات إضافية عن حالة الجهاز..."></textarea>
                </div>
              </div>
            </div>

            {/* الضمان */}
            <div>
              <h4 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={warrantyEnabled} onChange={e => setWarrantyEnabled(e.target.checked)} id="warrantyCheckbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <label htmlFor="warrantyCheckbox" style={{ cursor: 'pointer', margin: 0 }}>تفعيل الضمان</label>
              </h4>

              {warrantyEnabled && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>مدة الضمان (بالأيام)</label>
                    <input type="number" min="1" required={warrantyEnabled} value={warrantyDays} onChange={e => setWarrantyDays(e.target.value)} placeholder="30" />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>تاريخ انتهاء الضمان المتوقع</label>
                    <input type="text" readOnly value={
                      warrantyDays ? (() => {
                        const d = new Date();
                        d.setDate(d.getDate() + parseInt(warrantyDays));
                        return d.toLocaleDateString('en-GB');
                      })() : '-'
                    } style={{ background: 'var(--bg)', color: 'var(--text-main)', opacity: 0.8 }} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                    <label>ملاحظة الضمان</label>
                    <textarea rows={2} value={warrantyNote} onChange={e => setWarrantyNote(e.target.value)} placeholder="مثال: الضمان يشمل الشاشة فقط..."></textarea>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }} disabled={technicians.length === 0}>
                إضافة العملية
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* شريط الفلاتر */}
          <div className="card dashboard-card slide-up" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🔍</span> فلاتر البحث والفرز
              </h4>
              <button className="btn btn-secondary" onClick={() => {
                setSearchTerm('');
                setPaymentFilter('all');
                setStatusFilter('all');
                setWarrantyFilter('all');
                setDateFrom('');
                setDateTo('');
              }}>إعادة ضبط الفلاتر</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>بحث نصي (رقم، اسم، هاتف، جهاز)</label>
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="اكتب للبحث..." />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>حالة الدفع</label>
                <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value as any)}>
                  <option value="all">الكل</option>
                  <option value="cash">نقدي (تم الدفع)</option>
                  <option value="partial">مدفوع جزئياً</option>
                  <option value="debt">دين (آجل)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>حالة الجهاز</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                  <option value="all">الكل</option>
                  <option value="not_delivered">غير مسلّمة (تحت الصيانة/مكتمل)</option>
                  <option value="under_maintenance">تحت الصيانة فقط</option>
                  <option value="completed">مكتمل فقط</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">ملغى</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>الضمان</label>
                <select value={warrantyFilter} onChange={e => setWarrantyFilter(e.target.value as any)}>
                  <option value="all">الكل</option>
                  <option value="active">ضمان فعال فقط</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0, display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label>من تاريخ</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label>إلى تاريخ</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>رقم</th>
                  <th>التاريخ</th>
                  <th>اسم الزبون</th>
                  <th>رقم الهاتف</th>
                  <th>الجهاز/العطل</th>
                  <th>المبيعات</th>
                  <th>التكلفة</th>
                  <th>ربح الفني</th>
                  <th>ربح المحل</th>
                  <th style={{ textAlign: 'center' }}>الدفع</th>
                  <th style={{ textAlign: 'center' }}>حالة الجهاز</th>
                  <th style={{ textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOperations.map(op => (
                  <tr key={op.id}>
                    <td><span className="tag">#{op.id}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{op.date}</td>
                    <td style={{ fontWeight: 500 }}>{op.customer_name || '-'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {op.customer_phone || '-'}
                        {op.customer_phone && (
                          <button
                            className="btn btn-icon"
                            style={{ padding: '4px', color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', border: 'none' }}
                            onClick={() => sendWhatsApp(op)}
                            title="مراسلة عبر واتساب"
                          >
                            <MessageCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      <div>{op.device || '-'}</div>
                      {(() => {
                        let dispFaults: string[] = [];
                        if (Array.isArray(op.faults)) dispFaults = op.faults;
                        else if (typeof op.faults === 'string') dispFaults = [op.faults];
                        else if (typeof (op as any).fault === 'string') dispFaults = [(op as any).fault];

                        return dispFaults.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {dispFaults.map((f, i) => (
                              <span key={i} style={{ fontSize: '0.75rem', background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>{f}</span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td style={{ fontWeight: 600 }}>{op.price ? op.price.toFixed(2) : '0.00'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{op.cost ? op.cost.toFixed(2) : '0.00'}</td>
                    <td style={{ color: 'var(--primary)' }}>{op.tech_profit.toFixed(2)}</td>
                    <td style={{ color: 'var(--success)' }}>{op.shop_profit.toFixed(2)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {(() => {
                        const ps = op.payment_status;
                        if (ps === 'cash') return <StatusBadge status="مسدد" />;
                        if (ps === 'partial') return <span className="badge badge-warning">جزئي</span>;
                        return <StatusBadge status="دين" />;
                      })()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {op.status === 'under_maintenance' ? (
                        <StatusBadge status="قيد الصيانة" />
                      ) : op.status === 'completed' ? (
                        <StatusBadge status="مكتمل" />
                      ) : (
                        <StatusBadge status="تم التسليم" />
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {op.status === 'under_maintenance' && (
                          <button
                            className="btn btn-icon"
                            style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}
                            onClick={async () => {
                              const res = await (window as any).api.editOperation(op.id, { ...op, status: 'completed' });
                              if (res && res.success === false) {
                                await dialog.error(res.reason || 'فشل الحفظ');
                                return;
                              }
                              loadData();

                              if (op.customer_phone) {
                                const confirmed = await dialog.confirm('تم تحديث الحالة إلى مكتمل. هل تود إرسال رسالة واتساب للزبون لإبلاغه بجاهزية الجهاز؟', 'تأكيد المراسلة');
                                if (confirmed) {
                                  sendWhatsApp(op);
                                }
                              } else {
                                setToastMessage('تم تحديث الحالة إلى مكتمل');
                                setTimeout(() => setToastMessage(null), 3000);
                              }
                            }}
                            title="تأشير كمكتمل"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                        {op.status === 'completed' && (
                          <button
                            className="btn btn-icon"
                            style={{ color: 'var(--success)', background: 'var(--success-bg)' }}
                            onClick={async () => {
                              const res = await (window as any).api.editOperation(op.id, { ...op, status: 'delivered', paid_amount: op.price });
                              if (res && res.success === false) {
                                await dialog.error(res.reason || 'فشل الحفظ');
                                return;
                              }
                              loadData();
                              setToastMessage('تم تسليم الجهاز واحتساب الأرباح بنجاح');
                              setTimeout(() => setToastMessage(null), 3000);
                            }}
                            title="تأشير كتم التسليم"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                        <button className="btn btn-icon" onClick={() => setViewingOp(op)} title="عرض التفاصيل">
                          <Eye size={18} />
                        </button>
                        <button className="btn btn-icon" onClick={() => handleEditClick(op)} title="تعديل">
                          <Edit size={18} />
                        </button>
                        <button
                          className="btn btn-icon danger"
                          onClick={async () => {
                            const confirmed = await dialog.confirm('هل أنت متأكد من حذف هذه العملية؟', 'تأكيد الحذف', true);
                            if (confirmed) {
                              const res = await (window as any).api.deleteOperation(op.id);
                              if (res && res.success === false) {
                                await dialog.error(res.reason || 'فشل الحذف');
                              } else {
                                loadData();
                                setToastMessage('تم حذف العملية بنجاح');
                                setTimeout(() => setToastMessage(null), 3000);
                              }
                            }
                          }}
                          title="حذف"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {operations.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ padding: 0 }}>
                      <div className="empty-state">
                        <CheckCircle2 className="empty-state-icon" />
                        <div className="empty-state-title">لا توجد عمليات مسجلة حتى الآن</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {operations.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem 0', gap: '1rem', marginTop: '1rem' }}>
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
        </>
      )}

      {editingOp && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PenTool size={20} /> تعديل العملية رقم #{editingOp.id}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* بيانات الزبون والجهاز */}
              <div>
                <h4 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>بيانات الصيانة</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>الفني (غير قابل للتعديل)</label>
                    <select value={editTechId} disabled required style={{ opacity: 0.7, cursor: 'not-allowed' }}>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>العميل</label>
                    <input type="text" list="customers-list" value={editCustomerName} onChange={e => {
                      setEditCustomerName(e.target.value);
                      const found = customers.find(c => c.name === e.target.value || c.phone === e.target.value);
                      if (found) {
                        setEditCustomerId(found.id);
                        setEditCustomerName(found.name);
                        setEditCustomerPhone(found.phone);
                      } else {
                        setEditCustomerId('');
                      }
                    }} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>رقم الهاتف (اختياري)</label>
                    <input type="tel" value={editCustomerPhone} onChange={e => setEditCustomerPhone(e.target.value)} disabled={editCustomerId !== ''} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>اسم الجهاز</label>
                    <input type="text" list="quick-devices" value={editDeviceName} onChange={e => setEditDeviceName(e.target.value)} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>كود الجهاز (اختياري)</label>
                    <input type="text" value={editDeviceCode} onChange={e => setEditDeviceCode(e.target.value)} placeholder="IMEI / Serial" />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                    <label style={{ color: 'var(--text-main)' }}>الأعطال</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        list="quick-faults"
                        value={editFaultType}
                        onChange={e => setEditFaultType(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (editFaultType.trim() && !editFaults.includes(editFaultType.trim())) {
                              setEditFaults([...editFaults, editFaultType.trim()]);
                              setEditFaultType('');
                            }
                          }
                        }}
                        placeholder="اضغط Enter للإضافة"
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          if (editFaultType.trim() && !editFaults.includes(editFaultType.trim())) {
                            setEditFaults([...editFaults, editFaultType.trim()]);
                            setEditFaultType('');
                          }
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {editFaults.map((f, i) => (
                        <span key={i} className="badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                          {f}
                          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 4px', fontSize: '1.2rem', lineHeight: 1 }} onClick={() => setEditFaults(editFaults.filter(x => x !== f))}>&times;</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* البيانات المالية */}
              <div>
                <h4 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--success)' }}>البيانات المالية</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>السعر</label>
                    <input type="number" step="0.01" min="0" value={editPrice} onChange={e => setEditPrice(e.target.value)} required />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>التكلفة</label>
                    <input type="number" step="0.01" min="0" value={editCost} onChange={e => setEditCost(e.target.value)} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>المبلغ الواصل من الزبون (اختياري)</label>
                    <input type="number" step="0.01" min="0" max={editPrice || undefined} value={editCostPaid} onChange={e => setEditCostPaid(e.target.value)} placeholder={editPrice ? `الحد الأقصى: ${editPrice}` : "0.00"} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>المبلغ المتبقي</label>
                    <input type="text" readOnly value={Math.max(0, (parseFloat(editPrice || '0') - parseFloat(editCostPaid || '0'))).toFixed(2)} style={{ background: 'var(--bg)', color: 'var(--text-main)', opacity: 0.8 }} />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>حالة الدفع</label>
                    <select value={
                       (parseFloat(editCostPaid || '0') >= parseFloat(editPrice || '0') && editPrice !== '') ? 'cash' :
                       parseFloat(editCostPaid || '0') > 0 ? 'partial' : 'debt'
                    } onChange={e => {
                       if (e.target.value === 'cash') {
                         setEditCostPaid(editPrice);
                       } else if (e.target.value === 'debt') {
                         setEditCostPaid('');
                       }
                    }} style={{ fontWeight: 'bold' }}>
                      <option value="cash">نقدي (مدفوع بالكامل) 💵</option>
                      <option value="partial">مدفوع جزئياً 🪙</option>
                      <option value="debt">دين (آجل) ⏳</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>حالة الجهاز</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value as any)} required style={{ fontWeight: 'bold', color: editStatus === 'under_maintenance' ? 'var(--warning)' : editStatus === 'completed' ? '#3b82f6' : editStatus === 'delivered' ? 'var(--success)' : 'var(--danger)' }}>
                      <option value="under_maintenance">تحت الصيانة 🛠️</option>
                      <option value="completed">مكتمل 🔵</option>
                      <option value="delivered">تم تسليمه ✅</option>
                      <option value="cancelled">ملغى ❌</option>
                    </select>
                  </div>
                </div>

                {parseFloat(editCostPaid || '0') > parseFloat(editPrice || '0') && (
                  <div style={{ marginTop: '0.5rem', color: 'var(--warning)', fontSize: '0.9rem' }}>
                    ⚠️ تنبيه: المبلغ الواصل يتجاوز السعر المدخل.
                  </div>
                )}
              </div>

              {/* تفاصيل إضافية */}
              <div>
                <h4 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--info)' }}>تفاصيل إضافية</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: 'var(--text-main)' }}>اللحقات المستلمة</label>
                    <input type="text" value={editAccessories} onChange={e => setEditAccessories(e.target.value)} placeholder="مثال: جهاز + شاحن" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                    <label style={{ color: 'var(--text-main)' }}>ملاحظات</label>
                    <textarea rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="ملاحظات إضافية عن حالة الجهاز..."></textarea>
                  </div>
                </div>
              </div>

              {/* الضمان */}
              <div>
                <h4 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={editWarrantyEnabled} onChange={e => setEditWarrantyEnabled(e.target.checked)} id="editWarrantyCheckbox" style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <label htmlFor="editWarrantyCheckbox" style={{ cursor: 'pointer', margin: 0, color: 'var(--text-main)' }}>تفعيل الضمان</label>
                </h4>

                {editWarrantyEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: 'var(--text-main)' }}>مدة الضمان (بالأيام)</label>
                      <input type="number" min="1" required={editWarrantyEnabled} value={editWarrantyDays} onChange={e => setEditWarrantyDays(e.target.value)} placeholder="30" />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: 'var(--text-main)' }}>تاريخ انتهاء الضمان المتوقع</label>
                      <input type="text" readOnly value={
                        editWarrantyDays ? (() => {
                          const [day, month, year] = editingOp.date.split('/');
                          const d = new Date(Number(year), Number(month) - 1, Number(day));
                          d.setDate(d.getDate() + parseInt(editWarrantyDays));
                          return d.toLocaleDateString('en-GB');
                        })() : '-'
                      } style={{ background: 'var(--bg)', color: 'var(--text-main)', opacity: 0.8 }} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                      <label style={{ color: 'var(--text-main)' }}>ملاحظة الضمان</label>
                      <textarea rows={2} value={editWarrantyNote} onChange={e => setEditWarrantyNote(e.target.value)} placeholder="مثال: الضمان يشمل الشاشة فقط..."></textarea>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setEditingOp(null)}>إلغاء التعديل</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit}>حفظ التعديلات</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingOp && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setViewingOp(null); }}>
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={20} /> تفاصيل العملية رقم #{viewingOp.id}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {/* بيانات أساسية */}
              <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>بيانات أساسية</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>التاريخ:</span> <b>{viewingOp.date}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>الفني:</span> <b>{technicians.find(t => t.id === viewingOp.technician_id)?.name || '-'}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>اسم الزبون:</span> <b>{viewingOp.customer_name || '-'}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>رقم الهاتف:</span> <b>{viewingOp.customer_phone || '-'}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>اسم الجهاز:</span> <b>{viewingOp.device || '-'}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>كود الجهاز:</span> <b>{viewingOp.device_code || '-'}</b></div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>الأعطال:</span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {(Array.isArray(viewingOp.faults) ? viewingOp.faults : (typeof viewingOp.faults === 'string' ? [viewingOp.faults] : [])).map((f, i) => (
                        <span key={i} className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem' }}>{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* بيانات مالية */}
              <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--success)' }}>بيانات مالية</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>السعر:</span> <b>{viewingOp.price ? viewingOp.price.toFixed(2) : '0.00'}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>التكلفة:</span> <b>{viewingOp.cost ? viewingOp.cost.toFixed(2) : '0.00'}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>الواصل من التكلفة:</span> <b>{viewingOp.cost_paid !== undefined ? viewingOp.cost_paid.toFixed(2) : '-'}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>المتبقي من التكلفة:</span> <b>{Math.max(0, (viewingOp.cost || 0) - (viewingOp.cost_paid || 0)).toFixed(2)}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>ربح الفني:</span> <b>{viewingOp.tech_profit.toFixed(2)}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>ربح المحل:</span> <b style={{ color: 'var(--success)' }}>{viewingOp.shop_profit.toFixed(2)}</b></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>حالة الدفع:</span> {viewingOp.payment_status === 'debt' ? <StatusBadge status="دين" /> : <StatusBadge status="مسدد" />}</div>
                  <div><span style={{ color: 'var(--text-muted)' }}>حالة الجهاز:</span> {viewingOp.status === 'under_maintenance' ? <StatusBadge status="قيد الصيانة" /> : viewingOp.status === 'completed' ? <StatusBadge status="مكتمل" /> : <StatusBadge status="تم التسليم" />}</div>
                </div>
              </div>

              {/* تفاصيل إضافية */}
              <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', gridColumn: '1 / -1' }}>
                <h4 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--info)' }}>تفاصيل إضافية</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>اللحقات المستلمة:</span>
                    <div style={{ padding: '8px', background: 'var(--bg)', borderRadius: '4px', minHeight: '38px' }}>{viewingOp.accessories || '-'}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>الملاحظات:</span>
                    <div style={{ padding: '8px', background: 'var(--bg)', borderRadius: '4px', minHeight: '38px', whiteSpace: 'pre-wrap' }}>{viewingOp.notes || '-'}</div>
                  </div>
                </div>
              </div>

              {/* الضمان */}
              <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: 'var(--radius-md)', gridColumn: '1 / -1' }}>
                <h4 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--warning)' }}>بيانات الضمان</h4>
                {viewingOp.warranty_enabled ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>مدة الضمان:</span>
                      <div style={{ padding: '8px', background: 'var(--bg)', borderRadius: '4px' }}>{viewingOp.warranty_days} يوم</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>تاريخ انتهاء الضمان:</span>
                      <div style={{ padding: '8px', background: 'var(--bg)', borderRadius: '4px' }}>{
                        (() => {
                          const [day, month, year] = viewingOp.date.split('/');
                          const d = new Date(Number(year), Number(month) - 1, Number(day));
                          d.setDate(d.getDate() + (viewingOp.warranty_days || 0));
                          return d.toLocaleDateString('en-GB');
                        })()
                      }</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ملاحظات الضمان:</span>
                      <div style={{ padding: '8px', background: 'var(--bg)', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>{viewingOp.warranty_note || '-'}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>لا يوجد ضمان لهذه العملية</div>
                )}
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={() => setViewingOp(null)} style={{ minWidth: '150px' }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
