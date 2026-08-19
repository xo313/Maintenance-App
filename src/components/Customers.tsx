import React, { useEffect, useState } from "react";
import { Users, Search, Edit, Trash2, PlusCircle, Eye, Phone, X, Clock } from "lucide-react";
import type { Customer, Operation } from "../types";
import { useDialog } from "./ui/DialogProvider";
import { StatusBadge } from "./ui/Badge";

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [customerOperations, setCustomerOperations] = useState<Operation[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dialog = useDialog();

  const loadData = async () => {
    try {
      const data = await (window as any).api.getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[Customers] loadData failed:', err);
      setCustomers([]);
    }
  };

  useEffect(() => { loadData(); }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    const res = await (window as any).api.addCustomer({ name: name.trim(), phone: phone.trim(), notes: notes.trim() });
    if (res.success) {
      showToast("✅ تمت إضافة العميل بنجاح");
      setIsAddingCustomer(false);
      resetForm();
      loadData();
    } else {
      showToast("❌ فشل إضافة العميل");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingCustomer || !name.trim() || !phone.trim()) return;
    const res = await (window as any).api.editCustomer(isEditingCustomer.id, { name: name.trim(), phone: phone.trim(), notes: notes.trim() });
    if (res.success) {
      showToast("✅ تم تحديث بيانات العميل");
      setIsEditingCustomer(null);
      resetForm();
      loadData();
    } else {
      showToast("❌ فشل تحديث البيانات");
    }
  };

  const handleDelete = async (id: number, customerName: string) => {
    const confirmed = await dialog.confirm(
      `هل أنت متأكد من رغبتك في حذف العميل "${customerName}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      "حذف العميل",
      true
    );
    if (confirmed) {
      const res = await (window as any).api.deleteCustomer(id);
      if (res.success) {
        showToast("✅ تم حذف العميل بنجاح");
        loadData();
      } else {
        showToast(res.reason || "❌ خطأ أثناء الحذف");
      }
    }
  };

  const handleViewCustomer = async (customer: Customer) => {
    setViewingCustomer(customer);
    // Virtual customers (id < 0) are from operations only — search by phone
    const searchId = customer.id > 0 ? customer.id : undefined;
    const ops = await (window as any).api.getCustomerOperations(searchId, customer.phone);
    setCustomerOperations(ops || []);
  };

  const resetForm = () => { setName(""); setPhone(""); setNotes(""); };

  const openAddModal = () => { resetForm(); setIsAddingCustomer(true); };
  const openEditModal = (customer: Customer) => {
    setIsEditingCustomer(customer);
    setName(customer.name);
    setPhone(customer.phone);
    setNotes(customer.notes || "");
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  // Generate avatar initials
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const avatarColors = [
    { bg: 'rgba(61, 142, 245, 0.15)', color: '#3d8ef5' },
    { bg: 'rgba(34, 211, 160, 0.15)', color: '#22d3a0' },
    { bg: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' },
    { bg: 'rgba(245, 158, 11, 0.15)',  color: '#f59e0b' },
    { bg: 'rgba(244, 63, 94, 0.15)',   color: '#f43f5e' },
    { bg: 'rgba(56, 189, 248, 0.15)',  color: '#38bdf8' },
  ];

  const getAvatarColor = (id: number) => avatarColors[Math.abs(id) % avatarColors.length];

  const getPaymentLabel = (status: string) => {
    if (status === 'cash') return <span className="badge badge-success">مدفوع</span>;
    if (status === 'partial') return <span className="badge badge-warning">جزئي</span>;
    return <span className="badge badge-danger">دين</span>;
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: '4px' }}>
            إدارة العملاء
          </h2>
          <p className="caption">
            {customers.length > 0 ? `${customers.length} عميل مسجّل` : 'لا يوجد عملاء مسجّلون بعد'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div className="search-bar" style={{ minWidth: '220px' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="ابحث بالاسم أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={openAddModal} id="add-customer-btn">
            <PlusCircle size={18} />
            <span>إضافة عميل</span>
          </button>
        </div>
      </div>

      {/* ── Customers Grid ── */}
      {filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={48} /></div>
          <div className="empty-state-title">
            {searchQuery ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء بعد'}
          </div>
          <p>{searchQuery ? 'جرب كلمة بحث مختلفة' : 'ابدأ بإضافة عميلك الأول'}</p>
        </div>
      ) : (
        <div className="grid-cards">
          {filteredCustomers.map(customer => {
            const av = getAvatarColor(customer.id);
            return (
              <div key={customer.id} className="entity-card">
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <div
                    className="entity-avatar"
                    style={{ background: av.bg, color: av.color, fontFamily: '"Outfit", monospace', fontSize: '1rem' }}
                  >
                    {getInitials(customer.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {customer.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <Phone size={13} />
                      <span dir="ltr">{customer.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {customer.notes && (
                  <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    lineHeight: 1.5,
                  }}>
                    {customer.notes}
                  </div>
                )}

                {/* Added date */}
                {customer.created_at && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                    <Clock size={12} />
                    <span>
                      {new Date(customer.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="entity-card-footer">
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => handleViewCustomer(customer)}
                  >
                    <Eye size={15} />
                    <span>العمليات</span>
                  </button>
                  {customer.id > 0 && (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => openEditModal(customer)}
                      >
                        <Edit size={15} />
                        <span>تعديل</span>
                      </button>
                      <button
                        className="btn btn-icon btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => handleDelete(customer.id, customer.name)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                  {customer.id < 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', alignSelf: 'center' }}>
                      عميل من العمليات
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {(isAddingCustomer || isEditingCustomer) && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setIsAddingCustomer(false); setIsEditingCustomer(null); } }}>
          <div className="modal-content scale-in">
            <div className="modal-header">
              <h2 style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
                {isEditingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
              </h2>
              <button
                className="btn btn-icon"
                onClick={() => { setIsAddingCustomer(false); setIsEditingCustomer(null); }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={isEditingCustomer ? handleEditSubmit : handleAddSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label>اسم العميل</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="أدخل اسم العميل"
                  id="customer-name-input"
                />
              </div>
              <div className="form-group">
                <label>رقم الهاتف</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  placeholder="05xxxxxxxxx"
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                  id="customer-phone-input"
                />
              </div>
              <div className="form-group">
                <label>ملاحظات (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="أي ملاحظات إضافية..."
                  rows={3}
                  id="customer-notes-input"
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setIsAddingCustomer(false); setIsEditingCustomer(null); resetForm(); }}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary" id="customer-save-btn">
                  {isEditingCustomer ? 'حفظ التعديلات' : 'إضافة العميل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Customer Operations Modal ── */}
      {viewingCustomer && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setViewingCustomer(null); }}>
          <div className="modal-content scale-in" style={{ maxWidth: '820px', width: '95%' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none', fontSize: '1.15rem' }}>
                  {viewingCustomer.name}
                </h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} />
                  <span dir="ltr">{viewingCustomer.phone}</span>
                </div>
              </div>
              <button className="btn btn-icon" onClick={() => setViewingCustomer(null)}>
                <X size={18} />
              </button>
            </div>

            <div>
              <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                سجل العمليات ({customerOperations.length})
              </div>
              {customerOperations.length === 0 ? (
                <div className="empty-state" style={{ minHeight: '120px' }}>
                  <div className="empty-state-icon"><Clock size={36} /></div>
                  <p>لا توجد عمليات سابقة لهذا العميل</p>
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: '440px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>الجهاز</th>
                        <th>الحالة</th>
                        <th>الدفع</th>
                        <th>المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerOperations.map(op => (
                        <tr key={op.id}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{op.date}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{op.device}</div>
                            {op.faults && Array.isArray(op.faults) && op.faults.length > 0 && (
                              <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
                                {op.faults.join('، ')}
                              </div>
                            )}
                          </td>
                          <td><StatusBadge status={op.status} /></td>
                          <td>{getPaymentLabel(op.payment_status)}</td>
                          <td style={{ fontWeight: 700, fontFamily: '"Outfit", monospace', color: 'var(--text)' }}>
                            {Number(op.price).toLocaleString()} ر.س
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toastMessage && (
        <div className="toast slide-up">{toastMessage}</div>
      )}
    </div>
  );
}
