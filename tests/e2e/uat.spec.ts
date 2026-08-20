import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

type Session = { app: ElectronApplication; page: Page; userData: string };

async function openApp(): Promise<Session> {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-app-uat-'));
  const app = await electron.launch({
    args: [path.join(projectRoot, 'dist-electron/main.js')],
    env: { ...process.env, TEST_USER_DATA: userData, ISOLATED_TEST_APPDATA: userData },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  return { app, page, userData };
}

async function closeApp(s: Session) {
  try { await s.app.close(); } finally { fs.rmSync(s.userData, { recursive: true, force: true }); }
}

async function go(page: Page, name: string) {
  let nav;
  if (name === 'العمليات والصيانة' || name === 'العمليات') nav = page.getByTestId('nav-operations');
  else if (name === 'السحوبات والمصروفات' || name === 'الخزينة والسحوبات') nav = page.getByTestId('nav-withdrawals');
  else if (name === 'لوحة التحكم') nav = page.getByTestId('nav-dashboard');
  else if (name === 'العملاء') nav = page.getByTestId('nav-customers');
  else if (name === 'الإعدادات') nav = page.getByTestId('settings-nav');
  else nav = page.locator('button').filter({ hasText: name }).first();

  await expect(nav).toBeVisible({ timeout: 10_000 });
  await nav.click();
  await page.waitForTimeout(250);
}

async function openSettingsTab(page: Page, name: string) {
  await go(page, 'الإعدادات');
  let tab;
  if (name === 'إدارة الفنيين') tab = page.getByTestId('tab-technicians');
  else if (name === 'إعدادات عامة') tab = page.getByTestId('tab-general');
  else tab = page.locator('button').filter({ hasText: name }).first();
  
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();
  await page.waitForTimeout(250);
}

async function ensureTechnician(page: Page, name = 'UAT Technician') {
  await openSettingsTab(page, 'إدارة الفنيين');
  const existing = page.getByText(name, { exact: true }).first();
  if (!(await existing.isVisible().catch(() => false))) {
    await page.locator('.form-group').filter({ hasText: 'اسم الفني' }).locator('input, select, textarea').first().fill(name);
    await page.locator('.form-group').filter({ hasText: 'نسبة الربح (%)' }).locator('input, select, textarea').first().fill('30');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  await go(page, 'العمليات والصيانة');
}

async function addCustomer(page: Page, name: string, phone: string) {
  await go(page, 'العملاء');
  await page.locator('#add-customer-btn').click();
  await page.locator('#customer-name-input').fill(name);
  await page.locator('#customer-phone-input').fill(phone);
  await page.locator('#customer-save-btn').click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

async function addOperation(page: Page, data: { customer: string; phone?: string; device?: string; price: string; cost?: string; paid?: string; status?: string; warranty?: string }) {
  await go(page, 'العمليات والصيانة');
  await page.getByRole('button', { name: 'عملية جديدة', exact: true }).click();
  await expect(page.getByRole('button', { name: 'إضافة العملية', exact: true })).toBeVisible();
  const techSelect = page.locator('.form-group').filter({ hasText: 'الفني' }).locator('input, select, textarea').first();
  try {
    await techSelect.selectOption({ label: /UAT Technician/ });
  } catch {
    await techSelect.selectOption({ index: 1 });
  }
  await page.locator('.form-group').filter({ hasText: 'العميل' }).locator('input, select, textarea').first().fill(data.customer);
  if (data.phone) await page.locator('.form-group').filter({ hasText: 'رقم الهاتف (اختياري)' }).locator('input, select, textarea').first().fill(data.phone);
  await page.locator('.form-group').filter({ hasText: 'اسم الجهاز' }).locator('input, select, textarea').first().fill(data.device || 'UAT Phone');
  await page.locator('.form-group').filter({ hasText: 'المبيعات (السعر)' }).locator('input, select, textarea').first().fill(data.price);
  await page.locator('.form-group').filter({ hasText: 'المشتريات (التكلفة)' }).locator('input, select, textarea').first().fill(data.cost || '10');
  if (data.paid !== undefined) {
    await page.waitForTimeout(200);
    await page.locator('.form-group').filter({ hasText: 'المبلغ الواصل من الزبون' }).locator('input, select, textarea').first().fill(data.paid);
  }
  if (data.status) await page.locator('.form-group').filter({ hasText: 'حالة الجهاز' }).locator('input, select, textarea').first().selectOption(data.status);
  if (data.warranty) {
    await page.locator('#warrantyCheckbox').check();
    await page.locator('.form-group').filter({ hasText: 'مدة الضمان (بالأيام)' }).locator('input, select, textarea').first().fill(data.warranty);
  }
  await page.getByRole('button', { name: 'إضافة العملية', exact: true }).click();
  await expect(page.getByText(data.customer, { exact: true }).first()).toBeVisible();
}

async function operationRow(page: Page, text: string) {
  return page.getByRole('row').filter({ hasText: text }).last();
}

async function confirmDialog(page: Page) {
  const dialog = page.locator('[role="dialog"]');
  const confirm = dialog.getByRole('button').last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

async function ensureBackupAvailable(page: Page) {
  await openSettingsTab(page, 'إعدادات عامة');
  const backups = page.getByText(/النسخ المتوفرة/).first();
  if (!(await page.getByRole('button', { name: 'إنشاء نسخة احتياطية الآن', exact: true }).isVisible().catch(() => false))) {
    await expect(backups).toBeVisible({ timeout: 10_000 });
  }
  const restoreButtons = page.getByRole('button', { name: /استعادة/ });
  if (await restoreButtons.count() === 0) {
    await page.getByRole('button', { name: 'إنشاء نسخة احتياطية الآن', exact: true }).click();
    await expect(page.getByText(/تم إنشاء نسخة احتياطية كاملة/)).toBeVisible({ timeout: 10_000 });
  }
}

// 01-06: shell / UX
test('UAT-01: opens the real Electron app', async () => { const s = await openApp(); try { await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-02: closes and reopens against the same isolated userData', async () => { const s = await openApp(); try { await s.app.close(); s.app = await electron.launch({ args: [path.join(projectRoot, 'dist-electron/main.js')], env: { ...process.env, TEST_USER_DATA: s.userData, ISOLATED_TEST_APPDATA: s.userData } }); s.page = await s.app.firstWindow(); await s.page.waitForLoadState('domcontentloaded'); await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-03: navigates across all main pages', async () => { const s = await openApp(); try { for (const name of ['العمليات والصيانة', 'العملاء', 'السحوبات والمصروفات', 'الإعدادات']) await go(s.page, name); await expect(s.page.getByText('الإعدادات', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-04: collapses and expands the sidebar', async () => { const s = await openApp(); try { await s.page.getByRole('button', { name: 'تبديل القائمة' }).click(); await s.page.getByRole('button', { name: 'تبديل القائمة' }).click(); await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-05: Arabic text renders without mojibake', async () => { const s = await openApp(); try { await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); await expect(s.page.getByText('العمليات', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-06: operations search controls are available after prerequisite setup', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await expect(s.page.locator('.form-group').filter({ hasText: 'بحث نصي (رقم، اسم، هاتف، جهاز)' }).locator('input, select, textarea').first()).toBeVisible(); } finally { await closeApp(s); } });

// 07-11: customers
test('UAT-07: adds a customer', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 07', '07700000007'); } finally { await closeApp(s); } });
test('UAT-08: edits a customer', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 08', '07700000008'); const card = s.page.locator('.entity-card').filter({ hasText: 'UAT Customer 08' }).first(); await card.getByRole('button', { name: 'تعديل' }).click(); await s.page.locator('#customer-phone-input').fill('07700000080'); await s.page.getByRole('button', { name: 'حفظ التعديلات', exact: true }).click(); await expect(card.getByText('07700000080', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-09: searches customers by name and phone', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 09', '07700000009'); const search = s.page.getByPlaceholder('ابحث بالاسم أو الهاتف...'); await search.fill('07700000009'); await expect(s.page.getByText('UAT Customer 09', { exact: true }).first()).toBeVisible(); await search.fill('UAT Customer 09'); await expect(s.page.getByText('UAT Customer 09', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-10: opens customer operations history', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 10', '07700000010'); const card = s.page.locator('.entity-card').filter({ hasText: 'UAT Customer 10' }).first(); await card.getByRole('button', { name: 'العمليات', exact: true }).click(); await expect(s.page.getByText(/سجل العمليات/)).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-11: deletes a customer', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 11', '07700000011'); const card = s.page.locator('.entity-card').filter({ hasText: 'UAT Customer 11' }).first(); await card.getByRole('button').nth(2).click(); await confirmDialog(s.page); await expect(s.page.getByText('UAT Customer 11', { exact: true })).toHaveCount(0); } finally { await closeApp(s); } });

// 12-20: operations lifecycle
test('UAT-12: creates full-cash operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 12', price: '50000', cost: '10000', paid: '50000' }); await expect((await operationRow(s.page, 'UAT Op 12')).getByText('مسدد')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-13: creates partial-payment operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 13', price: '50000', cost: '10000', paid: '20000' }); await expect((await operationRow(s.page, 'UAT Op 13')).getByText('جزئي')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-14: creates debt operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 14', price: '50000', cost: '10000', paid: '0' }); await expect((await operationRow(s.page, 'UAT Op 14')).getByText('دين')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-15: payment input has a max equal to sale price', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await go(s.page, 'العمليات والصيانة'); await s.page.getByRole('button', { name: 'عملية جديدة', exact: true }).click(); const price = s.page.locator('.form-group').filter({ hasText: 'المبيعات (السعر)' }).locator('input, select, textarea').first(); const paid = s.page.locator('.form-group').filter({ hasText: 'المبلغ الواصل من الزبون' }).locator('input, select, textarea').first(); await price.fill('50000'); await expect(paid).toHaveAttribute('max', '50000'); } finally { await closeApp(s); } });
test('UAT-16: operation moves to completed', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 16', price: '50000', cost: '10000', paid: '50000', status: 'under_maintenance' }); const row = await operationRow(s.page, 'UAT Op 16'); await row.locator('button[title="تأشير كمكتمل"]').click(); await expect(row.getByText('مكتمل')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-17: completed action is available only for maintenance operations', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 17', price: '50000', cost: '10000', paid: '50000', status: 'completed' }); const row = await operationRow(s.page, 'UAT Op 17'); await expect(row.locator('button[title="تأشير كمكتمل"]').first()).toHaveCount(0); } finally { await closeApp(s); } });
test('UAT-18: delivers a completed operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 18', price: '50000', cost: '10000', paid: '50000', status: 'completed' }); const row = await operationRow(s.page, 'UAT Op 18'); await row.locator('button[title="تأشير كتم التسليم"]').click(); await expect(row.getByText('تم التسليم')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-19: edits operation price and notes', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 19', price: '50000', cost: '10000', paid: '50000' }); const row = await operationRow(s.page, 'UAT Op 19'); await row.locator('button[title="تعديل"]').click(); await s.page.locator('.form-group').filter({ hasText: 'السعر' }).locator('input, select, textarea').first().fill('60000'); await s.page.locator('.form-group').filter({ hasText: 'ملاحظات' }).locator('input, select, textarea').first().fill('Edited by UAT'); await s.page.getByRole('button', { name: 'حفظ التعديلات', exact: true }).click(); await expect((await operationRow(s.page, 'UAT Op 19')).getByText('60000.00')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-20: opens operation details', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 20', price: '50000', cost: '10000', paid: '50000' }); const row = await operationRow(s.page, 'UAT Op 20'); await row.locator('button[title="عرض التفاصيل"]').click(); await expect(s.page.getByText(/تفاصيل العملية رقم/)).toBeVisible(); } finally { await closeApp(s); } });

// 21-30: finance, search and filters
test('UAT-21: technician and shop profit are non-zero for a profitable delivered operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 21', price: '100000', cost: '30000', paid: '100000', status: 'delivered' }); const row = await operationRow(s.page, 'UAT Op 21'); await expect(row.locator('td').nth(7)).not.toHaveText('0.00'); await expect(row.locator('td').nth(8)).not.toHaveText('0.00'); } finally { await closeApp(s); } });
test('UAT-22: dashboard shows the delivered operation in summary', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 22', price: '100000', cost: '30000', paid: '100000', status: 'delivered' }); await go(s.page, 'لوحة التحكم'); await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); await expect(s.page.getByText(/70000|70,000|7,0000/).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-23: debt operation is visible in the operations list', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 23', price: '100000', cost: '30000', paid: '0' }); await expect((await operationRow(s.page, 'UAT Op 23')).getByText('دين')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-24: debt dashboard section is populated after a debt operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 24', price: '100000', cost: '30000', paid: '0' }); await go(s.page, 'لوحة التحكم'); await expect(s.page.getByText(/الديون|دين/).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-25: text search finds an operation by customer', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Search 25', price: '10000', cost: '1000', paid: '10000' }); await s.page.locator('.form-group').filter({ hasText: 'بحث نصي (رقم، اسم، هاتف، جهاز)' }).locator('input, select, textarea').first().fill('UAT Search 25'); await expect(s.page.getByText('UAT Search 25', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-26: cash filter returns only cash operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Cash 26', price: '10000', paid: '10000' }); await s.page.locator('.form-group').filter({ hasText: 'حالة الدفع' }).locator('input, select, textarea').first().selectOption('cash'); await expect(s.page.getByText('UAT Cash 26', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-27: partial filter returns partial operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Partial 27', price: '10000', paid: '3000' }); await s.page.locator('.form-group').filter({ hasText: 'حالة الدفع' }).locator('input, select, textarea').first().selectOption('partial'); await expect(s.page.getByText('UAT Partial 27', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-28: debt filter returns debt operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Debt 28', price: '10000', paid: '0' }); await s.page.locator('.form-group').filter({ hasText: 'حالة الدفع' }).locator('input, select, textarea').first().selectOption('debt'); await expect(s.page.getByText('UAT Debt 28', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-29: completed status filter returns completed operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Status 29', price: '10000', paid: '10000', status: 'completed' }); await s.page.locator('.form-group').filter({ hasText: 'حالة الجهاز' }).locator('input, select, textarea').first().selectOption('completed'); await expect(s.page.getByText('UAT Status 29', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-30: active warranty filter returns warranty operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Warranty 30', price: '10000', paid: '10000', warranty: '30' }); await s.page.locator('.form-group').filter({ hasText: 'الضمان' }).locator('input, select, textarea').first().selectOption('active'); await expect(s.page.getByText('UAT Warranty 30', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });

// 31-37: withdrawals / technicians / settings
test('UAT-31: opens withdrawals page', async () => { const s = await openApp(); try { await go(s.page, 'السحوبات والمصروفات'); await expect(s.page.getByText('السحوبات والمصروفات', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-32: adds a shop withdrawal', async () => { const s = await openApp(); try { await go(s.page, 'السحوبات والمصروفات'); await s.page.locator('.form-group').filter({ hasText: 'المبلغ' }).locator('input, select, textarea').first().fill('1000'); await s.page.locator('.form-group').filter({ hasText: 'البيان / الوصف' }).locator('input, select, textarea').first().fill('UAT shop expense'); await s.page.getByRole('button', { name: 'إضافة سحب', exact: true }).click(); await expect(s.page.getByText('UAT shop expense', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-33: edits a shop withdrawal', async () => { const s = await openApp(); try { await go(s.page, 'السحوبات والمصروفات'); await s.page.locator('.form-group').filter({ hasText: 'المبلغ' }).locator('input, select, textarea').first().fill('1000'); await s.page.locator('.form-group').filter({ hasText: 'البيان / الوصف' }).locator('input, select, textarea').first().fill('UAT edit 33'); await s.page.getByRole('button', { name: 'إضافة سحب', exact: true }).click(); const row = await operationRow(s.page, 'UAT edit 33'); await row.getByRole('button', { name: 'تعديل' }).click(); await s.page.locator('.form-group').filter({ hasText: 'المبلغ' }).locator('input, select, textarea').first().fill('2000'); await s.page.getByRole('button', { name: 'حفظ التعديل', exact: true }).click(); await expect((await operationRow(s.page, 'UAT edit 33')).getByText('2000.00')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-34: deletes a withdrawal', async () => { const s = await openApp(); try { await go(s.page, 'السحوبات والمصروفات'); await s.page.locator('.form-group').filter({ hasText: 'المبلغ' }).locator('input, select, textarea').first().fill('1000'); await s.page.locator('.form-group').filter({ hasText: 'البيان / الوصف' }).locator('input, select, textarea').first().fill('UAT delete 34'); await s.page.getByRole('button', { name: 'إضافة سحب', exact: true }).click(); const row = await operationRow(s.page, 'UAT delete 34'); await row.getByRole('button', { name: 'حذف' }).click(); await confirmDialog(s.page); await expect(s.page.getByText('UAT delete 34', { exact: true })).toHaveCount(0); } finally { await closeApp(s); } });
test('UAT-35: creates a technician withdrawal after creating prerequisite technician', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await openSettingsTab(s.page, 'إدارة الفنيين'); const card = s.page.locator('.glass').filter({ hasText: 'UAT Technician' }).first(); await card.getByRole('button', { name: 'تسجيل سحب نقدي' }).click(); await s.page.locator('.form-group').filter({ hasText: 'مبلغ السحب' }).locator('input, select, textarea').first().fill('500'); await s.page.getByRole('button', { name: 'تسجيل السحب', exact: true }).click(); await expect(card).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-36: changes the shop name in general settings', async () => { const s = await openApp(); try { await openSettingsTab(s.page, 'إعدادات عامة'); await s.page.locator('.form-group').filter({ hasText: 'اسم المركز (Shop Name)' }).locator('input, select, textarea').first().fill('UAT Service Center'); await s.page.getByRole('button', { name: 'حفظ الإعدادات', exact: true }).click(); await expect(s.page.getByText(/تم حفظ الإعدادات بنجاح/)).toBeVisible({ timeout: 10_000 }); } finally { await closeApp(s); } });
test('UAT-37: toggles light and dark theme', async () => { const s = await openApp(); try { await openSettingsTab(s.page, 'إعدادات عامة'); await s.page.getByRole('button', { name: 'نهاري', exact: true }).click(); await s.page.getByRole('button', { name: 'حفظ الإعدادات', exact: true }).click(); await expect(s.page.getByText(/تم حفظ الإعدادات بنجاح/)).toBeVisible({ timeout: 10_000 }); await s.page.waitForTimeout(2000); await expect(s.page.locator('html')).toHaveClass(/light/); } finally { await closeApp(s); } });

// 38-40: backup / restore / persistence
test('UAT-38: creates a JSON backup from the UI', async () => { const s = await openApp(); try { await openSettingsTab(s.page, 'إعدادات عامة'); await s.page.getByRole('button', { name: 'إنشاء نسخة احتياطية الآن', exact: true }).click(); await expect(s.page.getByText(/تم إنشاء نسخة احتياطية كاملة/)).toBeVisible({ timeout: 10_000 }); await expect(s.page.getByText(/النسخ المتوفرة/)).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-39: restore requires an existing backup file and explicit confirmation', async () => { const s = await openApp(); try { await ensureBackupAvailable(s.page); const restore = s.page.getByRole('button', { name: /استعادة/ }).first(); await expect(restore).toBeVisible(); await restore.click(); await expect(s.page.getByText(/سيتم استبدال بيانات البرنامج الحالية/)).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-40: operation data survives an Electron restart', async () => { test.setTimeout(60000); const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Restart 40', price: '10000', cost: '1000', paid: '10000' }); await s.page.waitForTimeout(1000); await s.app.evaluate(({ app }) => { app.quit(); }); await new Promise(resolve => setTimeout(resolve, 2000)); try { await s.app.close(); } catch (e) {} await new Promise(resolve => setTimeout(resolve, 2000)); s.app = await electron.launch({ args: [path.join(projectRoot, 'dist-electron/main.js')], env: { ...process.env, TEST_USER_DATA: s.userData, ISOLATED_TEST_APPDATA: s.userData } }); s.app.process().stdout?.on('data', d => console.log('NEW APP STDOUT:', d.toString())); s.app.process().stderr?.on('data', d => console.log('NEW APP STDERR:', d.toString())); s.page = await s.app.firstWindow(); await s.page.waitForLoadState('domcontentloaded'); await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible({ timeout: 15_000 }); await go(s.page, 'العمليات والصيانة'); await expect(s.page.getByText('UAT Restart 40', { exact: true })).toBeVisible({ timeout: 15_000 }); } finally { await closeApp(s); } });



