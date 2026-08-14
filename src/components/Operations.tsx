import { useEffect, useState } from "react";
import type { Operation, Technician } from "../types";

export default function Operations() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  
  const [techId, setTechId] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [device, setDevice] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'cash' | 'debt'>('cash');

  // Edit state
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [editTechId, setEditTechId] = useState<number | ''>('');
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editDevice, setEditDevice] = useState<string>('');
  const [editPrice, setEditPrice] = useState<string>('');
  const [editCost, setEditCost] = useState<string>('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'cash' | 'debt'>('cash');

  const loadData = async () => {
    const ops = await (window as any).api.getOperations();
    const techs = await (window as any).api.getTechnicians();
    setOperations(ops);
    setTechnicians(techs);
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
    
    const net_profit = s - p;
    const tech_profit = Number((net_profit * selectedTech.profit_percentage).toFixed(2));
    const shop_profit = Number((net_profit - tech_profit).toFixed(2));

    await (window as any).api.addOperation({
      technician_id: Number(techId),
      customer_name: customerName,
      device: device,
      price: s,
      cost: p,
      shop_profit,
      tech_profit,
      payment_status: paymentStatus
    });

    setCustomerName('');
    setDevice('');
    setPrice('');
    setCost('');
    setPaymentStatus('cash');
    loadData();
  };

  const handleEditClick = (op: Operation) => {
    setEditingOp(op);
    setEditTechId(op.technician_id);
    setEditCustomerName(op.customer_name || '');
    setEditDevice(op.device || '');
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
    
    const net_profit = s - p;
    const tech_profit = Number((net_profit * selectedTech.profit_percentage).toFixed(2));
    const shop_profit = Number((net_profit - tech_profit).toFixed(2));

    await (window as any).api.editOperation(editingOp.id, {
      technician_id: Number(editTechId),
      customer_name: editCustomerName,
      device: editDevice,
      price: s,
      cost: p,
      shop_profit,
      tech_profit,
      payment_status: editPaymentStatus
    });

    setEditingOp(null);
    loadData();
  };

  return (
    <div>
      <div className="header-flex">
        <h2>العمليات والصيانة</h2>
      </div>

      <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>إضافة عملية جديدة</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
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
            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>نوع الجهاز / العطل</label>
            <input type="text" value={device} onChange={e => setDevice(e.target.value)} />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>المبيعات (السعر)</label>
            <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)} required />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>المشتريات (التكلفة)</label>
            <input type="number" step="0.01" min="0" value={cost} onChange={e => setCost(e.target.value)} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>حالة الدفع</label>
            <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'cash'|'debt')} required>
              <option value="cash">نقدي</option>
              <option value="debt">دين (آجل)</option>
            </select>
          </div>
          
          <button type="submit" className="btn">حفظ العملية</button>
        </form>
      </div>

      {editingOp && (
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>تعديل العملية رقم #{editingOp.id}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>الفني</label>
              <select value={editTechId} onChange={e => setEditTechId(Number(e.target.value))} required>
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>اسم الزبون</label>
              <input type="text" value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>نوع الجهاز / العطل</label>
              <input type="text" value={editDevice} onChange={e => setEditDevice(e.target.value)} />
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>السعر</label>
              <input type="number" step="0.01" min="0" value={editPrice} onChange={e => setEditPrice(e.target.value)} required />
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>التكلفة</label>
              <input type="number" step="0.01" min="0" value={editCost} onChange={e => setEditCost(e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>حالة الدفع</label>
              <select value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value as 'cash'|'debt')} required>
                <option value="cash">نقدي</option>
                <option value="debt">دين (آجل)</option>
              </select>
            </div>
            
            <button className="btn" onClick={handleSaveEdit}>حفظ التعديل</button>
            <button className="btn" style={{ background: 'var(--text-muted)' }} onClick={() => setEditingOp(null)}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="glass table-container">
        <table>
          <thead>
            <tr>
              <th>رقم</th>
              <th>التاريخ</th>
              <th>اسم الزبون</th>
              <th>نوع الجهاز/العطل</th>
              <th>الفني</th>
              <th>المبيعات</th>
              <th>التكلفة</th>
              <th>ربح الفني</th>
              <th>ربح المحل</th>
              <th>الدفع</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {operations.map(op => (
              <tr key={op.id}>
                <td>{op.id}</td>
                <td>{op.date}</td>
                <td>{op.customer_name || '-'}</td>
                <td>{op.device || '-'}</td>
                <td>{op.technician_name}</td>
                <td>{op.price ? op.price.toFixed(2) : '0.00'}</td>
                <td>{op.cost ? op.cost.toFixed(2) : '0.00'}</td>
                <td>{op.tech_profit.toFixed(2)}</td>
                <td>{op.shop_profit.toFixed(2)}</td>
                <td>
                  {op.payment_status === 'debt' ? (
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>دين</span>
                  ) : (
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>نقدي</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => handleEditClick(op)}>
                      تعديل
                    </button>
                    <button 
                      className="btn" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'var(--danger)' }} 
                      onClick={async () => {
                        if (confirm('هل أنت متأكد من حذف هذه العملية؟')) {
                          const res = await (window as any).api.deleteOperation(op.id);
                          if (!res) {
                            alert('لا يمكن حذف عملية من شهر تم تقفيله مسبقاً لحماية السجلات.');
                          }
                          loadData();
                        }
                      }}>
                      حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {operations.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center' }}>لا توجد عمليات مسجلة</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
