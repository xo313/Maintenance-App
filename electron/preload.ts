import { contextBridge, ipcRenderer } from 'electron';
import type { Operation, Withdrawal } from '../src/types';

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),
  
  getTechnicians: () => ipcRenderer.invoke('get-technicians'),
  addTechnician: (name: string, profit_percentage: number) => ipcRenderer.invoke('add-technician', name, profit_percentage),
  editTechnician: (id: number, name: string, profit_percentage: number) => ipcRenderer.invoke('edit-technician', id, name, profit_percentage),
  deleteTechnician: (id: number) => ipcRenderer.invoke('delete-technician', id),
  
  getCustomers: () => ipcRenderer.invoke('get-customers'),
  addCustomer: (customer: any) => ipcRenderer.invoke('add-customer', customer),
  editCustomer: (id: number, data: any) => ipcRenderer.invoke('edit-customer', id, data),
  deleteCustomer: (id: number) => ipcRenderer.invoke('delete-customer', id),
  getCustomerOperations: (id: number, phone: string) => ipcRenderer.invoke('get-customer-operations', id, phone),
  
  getOperations: () => ipcRenderer.invoke('get-operations'),
  addOperation: (op: Partial<Operation>) => ipcRenderer.invoke('add-operation', op),
  editOperation: (id: number, op: Partial<Operation>) => ipcRenderer.invoke('edit-operation', id, op),
  deleteOperation: (id: number) => ipcRenderer.invoke('delete-operation', id),
  importOperationsExcel: () => ipcRenderer.invoke('import-operations-excel'),
  importOperationsExcelData: (data: any[]) => ipcRenderer.invoke('import-operations-excel-data', data),
  getDebts: () => ipcRenderer.invoke('get-debts'),
  payDebt: (id: number) => ipcRenderer.invoke('pay-debt', id),
  
  getWithdrawals: () => ipcRenderer.invoke('get-withdrawals'),
  addWithdrawal: (w: Partial<Withdrawal>) => ipcRenderer.invoke('add-withdrawal', w),
  editWithdrawal: (id: number, w: Partial<Withdrawal>) => ipcRenderer.invoke('edit-withdrawal', id, w),
  deleteWithdrawal: (id: number) => ipcRenderer.invoke('delete-withdrawal', id),
  
  getIcCompatibilities: () => ipcRenderer.invoke('get-ic-compatibilities'),
  addIcCompatibility: (ic: any) => ipcRenderer.invoke('add-ic-compatibility', ic),
  editIcCompatibility: (id: number, ic: any) => ipcRenderer.invoke('edit-ic-compatibility', id, ic),
  deleteIcCompatibility: (id: number) => ipcRenderer.invoke('delete-ic-compatibility', id),
  importIcExcel: () => ipcRenderer.invoke('import-ic-excel'),
  importIcExcelData: (data: any[]) => ipcRenderer.invoke('import-ic-excel-data', data),

  // Scrap Devices
  getScrapDevices: () => ipcRenderer.invoke('get-scrap-devices'),
  addScrapDevice: (data: any) => ipcRenderer.invoke('add-scrap-device', data),
  editScrapDevice: (id: number, data: any) => ipcRenderer.invoke('edit-scrap-device', id, data),
  deleteScrapDevice: (id: number) => ipcRenderer.invoke('delete-scrap-device', id),

  // Quick Lists
  getQuickLists: () => ipcRenderer.invoke('get-quick-lists'),
  addQuickListItem: (type: 'device' | 'fault', item: string) => ipcRenderer.invoke('add-quick-list-item', type, item),
  removeQuickListItem: (type: 'device' | 'fault', item: string) => ipcRenderer.invoke('remove-quick-list-item', type, item),

  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getTechnicianStats: () => ipcRenderer.invoke('get-technician-stats'),
  closeMonth: (newCapital: number) => ipcRenderer.invoke('close-month', newCapital),
  closeMonthWithExcel: (newCapital: number) => ipcRenderer.invoke('close-month-with-excel', newCapital),
  
  // Suppliers
  getSuppliers: () => ipcRenderer.invoke('get-suppliers'),
  addSupplier: (s: any) => ipcRenderer.invoke('add-supplier', s),
  editSupplier: (id: number, s: any) => ipcRenderer.invoke('edit-supplier', id, s),
  deleteSupplier: (id: number) => ipcRenderer.invoke('delete-supplier', id),
  getSupplierPurchases: (id: number) => ipcRenderer.invoke('get-supplier-purchases', id),
  getSupplierPayments: (id: number) => ipcRenderer.invoke('get-supplier-payments', id),
  addSupplierPurchase: (p: any) => ipcRenderer.invoke('add-supplier-purchase', p),
  addSupplierPayment: (p: any) => ipcRenderer.invoke('add-supplier-payment', p),

  // Shop Expenses
  getShopExpenses: () => ipcRenderer.invoke('get-shop-expenses'),
  addShopExpense: (e: any) => ipcRenderer.invoke('add-shop-expense', e),
  deleteShopExpense: (id: number) => ipcRenderer.invoke('delete-shop-expense', id),

  // Cash Ledger
  getCashTransactions: () => ipcRenderer.invoke('get-cash-transactions'),
  addCashTransaction: (tx: any) => ipcRenderer.invoke('add-cash-transaction', tx),
  deleteCashTransaction: (id: number) => ipcRenderer.invoke('delete-cash-transaction', id),

  // Backup & Reset
  getAllOperations: () => ipcRenderer.invoke('get-all-operations'),
  factoryReset: () => ipcRenderer.invoke('factory-reset'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  createFullBackup: () => ipcRenderer.invoke('create-full-backup'),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  restoreBackup: (filename: string) => ipcRenderer.invoke('backup:restore', filename)
});
