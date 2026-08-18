# Maintenance App (تطبيق إدارة مراكز الصيانة)

تطبيق مكتبي متكامل لإدارة مراكز صيانة الهواتف والأجهزة الإلكترونية (Desktop Offline-First)، مبني بأحدث التقنيات:
- **Electron 43**
- **React 19**
- **TypeScript & Vite**
- **SQLite (better-sqlite3)** مع وضع الكتابة المسبقة (WAL Mode) والـ Foreign Keys
- **Lucide Icons**

---

## 🏗️ المعمارية وقاعدة البيانات (SQLite Architecture)

تمت ترقية طبقة تخزين البيانات بالكامل إلى **SQLite** عبر مكتبة `better-sqlite3` بتصميم يعتمد على نمط المستودعات (Repository Pattern):

```
React Frontend
      ↓
electron/preload.ts (ContextBridge)
      ↓
electron/main.ts (IPC Handlers)
      ↓
electron/db/repositories/
      ↓
electron/db/connection.ts (WAL Mode & Pragmas)
      ↓
SQLite Database (app.getPath('userData')/maintenance.db)
```

### ملفات ومسارات قاعدة البيانات
- **مسار قاعدة البيانات الأساسي**: `app.getPath('userData')/maintenance.db`
- **إعدادات الأداء والأمان (PRAGMAs)**:
  - `PRAGMA foreign_keys = ON;` (تأمين تكامل العلاقات بين الجداول)
  - `PRAGMA journal_mode = WAL;` (أداء كتابة وقراءة فائق وتزامن سلس)
  - `PRAGMA synchronous = NORMAL;` (توازن مثالي بين الأمان والسرعة)
  - `PRAGMA busy_timeout = 5000;` (منع أخطاء القفل أثناء الضغط)

---

## 🔄 الترحيل التلقائي من JSON القديم (Automatic Migration)

يحتوي التطبيق على نظام ترحيل تلقائي وذاتي (Idempotent Migration):
1. عند تشغيل التطبيق لأول مرة، يفحص وجود `database.json`.
2. يقوم بإنشاء نسخة احتياطية من `database.json` في مجلد `backups_v2/`.
3. ينقل البيانات كاملة داخل **Transaction واحدة** إلى جداول SQLite.
4. يتحقق بدقة 100% من تطابق أعداد العمليات، الفنيين، الأشهر، السحوبات، والمجاميع المالية (الأسعار، التكاليف، أرباح المحل، أرباح الفنيين، والديون).
5. يحتفظ بملف `database.json` كنسخة أرشيفية (Legacy) دون حذفه أو تعديله.

---

## 💾 النسخ الاحتياطي والاستعادة (Backup & Restore)

- **النسخ الاحتياطي**: يعتمد على SQLite Online Backup API لإنشاء لقطة فورية متزامنة وآمنة بصيغة `.db` مع ملف بيانات وصفية `.meta.json` وتشفير SHA-256 للتحقق من سلامة الملف.
- **الاستعادة**: فحص سلامة النسخة (`PRAGMA integrity_check`)، إنشاء نسخة وقائية من القاعدة الحالية، واستبدال الملف بطريقة ذرية (Atomic) مع فحص شامل بعد الاستعادة.

---

## 🚀 متطلبات التشغيل والتطوير (Development & Build)

### المتطلبات
- **Node.js**: إصدار `18+` أو `20+` أو `22+`
- **npm**: إصدار `9+`

### أوامر التشغيل
```bash
# تثبيت التبعيات
npm install

# تشغيل بيئة التطوير
npm run dev

# تشغيل الاختبارات الشاملة (44+ فحص)
npm test

# فحص الكود (Lint)
npm run lint

# بناء الواجهة والخلفية (Production Build)
npm run build

# حزم التطبيق لنظام Windows
npm run build:windows
```

---

## 🧪 الاختبارات الآلية (Test Suite)

تم تضمين سلسلة اختبارات شاملة تغطي:
1. إنشاء وتهيئة قاعدة البيانات وفحص السلامة `PRAGMA integrity_check`.
2. كافة عمليات الـ CRUD لجميع الكيانات (الإعدادات، الفنيين، العملاء، العمليات، السحوبات، الآيسيات، السكراب).
3. الحسابات المالية (العمليات النقدية، الآجلة، الدفع الجزئي، تسديد الديون، وتوزيع الأرباح).
4. تسوية وتقفيل الأشهر المالية.
5. النسخ الاحتياطي والاستعادة ومطابقة الـ SHA-256.
6. الترحيل من `database.json` والتحقق من عدم تكرار البيانات (Idempotency).
7. اختبار أداء عالي على **10,000 عملية صيانة** (إدراج في أقل من 800ms، وحساب لوحة الإحصائيات في 26ms).

---

## 📌 إصدار النظام
- **Version**: `1.0.0-beta.1`
- **Branch**: `v2-experimental`
