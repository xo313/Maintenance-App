import React, { useEffect, useState } from "react";
import { Users, Search, Edit, Trash2, PlusCircle, Eye } from "lucide-react";
import type { Customer, Operation } from "../types";
import { useDialog } from "./ui/DialogProvider";
import { StatusBadge } from "./ui/Badge";

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals state
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [customerOperations, setCustomerOperations] = useState<Operation[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dialog = useDialog();

  const loadData = async () => {
    const data = await (window as any).api.getCustomers();
    setCustomers(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    const res = await (window as any).api.addCustomer({ name, phone, notes });
    if (res.success) {
      showToast("تمت إضافة العميل بنجاح");
      setIsAddingCustomer(false);
      resetForm();
      loadData();
    } else {
      showToast("فشل إضافة العميل");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingCustomer || !name || !phone) return;

    const res = await (window as any).api.editCustomer(isEditingCustomer.id, { name, phone, notes });
    if (res.success) {
      showToast("تم تحديث بيانات العميل");
      setIsEditingCustomer(null);
      resetForm();
      loadData();
    } else {
      showToast("فشل تحديث البيانات");
    }
  };

  const handleDelete = async (id: number, customerName: string) => {
    const confirmed = await dialog.confirm({
      title: "حذف العميل",
      message: `هل أنت متأكد من رغبتك في حذف العميل "${customerName}"؟ لا يمكن التراجع عن هذا الإجراء.`
    });

    if (confirmed) {
      const res = await (window as any).api.deleteCustomer(id);
      if (res.success) {
        showToast("تم حذف العميل بنجاح");
        loadData();
      } else {
        showToast(res.reason || "خطأ أثناء الحذف");
      }
    }
  };

  const handleViewCustomer = async (customer: Customer) => {
    setViewingCustomer(customer);
    const ops = await (window as any).api.getCustomerOperations(customer.id, customer.phone);
    setCustomerOperations(ops);
  };

  const resetForm = () => {
    setName("");
    setPhone("");
    setNotes("");
  };

  const openAddModal = () => {
    resetForm();
    setIsAddingCustomer(true);
  };

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

  return (
    <div className="section-container">
      {/* Header & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: '400px', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Search size={18} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="ابحث بالاسم أو رقم الهاتف..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <PlusCircle size={20} />
          <span>إضافة عميل جديد</span>
        </button>
      </div>

      {/* Customers List */}
      <div className="grid-cards">
        {filteredCustomers.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>لا يوجد عملاء مطابقين للبحث</div>
        ) : (
          filteredCustomers.map(customer => (
            <div key={customer.id} className="card dashboard-card slide-up">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                    <Users size={24} color="#3b82f6" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', fontWeight: 600 }}>{customer.name}</h3>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{customer.phone}</div>
                  </div>
                </div>
              </div>
              
              {customer.notes && (
                <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '4px' }}>
                  {customer.notes}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem' }} onClick={() => handleViewCustomer(customer)}>
                  <Eye size={16} />
                  <span>التفاصيل</span>
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem' }} onClick={() => openEditModal(customer)}>
                  <Edit size={16} />
                  <span>تعديل</span>
                </button>
                <button className="btn btn-danger" style={{ padding: '0.4rem' }} onClick={() => handleDelete(customer.id, customer.name)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      {(isAddingCustomer || isEditingCustomer) && (
        <div className="modal-overlay">
          <div className="modal-content scale-in" style={{ maxWidth: '500px' }}>
            <h2>{isEditingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h2>
            <form onSubmit={isEditingCustomer ? handleEditSubmit : handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div className="form-group">
                <label>اسم العميل</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="أدخل اسم العميل" />
              </div>
              
              <div className="form-group">
                <label>رقم الهاتف</label>
                <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="أدخل رقم الهاتف" dir="ltr" style={{ textAlign: 'right' }} />
              </div>

              <div className="form-group">
                <label>ملاحظات إضافية (اختياري)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي ملاحظات حول العميل..." rows={3}></textarea>
              </div>

              <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setIsAddingCustomer(false); setIsEditingCustomer(null); }}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary">
                  حفظ البيانات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Customer Details Modal */}
      {viewingCustomer && (
        <div className="modal-overlay">
          <div className="modal-content scale-in" style={{ maxWidth: '800px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div>
                <h2>{viewingCustomer.name}</h2>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>{viewingCustomer.phone}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => setViewingCustomer(null)}>إغلاق</button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3>سجل العمليات السابقة ({customerOperations.length})</h3>
              {customerOperations.length === 0 ? (
                <div className="empty-state">لا توجد عمليات سابقة لهذا العميل</div>
              ) : (
                <div className="table-responsive" style={{ marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
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
                          <td>{op.date}</td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{op.device}</div>
                            <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{op.fault}</div>
                          </td>
                          <td><StatusBadge status={op.status} /></td>
                          <td>
                            {op.payment_status === 'cash' ? (
                              <span className="badge badge-success">مدفوع</span>
                            ) : op.payment_status === 'partial' ? (
                              <span className="badge badge-warning">جزئي</span>
                            ) : (
                              <span className="badge badge-danger">دين</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{op.price}</td>
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

      {toastMessage && (
        <div className="toast slide-up">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
