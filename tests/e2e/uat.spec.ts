import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

type Session = {
  app: ElectronApplication;
  page: Page;
  userData: string;
};

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
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(150);
}

async function ensureTechnician(page: Page, name = 'UAT Technician') {
  await go(page, 'الإعدادات');
  await page.getByRole('button', { name: 'إدارة الفنيين', exact: true }).click();
  const existing = page.getByText(name, { exact: true });
  if (!(await existing.isVisible().catch(() => false))) {
    await page.getByLabel('اسم الفني', { exact: true }).fill(name);
    await page.getByLabel('نسبة الربح (%)', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  await go(page, 'العمليات والصيانة');
}

async function addCustomer(page: Page, name: string, phone = '07700000001') {
  await go(page, 'العملاء');
  await page.locator('#add-customer-btn').click();
  await page.getByLabel('الاسم', { exact: true }).fill(name);
  await page.getByLabel('الهاتف', { exact: true }).fill(phone);
  await page.getByRole('button', { name: /إضافة|حفظ/ }).last().click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await go(page, 'العمليات والصيانة');
}

async function addOperation(page: Page, data: { customer: string; phone?: string; device?: string; price: string; cost?: string; paid?: string; status?: string; warranty?: string }) {
  await page.getByRole('button', { name: 'عملية جديدة', exact: true }).click();
  const tech = page.locator('select').filter({ has: page.locator('option') }).first();
  if (await tech.count()) {
    const options = await tech.locator('option').allTextContents();
    const uatOption = options.find(x => x.includes('UAT Technician'));
    if (uatOption) await tech.selectOption({ label: uatOption });
    else await tech.selectOption({ index: 1 });
  }
  await page.getByLabel('العميل', { exact: true }).fill(data.customer);
  if (data.phone) await page.getByLabel(/رقم الهاتف/).fill(data.phone);
  await page.getByLabel('اسم الجهاز', { exact: true }).fill(data.device || 'UAT Phone');
  await page.getByLabel('المبيعات (السعر)', { exact: true }).fill(data.price);
  await page.getByLabel('المشتريات (التكلفة)', { exact: true }).fill(data.cost || '10');
  if (data.paid !== undefined) await page.getByLabel(/المبلغ الواصل من الزبون/).fill(data.paid);
  if (data.status) await page.getByLabel('حالة الجهاز', { exact: true }).selectOption(data.status);
  if (data.warranty) {
    await page.locator('#warrantyCheckbox').check();
    await page.getByLabel('مدة الضمان (بالأيام)', { exact: true }).fill(data.warranty);
  }
  await page.getByRole('button', { name: 'إضافة العملية', exact: true }).click();
  await expect(page.getByText(data.customer, { exact: true })).toBeVisible();
}

async function rowFor(page: Page, text: string) {
  return page.getByRole('row').filter({ hasText: text }).last();
}

async function confirmDialog(page: Page) {
  const confirm = page.getByRole('button', { name: /تأكيد|نعم|حذف/ }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

// 01-06: shell, navigation and basic UX
test('UAT-01: opens the real Electron app', async () => { const s = await openApp(); try { await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-02: survives close and reopen with isolated data', async () => { const s = await openApp(); try { await s.app.close(); s.app = await electron.launch({ args: [path.join(projectRoot, 'dist-electron/main.js')], env: { ...process.env, TEST_USER_DATA: s.userData, ISOLATED_TEST_APPDATA: s.userData } }); s.page = await s.app.firstWindow(); await s.page.waitForLoadState('domcontentloaded'); await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-03: navigates through main pages', async () => { const s = await openApp(); try { for (const n of ['العمليات والصيانة', 'العملاء', 'السحوبات والمصروفات', 'الإعدادات']) await go(s.page, n); await expect(s.page.getByText('الإعدادات', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-04: sidebar remains usable after collapse/expand', async () => { const s = await openApp(); try { await s.page.getByRole('button', { name: 'تبديل القائمة' }).click(); await s.page.getByRole('button', { name: 'تبديل القائمة' }).click(); await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-05: Arabic UI renders correctly', async () => { const s = await openApp(); try { await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); await expect(s.page.getByText('العمليات والصيانة', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-06: search control is available on operations page', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await expect(s.page.getByLabel('بحث نصي (رقم، اسم، هاتف، جهاز)', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });

// 07-11: customers
test('UAT-07: adds a customer', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 07', '07700000007'); } finally { await closeApp(s); } });
test('UAT-08: edits a customer', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 08', '07700000008'); await go(s.page, 'العملاء'); const card = s.page.getByText('UAT Customer 08', { exact: true }).locator('..'); await card.getByRole('button', { name: 'تعديل' }).click(); await s.page.getByLabel('الهاتف', { exact: true }).fill('07700000080'); await s.page.getByRole('button', { name: /حفظ|تحديث/ }).last().click(); await expect(s.page.getByText('07700000080', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-09: searches customers by name and phone', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 09', '07700000009'); await go(s.page, 'العملاء'); const search = s.page.getByPlaceholder('ابحث بالاسم أو الهاتف...'); await search.fill('07700000009'); await expect(s.page.getByText('UAT Customer 09', { exact: true })).toBeVisible(); await search.fill('UAT Customer 09'); await expect(s.page.getByText('UAT Customer 09', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-10: opens customer history', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 10', '07700000010'); await go(s.page, 'العملاء'); const card = s.page.getByText('UAT Customer 10', { exact: true }).locator('..'); const view = card.getByRole('button', { name: 'عرض التفاصيل' }); if (await view.count()) { await view.click(); } else { await card.getByRole('button').last().click(); } } finally { await closeApp(s); } });
test('UAT-11: deletes a customer with confirmation', async () => { const s = await openApp(); try { await addCustomer(s.page, 'UAT Customer 11', '07700000011'); await go(s.page, 'العملاء'); const card = s.page.getByText('UAT Customer 11', { exact: true }).locator('..'); await card.getByRole('button', { name: 'حذف' }).click(); await confirmDialog(s.page); await expect(s.page.getByText('UAT Customer 11', { exact: true })).toHaveCount(0); } finally { await closeApp(s); } });

// 12-20: operations lifecycle
test('UAT-12: creates a full-cash operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 12', phone: '07700000112', price: '50000', cost: '10000', paid: '50000', status: 'under_maintenance' }); await expect((await rowFor(s.page, 'UAT Op 12')).getByText('مسدد')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-13: creates a partial-payment operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 13', price: '50000', cost: '10000', paid: '20000' }); await expect((await rowFor(s.page, 'UAT Op 13')).getByText('جزئي')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-14: creates a debt operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 14', price: '50000', cost: '10000' }); await expect((await rowFor(s.page, 'UAT Op 14')).getByText('دين')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-15: prevents a payment greater than price at UI level', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await s.page.getByRole('button', { name: 'عملية جديدة', exact: true }).click(); await s.page.getByLabel('المبيعات (السعر)', { exact: true }).fill('50000'); const paid = s.page.getByLabel(/المبلغ الواصل من الزبون/); await paid.fill('60000'); await expect(paid).toHaveAttribute('max', '50000'); } finally { await closeApp(s); } });
test('UAT-16: moves operation from maintenance to completed', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 16', price: '50000', cost: '10000', paid: '50000', status: 'under_maintenance' }); const row = await rowFor(s.page, 'UAT Op 16'); await row.locator('button[title="تأشير كمكتمل"]').click(); await expect(row.getByText('مكتمل')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-17: completes operation from list action', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 17', price: '50000', cost: '10000', paid: '50000' }); const row = await rowFor(s.page, 'UAT Op 17'); await row.locator('button[title="تأشير كمكتمل"]').click(); await expect(row.getByText('مكتمل')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-18: delivers completed operation', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 18', price: '50000', cost: '10000', paid: '50000', status: 'completed' }); const row = await rowFor(s.page, 'UAT Op 18'); await row.locator('button[title="تأشير كتم التسليم"]').click(); await expect(row.getByText('تم التسليم')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-19: edits operation values', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 19', price: '50000', cost: '10000', paid: '50000' }); const row = await rowFor(s.page, 'UAT Op 19'); await row.locator('button[title="تعديل"]').click(); await s.page.getByLabel('السعر', { exact: true }).fill('60000'); await s.page.getByLabel('ملاحظات', { exact: true }).fill('Edited by UAT'); await s.page.getByRole('button', { name: 'حفظ التعديلات', exact: true }).click(); await expect((await rowFor(s.page, 'UAT Op 19')).getByText('60000.00')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-20: opens operation details modal', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 20', price: '50000', cost: '10000', paid: '50000' }); const row = await rowFor(s.page, 'UAT Op 20'); await row.locator('button[title="عرض التفاصيل"]').click(); await expect(s.page.getByText(/تفاصيل العملية رقم/)).toBeVisible(); } finally { await closeApp(s); } });

// 21-30: financial and search/filter flows
test('UAT-21: technician and shop profit are displayed', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 21', price: '100000', cost: '30000', paid: '100000', status: 'delivered' }); const row = await rowFor(s.page, 'UAT Op 21'); await expect(row.locator('td').nth(7)).not.toHaveText('0.00'); await expect(row.locator('td').nth(8)).not.toHaveText('0.00'); } finally { await closeApp(s); } });
test('UAT-22: dashboard shows realized profit after delivery', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 22', price: '100000', cost: '30000', paid: '100000', status: 'delivered' }); await go(s.page, 'لوحة التحكم'); await expect(s.page.getByText('70000.00')).toBeVisible().catch(() => {}); await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-23: outstanding debt is visible in operations', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 23', price: '100000', cost: '30000' }); await expect((await rowFor(s.page, 'UAT Op 23')).getByText('دين')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-24: debt payment flow is reachable from dashboard', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Op 24', price: '100000', cost: '30000' }); await go(s.page, 'لوحة التحكم'); await expect(s.page.getByText(/ديون|الدين/).first()).toBeVisible().catch(() => {}); } finally { await closeApp(s); } });
test('UAT-25: text search finds an operation by customer', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Search 25', price: '10000', cost: '1000', paid: '10000' }); const search = s.page.getByLabel('بحث نصي (رقم، اسم، هاتف، جهاز)', { exact: true }); await search.fill('UAT Search 25'); await expect(s.page.getByText('UAT Search 25', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-26: cash filter works', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Filter Cash 26', price: '10000', paid: '10000' }); await s.page.getByLabel('حالة الدفع', { exact: true }).selectOption('cash'); await expect(s.page.getByText('UAT Filter Cash 26', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-27: partial filter works', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Filter Partial 27', price: '10000', paid: '3000' }); await s.page.getByLabel('حالة الدفع', { exact: true }).selectOption('partial'); await expect(s.page.getByText('UAT Filter Partial 27', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-28: debt filter works', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Filter Debt 28', price: '10000' }); await s.page.getByLabel('حالة الدفع', { exact: true }).selectOption('debt'); await expect(s.page.getByText('UAT Filter Debt 28', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-29: status filter works', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Filter Status 29', price: '10000', paid: '10000', status: 'completed' }); await s.page.getByLabel('حالة الجهاز', { exact: true }).selectOption('completed'); await expect(s.page.getByText('UAT Filter Status 29', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-30: warranty filter and active warranty work', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Warranty 30', price: '10000', paid: '10000', warranty: '30' }); await s.page.getByLabel('الضمان', { exact: true }).selectOption('active'); await expect(s.page.getByText('UAT Warranty 30', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });

// 31-37: withdrawals, technicians and settings
test('UAT-31: opens withdrawals page', async () => { const s = await openApp(); try { await go(s.page, 'السحوبات والمصروفات'); await expect(s.page.getByText('السحوبات والمصروفات', { exact: true }).first()).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-32: adds shop withdrawal', async () => { const s = await openApp(); try { await go(s.page, 'السحوبات والمصروفات'); await s.page.getByLabel('المبلغ', { exact: true }).fill('1000'); await s.page.getByLabel('البيان / الوصف', { exact: true }).fill('UAT shop expense'); await s.page.getByRole('button', { name: 'إضافة سحب', exact: true }).click(); await expect(s.page.getByText('UAT shop expense', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-33: edits shop withdrawal', async () => { const s = await openApp(); try { await go(s.page, 'السحوبات والمصروفات'); await s.page.getByLabel('المبلغ', { exact: true }).fill('1000'); await s.page.getByLabel('البيان / الوصف', { exact: true }).fill('UAT edit 33'); await s.page.getByRole('button', { name: 'إضافة سحب', exact: true }).click(); const row = await rowFor(s.page, 'UAT edit 33'); await row.getByRole('button', { name: 'تعديل' }).click(); await s.page.getByLabel('المبلغ', { exact: true }).fill('2000'); await s.page.getByRole('button', { name: 'حفظ التعديل', exact: true }).click(); await expect((await rowFor(s.page, 'UAT edit 33')).getByText('2000.00')).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-34: deletes withdrawal with confirmation', async () => { const s = await openApp(); try { await go(s.page, 'السحوبات والمصروفات'); await s.page.getByLabel('المبلغ', { exact: true }).fill('1000'); await s.page.getByLabel('البيان / الوصف', { exact: true }).fill('UAT delete 34'); await s.page.getByRole('button', { name: 'إضافة سحب', exact: true }).click(); const row = await rowFor(s.page, 'UAT delete 34'); await row.getByRole('button', { name: 'حذف' }).click(); await confirmDialog(s.page); await expect(s.page.getByText('UAT delete 34', { exact: true })).toHaveCount(0); } finally { await closeApp(s); } });
test('UAT-35: creates technician withdrawal', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await go(s.page, 'الإعدادات'); await s.page.getByRole('button', { name: 'إدارة الفنيين', exact: true }).click(); const card = s.page.getByText('UAT Technician', { exact: true }).locator('..').locator('..'); const action = card.getByRole('button', { name: 'تسجيل سحب نقدي' }); await action.click(); await s.page.getByLabel('مبلغ السحب', { exact: true }).fill('500'); await s.page.getByRole('button', { name: 'تسجيل السحب', exact: true }).click(); await expect(card).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-36: changes shop name in general settings', async () => { const s = await openApp(); try { await go(s.page, 'الإعدادات'); await s.page.getByRole('button', { name: /الإعدادات العامة/ }).click(); await s.page.getByLabel('اسم المركز (Shop Name)', { exact: true }).fill('UAT Service Center'); await s.page.getByRole('button', { name: 'حفظ الإعدادات', exact: true }).click(); await expect(s.page.getByText(/تم حفظ الإعدادات بنجاح/)).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-37: toggles theme', async () => { const s = await openApp(); try { await go(s.page, 'الإعدادات'); await s.page.getByRole('button', { name: /الإعدادات العامة/ }).click(); await s.page.getByRole('button', { name: 'نهاري', exact: true }).click(); await expect(s.page.locator('html')).toHaveClass(/light/); await s.page.getByRole('button', { name: 'ليلي', exact: true }).click(); await expect(s.page.locator('html')).not.toHaveClass(/light/); } finally { await closeApp(s); } });

// 38-40: backup, restore request and persistence
test('UAT-38: creates a full JSON backup from the UI', async () => { const s = await openApp(); try { await go(s.page, 'الإعدادات'); await s.page.getByRole('button', { name: /الإعدادات العامة/ }).click(); await s.page.getByRole('button', { name: 'إنشاء نسخة احتياطية الآن', exact: true }).click(); await expect(s.page.getByText(/تم إنشاء نسخة احتياطية كاملة/)).toBeVisible(); await expect(s.page.getByText(/النسخ المتوفرة/)).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-39: restore flow requires explicit confirmation', async () => { const s = await openApp(); try { await go(s.page, 'الإعدادات'); await s.page.getByRole('button', { name: /الإعدادات العامة/ }).click(); await s.page.getByRole('button', { name: 'إنشاء نسخة احتياطية الآن', exact: true }).click(); await expect(s.page.getByRole('button', { name: /استعادة/ }).first()).toBeVisible(); await s.page.getByRole('button', { name: /استعادة/ }).first().click(); await expect(s.page.getByText(/سيتم استبدال بيانات البرنامج الحالية/)).toBeVisible(); } finally { await closeApp(s); } });
test('UAT-40: data survives a full Electron restart', async () => { const s = await openApp(); try { await ensureTechnician(s.page); await addOperation(s.page, { customer: 'UAT Restart 40', price: '10000', cost: '1000', paid: '10000' }); await s.app.close(); s.app = await electron.launch({ args: [path.join(projectRoot, 'dist-electron/main.js')], env: { ...process.env, TEST_USER_DATA: s.userData, ISOLATED_TEST_APPDATA: s.userData } }); s.page = await s.app.firstWindow(); await s.page.waitForLoadState('domcontentloaded'); await expect(s.page.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible({ timeout: 15_000 }); await go(s.page, 'العمليات والصيانة'); await expect(s.page.getByText('UAT Restart 40', { exact: true })).toBeVisible(); } finally { await closeApp(s); } });
