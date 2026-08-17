import { app } from 'electron';

const testAppData = process.env.ISOLATED_TEST_APPDATA;
if (testAppData) {
  app.setPath('appData', testAppData);
}
