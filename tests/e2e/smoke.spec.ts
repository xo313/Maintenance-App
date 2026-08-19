import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '../..');

test('Maintenance App opens and displays the dashboard', async () => {
  const testUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-app-e2e-'));
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined;

  try {
    app = await electron.launch({
      args: [path.join(projectRoot, 'dist-electron/main.js')],
      env: {
        ...process.env,
        TEST_USER_DATA: testUserData,
        ISOLATED_TEST_APPDATA: testUserData,
      },
    });

    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    await expect(window.getByText('لوحة التحكم', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    try {
      await app?.close();
    } finally {
      try {
        fs.rmSync(testUserData, { recursive: true, force: true });
      } catch {
        // Cleanup failures must not mask the original test failure.
      }
    }
  }
});
