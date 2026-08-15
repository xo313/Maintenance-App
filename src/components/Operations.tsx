import { useEffect, useState } from "react";
import { Edit, Trash2, PlusCircle, PenTool, CheckCircle2, ChevronRight, ChevronLeft, MessageCircle } from "lucide-react";
import type { Operation, Technician } from "../types";

export default function Operations() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  // Quick Lists
  const [quickDevices, setQuickDevices] = useState<string[]>([]);
  const [quickFaults, setQuickFaults] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Form state
  const [techId, setTechId] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  const [deviceName, setDeviceName] = useState<string>('');
  const [faultType, setFaultType] = useState<string>('');

  const [price, setPrice] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'cash' | 'debt'>('cash');

  // Edit state
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [editTechId, setEditTechId] = useState<number | ''>('');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>('');

  const [editDeviceName, setEditDeviceName] = useState<string>('');
  const [editFaultType, setEditFaultType] = useState<string>('');

  const [editPrice, setEditPrice] = useState<string>('');
  const [editCost, setEditCost] = useState<string>('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'cash' | 'debt'>('cash');

  const loadData = async () => {
    const ops = await (window as any).api.getOperations();
    const techs = await (window as any).api.getTechnicians();
    const qLists = await (window as any).api.getQuickLists();
    setOperations(ops);
    setTechnicians(techs);
    setQuickDevices(qLists.devices || []);
    setQuickFaults(qLists.faults || []);
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

    if (p > s) {
      if (!confirm('تنبيه: التكلفة (المشتريات) أعلى من المبيعات! هل أنت متأكد من تسجيل العملية بخسارة؟')) {
        return;
      }
    }

    const net_profit = s - p;
    const tech_profit = Number((net_profit * selectedTech.profit_percentage).toFixed(2));
    const shop_profit = Number((net_profit - tech_profit).toFixed(2));

    const combinedDevice = [deviceName.trim(), faultType.trim()].filter(Boolean).join(' - ');

    await (window as any).api.addOperation({
      technician_id: Number(techId),
      customer_name: customerName,
      customer_phone: customerPhone,
      device: combinedDevice,
      price: s,
      cost: p,
      shop_profit,
      tech_profit,
      payment_status: paymentStatus
    });

    setCustomerName('');
    setCustomerPhone('');
    setDeviceName('');
    setFaultType('');
    setPrice('');
    setCost('');
    setPaymentStatus('cash');
    loadData();
  };

  const handleEditClick = (op: Operation) => {
    setEditingOp(op);
    setEditTechId(op.technician_id);
    setEditCustomerName(op.customer_name || '');
    setEditCustomerPhone(op.customer_phone || '');

    // Split combined device into device and fault if possible
    let dName = op.device || '';
    let fType = '';
    if (dName.includes(' - ')) {
      const parts = dName.split(' - ');
      dName = parts[0];
      fType = parts.slice(1).join(' - ');
    }

    setEditDeviceName(dName);
    setEditFaultType(fType);

    setEditPrice(op.price ? op.price.toString() : '0');
    setEditCost(op.cost ? op.cost.toString() : '0');
    setEditPaymentStatus(op.payment_status);
  };

  const handleSaveEdit = async () => {
    if (!editingOp || !editTechId || !editPrice) return;

    const selectedTech = technicians.find(t => t.id === Number(editTechId));
    if (!selectedTech) return;

    const s = parseFloat(editPrice);
    const p = parseFloat(editCost || '0');

    if (p > s) {
      if (!confirm('تنبيه: التكلفة (المشتريات) أعلى من المبيعات! هل أنت متأكد من حفظ العملية بخسارة؟')) {
        return;
      }
    }

    const net_profit = s - p;
    const tech_profit = Number((net_profit * selectedTech.profit_percentage).toFixed(2));
    const shop_profit = Number((net_profit - tech_profit).toFixed(2));

    const combinedDevice = [editDeviceName.trim(), editFaultType.trim()].filter(Boolean).join(' - ');

    await (window as any).api.editOperation(editingOp.id, {
      technician_id: Number(editTechId),
      customer_name: editCustomerName,
      customer_phone: editCustomerPhone,
      device: combinedDevice,
      price: s,
      cost: p,
      shop_profit,
      tech_profit,
      payment_status: editPaymentStatus
    });

    setEditingOp(null);
    loadData();
  };

  const handleImportExcel = async () => {
    const res = await (window as any).api.importOperationsExcel();
    if (res.success) {
      alert(`تم استيراد ${res.added} سجلات بنجاح، وتم تجاهل ${res.ignored} سجلات مكررة.`);
      loadData();
    } else if (res.reason !== 'cancelled') {
      alert('حدث خطأ أثناء الاستيراد: ' + res.message);
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

  const sendWhatsApp = (op: Operation) => {
    const formattedPhone = formatPhoneNumber(op.customer_phone || '');
    if (!formattedPhone) {
      alert('لا يوجد رقم هاتف صالح لإرسال الرسالة.');
      return;
    }

    const text = `السلام عليكم ${op.customer_name || 'عميلنا العزيز'}
نود إعلامك بأن جهازك (${op.device || '-'}) قد تمت صيانته بنجاح وهو جاهز للاستلام الآن.
تكلفة الصيانة : ${op.price || 0}
نسعد بزيارتك لاستلامه في أقرب وقت. شكراً لثقتك بـ مركز Google!`;

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
          <button className="btn" onClick={handleImportExcel} style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'var(--success-bg)' }}>
            استيراد من إكسل
          </button>
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
            <label>نوع العطل</label>
            <select value={faultType} onChange={e => setFaultType(e.target.value)} required>
              <option value="" disabled>اختر العطل...</option>
              {quickFaults.map((f, idx) => (
                <option key={idx} value={f}>{f}</option>
              ))}
            </select>
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
        <div className="stat-card fade-in" style={{ padding: '2rem', marginBottom: '2.5rem', border: '1px solid var(--primary)', background: 'var(--primary-light)' }}>
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
              <label style={{ color: 'var(--text-main)' }}>نوع العطل</label>
              <select value={editFaultType} onChange={e => setEditFaultType(e.target.value)} required>
                <option value="" disabled>اختر العطل...</option>
                {quickFaults.map((f, idx) => (
                  <option key={idx} value={f}>{f}</option>
                ))}
              </select>
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
                <td style={{ color: 'var(--text-muted)' }}>{op.device || '-'}</td>
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
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button className="btn btn-icon" onClick={() => handleEditClick(op)} title="تعديل">
                      <Edit size={18} />
                    </button>
                    <button
                      className="btn btn-icon danger"
                      onClick={async () => {
                        if (confirm('هل أنت متأكد من حذف هذه العملية؟')) {
                          const res = await (window as any).api.deleteOperation(op.id);
                          if (!res) {
                            alert('لا يمكن حذف عملية من شهر تم تقفيله مسبقاً لحماية السجلات.');
                          }
                          loadData();
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
    </div>
  );
}
