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
  getDebts: () => ipcRenderer.invoke('get-debts'),
  payDebt: (id: number) => ipcRenderer.invoke('pay-debt', id),
  
  getWithdrawals: () => ipcRenderer.invoke('get-withdrawals'),
  addWithdrawal: (w: Partial<Withdrawal>) => ipcRenderer.invoke('add-withdrawal', w),
  editWithdrawal: (id: number, w: Partial<Withdrawal>) => ipcRenderer.invoke('edit-withdrawal', id, w),
  deleteWithdrawal: (id: number) => ipcRenderer.invoke('delete-withdrawal', id),
  
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getTechnicianStats: () => ipcRenderer.invoke('get-technician-stats'),
  closeMonth: (newCapital: number) => ipcRenderer.invoke('close-month', newCapital),
  closeMonthWithExcel: (newCapital: number) => ipcRenderer.invoke('close-month-with-excel', newCapital)
});
