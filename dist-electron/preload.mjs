let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("api", {
	getSettings: () => electron.ipcRenderer.invoke("get-settings"),
	updateSettings: (capital, name) => electron.ipcRenderer.invoke("update-settings", capital, name),
	getTechnicians: () => electron.ipcRenderer.invoke("get-technicians"),
	addTechnician: (name, profit_percentage) => electron.ipcRenderer.invoke("add-technician", name, profit_percentage),
	getOperations: () => electron.ipcRenderer.invoke("get-operations"),
	addOperation: (op) => electron.ipcRenderer.invoke("add-operation", op),
	getWithdrawals: () => electron.ipcRenderer.invoke("get-withdrawals"),
	addWithdrawal: (w) => electron.ipcRenderer.invoke("add-withdrawal", w),
	getDashboardStats: () => electron.ipcRenderer.invoke("get-dashboard-stats"),
	getTechnicianStats: (id) => electron.ipcRenderer.invoke("get-technician-stats", id)
});
//#endregion
