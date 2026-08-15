import { contextBridge, ipcRenderer } from 'electron';
import type { Operation, Withdrawal } from '../src/types';

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (capital: number, name: string) => ipcRenderer.invoke('update-settings', capital, name),
  
  getTechnicians: () => ipcRenderer.invoke('get-technicians'),
  addTechnician: (name: string, profit_percentage: number) => ipcRenderer.invoke('add-technician', name, profit_percentage),
  editTechnician: (id: number, name: string, profit_percentage: number) => ipcRenderer.invoke('edit-technician', id, name, profit_percentage),
  deleteTechnician: (id: number) => ipcRenderer.invoke('delete-technician', id),
  
  getOperations: () => ipcRenderer.invoke('get-operations'),
  addOperation: (op: Partial<Operation>) => ipcRenderer.invoke('add-operation', op),
  editOperation: (id: number, op: Partial<Operation>) => ipcRenderer.invoke('edit-operation', id, op),
  deleteOperation: (id: number) => ipcRenderer.invoke('delete-operation', id),
  importOperationsExcel: () => ipcRenderer.invoke('import-operations-excel'),
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
  closeMonthWithExcel: (newCapital: number) => ipcRenderer.invoke('close-month-with-excel', newCapital)
});
