import React, { useEffect, useState } from "react";
import * as xlsx from 'xlsx';
import { Edit, Trash2, PlusCircle, PenTool, CheckCircle2, ChevronRight, ChevronLeft, MessageCircle } from "lucide-react";
import type { Operation, Technician } from "../types";
import { useDialog } from "./ui/DialogProvider";

export default function Operations() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  // Quick Lists
  const [quickDevices, setQuickDevices] = useState<string[]>([]);
  const [quickFaults, setQuickFaults] = useState<string[]>([]);

  const [settings, setSettings] = useState<any>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Form state
  const [techId, setTechId] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  const [deviceName, setDeviceName] = useState<string>('');
  const [faultType, setFaultType] = useState<string>('');
  const [faults, setFaults] = useState<string[]>([]);

  const [price, setPrice] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'cash' | 'debt'>('cash');
  const [status, setStatus] = useState<'under_maintenance' | 'completed' | 'delivered'>('under_maintenance');

  // Edit state
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [editTechId, setEditTechId] = useState<number | ''>('');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>('');

  const [editDeviceName, setEditDeviceName] = useState<string>('');
  const [editFaultType, setEditFaultType] = useState<string>('');
  const [editFaults, setEditFaults] = useState<string[]>([]);

  const [editPrice, setEditPrice] = useState<string>('');
  const [editCost, setEditCost] = useState<string>('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'cash' | 'debt'>('cash');
  const [editStatus, setEditStatus] = useState<'under_maintenance' | 'completed' | 'delivered'>('under_maintenance');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dialog = useDialog();

  const loadData = async () => {
    const ops = await (window as any).api.getOperations();
    const techs = await (window as any).api.getTechnicians();
    const qLists = await (window as any).api.getQuickLists();
    const sets = await (window as any).api.getSettings();
    setOperations(ops);
    setTechnicians(techs);
    setQuickDevices(qLists.devices || []);
    setQuickFaults(qLists.faults || []);
    setSettings(sets);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techId || !price) return;

    const selectedTech = technicians.find(t => t.id === Number(techId));
    if (!selectedTech) return;

    const s = parseFloat(price);
    const p = parseFloat(cost || '0');

    const executeSubmit = async () => {
      const net_profit = s - p;
      const tech_profit = Number((net_profit * selectedTech.profit_percentage).toFixed(2));
      const shop_profit = Number((net_profit - tech_profit).toFixed(2));

      let finalFaults = [...faults];
      if (faultType.trim() && !finalFaults.includes(faultType.trim())) {
        finalFaults.push(faultType.trim());
      }

      const res = await (window as any).api.addOperation({
        technician_id: Number(techId),
        customer_name: customerName,
        customer_phone: customerPhone,
        device: deviceName.trim(),
        faults: finalFaults,
        price: s,
        cost: p,
        shop_profit,
        tech_profit,
        payment_status: paymentStatus,
        status: status
      });
      if (res && res.success === false) {
        await dialog.error(res.reason || 'فشل الحفظ');
        return;
      }

      setDeviceName('');
      setFaultType('');
      setFaults([]);
      setPrice('');
      setCost('');
      setCustomerName('');
      setCustomerPhone('');
      setStatus('under_maintenance');
      setPaymentStatus('cash');
      loadData();
      setToastMessage('تم تسجيل العملية بنجاح');
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
      setEditFaultType('');
      setEditFaults(fList);
      setEditPrice(op.price ? String(op.price) : '0');
      setEditCost(op.cost ? String(op.cost) : (typeof (op as any).spare_parts_cost === 'number' ? String((op as any).spare_parts_cost) : '0'));
      setEditPaymentStatus(op.payment_status || 'cash');
      
      let initialStatus = op.status;
      if (!initialStatus) {
        initialStatus = 'completed'; 
      }
      setEditStatus(initialStatus);
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

    const executeEdit = async () => {
      const net_profit = s - p;
      const tech_profit = Number((net_profit * selectedTech.profit_percentage).toFixed(2));
      const shop_profit = Number((net_profit - tech_profit).toFixed(2));

      let finalEditFaults = [...editFaults];
      if (editFaultType.trim() && !finalEditFaults.includes(editFaultType.trim())) {
        finalEditFaults.push(editFaultType.trim());
      }

      const res = await (window as any).api.editOperation(editingOp.id, {
        technician_id: Number(editTechId),
        customer_name: editCustomerName,
        customer_phone: editCustomerPhone,
        device: editDeviceName.trim(),
        faults: finalEditFaults,
        price: s,
        cost: p,
        shop_profit,
        tech_profit,
        payment_status: editPaymentStatus,
        status: editStatus
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

    try {
      dialog.loading('جاري استيراد العمليات...');
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      const res = await (window as any).api.importOperationsExcelData(data);
      if (res.success) {
        await dialog.success(`تم استيراد ${res.added} سجلات بنجاح، وتم تجاهل ${res.ignored} سجلات مكررة.`);
        loadData();
      } else {
        await dialog.error('حدث خطأ أثناء الاستيراد: ' + res.message);
      }
    } catch (err: any) {
      await dialog.error('حدث خطأ في قراءة الملف: ' + err.message);
    }
    e.target.value = '';
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
شكراً لاختيارك [اسم_المحل]!`;

    text = text.replace(/\[اسم_الزبون\]/g, op.customer_name || 'عميلنا العزيز');
    text = text.replace(/\[اسم_الجهاز\]/g, op.device || '-');
    
    const faultsText = op.faults && op.faults.length > 0 ? op.faults.join('، ') : 'غير محدد';
    text = text.replace(/\[المشكلة\]/g, faultsText);
    
    text = text.replace(/\[المبلغ\]/g, op.price ? op.price.toString() : '0');
    text = text.replace(/\[اسم_المحل\]/g, settings?.shop_name || 'مركز الصيانة');

    const encodedMessage = encodeURIComponent(text);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(url, '_blank');
  };

  const totalPages = Math.ceil(operations.length / itemsPerPage) || 1;
  const paginatedOperations = operations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="fade-in">
      <div className="header-flex">
        <h2 className="page-title">
          العمليات والصيانة
        </h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label className="btn" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success-bg)', cursor: 'pointer', margin: 0 }}>
            استيراد من إكسل
            <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="stat-card" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
          <PlusCircle size={20} color="var(--primary)" /> إضافة عملية جديدة
        </h3>

        {/* Datalists for quick lists */}
        <datalist id="quick-devices">
          {quickDevices.map((d, idx) => <option key={idx} value={d} />)}
        </datalist>
        <datalist id="quick-faults">
          {quickFaults.map((f, idx) => <option key={idx} value={f} />)}
        </datalist>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
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
            <label>اسم الزبون</label>
            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="مثال: أحمد مصطفى" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>رقم الهاتف (اختياري)</label>
            <input type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="مثال: 01012345678" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>اسم الجهاز</label>
            <input type="text" list="quick-devices" value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="مثال: iPhone 13" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>المبيعات (السعر)</label>
            <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} required placeholder="0.00" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>المشتريات (التكلفة)</label>
            <input type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>حالة الجهاز</label>
            <select value={status} onChange={e => setStatus(e.target.value as 'under_maintenance' | 'completed' | 'delivered')} required style={{ fontWeight: 'bold', color: status === 'under_maintenance' ? 'var(--warning)' : status === 'completed' ? '#3b82f6' : 'var(--success)' }}>
              <option value="under_maintenance">تحت الصيانة 🛠️</option>
              <option value="completed">مكتمل 🔵</option>
              <option value="delivered">تم تسليمه ✅</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>حالة الدفع</label>
            <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'cash' | 'debt')} required>
              <option value="cash">نقدي (تم الدفع)</option>
              <option value="debt">دين (آجل)</option>
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            {technicians.length === 0 ? (
              <div style={{ padding: '1rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: '8px', textAlign: 'center', marginBottom: '1rem' }}>
                ⚠️ لا يمكنك تسجيل عملية صيانة قبل إضافة "فني" واحد على الأقل من صفحة الإعدادات.
              </div>
            ) : null}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '48px' }} disabled={technicians.length === 0}>
              حفظ العملية
            </button>
          </div>
        </form>
      </div>

      {editingOp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="stat-card fade-in" style={{ padding: '2rem', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--primary)', background: 'var(--primary-light)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PenTool size={20} /> تعديل العملية رقم #{editingOp.id}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: 'var(--text-main)' }}>الفني</label>
              <select value={editTechId} onChange={e => setEditTechId(Number(e.target.value))} required>
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: 'var(--text-main)' }}>اسم الزبون</label>
              <input type="text" value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: 'var(--text-main)' }}>رقم الهاتف (اختياري)</label>
              <input type="tel" value={editCustomerPhone} onChange={e => setEditCustomerPhone(e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: 'var(--text-main)' }}>اسم الجهاز</label>
              <input type="text" list="quick-devices" value={editDeviceName} onChange={e => setEditDeviceName(e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: 'var(--text-main)' }}>السعر</label>
              <input type="number" step="0.01" min="0" value={editPrice} onChange={e => setEditPrice(e.target.value)} required />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: 'var(--text-main)' }}>التكلفة</label>
              <input type="number" step="0.01" min="0" value={editCost} onChange={e => setEditCost(e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: 'var(--text-main)' }}>حالة الجهاز</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value as 'under_maintenance' | 'completed' | 'delivered')} required style={{ fontWeight: 'bold', color: editStatus === 'under_maintenance' ? 'var(--warning)' : editStatus === 'completed' ? '#3b82f6' : 'var(--success)' }}>
                <option value="under_maintenance">تحت الصيانة 🛠️</option>
                <option value="completed">مكتمل 🔵</option>
                <option value="delivered">تم تسليمه ✅</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ color: 'var(--text-main)' }}>حالة الدفع</label>
              <select value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value as 'cash' | 'debt')} required>
                <option value="cash">نقدي</option>
                <option value="debt">دين (آجل)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', gridColumn: '1 / -1', marginTop: '1rem' }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setEditingOp(null)}>إلغاء التعديل</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit}>حفظ التعديلات</button>
            </div>
          </div>
        </div>
        </div>
      )}

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
                  {op.payment_status === 'debt' ? (
                    <span className="badge badge-debt">دين (آجل)</span>
                  ) : (
                    <span className="badge badge-cash">نقدي</span>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {op.status === 'under_maintenance' ? (
                    <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', borderColor: 'var(--warning)' }}>تحت الصيانة</span>
                  ) : op.status === 'completed' ? (
                    <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderColor: '#3b82f6' }}>مكتمل</span>
                  ) : (
                    <span className="badge" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success)' }}>تم تسليمه</span>
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
                          const res = await (window as any).api.editOperation(op.id, { ...op, status: 'delivered' });
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
                <td colSpan={11} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <div>لا توجد عمليات مسجلة حتى الآن</div>
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
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--success)', color: '#fff', padding: '1rem 2rem', borderRadius: '8px', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontWeight: 'bold' }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
