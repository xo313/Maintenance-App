var e=Object.create,t=Object.defineProperty,n=Object.getOwnPropertyDescriptor,r=Object.getOwnPropertyNames,i=Object.getPrototypeOf,a=Object.prototype.hasOwnProperty,o=(e,i,o,s)=>{if(i&&typeof i==`object`||typeof i==`function`)for(var c=r(i),l=0,u=c.length,d;l<u;l++)d=c[l],!a.call(e,d)&&d!==o&&t(e,d,{get:(e=>i[e]).bind(null,d),enumerable:!(s=n(i,d))||s.enumerable});return e},s=(n,r,s)=>(s=n==null?{}:e(i(n)),o(r||!n||!n.__esModule||!a.call(n,`default`)?t(s,`default`,{value:n,enumerable:!0}):s,n));let c=require("electron"),l=require("node:path");l=s(l);let u=require("node:fs");u=s(u);let d=require("node:crypto");d=s(d);var f=process.env.ISOLATED_TEST_APPDATA;f&&c.app.setPath(`appData`,f);var p=`
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  base_capital REAL NOT NULL DEFAULT 0,
  shop_name TEXT NOT NULL DEFAULT 'مركز الصيانة',
  whatsapp_template TEXT,
  theme TEXT DEFAULT 'dark'
);

CREATE TABLE IF NOT EXISTS months (
  id INTEGER PRIMARY KEY,
  month_name TEXT NOT NULL,
  start_capital REAL NOT NULL DEFAULT 0,
  is_closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS technicians (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  profit_percentage REAL NOT NULL DEFAULT 0,
  start_balance REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS operations (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE RESTRICT,
  technician_id INTEGER NOT NULL REFERENCES technicians(id) ON DELETE RESTRICT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  device TEXT NOT NULL,
  device_code TEXT,
  faults TEXT, -- JSON array string
  cost REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  tech_profit_percentage REAL,
  shop_profit REAL NOT NULL DEFAULT 0,
  tech_profit REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL CHECK(payment_status IN ('cash', 'debt', 'partial')),
  status TEXT NOT NULL CHECK(status IN ('under_maintenance', 'completed', 'delivered', 'cancelled')),
  paid_in_month_id INTEGER REFERENCES months(id) ON DELETE RESTRICT,
  delivered_in_month_id INTEGER REFERENCES months(id) ON DELETE RESTRICT,
  paid_at TEXT,
  paid_amount REAL,
  notes TEXT,
  accessories TEXT,
  warranty_enabled INTEGER DEFAULT 0,
  warranty_days INTEGER,
  warranty_note TEXT,
  warranty_expiry_date TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE RESTRICT,
  amount REAL NOT NULL,
  paid_at TEXT NOT NULL,
  payment_type TEXT DEFAULT 'cash',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  type TEXT NOT NULL CHECK(type IN ('shop_withdrawal', 'tech_withdrawal')),
  technician_id INTEGER REFERENCES technicians(id) ON DELETE RESTRICT,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ic_compatibilities (
  id INTEGER PRIMARY KEY,
  ic_number TEXT NOT NULL,
  component_type TEXT,
  compatible_devices TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS scrap_devices (
  id INTEGER PRIMARY KEY,
  device_name TEXT NOT NULL,
  device_model TEXT,
  quantity INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS common_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS common_faults (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shop_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE RESTRICT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE RESTRICT,
  reference_id INTEGER,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS legacy_migration_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  status TEXT NOT NULL,
  source_hash TEXT,
  error TEXT,
  updated_at TEXT NOT NULL
);
`,m=`
CREATE INDEX IF NOT EXISTS idx_operations_month_id ON operations(month_id);
CREATE INDEX IF NOT EXISTS idx_operations_technician_id ON operations(technician_id);
CREATE INDEX IF NOT EXISTS idx_operations_customer_id ON operations(customer_id);
CREATE INDEX IF NOT EXISTS idx_operations_payment_status ON operations(payment_status);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_delivered_in_month ON operations(delivered_in_month_id);
CREATE INDEX IF NOT EXISTS idx_operations_paid_in_month ON operations(paid_in_month_id);
CREATE INDEX IF NOT EXISTS idx_operations_date ON operations(date);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_withdrawals_month_id ON withdrawals(month_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_technician_id ON withdrawals(technician_id);
CREATE INDEX IF NOT EXISTS idx_payments_operation_id ON payments(operation_id);
CREATE INDEX IF NOT EXISTS idx_payments_month_id ON payments(month_id);
`,h=(typeof globalThis.require==`function`?globalThis.require:require)(`better-sqlite3`),g=null;function _(){let e=process.env.TEST_USER_DATA||(c.app&&typeof c.app.getPath==`function`?c.app.getPath(`userData`):l.default.join(process.cwd(),`test_userData`));return l.default.join(e,`maintenance.db`)}function v(){return g||=y(),g}function y(e){let t=!e||e===_(),n=e||_(),r=l.default.dirname(n);if(u.default.existsSync(r)||u.default.mkdirSync(r,{recursive:!0}),t&&g){try{g.close()}catch{}g=null}let i=new h(n);return i.pragma(`foreign_keys = ON`),i.pragma(`journal_mode = WAL`),i.pragma(`synchronous = NORMAL`),i.pragma(`busy_timeout = 5000`),i.pragma(`temp_store = MEMORY`),b(i),t&&(g=i),i}function b(e){e.exec(p),e.exec(m),e.prepare(`SELECT version FROM schema_migrations WHERE version = 1`).get()||e.prepare(`INSERT OR IGNORE INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)`).run(1,new Date().toISOString(),`Initial SQLite schema`),e.prepare(`SELECT version FROM schema_migrations WHERE version = 2`).get()||(console.log(`[SQLite] Running migration to Schema V2 (Cash Ledger & Suppliers)...`),e.transaction(()=>{e.prepare(`
        INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
        SELECT 
          'CUSTOMER_PAYMENT', 
          amount, 
          paid_at, 
          month_id, 
          operation_id, 
          COALESCE(notes, 'دفعة عملية #' || operation_id), 
          paid_at
        FROM payments
        WHERE amount > 0
      `).run(),e.prepare(`
        INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
        SELECT 
          CASE WHEN type = 'shop_withdrawal' THEN 'SHOP_WITHDRAWAL' ELSE 'TECHNICIAN_PAYMENT' END,
          amount, 
          date, 
          month_id, 
          technician_id, 
          notes, 
          date
        FROM withdrawals
        WHERE amount > 0
      `).run(),e.prepare(`INSERT OR IGNORE INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)`).run(2,new Date().toISOString(),`Added unified cash ledger and suppliers`)})(),console.log(`[SQLite] Migration to Schema V2 completed.`))}function x(e){let t=e||v();try{let e=t.pragma(`integrity_check`);return Array.isArray(e)&&e.length===1&&e[0].integrity_check===`ok`}catch(e){return console.error(`[SQLite] Integrity check failed with error:`,e),!1}}function S(){if(g)try{g.close()}catch(e){console.error(`[SQLite] Error closing database connection:`,e)}finally{g=null}}function C(e){if(!e)return d.default.createHash(`sha256`).update(``,`utf8`).digest(`hex`);let t=e=>{if(typeof e!=`object`||!e)return e;if(Array.isArray(e))return e.map(t);let n={},r=Object.keys(e).sort();for(let i of r)n[i]=t(e[i]);return n},n=t(e),r=JSON.stringify(n);return d.default.createHash(`sha256`).update(r,`utf8`).digest(`hex`)}function w(e){if(!e||typeof e!=`object`||!e.settings||typeof e.settings!=`object`||Array.isArray(e.settings)||!Array.isArray(e.months)||!Array.isArray(e.operations)||!Array.isArray(e.technicians)||!Array.isArray(e.withdrawals))return!1;let t=e=>typeof e==`number`&&Number.isFinite(e),n=e=>typeof e==`object`&&!!e&&!Array.isArray(e),r=(e,n)=>e[n]===void 0||t(e[n]),i=(e,t)=>e[t]===void 0||typeof e[t]==`string`,a=(e,t)=>e[t]===void 0||e[t]===null||typeof e[t]==`string`;if(!r(e.settings,`id`)||!r(e.settings,`base_capital`)||!i(e.settings,`shop_name`)||!i(e.settings,`whatsapp_template`))return!1;let o=e=>{let r=new Set;for(let i of e){if(!n(i)||!t(i.id)||r.has(i.id))return!1;r.add(i.id)}return!0};if(!o(e.months)||!o(e.operations)||!o(e.technicians)||!o(e.withdrawals))return!1;for(let t of e.months)if(!i(t,`month_name`)||!r(t,`start_capital`)||t.is_closed!==void 0&&typeof t.is_closed!=`boolean`||!i(t,`created_at`)||!a(t,`closed_at`))return!1;for(let t of e.technicians)if(!i(t,`name`)||!r(t,`profit_percentage`)||!r(t,`start_balance`)||t.is_active!==void 0&&typeof t.is_active!=`boolean`)return!1;for(let t of e.operations)if(!i(t,`date`)||!i(t,`customer_name`)||!i(t,`customer_phone`)||!i(t,`device`)||!r(t,`cost`)||!r(t,`price`)||!r(t,`shop_profit`)||!r(t,`tech_profit`)||!r(t,`technician_id`)||!r(t,`month_id`)||!r(t,`paid_in_month_id`)||!a(t,`paid_at`)||t.faults!==void 0&&(!Array.isArray(t.faults)||t.faults.some(e=>typeof e!=`string`))||t.payment_status!==void 0&&![`cash`,`debt`,`partial`].includes(t.payment_status)||t.status!==void 0&&![`under_maintenance`,`completed`,`delivered`,`cancelled`].includes(t.status))return!1;for(let n of e.withdrawals)if(!i(n,`date`)||!i(n,`description`)||!r(n,`amount`)||!r(n,`month_id`)||n.technician_id!==void 0&&n.technician_id!==null&&!t(n.technician_id)||n.type!==void 0&&![`shop_withdrawal`,`tech_withdrawal`].includes(n.type))return!1;for(let t of[`ic_compatibilities`,`scrap_devices`,`common_devices`,`common_faults`])if(e[t]!==void 0&&!Array.isArray(e[t]))return!1;return!0}(typeof globalThis.require==`function`?globalThis.require:require)(`better-sqlite3`);function T(){let e=process.env.TEST_USER_DATA||(c.app&&typeof c.app.getPath==`function`?c.app.getPath(`userData`):l.default.join(process.cwd(),`test_userData`)),t=c.app&&typeof c.app.getPath==`function`?c.app.getPath(`appData`):process.cwd();return[l.default.join(e,`database.json`),l.default.join(t,`Maintenance App`,`database.json`),l.default.join(t,`maintenance_app`,`database.json`),l.default.join(process.cwd(),`database.json`)]}function E(){for(let e of T())if(u.default.existsSync(e))try{if(u.default.statSync(e).size>10)return e}catch{}return null}function D(e,t,n,r){let i=new Date().toISOString();e.prepare(`
    INSERT INTO legacy_migration_state (id, status, source_hash, error, updated_at) 
    VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      status = excluded.status,
      source_hash = COALESCE(excluded.source_hash, legacy_migration_state.source_hash),
      error = excluded.error,
      updated_at = excluded.updated_at
  `).run(t,n,r,i)}function ee(){let e=_();if(u.default.existsSync(e))try{let e=y(),t=e.prepare(`SELECT MAX(version) as version FROM schema_migrations`).get(),n=Number(t?.version||0)>=2;if(x(e)&&n){let t=e.prepare(`SELECT status FROM legacy_migration_state WHERE id = 1`).get();if(t?.status===`COMPLETED`||t?.status===`ADOPTED`)return console.log(`[SQLite Migration] Existing SQLite database is verified. Skipping migration.`),!0;if(t?.status!==`FAILED`&&t?.status!==`IN_PROGRESS`){let t=e.prepare(`SELECT count(*) as count FROM operations`).get().count,n=e.prepare(`SELECT count(*) as count FROM months`).get().count,r=e.prepare(`SELECT count(*) as count FROM customers`).get().count,i=e.prepare(`SELECT count(*) as count FROM technicians`).get().count,a=e.prepare(`SELECT count(*) as count FROM settings`).get().count>0;return t===0&&n<=1&&r===0&&i===0?(console.log(`[SQLite Migration] Fresh SQLite database detected. No legacy migration required.`),D(e,`COMPLETED`,`fresh_install`,null),!0):a&&n>0?(console.log(`[SQLite Migration] Populated V2 database detected without migration marker. Proceeding with Safe Adoption.`),D(e,`ADOPTED`,`safe_adoption`,null),!0):(console.error(`[SQLite Migration] Existing populated SQLite database is unrecognized (missing markers and fails adoption). Halting.`),O(`تم العثور على قاعدة بيانات موجودة تحتاج إلى التحقق قبل الترحيل. تم إيقاف التشغيل للحماية.`),!1)}}}catch(e){console.warn(`[SQLite Migration] Existing DB verification warning:`,e)}let t=E();if(!t){console.log(`[SQLite Migration] No legacy database found. Initializing fresh SQLite database.`);let e=y();return te(e),D(e,`COMPLETED`,`fresh_install`,null),!0}console.log(`[SQLite Migration] Legacy database found at: ${t}. Starting migration...`);let n;try{n=JSON.parse(u.default.readFileSync(t,`utf8`))}catch(e){return console.error(`[SQLite Migration] Failed to read or parse legacy database:`,e),O(`تعذر قراءة قاعدة البيانات القديمة: `+(e?.message||e)),!1}if(!w(n))return console.error(`[SQLite Migration] Legacy database schema validation failed.`),O(`قاعدة البيانات القديمة غير متوافقة أو تالفة. تم إيقاف الترحيل لحماية بياناتك.`),!1;let r=C(n),i=process.env.TEST_USER_DATA||(c.app&&typeof c.app.getPath==`function`?c.app.getPath(`userData`):l.default.join(process.cwd(),`test_userData`)),a=l.default.join(i,`backups_v2`);u.default.existsSync(a)||u.default.mkdirSync(a,{recursive:!0});let o=new Date,s=e=>e.toString().padStart(2,`0`),d=`${o.getFullYear()}-${s(o.getMonth()+1)}-${s(o.getDate())}_${s(o.getHours())}-${s(o.getMinutes())}-${s(o.getSeconds())}`,f=l.default.join(a,`migration-json-backup-${d}.json`);try{u.default.writeFileSync(f,JSON.stringify({backup_version:1,is_migration_backup:!0,created_at:o.toISOString(),source_file:t,database_hash:r,database:n},null,2),`utf8`)}catch(e){return console.error(`[SQLite Migration] Failed to create legacy backup:`,e),O(`فشل إنشاء نسخة احتياطية من البيانات القديمة قبل الترحيل. تم الإيقاف للأمان.`),!1}let p=y(),m=p.prepare(`SELECT status FROM legacy_migration_state WHERE id = 1`).get();(m?.status===`IN_PROGRESS`||m?.status===`FAILED`)&&console.log(`[SQLite Migration] Recovering from ${m.status} migration state...`),D(p,`IN_PROGRESS`,r,null);try{p.transaction(()=>{p.prepare(`DELETE FROM cash_transactions`).run(),p.prepare(`DELETE FROM payments`).run(),p.prepare(`DELETE FROM withdrawals`).run(),p.prepare(`DELETE FROM operations`).run(),p.prepare(`DELETE FROM customers`).run(),p.prepare(`DELETE FROM technicians`).run(),p.prepare(`DELETE FROM months`).run(),p.prepare(`DELETE FROM settings`).run(),p.prepare(`DELETE FROM ic_compatibilities`).run(),p.prepare(`DELETE FROM scrap_devices`).run(),p.prepare(`DELETE FROM common_devices`).run(),p.prepare(`DELETE FROM common_faults`).run();let e=n.settings||{};p.prepare(`INSERT OR REPLACE INTO settings (id, base_capital, shop_name, whatsapp_template, theme) VALUES (1, ?, ?, ?, ?)`).run(e.base_capital||0,e.shop_name||`مركز الصيانة`,e.whatsapp_template||`السلام عليكم [اسم_الزبون] 👋
نود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.
المبلغ المطلوب: [المبلغ]
شكراً لاختيارك مركزنا! 🛠️✨`,e.theme||`dark`);let t=Array.isArray(n.months)?n.months:[],r=p.prepare(`INSERT OR REPLACE INTO months (id, month_name, start_capital, is_closed, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?)`);if(t.length===0)r.run(1,o.toLocaleDateString(`ar-EG`,{month:`long`,year:`numeric`}),e.base_capital||0,0,o.toISOString(),null);else for(let e of t)r.run(e.id,e.month_name||`شهر غير مسمى`,Number(e.start_capital)||0,+!!e.is_closed,e.created_at||o.toISOString(),e.closed_at||null);let i=Array.isArray(n.technicians)?n.technicians:[],a=p.prepare(`INSERT OR REPLACE INTO technicians (id, name, profit_percentage, start_balance, is_active) VALUES (?, ?, ?, ?, ?)`);for(let e of i)a.run(e.id,e.name||`فني`,Number(e.profit_percentage)||0,Number(e.start_balance)||0,e.is_active===!1?0:1);let s=Array.isArray(n.customers)?n.customers:[],c=p.prepare(`INSERT OR REPLACE INTO customers (id, name, phone, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);for(let e of s)c.run(e.id,e.name||`عميل`,e.phone||``,e.notes||``,e.created_at||o.toISOString(),e.updated_at||o.toISOString());let l=Array.isArray(n.operations)?n.operations:[],u=p.prepare(`INSERT OR REPLACE INTO operations (id, date, month_id, technician_id, customer_id, customer_name, customer_phone, device, device_code, faults, cost, price, tech_profit_percentage, shop_profit, tech_profit, payment_status, status, paid_in_month_id, delivered_in_month_id, paid_at, paid_amount, notes, accessories, warranty_enabled, warranty_days, warranty_note, warranty_expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),d=p.prepare(`INSERT INTO payments (operation_id, month_id, amount, paid_at, payment_type, notes) VALUES (?, ?, ?, ?, ?, ?)`),f=p.prepare(`INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),m=t.length>0?t[0].id:1,h=new Set(i.map(e=>e.id)),g=new Set(t.map(e=>e.id));h.size===0&&(a.run(1,`فني افتراضي`,.5,0,1),h.add(1));let _=Array.from(h)[0];for(let e of l){let t=g.has(e.month_id)?e.month_id:m,n=h.has(e.technician_id)?e.technician_id:_,r=`[]`;Array.isArray(e.faults)?r=JSON.stringify(e.faults):typeof e.faults==`string`&&e.faults.trim()&&(r=JSON.stringify([e.faults.trim()]));let i=e.paid_in_month_id&&g.has(e.paid_in_month_id)?e.paid_in_month_id:null,a=e.delivered_in_month_id&&g.has(e.delivered_in_month_id)?e.delivered_in_month_id:null,s=e.paid_amount===void 0?e.payment_status===`cash`&&Number(e.price)||0:Number(e.paid_amount),c=e.paid_at||e.date||o.toISOString();if(u.run(e.id,e.date||o.toLocaleDateString(`en-GB`),t,n,e.customer_id||null,e.customer_name||`عميل`,e.customer_phone||``,e.device||`جهاز`,e.device_code||null,r,Number(e.cost)||0,Number(e.price)||0,e.tech_profit_percentage===void 0?null:Number(e.tech_profit_percentage),Number(e.shop_profit)||0,Number(e.tech_profit)||0,[`cash`,`debt`,`partial`].includes(e.payment_status)?e.payment_status:`cash`,[`under_maintenance`,`completed`,`delivered`,`cancelled`].includes(e.status)?e.status:`delivered`,i,a,s>0?c:null,s,e.notes||null,e.accessories||null,+!!e.warranty_enabled,e.warranty_days?Number(e.warranty_days):null,e.warranty_note||null,e.warranty_expiry_date||null),s>0){let n=i||t;d.run(e.id,n,s,c,`cash`,`رصيد مدفوع مسجل من البيانات السابقة`),f.run(`CUSTOMER_PAYMENT`,s,c,n,e.id,`دفعة عملية #`+e.id,c)}}let v=Array.isArray(n.withdrawals)?n.withdrawals:[],y=p.prepare(`INSERT OR REPLACE INTO withdrawals (id, date, amount, notes, type, technician_id, month_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);for(let e of v){let t=g.has(e.month_id)?e.month_id:m,n=e.technician_id&&h.has(e.technician_id)?e.technician_id:null,r=[`shop_withdrawal`,`tech_withdrawal`].includes(e.type)?e.type:`shop_withdrawal`,i=Number(e.amount)||0,a=e.date||o.toLocaleDateString(`en-GB`),s=e.notes||e.description||``;if(y.run(e.id,a,i,s,r,n,t),i>0){let e=r===`shop_withdrawal`?`SHOP_WITHDRAWAL`:`TECHNICIAN_PAYMENT`;f.run(e,i,a,t,n,s,a)}}let b=Array.isArray(n.common_devices)?n.common_devices:[],x=p.prepare(`INSERT OR IGNORE INTO common_devices (name) VALUES (?)`);for(let e of b)typeof e==`string`&&e.trim()&&x.run(e.trim());let S=Array.isArray(n.common_faults)?n.common_faults:[],C=p.prepare(`INSERT OR IGNORE INTO common_faults (name) VALUES (?)`);for(let e of S)typeof e==`string`&&e.trim()&&C.run(e.trim());let w=Array.isArray(n.ic_compatibilities)?n.ic_compatibilities:[],T=p.prepare(`INSERT OR REPLACE INTO ic_compatibilities (id, ic_number, component_type, compatible_devices, notes) VALUES (?, ?, ?, ?, ?)`);for(let e of w)T.run(e.id||Date.now(),e.ic_number||``,e.component_type||``,e.compatible_devices||``,e.notes||``);let E=Array.isArray(n.scrap_devices)?n.scrap_devices:[],D=p.prepare(`INSERT OR REPLACE INTO scrap_devices (id, device_name, device_model, quantity) VALUES (?, ?, ?, ?)`);for(let e of E)D.run(e.id||Date.now(),e.device_name||``,e.device_model||``,Number(e.quantity)||1)})();let e=p.prepare(`SELECT count(*) as count FROM operations`).get().count,t=p.prepare(`SELECT count(*) as count FROM technicians`).get().count,i=p.prepare(`SELECT count(*) as count FROM months`).get().count,a=p.prepare(`SELECT count(*) as count FROM withdrawals`).get().count,s=Array.isArray(n.operations)?n.operations:[],c=Array.isArray(n.technicians)?n.technicians:[],l=Array.isArray(n.months)?n.months:[],u=Array.isArray(n.withdrawals)?n.withdrawals:[];if(e!==s.length||t<c.length||i<l.length||a!==u.length)throw Error(`Record count mismatch: Ops(${e}/${s.length}), Techs(${t}/${c.length}), Months(${i}/${l.length}), Withs(${a}/${u.length})`);let d=p.prepare(`SELECT SUM(price) as total_price, SUM(cost) as total_cost, SUM(shop_profit) as total_shop_profit, SUM(tech_profit) as total_tech_profit FROM operations`).get(),f=s.reduce((e,t)=>e+(Number(t.price)||0),0),m=s.reduce((e,t)=>e+(Number(t.cost)||0),0),h=s.reduce((e,t)=>e+(Number(t.shop_profit)||0),0),g=s.reduce((e,t)=>e+(Number(t.tech_profit)||0),0),_=(e,t)=>Math.abs((e||0)-(t||0))<.01;if(!_(d.total_price,f)||!_(d.total_cost,m)||!_(d.total_shop_profit,h)||!_(d.total_tech_profit,g))throw Error(`Financial sum mismatch: Price(${d.total_price}/${f}), Cost(${d.total_cost}/${m}), ShopProfit(${d.total_shop_profit}/${h}), TechProfit(${d.total_tech_profit}/${g})`);return D(p,`COMPLETED`,r,null),console.log(`[SQLite Migration] Migration completed and verified with 100% data integrity!`),!0}catch(e){console.error(`[SQLite Migration] Migration transaction failed:`,e);try{D(p,`FAILED`,r,e?.message||String(e))}catch{}return O(`فشل ترحيل البيانات إلى SQLite: `+(e?.message||e)+`
تم التراجع والبيانات القديمة في أمان.`),!1}}function te(e){let t=c.app&&typeof c.app.getAppPath==`function`?c.app.getAppPath():process.cwd(),n=l.default.join(t,`default_seed.json`);if(u.default.existsSync(n))try{let t=JSON.parse(u.default.readFileSync(n,`utf8`));if(Array.isArray(t.common_devices)){let n=e.prepare(`INSERT OR IGNORE INTO common_devices (name) VALUES (?)`);for(let e of t.common_devices)n.run(e)}if(Array.isArray(t.common_faults)){let n=e.prepare(`INSERT OR IGNORE INTO common_faults (name) VALUES (?)`);for(let e of t.common_faults)n.run(e)}if(Array.isArray(t.ic_compatibilities)){let n=e.prepare(`INSERT OR IGNORE INTO ic_compatibilities (id, ic_number, component_type, compatible_devices, notes) VALUES (?, ?, ?, ?, ?)`),r=1;for(let e of t.ic_compatibilities)n.run(r++,e.ic_number,e.component_type||``,e.compatible_devices||``,e.notes||``)}}catch(e){console.warn(`Failed to seed initial default_seed.json:`,e)}e.prepare(`SELECT count(*) as count FROM months`).get().count===0&&e.prepare(`INSERT INTO months (id, month_name, start_capital, is_closed, created_at, closed_at) VALUES (1, ?, 0, 0, ?, NULL)`).run(new Date().toLocaleDateString(`ar-EG`,{month:`long`,year:`numeric`}),new Date().toISOString()),e.prepare(`SELECT count(*) as count FROM settings`).get().count===0&&e.prepare(`INSERT INTO settings (id, base_capital, shop_name, whatsapp_template, theme) VALUES (1, 0, ?, ?, ?)`).run(`مركز الصيانة`,`السلام عليكم [اسم_الزبون] 👋
نود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.
المبلغ المطلوب: [المبلغ]
شكراً لاختيارك مركزنا! 🛠️✨`,`dark`)}function O(e){try{c.dialog.showErrorBox(`خطأ في ترحيل البيانات`,e)}catch{console.error(`[Error Box]`,e)}}var k=(typeof globalThis.require==`function`?globalThis.require:require)(`better-sqlite3`),ne=30;function A(){let e=process.env.TEST_USER_DATA||(c.app&&typeof c.app.getPath==`function`?c.app.getPath(`userData`):l.default.join(process.cwd(),`test_userData`)),t=l.default.join(e,`backups_v2`);return u.default.existsSync(t)||u.default.mkdirSync(t,{recursive:!0}),t}function re(e){let t=u.default.readFileSync(e);return d.default.createHash(`sha256`).update(t).digest(`hex`)}async function j(e=!1){try{let t=v();if(!x(t))throw Error(`DATABASE_CORRUPTED_BEFORE_BACKUP`);let n=A(),r=new Date,i=e=>e.toString().padStart(2,`0`),a=`backup-${`${r.getFullYear()}-${i(r.getMonth()+1)}-${i(r.getDate())}_${i(r.getHours())}-${i(r.getMinutes())}-${i(r.getSeconds())}`}.db`,o=l.default.join(n,a);await t.backup(o);let s=new k(o,{readonly:!0}),c=x(s);if(s.close(),!c)throw u.default.existsSync(o)&&u.default.unlinkSync(o),Error(`BACKUP_INTEGRITY_CHECK_FAILED`);let d=u.default.statSync(o),f=re(o),p=t.prepare(`SELECT count(*) as count FROM operations`).get().count,m=t.prepare(`SELECT count(*) as count FROM months`).get().count,h=t.prepare(`SELECT count(*) as count FROM technicians`).get().count,g=t.prepare(`SELECT count(*) as count FROM withdrawals`).get().count,_={filename:a,created_at:r.toISOString(),size_kb:Math.round(d.size/1024),operations_count:p,months_count:m,technicians_count:h,withdrawals_count:g,sha256:f,schema_version:2,is_manual:e};return u.default.writeFileSync(l.default.join(n,`${a}.meta.json`),JSON.stringify(_,null,2),`utf8`),ae(n),{success:!0,filename:a,metadata:_}}catch(e){return console.error(`[SQLite Backup] Create backup failed:`,e),{success:!1,reason:e?.message||`BACKUP_FAILED`}}}function M(){let e=A();if(!u.default.existsSync(e))return[];let t=[];for(let n of u.default.readdirSync(e))if(n.endsWith(`.meta.json`))try{let r=JSON.parse(u.default.readFileSync(l.default.join(e,n),`utf8`));u.default.existsSync(l.default.join(e,r.filename))&&t.push(r)}catch(e){console.warn(`[SQLite Backup] Failed to read metadata for ${n}:`,e)}return t.sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())}async function ie(e){let t=A(),n=l.default.join(t,e),r=_();if(!u.default.existsSync(n))return{success:!1,reason:`BACKUP_FILE_NOT_FOUND`};try{let e=new k(n,{readonly:!0}),t=x(e);if(e.close(),!t)return{success:!1,reason:`BACKUP_FILE_CORRUPTED`}}catch(e){return{success:!1,reason:`BACKUP_OPEN_FAILED: `+(e?.message||e)}}let i=`pre-restore-${Date.now()}.db`,a=l.default.join(t,i);try{await v().backup(a)}catch(e){return console.warn(`[SQLite Restore] Could not create pre-restore snapshot:`,e),{success:!1,reason:`PRE_RESTORE_BACKUP_FAILED`}}S();let o=`${r}-wal`,s=`${r}-shm`;try{u.default.existsSync(o)&&u.default.unlinkSync(o),u.default.existsSync(s)&&u.default.unlinkSync(s)}catch(e){return y(r),{success:!1,reason:`DATABASE_AUXILIARY_FILE_REMOVE_FAILED: `+(e?.message||e)}}let c=l.default.join(t,`.restore-${process.pid}-${Date.now()}.db`);try{u.default.copyFileSync(n,c);let t=new k(c,{readonly:!0}),i=x(t);if(t.close(),!i)throw Error(`RESTORE_TEMP_INTEGRITY_FAILED`);if(u.default.renameSync(c,r),!x(y(r)))throw Error(`RESTORED_DB_INTEGRITY_FAILED`);return console.log(`[SQLite Restore] Successfully restored database from: ${e}`),{success:!0}}catch(e){console.error(`[SQLite Restore] Restore failed, attempting rollback:`,e);try{u.default.existsSync(c)&&u.default.unlinkSync(c)}catch{}if(S(),u.default.existsSync(a))try{let e=l.default.join(t,`.rollback-${process.pid}-${Date.now()}.db`);u.default.copyFileSync(a,e);let n=new k(e,{readonly:!0}),i=x(n);if(n.close(),!i)throw Error(`ROLLBACK_SNAPSHOT_CORRUPTED`);u.default.renameSync(e,r),y(r)}catch(e){console.error(`[SQLite Restore] Rollback failed critically:`,e)}return{success:!1,reason:e?.message||`RESTORE_FAILED`}}}function ae(e){try{let t=M();if(t.length>ne)for(let n of t.slice(ne)){let t=l.default.join(e,n.filename),r=l.default.join(e,`${n.filename}.meta.json`);u.default.existsSync(t)&&u.default.unlinkSync(t),u.default.existsSync(r)&&u.default.unlinkSync(r)}}catch(e){console.warn(`[SQLite Backup] Failed to clean old backups:`,e)}}function N(){let e=v(),t=e.prepare(`SELECT * FROM settings WHERE id = 1`).get();return t||=(e.prepare(`
      INSERT INTO settings (id, base_capital, shop_name, whatsapp_template, theme)
      VALUES (1, 0, 'مركز الصيانة', 'السلام عليكم [اسم_الزبون] 👋
نود إعلامك بأن جهازك ([اسم_الجهاز]) قد تمت صيانته وهو جاهز للاستلام.
المبلغ المطلوب: [المبلغ]
شكراً لاختيارك مركزنا! 🛠️✨', 'dark')
    `).run(),e.prepare(`SELECT * FROM settings WHERE id = 1`).get()),t}function oe(e){let t=v(),n={...N(),...e};try{return t.prepare(`
      UPDATE settings
      SET base_capital = ?, shop_name = ?, whatsapp_template = ?, theme = ?
      WHERE id = 1
    `).run(Number(n.base_capital)||0,n.shop_name||`مركز الصيانة`,n.whatsapp_template||``,n.theme||`dark`),{success:!0}}catch(e){return console.error(`[SettingsRepo] Update failed:`,e),{success:!1,reason:`DATABASE_SAVE_FAILED`}}}function se(){return v().prepare(`SELECT * FROM months ORDER BY id ASC`).all().map(e=>({...e,is_closed:!!e.is_closed}))}function P(){let e=v(),t=e.prepare(`SELECT * FROM months WHERE is_closed = 0 ORDER BY id DESC LIMIT 1`).get();if(t||=e.prepare(`SELECT * FROM months ORDER BY id DESC LIMIT 1`).get(),!t){let n=new Date;e.prepare(`
      INSERT INTO months (id, month_name, start_capital, is_closed, created_at, closed_at)
      VALUES (1, ?, 0, 0, ?, NULL)
    `).run(n.toLocaleDateString(`ar-EG`,{month:`long`,year:`numeric`}),n.toISOString()),t=e.prepare(`SELECT * FROM months WHERE id = 1`).get()}return{...t,is_closed:!!t.is_closed}}function ce(){let e=v().prepare(`SELECT MAX(id) as maxId FROM months`).get();return e&&e.maxId?e.maxId+1:1}function F(e){let t=v(),n=P();try{return{success:!0,newMonth:t.transaction(()=>{let r=new Date;t.prepare(`UPDATE months SET is_closed = 1, closed_at = ? WHERE id = ?`).run(r.toISOString(),n.id);let i=ce(),a=r.toLocaleDateString(`ar-EG`,{month:`long`,year:`numeric`});return t.prepare(`
        INSERT INTO months (id, month_name, start_capital, is_closed, created_at, closed_at)
        VALUES (?, ?, ?, 0, ?, NULL)
      `).run(i,a,Number(e)||0,r.toISOString()),{id:i,month_name:a,start_capital:Number(e)||0,is_closed:!1,created_at:r.toISOString(),closed_at:null}})()}}catch(e){return console.error(`[MonthsRepo] Close month transaction failed:`,e),{success:!1,reason:e?.message||`CLOSE_MONTH_FAILED`}}}function le(){return v().prepare(`SELECT * FROM technicians WHERE is_active = 1 ORDER BY id ASC`).all().map(e=>({...e,is_active:!!e.is_active}))}function I(){return v().prepare(`SELECT * FROM technicians ORDER BY id ASC`).all().map(e=>({...e,is_active:!!e.is_active}))}function L(e){let t=v().prepare(`SELECT * FROM technicians WHERE id = ?`).get(e);return t?{...t,is_active:!!t.is_active}:null}function ue(e,t){let n=v(),r=Date.now(),i=Number(t)||0;try{return n.prepare(`
      INSERT INTO technicians (id, name, profit_percentage, start_balance, is_active)
      VALUES (?, ?, ?, 0, 1)
    `).run(r,e.trim(),i),{success:!0,data:{id:r,name:e.trim(),profit_percentage:i,start_balance:0,is_active:!0}}}catch(e){return console.error(`[TechniciansRepo] Add technician failed:`,e),{success:!1,reason:e?.message||`ADD_TECHNICIAN_FAILED`}}}function de(e,t,n){let r=v(),i=Number(n)||0;try{return r.prepare(`
      UPDATE technicians
      SET name = ?, profit_percentage = ?
      WHERE id = ?
    `).run(t.trim(),i,e).changes===0?{success:!1,reason:`NOT_FOUND`}:{success:!0,data:L(e)||void 0}}catch(e){return console.error(`[TechniciansRepo] Edit technician failed:`,e),{success:!1,reason:e?.message||`EDIT_TECHNICIAN_FAILED`}}}function fe(e){let t=v();try{return t.prepare(`UPDATE technicians SET is_active = 0 WHERE id = ?`).run(e).changes===0?{success:!1,reason:`NOT_FOUND`}:{success:!0}}catch(e){return console.error(`[TechniciansRepo] Delete technician failed:`,e),{success:!1,reason:e?.message||`DELETE_TECHNICIAN_FAILED`}}}function pe(){try{return v().prepare(`SELECT * FROM customers ORDER BY created_at DESC`).all()}catch(e){return console.error(`[CustomersRepo] getCustomers failed:`,e),[]}}function me(){try{let e=v(),t=e.prepare(`SELECT * FROM customers ORDER BY created_at DESC`).all(),n=new Set(t.map(e=>e.name.trim())),r=new Set(t.map(e=>(e.phone||``).trim()).filter(Boolean)),i=e.prepare(`
      SELECT DISTINCT customer_name AS name, customer_phone AS phone
      FROM operations
      WHERE customer_name IS NOT NULL AND customer_name != ''
      ORDER BY customer_name
    `).all(),a=[],o=-1;for(let e of i){let t=(e.name||``).trim(),i=(e.phone||``).trim();t&&(n.has(t)||i&&r.has(i)||a.push({id:o--,name:t,phone:i,notes:``,created_at:null,updated_at:null}))}return[...t,...a]}catch(e){console.error(`[CustomersRepo] getCustomersWithOrphans failed:`,e);try{return v().prepare(`SELECT * FROM customers ORDER BY created_at DESC`).all()}catch{return[]}}}function R(e){return v().prepare(`SELECT * FROM customers WHERE id = ?`).get(e)||null}function he(e,t){let n=v();if(t&&t.trim()){let e=n.prepare(`SELECT * FROM customers WHERE phone = ? LIMIT 1`).get(t.trim());if(e)return e}if(e&&e.trim()){let t=n.prepare(`SELECT * FROM customers WHERE name = ? LIMIT 1`).get(e.trim());if(t)return t}return null}function z(e){let t=v(),n=e.id||Date.now()+Math.floor(Math.random()*1e3),r=new Date().toISOString();try{return t.prepare(`
      INSERT INTO customers (id, name, phone, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(n,e.name?.trim()||`عميل`,e.phone?.trim()||``,e.notes?.trim()||``,e.created_at||r,r),{success:!0,data:R(n)||void 0}}catch(e){return console.error(`[CustomersRepo] Add customer failed:`,e),{success:!1,reason:e?.message||`ADD_CUSTOMER_FAILED`}}}function ge(e,t){let n=v(),r=R(e);if(!r)return{success:!1,reason:`NOT_FOUND`};let i=new Date().toISOString(),a=t.name===void 0?r.name:t.name.trim(),o=t.phone===void 0?r.phone:t.phone.trim(),s=t.notes===void 0?r.notes||``:t.notes.trim();try{return n.prepare(`
      UPDATE customers
      SET name = ?, phone = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(a,o,s,i,e),{success:!0,data:R(e)||void 0}}catch(e){return console.error(`[CustomersRepo] Edit customer failed:`,e),{success:!1,reason:e?.message||`EDIT_CUSTOMER_FAILED`}}}function _e(e){let t=v();try{return t.prepare(`DELETE FROM customers WHERE id = ?`).run(e).changes===0?{success:!1,reason:`NOT_FOUND`}:{success:!0}}catch(e){return console.error(`[CustomersRepo] Delete customer failed:`,e),{success:!1,reason:e?.message||`DELETE_CUSTOMER_FAILED`}}}function B(e){let t=[];if(e.faults)try{t=JSON.parse(e.faults),Array.isArray(t)||(t=[String(e.faults)])}catch{t=typeof e.faults==`string`?[e.faults]:[]}let n=Number(e.price)||0,r=Number(e.cost)||0,i=e.paid_amount!==null&&e.paid_amount!==void 0?Number(e.paid_amount):e.payment_status===`cash`?n:0;return{...e,price:n,cost:r,shop_profit:Number(e.shop_profit)||0,tech_profit:Number(e.tech_profit)||0,tech_profit_percentage:e.tech_profit_percentage===null?void 0:Number(e.tech_profit_percentage),paid_amount:i,faults:t,warranty_enabled:!!e.warranty_enabled,warranty_days:e.warranty_days?Number(e.warranty_days):void 0,technician_name:e.technician_name||void 0}}function ve(){let e=v(),t=P();return e.prepare(`
    SELECT o.*, t.name as technician_name
    FROM operations o
    LEFT JOIN technicians t ON o.technician_id = t.id
    WHERE o.month_id = ?
       OR o.status IN ('under_maintenance', 'completed')
       OR (o.payment_status IN ('debt', 'partial') AND (o.price - COALESCE(o.paid_amount, 0)) > 0)
    ORDER BY o.id DESC
  `).all(t.id).map(B)}function V(){return v().prepare(`
    SELECT o.*, t.name as technician_name
    FROM operations o
    LEFT JOIN technicians t ON o.technician_id = t.id
    ORDER BY o.id DESC
  `).all().map(B)}function H(e){let t=v().prepare(`
    SELECT o.*, t.name as technician_name
    FROM operations o
    LEFT JOIN technicians t ON o.technician_id = t.id
    WHERE o.id = ?
  `).get(e);return t?B(t):null}function ye(e,t){let n=v(),r=[];return e?r=n.prepare(`
      SELECT o.*, t.name as technician_name
      FROM operations o
      LEFT JOIN technicians t ON o.technician_id = t.id
      WHERE o.customer_id = ?
      ORDER BY o.id DESC
    `).all(e):t&&t.trim()&&(r=n.prepare(`
      SELECT o.*, t.name as technician_name
      FROM operations o
      LEFT JOIN technicians t ON o.technician_id = t.id
      WHERE o.customer_phone = ?
      ORDER BY o.id DESC
    `).all(t.trim())),r.map(B)}function be(){let e=v().prepare(`SELECT MAX(id) as maxId FROM operations WHERE id < 100000000000`).get();return e&&e.maxId?e.maxId+1:1}function U(e){let t=v(),n=P(),r=Number(e.price)||0,i=Number(e.cost)||0,a=r-i,o=Number(e.technician_id)||1,s=L(o),c=e.tech_profit_percentage===void 0?s?s.profit_percentage:.5:Number(e.tech_profit_percentage),l=a*c,u=a-l,d=[`cash`,`debt`,`partial`].includes(e.payment_status)?e.payment_status:`cash`,f=0;d===`cash`?f=r:d===`partial`&&(f=Math.max(0,Math.min(r,Number(e.paid_amount)||0)));let p=[`under_maintenance`,`completed`,`delivered`,`cancelled`].includes(e.status)?e.status:`under_maintenance`,m=e.month_id||n.id,h=p===`delivered`?n.id:null,g=f>0?n.id:null;try{return{success:!0,data:H(t.transaction(()=>{let a=e.customer_id;if(e.customer_name&&e.customer_name.trim()){let t=he(e.customer_name,e.customer_phone);if(t)a=t.id;else{let t=z({name:e.customer_name.trim(),phone:e.customer_phone?.trim()||``});t.success&&t.data&&(a=t.data.id)}}let s=e.id||be(),_=JSON.stringify(Array.isArray(e.faults)?e.faults:e.faults?[e.faults]:[]),v=new Date().toISOString();return t.prepare(`
        INSERT INTO operations (
          id, date, month_id, technician_id, customer_id, customer_name, customer_phone,
          device, device_code, faults, cost, price, tech_profit_percentage, shop_profit,
          tech_profit, payment_status, status, paid_in_month_id, delivered_in_month_id,
          paid_at, paid_amount, notes, accessories, warranty_enabled, warranty_days,
          warranty_note, warranty_expiry_date
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?
        )
      `).run(s,e.date||new Date().toLocaleDateString(`en-GB`),m,o,a||null,e.customer_name?.trim()||`عميل`,e.customer_phone?.trim()||``,e.device?.trim()||`جهاز`,e.device_code?.trim()||null,_,i,r,c,u,l,d,p,g,h,f>0?e.paid_at||v:null,f,e.notes?.trim()||null,e.accessories?.trim()||null,+!!e.warranty_enabled,e.warranty_days?Number(e.warranty_days):null,e.warranty_note?.trim()||null,e.warranty_expiry_date?.trim()||null),f>0&&(t.prepare(`
          INSERT INTO payments (operation_id, month_id, amount, paid_at, payment_type, notes)
          VALUES (?, ?, ?, ?, 'cash', 'دفعة تسجيل العملية')
        `).run(s,n.id,f,v),t.prepare(`
          INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`CUSTOMER_PAYMENT`,f,e.date||new Date().toLocaleDateString(`en-GB`),n.id,s,`دفعة مقدمة - عملية #`+s,v)),s})())||void 0}}catch(e){return console.error(`[OperationsRepo] Add operation failed:`,e),{success:!1,reason:e?.message||`ADD_OPERATION_FAILED`}}}function xe(e,t){let n=v(),r=H(e);if(!r)return{success:!1,reason:`NOT_FOUND`};let i=P(),a=t.price===void 0?r.price:Number(t.price),o=t.cost===void 0?r.cost:Number(t.cost),s=a-o,c=t.technician_id===void 0?r.technician_id:Number(t.technician_id),l=L(c),u=t.tech_profit_percentage===void 0?r.tech_profit_percentage===void 0?l?l.profit_percentage:.5:r.tech_profit_percentage:Number(t.tech_profit_percentage),d=s*u,f=s-d,p=t.payment_status||r.payment_status,m=r.paid_amount||0;p===`cash`?m=a:p===`debt`?m=0:p===`partial`&&(m=t.paid_amount===void 0?r.paid_amount||0:Number(t.paid_amount),m=Math.max(0,Math.min(a,m)));let h=t.status||r.status,g=r.delivered_in_month_id;h===`delivered`?g||=i.id:g=void 0;let _=r.paid_in_month_id;m>0&&!_?_=i.id:m===0&&(_=void 0);try{return n.transaction(()=>{let s=JSON.stringify(Array.isArray(t.faults)?t.faults:r.faults||[]);n.prepare(`
        UPDATE operations
        SET
          date = ?, technician_id = ?, customer_id = ?, customer_name = ?, customer_phone = ?,
          device = ?, device_code = ?, faults = ?, cost = ?, price = ?,
          tech_profit_percentage = ?, shop_profit = ?, tech_profit = ?,
          payment_status = ?, status = ?, paid_in_month_id = ?, delivered_in_month_id = ?,
          paid_at = ?, paid_amount = ?, notes = ?, accessories = ?,
          warranty_enabled = ?, warranty_days = ?, warranty_note = ?, warranty_expiry_date = ?
        WHERE id = ?
      `).run(t.date||r.date,c,t.customer_id===void 0?r.customer_id:t.customer_id,t.customer_name?.trim()||r.customer_name,t.customer_phone?.trim()||r.customer_phone,t.device?.trim()||r.device,t.device_code===void 0?r.device_code:t.device_code,s,o,a,u,f,d,p,h,_||null,g||null,m>0?t.paid_at||r.paid_at||new Date().toISOString():null,m,t.notes===void 0?r.notes:t.notes,t.accessories===void 0?r.accessories:t.accessories,(t.warranty_enabled===void 0?r.warranty_enabled:t.warranty_enabled)?1:0,t.warranty_days===void 0?r.warranty_days:t.warranty_days,t.warranty_note===void 0?r.warranty_note:t.warranty_note,t.warranty_expiry_date===void 0?r.warranty_expiry_date:t.warranty_expiry_date,e);let l=r.paid_amount||0;m>l&&n.prepare(`
          INSERT INTO payments (operation_id, month_id, amount, paid_at, payment_type, notes)
          VALUES (?, ?, ?, ?, 'cash', 'دفعة إضافية من تعديل العملية')
        `).run(e,i.id,m-l,new Date().toISOString())})(),{success:!0,data:H(e)||void 0}}catch(e){return console.error(`[OperationsRepo] Edit operation failed:`,e),{success:!1,reason:e?.message||`EDIT_OPERATION_FAILED`}}}function Se(e){let t=v();try{return t.transaction(()=>{if(t.prepare(`DELETE FROM payments WHERE operation_id = ?`).run(e),t.prepare(`DELETE FROM operations WHERE id = ?`).run(e).changes===0)throw Error(`NOT_FOUND`)})(),{success:!0}}catch(e){return console.error(`[OperationsRepo] Delete operation failed:`,e),{success:!1,reason:e?.message||`DELETE_OPERATION_FAILED`}}}function Ce(){return v().prepare(`
    SELECT o.*, t.name as technician_name
    FROM operations o
    LEFT JOIN technicians t ON o.technician_id = t.id
    WHERE o.payment_status IN ('debt', 'partial')
      AND (o.price - COALESCE(o.paid_amount, 0)) > 0
    ORDER BY o.id DESC
  `).all().map(B)}function we(e){let t=v(),n=H(e);if(!n)return{success:!1,reason:`NOT_FOUND`};let r=P(),i=Math.max(0,n.price-(n.paid_amount||0));try{return t.transaction(()=>{let n=new Date().toISOString();t.prepare(`
        UPDATE operations
        SET payment_status = 'cash',
            paid_amount = price,
            paid_at = ?,
            paid_in_month_id = ?
        WHERE id = ?
      `).run(n,r.id,e),i>0&&(t.prepare(`
          INSERT INTO payments (operation_id, month_id, amount, paid_at, payment_type, notes)
          VALUES (?, ?, ?, ?, 'cash', 'تسديد دين بالكامل')
        `).run(e,r.id,i,n),t.prepare(`
          INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`CUSTOMER_PAYMENT`,i,n,r.id,e,`سداد دين - عملية #`+e,n))})(),{success:!0,data:H(e)||void 0}}catch(e){return console.error(`[OperationsRepo] Pay debt failed:`,e),{success:!1,reason:e?.message||`PAY_DEBT_FAILED`}}}function W(e){return{...e,amount:Number(e.amount)||0,description:e.notes||e.description||``,technician_name:e.technician_name||null}}function G(){let e=v(),t=P();return e.prepare(`
    SELECT w.*, t.name as technician_name
    FROM withdrawals w
    LEFT JOIN technicians t ON w.technician_id = t.id
    WHERE w.month_id = ?
    ORDER BY w.id DESC
  `).all(t.id).map(W)}function Te(){return v().prepare(`
    SELECT w.*, t.name as technician_name
    FROM withdrawals w
    LEFT JOIN technicians t ON w.technician_id = t.id
    ORDER BY w.id DESC
  `).all().map(W)}function K(e){let t=v().prepare(`
    SELECT w.*, t.name as technician_name
    FROM withdrawals w
    LEFT JOIN technicians t ON w.technician_id = t.id
    WHERE w.id = ?
  `).get(e);return t?W(t):null}function Ee(e){let t=v(),n=P(),r=e.id||Date.now(),i=e.type===`tech_withdrawal`?`tech_withdrawal`:`shop_withdrawal`,a=e.type===`tech_withdrawal`?`TECHNICIAN_PAYMENT`:`SHOP_WITHDRAWAL`,o=i===`tech_withdrawal`&&Number(e.technician_id)||null,s=e.month_id||n.id,c=Number(e.amount)||0,l=e.notes||e.description||``,u=e.date||new Date().toLocaleDateString(`en-GB`);try{return t.transaction(()=>{t.prepare(`
        INSERT INTO withdrawals (id, date, amount, notes, type, technician_id, month_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(r,u,c,l,i,o,s),t.prepare(`
        INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(a,c,u,s,r,l,new Date().toISOString())})(),{success:!0,data:K(r)||void 0}}catch(e){return console.error(`[WithdrawalsRepo] Add withdrawal failed:`,e),{success:!1,reason:e?.message||`ADD_WITHDRAWAL_FAILED`}}}function De(e,t){let n=v(),r=K(e);if(!r)return{success:!1,reason:`NOT_FOUND`};let i=t.type===void 0?r.type:t.type,a=i===`tech_withdrawal`?`TECHNICIAN_PAYMENT`:`SHOP_WITHDRAWAL`,o=i===`tech_withdrawal`?t.technician_id===void 0?r.technician_id:t.technician_id:null,s=t.amount===void 0?r.amount:Number(t.amount),c=t.notes===void 0?t.description===void 0?r.description:t.description:t.notes,l=t.date||r.date;try{return n.transaction(()=>{n.prepare(`
        UPDATE withdrawals
        SET date = ?, amount = ?, notes = ?, type = ?, technician_id = ?
        WHERE id = ?
      `).run(l,s,c,i,o,e),n.prepare(`
        UPDATE cash_transactions
        SET amount = ?, date = ?, description = ?, type = ?
        WHERE reference_id = ? AND type IN ('SHOP_WITHDRAWAL', 'TECHNICIAN_PAYMENT')
      `).run(s,l,c,a,e)})(),{success:!0,data:K(e)||void 0}}catch(e){return console.error(`[WithdrawalsRepo] Edit withdrawal failed:`,e),{success:!1,reason:e?.message||`EDIT_WITHDRAWAL_FAILED`}}}function Oe(e){let t=v();try{let n=!1;return t.transaction(()=>{t.prepare(`DELETE FROM cash_transactions WHERE reference_id = ? AND type IN ('SHOP_WITHDRAWAL', 'TECHNICIAN_PAYMENT')`).run(e),n=t.prepare(`DELETE FROM withdrawals WHERE id = ?`).run(e).changes>0})(),n?{success:!0}:{success:!1,reason:`NOT_FOUND`}}catch(e){return console.error(`[WithdrawalsRepo] Delete withdrawal failed:`,e),{success:!1,reason:e?.message||`DELETE_WITHDRAWAL_FAILED`}}}function q(){let e=v();return{common_devices:e.prepare(`SELECT name FROM common_devices ORDER BY id ASC`).all().map(e=>e.name),common_faults:e.prepare(`SELECT name FROM common_faults ORDER BY id ASC`).all().map(e=>e.name)}}function ke(e,t){let n=v(),r=t.trim();if(!r)return{success:!1,reason:`EMPTY_VALUE`};try{let t=e===`device`?`common_devices`:`common_faults`;return n.prepare(`INSERT OR IGNORE INTO ${t} (name) VALUES (?)`).run(r),{success:!0,data:q()}}catch(e){return console.error(`[QuickListsRepo] Add quick list item failed:`,e),{success:!1,reason:e?.message||`ADD_ITEM_FAILED`}}}function Ae(e,t){let n=v(),r=t.trim();try{let t=e===`device`?`common_devices`:`common_faults`;return n.prepare(`DELETE FROM ${t} WHERE name = ?`).run(r),{success:!0,data:q()}}catch(e){return console.error(`[QuickListsRepo] Remove quick list item failed:`,e),{success:!1,reason:e?.message||`REMOVE_ITEM_FAILED`}}}function J(){return v().prepare(`SELECT * FROM ic_compatibilities ORDER BY id DESC`).all()}function Y(e){return v().prepare(`SELECT * FROM ic_compatibilities WHERE id = ?`).get(e)||null}function X(e){let t=v(),n=e.id||Date.now();try{return t.prepare(`
      INSERT INTO ic_compatibilities (id, ic_number, component_type, compatible_devices, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(n,e.ic_number?.trim()||``,e.component_type?.trim()||``,e.compatible_devices?.trim()||``,e.notes?.trim()||``),{success:!0,data:Y(n)||void 0}}catch(e){return console.error(`[IcRepo] Add IC failed:`,e),{success:!1,reason:e?.message||`ADD_IC_FAILED`}}}function je(e,t){let n=v(),r=Y(e);if(!r)return{success:!1,reason:`NOT_FOUND`};try{return n.prepare(`
      UPDATE ic_compatibilities
      SET ic_number = ?, component_type = ?, compatible_devices = ?, notes = ?
      WHERE id = ?
    `).run(t.ic_number===void 0?r.ic_number:t.ic_number.trim(),t.component_type===void 0?r.component_type:t.component_type.trim(),t.compatible_devices===void 0?r.compatible_devices:t.compatible_devices.trim(),t.notes===void 0?r.notes:t.notes.trim(),e),{success:!0,data:Y(e)||void 0}}catch(e){return console.error(`[IcRepo] Edit IC failed:`,e),{success:!1,reason:e?.message||`EDIT_IC_FAILED`}}}function Me(e){let t=v();try{return t.prepare(`DELETE FROM ic_compatibilities WHERE id = ?`).run(e).changes===0?{success:!1,reason:`NOT_FOUND`}:{success:!0}}catch(e){return console.error(`[IcRepo] Delete IC failed:`,e),{success:!1,reason:e?.message||`DELETE_IC_FAILED`}}}function Z(){return v().prepare(`SELECT * FROM scrap_devices ORDER BY id DESC`).all()}function Q(e){return v().prepare(`SELECT * FROM scrap_devices WHERE id = ?`).get(e)||null}function Ne(e){let t=v(),n=e.id||Date.now();try{return t.prepare(`
      INSERT INTO scrap_devices (id, device_name, device_model, quantity)
      VALUES (?, ?, ?, ?)
    `).run(n,e.device_name?.trim()||`جهاز سكراب`,e.device_model?.trim()||``,Number(e.quantity)||1),{success:!0,data:Q(n)||void 0}}catch(e){return console.error(`[ScrapRepo] Add scrap device failed:`,e),{success:!1,reason:e?.message||`ADD_SCRAP_FAILED`}}}function Pe(e,t){let n=v(),r=Q(e);if(!r)return{success:!1,reason:`NOT_FOUND`};try{return n.prepare(`
      UPDATE scrap_devices
      SET device_name = ?, device_model = ?, quantity = ?
      WHERE id = ?
    `).run(t.device_name===void 0?r.device_name:t.device_name.trim(),t.device_model===void 0?r.device_model:t.device_model.trim(),t.quantity===void 0?r.quantity:Number(t.quantity),e),{success:!0,data:Q(e)||void 0}}catch(e){return console.error(`[ScrapRepo] Edit scrap device failed:`,e),{success:!1,reason:e?.message||`EDIT_SCRAP_FAILED`}}}function Fe(e){let t=v();try{return t.prepare(`DELETE FROM scrap_devices WHERE id = ?`).run(e).changes===0?{success:!1,reason:`NOT_FOUND`}:{success:!0}}catch(e){return console.error(`[ScrapRepo] Delete scrap device failed:`,e),{success:!1,reason:e?.message||`DELETE_SCRAP_FAILED`}}}function Ie(){let e=v(),t=P(),n=t.id,r=e.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN type IN ('CUSTOMER_PAYMENT', 'OTHER_IN') THEN amount
      ELSE -amount END
    ), 0) as cashBox
    FROM cash_transactions
    WHERE month_id = ?
  `).get(n),i=(Number(t.start_capital)||0)+(Number(r.cashBox)||0),a=e.prepare(`
    SELECT 
      COALESCE(SUM(price), 0) as totalSales,
      COALESCE(SUM(cost), 0) as totalCost,
      COALESCE(SUM(price - cost), 0) as grossProfit,
      COALESCE(SUM(shop_profit), 0) as shopOperationProfit,
      COALESCE(SUM(tech_profit), 0) as techShare
    FROM operations
    WHERE delivered_in_month_id = ?
  `).get(n),o=e.prepare(`
    SELECT COALESCE(SUM(amount), 0) as totalExpenses
    FROM shop_expenses
    WHERE month_id = ?
  `).get(n),s=Number(o.totalExpenses)||0,c=(Number(a.shopOperationProfit)||0)-s,l=e.prepare(`
    SELECT COALESCE(SUM(price - COALESCE(paid_amount, 0)), 0) as debtTotal
    FROM operations
    WHERE payment_status != 'cash' AND (price - COALESCE(paid_amount, 0)) > 0
  `).get(),u=Number(l.debtTotal)||0,d=e.prepare(`
    SELECT 
      (SELECT COALESCE(SUM(amount), 0) FROM supplier_purchases) - 
      (SELECT COALESCE(SUM(amount), 0) FROM supplier_payments) as supplierPayables
  `).get(),f=Number(d.supplierPayables)||0,p=e.prepare(`
    SELECT 
      (SELECT COALESCE(SUM(tech_profit), 0) FROM operations WHERE status = 'delivered') -
      (SELECT COALESCE(SUM(amount), 0) FROM cash_transactions WHERE type = 'TECHNICIAN_PAYMENT') as techPayables
  `).get(),m=Number(p.techPayables)||0,h=e.prepare(`SELECT COUNT(id) as c FROM operations WHERE month_id = ?`).get(n);return{cashBox:i,totalSales:Number(a.totalSales)||0,grossProfit:Number(a.grossProfit)||0,techShare:Number(a.techShare)||0,shopOperationProfit:Number(a.shopOperationProfit)||0,totalExpenses:s,netShopProfit:c,debtTotal:u,supplierPayables:f,technicianPayables:m,receivedDevicesCount:h.c,totalProfit:Number(a.grossProfit)||0,totalWithdrawals:s,totalTechProfit:Number(a.techShare)||0,totalShopProfit:Number(a.shopOperationProfit)||0,uncollectedProfit:0,baseCapital:Number(t.start_capital)||0,availableCapital:i,tiedCapital:Number(a.totalCost)||0,realizedShopProfit:c,totalShopWithdrawal:0,shopDue:c}}function Le(){let e=v(),t=P().id;return I().map(n=>{let r=e.prepare(`
      SELECT COALESCE(SUM(cost), 0) as totalCost
      FROM operations
      WHERE technician_id = ? AND month_id = ?
    `).get(n.id,t),i=e.prepare(`
      SELECT COALESCE(SUM(tech_profit), 0) as totalProfit
      FROM operations
      WHERE technician_id = ? AND delivered_in_month_id = ?
    `).get(n.id,t),a=e.prepare(`
      SELECT COALESCE(SUM(tech_profit), 0) as unrealizedProfit
      FROM operations
      WHERE technician_id = ? 
        AND payment_status IN ('debt', 'partial')
        AND (price - COALESCE(paid_amount, 0)) > 0
    `).get(n.id),o=e.prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalWithdrawal
      FROM cash_transactions
      WHERE reference_id = ? AND month_id = ? AND type = 'TECHNICIAN_PAYMENT'
    `).get(n.id,t),s=Number(r.totalCost)||0,c=Number(i.totalProfit)||0,l=Number(a.unrealizedProfit)||0,u=Number(o.totalWithdrawal)||0,d=c-u;return{id:n.id,name:n.name,profit_percentage:n.profit_percentage,is_active:n.is_active,totalCost:s,totalProfit:c,unrealizedProfit:l,totalWithdrawal:u,remainingBalance:d}})}function Re(e){let t=v(),n=new Date().toISOString();try{let r=t.prepare(`
      INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(e.type,e.amount,e.date,e.month_id,e.reference_id||null,e.description||``,n);return{success:!0,data:{...e,id:r.lastInsertRowid,created_at:n}}}catch(e){return console.error(`[CashRepo] Error adding cash transaction:`,e),{success:!1,reason:e.message}}}function ze(e){let t=v();try{return t.prepare(`DELETE FROM cash_transactions WHERE id = ?`).run(e).changes>0?{success:!0}:{success:!1,reason:`NOT_FOUND`}}catch(e){return console.error(`[CashRepo] Error deleting cash transaction:`,e),{success:!1,reason:e.message}}}function Be(e){return v().prepare(`SELECT * FROM cash_transactions WHERE month_id = ? ORDER BY date DESC, id DESC`).all(e)}function Ve(){return v().prepare(`
    SELECT 
      s.*,
      COALESCE((SELECT SUM(amount) FROM supplier_purchases WHERE supplier_id = s.id), 0) as total_purchases,
      COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = s.id), 0) as total_payments,
      COALESCE((SELECT SUM(amount) FROM supplier_purchases WHERE supplier_id = s.id), 0) - COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = s.id), 0) as balance
    FROM suppliers s
    ORDER BY s.name ASC
  `).all()}function He(e){let t=v(),n=new Date().toISOString();try{let r=t.prepare(`INSERT INTO suppliers (name, phone, notes, created_at) VALUES (?, ?, ?, ?)`).run(e.name,e.phone||``,e.notes||``,n);return{success:!0,data:{...e,id:r.lastInsertRowid,created_at:n}}}catch(e){return{success:!1,reason:e.message}}}function Ue(e,t){let n=v();try{return n.prepare(`UPDATE suppliers SET name = ?, phone = ?, notes = ? WHERE id = ?`).run(t.name,t.phone||``,t.notes||``,e),{success:!0}}catch(e){return{success:!1,reason:e.message}}}function We(e){let t=v();try{return t.prepare(`SELECT count(*) as c FROM supplier_purchases WHERE supplier_id = ?`).get(e).c>0?{success:!1,reason:`لا يمكن حذف المورد لوجود عمليات شراء مسجلة`}:(t.prepare(`DELETE FROM suppliers WHERE id = ?`).run(e),{success:!0})}catch(e){return{success:!1,reason:e.message}}}function Ge(e){return v().prepare(`SELECT * FROM supplier_purchases WHERE supplier_id = ? ORDER BY date DESC, id DESC`).all(e)}function Ke(e){return v().prepare(`SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY date DESC, id DESC`).all(e)}function qe(e){let t=v(),n=new Date().toISOString();try{let r=t.prepare(`INSERT INTO supplier_purchases (supplier_id, month_id, date, amount, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(e.supplier_id,e.month_id,e.date,e.amount,e.description||``,n);return{success:!0,data:{...e,id:r.lastInsertRowid,created_at:n}}}catch(e){return{success:!1,reason:e.message}}}function Je(e){let t=v(),n=new Date().toISOString();try{let r=0;return t.transaction(()=>{r=t.prepare(`INSERT INTO supplier_payments (supplier_id, month_id, date, amount, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(e.supplier_id,e.month_id,e.date,e.amount,e.description||``,n).lastInsertRowid,t.prepare(`INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(`SUPPLIER_PAYMENT`,e.amount,e.date,e.month_id,r,e.description||`دفعة لمورد`,n)})(),{success:!0,data:{...e,id:r,created_at:n}}}catch(e){return{success:!1,reason:e.message}}}function Ye(e){return v().prepare(`SELECT * FROM shop_expenses WHERE month_id = ? ORDER BY date DESC, id DESC`).all(e)}function Xe(e){let t=v(),n=new Date().toISOString();try{let r=0;return t.transaction(()=>{r=t.prepare(`INSERT INTO shop_expenses (month_id, date, amount, category, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(e.month_id,e.date,e.amount,e.category,e.description||``,n).lastInsertRowid,t.prepare(`INSERT INTO cash_transactions (type, amount, date, month_id, reference_id, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(`SHOP_EXPENSE`,e.amount,e.date,e.month_id,r,e.category+(e.description?` - `+e.description:``),n)})(),{success:!0,data:{...e,id:r,created_at:n}}}catch(e){return{success:!1,reason:e.message}}}function Ze(e){let t=v();try{return t.transaction(()=>{t.prepare(`DELETE FROM cash_transactions WHERE type = ? AND reference_id = ?`).run(`SHOP_EXPENSE`,e),t.prepare(`DELETE FROM shop_expenses WHERE id = ?`).run(e)})(),{success:!0}}catch(e){return{success:!1,reason:e.message}}}var $=null;function Qe(){$=new c.BrowserWindow({width:1200,height:800,minWidth:1e3,minHeight:700,webPreferences:{preload:l.default.join(__dirname,`preload.js`),nodeIntegration:!1,contextIsolation:!0},titleBarStyle:`hidden`,titleBarOverlay:{color:`#0f172a`,symbolColor:`#f8fafc`},autoHideMenuBar:!0}),$.setMenuBarVisibility(!1),$.maximize(),et(),j(!1),setInterval(()=>j(!1),36e5),process.env.VITE_DEV_SERVER_URL?$.loadURL(process.env.VITE_DEV_SERVER_URL):$.loadFile(l.default.join(__dirname,`../dist/index.html`))}function $e(){return ee()?x(v())?(Qe(),!0):(c.dialog.showErrorBox(`خطأ في قاعدة البيانات`,`تم اكتشاف تلف في ملف قاعدة البيانات SQLite.`),!1):(console.error(`[Startup] Migration failed. Halting application to protect user data.`),!1)}c.app.whenReady().then(()=>{$e()||c.app.quit()}),c.app.on(`window-all-closed`,()=>{S(),process.platform!==`darwin`&&c.app.quit()});function et(){c.ipcMain.handle(`get-settings`,()=>N()),c.ipcMain.handle(`update-settings`,(e,t)=>oe(t)),c.ipcMain.handle(`restart-app`,()=>{c.app.relaunch(),c.app.exit(0)}),c.ipcMain.handle(`get-technicians`,()=>le()),c.ipcMain.handle(`add-technician`,(e,t,n)=>ue(t,n)),c.ipcMain.handle(`edit-technician`,(e,t,n,r)=>de(t,n,r)),c.ipcMain.handle(`delete-technician`,(e,t)=>fe(t)),c.ipcMain.handle(`get-customers`,()=>{try{return me()}catch(e){return console.error(`[IPC get-customers] Unexpected error:`,e),[]}}),c.ipcMain.handle(`add-customer`,(e,t)=>z(t)),c.ipcMain.handle(`edit-customer`,(e,t,n)=>ge(t,n)),c.ipcMain.handle(`delete-customer`,(e,t)=>_e(t)),c.ipcMain.handle(`get-customer-operations`,(e,t,n)=>ye(t,n)),c.ipcMain.handle(`get-operations`,()=>ve()),c.ipcMain.handle(`get-all-operations`,()=>V()),c.ipcMain.handle(`add-operation`,(e,t)=>U(t)),c.ipcMain.handle(`edit-operation`,(e,t,n)=>xe(t,n)),c.ipcMain.handle(`delete-operation`,(e,t)=>Se(t)),c.ipcMain.handle(`get-debts`,()=>Ce()),c.ipcMain.handle(`pay-debt`,(e,t)=>we(t)),c.ipcMain.handle(`get-withdrawals`,()=>G()),c.ipcMain.handle(`add-withdrawal`,(e,t)=>Ee(t)),c.ipcMain.handle(`edit-withdrawal`,(e,t,n)=>De(t,n)),c.ipcMain.handle(`delete-withdrawal`,(e,t)=>Oe(t)),c.ipcMain.handle(`get-suppliers`,()=>Ve()),c.ipcMain.handle(`add-supplier`,(e,t)=>He(t)),c.ipcMain.handle(`edit-supplier`,(e,t,n)=>Ue(t,n)),c.ipcMain.handle(`delete-supplier`,(e,t)=>We(t)),c.ipcMain.handle(`get-supplier-purchases`,(e,t)=>Ge(t)),c.ipcMain.handle(`get-supplier-payments`,(e,t)=>Ke(t)),c.ipcMain.handle(`add-supplier-purchase`,(e,t)=>qe(t)),c.ipcMain.handle(`add-supplier-payment`,(e,t)=>Je(t)),c.ipcMain.handle(`get-shop-expenses`,()=>Ye(P().id)),c.ipcMain.handle(`add-shop-expense`,(e,t)=>{let n=P();return Xe({...t,month_id:n.id})}),c.ipcMain.handle(`delete-shop-expense`,(e,t)=>Ze(t)),c.ipcMain.handle(`get-cash-transactions`,()=>Be(P().id)),c.ipcMain.handle(`add-cash-transaction`,(e,t)=>{let n=P();return Re({...t,month_id:n.id})}),c.ipcMain.handle(`delete-cash-transaction`,(e,t)=>ze(t)),c.ipcMain.handle(`get-dashboard-stats`,()=>Ie()),c.ipcMain.handle(`get-technician-stats`,()=>Le()),c.ipcMain.handle(`get-ic-compatibilities`,()=>J()),c.ipcMain.handle(`add-ic-compatibility`,(e,t)=>X(t)),c.ipcMain.handle(`edit-ic-compatibility`,(e,t,n)=>je(t,n)),c.ipcMain.handle(`delete-ic-compatibility`,(e,t)=>Me(t)),c.ipcMain.handle(`get-scrap-devices`,()=>Z()),c.ipcMain.handle(`add-scrap-device`,(e,t)=>Ne(t)),c.ipcMain.handle(`edit-scrap-device`,(e,t,n)=>Pe(t,n)),c.ipcMain.handle(`delete-scrap-device`,(e,t)=>Fe(t)),c.ipcMain.handle(`get-quick-lists`,()=>q()),c.ipcMain.handle(`add-quick-list-item`,(e,t,n)=>ke(t,n)),c.ipcMain.handle(`remove-quick-list-item`,(e,t,n)=>Ae(t,n)),c.ipcMain.handle(`close-month`,(e,t)=>F(t)),c.ipcMain.handle(`import-operations-excel-data`,async(e,t)=>{try{let e=v(),n=P(),r=I(),i=0,a=0;return e.transaction(()=>{for(let o=1;o<t.length;o++){let s=t[o];if(!s||s.length<3)continue;let c=s[0]?String(s[0]).trim():new Date().toLocaleDateString(`en-GB`),l=s[1]?Number(s[1]):null,u=String(s[2]||``).trim(),d=String(s[3]||``).trim(),f=String(s[10]||``).trim(),p=r.find(e=>e.name===f);if(!p){a++;continue}let m=!1;if(l&&e.prepare(`SELECT id FROM operations WHERE id = ?`).get(l)&&(m=!0),m||e.prepare(`SELECT id FROM operations WHERE customer_name = ? AND device = ? AND date = ?`).get(u,d,c)&&(m=!0),m){a++;continue}let h=Math.max(0,Number(s[6])||0),g=Math.max(0,Number(s[5])||0),_=Math.max(0,Number(s[8])||0),v=Math.max(0,Number(s[9])||0),y=String(s[4]).includes(`دين`)?`debt`:`cash`;U({id:l&&!e.prepare(`SELECT id FROM operations WHERE id = ?`).get(l)?l:Date.now()+o,date:c,month_id:n.id,technician_id:p.id,customer_name:u,device:d,status:`delivered`,payment_status:y,cost:g,price:h,shop_profit:_,tech_profit:v}),i++}})(),{success:!0,added:i,ignored:a}}catch(e){return console.error(`[Excel Import] Error:`,e),{success:!1,reason:`error`,message:e?.message||String(e)}}}),c.ipcMain.handle(`import-operations-excel`,async()=>{let e={title:`استيراد ملف إكسل للعمليات`,properties:[`openFile`],filters:[{name:`Excel Files`,extensions:[`xlsx`,`xls`]}]},{canceled:t,filePaths:n}=$?await c.dialog.showOpenDialog($,e):await c.dialog.showOpenDialog(e);if(t||n.length===0)return{success:!1,reason:`cancelled`};try{let e=xlsx.readFile(n[0]),t=e.SheetNames[0],r=e.Sheets[t],i=xlsx.utils.sheet_to_json(r,{header:1}),a=v(),o=P(),s=I(),c=0,l=0;return a.transaction(()=>{for(let e=1;e<i.length;e++){let t=i[e];if(!t||t.length<3)continue;let n=t[0]?String(t[0]).trim():new Date().toLocaleDateString(`en-GB`),r=t[1]?Number(t[1]):null,u=String(t[2]||``).trim(),d=String(t[3]||``).trim(),f=String(t[10]||``).trim(),p=s.find(e=>e.name===f);if(!p){l++;continue}let m=!1;if(r&&a.prepare(`SELECT id FROM operations WHERE id = ?`).get(r)&&(m=!0),m||a.prepare(`SELECT id FROM operations WHERE customer_name = ? AND device = ? AND date = ?`).get(u,d,n)&&(m=!0),m){l++;continue}let h=Math.max(0,Number(t[6])||0),g=Math.max(0,Number(t[5])||0),_=Math.max(0,Number(t[8])||0),v=Math.max(0,Number(t[9])||0),y=String(t[4]).includes(`دين`)?`debt`:`cash`;U({id:r&&!a.prepare(`SELECT id FROM operations WHERE id = ?`).get(r)?r:Date.now()+e,date:n,month_id:o.id,technician_id:p.id,customer_name:u,device:d,status:`delivered`,payment_status:y,cost:g,price:h,shop_profit:_,tech_profit:v}),c++}})(),{success:!0,added:c,ignored:l}}catch(e){return console.error(`[Excel File Import] Error:`,e),{success:!1,reason:`error`,message:e?.message||String(e)}}}),c.ipcMain.handle(`import-ic-excel-data`,async(e,t)=>{try{let e=v(),n=0,r=0;return e.transaction(()=>{for(let i=1;i<t.length;i++){let a=t[i];if(!a||a.length<1)continue;let o=String(a[0]||``).trim();if(!o){r++;continue}let s=a[1]?String(a[1]).trim():``,c=a[2]?String(a[2]).trim():``,l=a[3]?String(a[3]).trim():``;if(e.prepare(`SELECT id FROM ic_compatibilities WHERE ic_number = ? AND component_type = ? AND compatible_devices = ?`).get(o,s,c)){r++;continue}X({ic_number:o,component_type:s,compatible_devices:c,notes:l}),n++}})(),{success:!0,added:n,ignored:r}}catch(e){return console.error(`[IC Import] Error:`,e),{success:!1,reason:`error`,message:e?.message||String(e)}}}),c.ipcMain.handle(`import-ic-excel`,async()=>{let e={title:`استيراد ملف إكسل لبدائل الآيسيات`,properties:[`openFile`],filters:[{name:`Excel Files`,extensions:[`xlsx`,`xls`]}]},{canceled:t,filePaths:n}=$?await c.dialog.showOpenDialog($,e):await c.dialog.showOpenDialog(e);if(t||n.length===0)return{success:!1,reason:`cancelled`};try{let e=xlsx.readFile(n[0]),t=e.SheetNames[0],r=e.Sheets[t],i=xlsx.utils.sheet_to_json(r,{header:1}),a=v(),o=0,s=0;return a.transaction(()=>{for(let e=1;e<i.length;e++){let t=i[e];if(!t||t.length<1)continue;let n=String(t[0]||``).trim();if(!n){s++;continue}let r=t[1]?String(t[1]).trim():``,c=t[2]?String(t[2]).trim():``,l=t[3]?String(t[3]).trim():``;if(a.prepare(`SELECT id FROM ic_compatibilities WHERE ic_number = ? AND component_type = ? AND compatible_devices = ?`).get(n,r,c)){s++;continue}X({ic_number:n,component_type:r,compatible_devices:c,notes:l}),o++}})(),{success:!0,added:o,ignored:s}}catch(e){return console.error(`[IC File Import] Error:`,e),{success:!1,reason:`error`,message:e?.message||String(e)}}}),c.ipcMain.handle(`close-month-with-excel`,async(e,t)=>{try{let e=P(),n=V().filter(t=>t.month_id===e.id),r=G(),i=n.map(e=>{let t=e.paid_amount===void 0?e.payment_status===`cash`?e.price:0:e.paid_amount,n=Math.max(0,e.price-t);return{"رقم العملية":e.id,التاريخ:e.date,"اسم العميل":e.customer_name,الجهاز:e.device,"اسم الفني":e.technician_name||`-`,"حالة الدفع":e.payment_status===`cash`?`نقدي`:e.payment_status===`partial`?`مدفوع جزئياً`:`دين`,"المبلغ الإجمالي":e.price,التكلفة:e.cost,المدفوع:t,"المتبقي (الدين)":n,"صافي الربح":e.price-e.cost,"حصة الفني":e.tech_profit,"حصة المحل":e.shop_profit}}),a=r.map(e=>({"رقم السحب":e.id,التاريخ:e.date,النوع:e.type===`shop_withdrawal`?`سحب محل`:`سحب فني`,"اسم الفني":e.technician_name||`-`,المبلغ:e.amount,الملاحظات:e.description||`-`})),o=xlsx.utils.book_new();xlsx.utils.book_append_sheet(o,xlsx.utils.json_to_sheet(i),`سجل العمليات`),xlsx.utils.book_append_sheet(o,xlsx.utils.json_to_sheet(a),`سجل السحوبات`);let s={title:`حفظ تقرير إغلاق الشهر (Excel)`,defaultPath:`تقرير_إغلاق_${e.month_name.replace(/\s+/g,`_`)}_${new Date().toISOString().split(`T`)[0]}.xlsx`,filters:[{name:`Excel Files`,extensions:[`xlsx`]}]},{canceled:l,filePath:u}=$?await c.dialog.showSaveDialog($,s):await c.dialog.showSaveDialog(s);return l||!u?{success:!1,reason:`cancelled`}:(xlsx.writeFile(o,u),F(t))}catch(e){return console.error(`[Close Month with Excel] Error:`,e),{success:!1,reason:`error`,message:e?.message||String(e)}}}),c.ipcMain.handle(`create-full-backup`,async()=>{try{let e=V(),t=Te(),n=I(),r=pe(),i=Ie(),a=Le(),o=e=>e.paid_amount??(e.payment_status===`cash`&&e.price||0),s=e=>Math.max(0,(e.price||0)-o(e)),l=e=>{switch(e){case`under_maintenance`:return`قيد الصيانة`;case`completed`:return`جاهز / مكتمل`;case`delivered`:return`تم التسليم`;case`cancelled`:return`ملغى`;default:return e||`-`}},d=(e,t,n)=>e===`cash`||t!==void 0&&n!==void 0&&t>=n?`نقدي (مدفوع بالكامل)`:e===`partial`||t!==void 0&&n!==void 0&&t>0&&t<n?`مدفوع جزئياً`:e===`debt`?`دين (آجل)`:e||`-`,f=[[`التقرير المالي العام وخلاصة الكاش والأرباح`],[`تاريخ التصدير`,new Date().toLocaleDateString(`ar-EG`,{dateStyle:`full`})],[``],[`=== حركة الكاش والصندوق ===`],[`رأس المال الافتتاحي للشهر`,i.baseCapital],[`إجمالي سحوبات الشهر`,i.totalWithdrawals],[`صافي رصيد الكاش / الصندوق الحالي`,i.cashBox],[``],[`=== ملخص الأرباح ===`],[`إجمالي الأرباح الكلية (للأجهزة المسلمة)`,i.totalProfit],[`إجمالي أرباح المحل (الصافية)`,i.totalShopProfit],[`إجمالي سحوبات المحل`,i.totalShopWithdrawal],[`الصافي المستحق للمحل`,i.shopDue],[`أرباح متوقعة قيد الإنجاز (أجهزة لم تُسلّم)`,i.uncollectedProfit],[``],[`=== ملخص الديون بالسوق ===`],[`إجمالي الديون المتبقية بذمة العملاء`,i.debtTotal],[``],[`=== ملخص مستحقات وأرباح الفنيين ===`],[`إجمالي أرباح جميع الفنيين`,i.totalTechProfit],[``],[`جدول تفصيلي بأرصدة وأرباح كل فني:`],[`اسم الفني`,`نسبة الربح`,`إجمالي التكلفة`,`إجمالي الأرباح المحققة`,`إجمالي السحوبات`,`الرصيد المتبقي المستحق`,`الحالة`]];a.forEach(e=>{f.push([e.name,`${((e.profit_percentage||0)*100).toFixed(0)}%`,e.totalCost,e.totalProfit,e.totalWithdrawal,e.remainingBalance,e.is_active?`نشط`:`غير نشط`])});let p=xlsx.utils.book_new(),m=xlsx.utils.aoa_to_sheet(f);m[`!cols`]=[{wch:45},{wch:20},{wch:18},{wch:22},{wch:18},{wch:24},{wch:15}],xlsx.utils.book_append_sheet(p,m,`التقرير المالي والخلاصة`);let h=e.map(e=>({"رقم العملية":e.id,التاريخ:e.date,"اسم العميل":e.customer_name||`-`,"هاتف العميل":e.customer_phone||`-`,الجهاز:e.device||`-`,الأعطال:Array.isArray(e.faults)?e.faults.join(`، `):e.faults||`-`,"اسم الفني":e.technician_name||`-`,"حالة الجهاز":l(e.status),"حالة الدفع":d(e.payment_status,e.paid_amount,e.price),"المبلغ الإجمالي":e.price,التكلفة:e.cost,"المبلغ الواصل (المدفوع)":o(e),"المبلغ المتبقي (الدين)":s(e),"صافي الربح":e.price-e.cost,"حصة الفني":e.tech_profit,"حصة المحل":e.shop_profit,"نسبة الفني":e.tech_profit_percentage===void 0?`-`:`${(e.tech_profit_percentage*100).toFixed(0)}%`,الضمان:e.warranty_enabled?e.warranty_days?`${e.warranty_days} يوم`:`مفعل`:`بدون ضمان`,"تاريخ انتهاء الضمان":e.warranty_expiry_date||`-`,"ملاحظات الضمان":e.warranty_note||`-`,"ملاحظات عامة":e.notes||`-`})),g=xlsx.utils.json_to_sheet(h);g[`!cols`]=[{wch:14},{wch:14},{wch:22},{wch:16},{wch:18},{wch:25},{wch:18},{wch:18},{wch:24},{wch:16},{wch:14},{wch:22},{wch:20},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16},{wch:20},{wch:20},{wch:22}],xlsx.utils.book_append_sheet(p,g,`سجل العمليات`);let _=t.map(e=>({"رقم السحب":e.id,التاريخ:e.date,"نوع السحب":e.type===`shop_withdrawal`?`سحب محل`:`سحب فني`,"اسم الفني":e.technician_name||`-`,المبلغ:e.amount,"البيان / الملاحظات":e.description||`-`})),v=xlsx.utils.json_to_sheet(_);v[`!cols`]=[{wch:14},{wch:14},{wch:18},{wch:20},{wch:16},{wch:30}],xlsx.utils.book_append_sheet(p,v,`سجل السحوبات`);let y=a.map(e=>({"رقم الفني":e.id,"اسم الفني":e.name,"نسبة الفني":`${((e.profit_percentage||0)*100).toFixed(0)}%`,الحالة:e.is_active?`نشط`:`غير نشط`,"أرباح الشهر الحالي":e.totalProfit,"سحوبات الشهر الحالي":e.totalWithdrawal,"الرصيد المستحق":e.remainingBalance})),b=xlsx.utils.json_to_sheet(y);if(b[`!cols`]=[{wch:14},{wch:22},{wch:16},{wch:14},{wch:20},{wch:20},{wch:20}],xlsx.utils.book_append_sheet(p,b,`سجل الفنيين`),r&&r.length>0){let e=r.map(e=>({"رقم العميل":e.id,"اسم العميل":e.name||`-`,"رقم الهاتف":e.phone||`-`,ملاحظات:e.notes||`-`,"تاريخ الإضافة":e.created_at||`-`})),t=xlsx.utils.json_to_sheet(e);t[`!cols`]=[{wch:16},{wch:25},{wch:20},{wch:30},{wch:25}],xlsx.utils.book_append_sheet(p,t,`سجل العملاء`)}let x={title:`حفظ نسخة احتياطية كاملة (Excel & JSON)`,defaultPath:`Full_Backup_${new Date().toISOString().split(`T`)[0]}.xlsx`,filters:[{name:`Excel Files`,extensions:[`xlsx`]}]},{canceled:S,filePath:C}=$?await c.dialog.showSaveDialog($,x):await c.dialog.showSaveDialog(x);if(S||!C)return{success:!1,reason:`cancelled`};xlsx.writeFile(p,C);let w=C.toLowerCase().endsWith(`.xlsx`)?C.slice(0,-5)+`.json`:`${C}.json`,T={settings:N(),months:se(),technicians:n,customers:r,operations:e,withdrawals:t,quick_lists:q(),ic_compatibilities:J(),scrap_devices:Z()};return u.default.writeFileSync(w,JSON.stringify(T,null,2),`utf-8`),{success:!0}}catch(e){return console.error(`[Full Backup] Error:`,e),{success:!1,reason:`error`,message:e?.message||String(e)}}}),c.ipcMain.handle(`backup:create`,async()=>j(!0)),c.ipcMain.handle(`backup:list`,()=>M()),c.ipcMain.handle(`backup:restore`,async(e,t)=>ie(t)),c.ipcMain.handle(`factory-reset`,async()=>{try{if(!(await j(!0)).success)return{success:!1,reason:`FACTORY_RESET_BACKUP_FAILED`,message:`فشل إنشاء نسخة احتياطية إجبارية. تم إيقاف عملية التصفير لحماية البيانات.`};let e=v();return e.transaction(()=>{e.prepare(`DELETE FROM payments`).run(),e.prepare(`DELETE FROM operations`).run(),e.prepare(`DELETE FROM withdrawals`).run(),e.prepare(`UPDATE technicians SET start_balance = 0`).run(),e.prepare(`DELETE FROM months WHERE id > 1`).run();let t=new Date,n=N();e.prepare(`
          UPDATE months
          SET month_name = ?, start_capital = ?, is_closed = 0, created_at = ?, closed_at = NULL
          WHERE id = 1
        `).run(t.toLocaleDateString(`ar-EG`,{month:`long`,year:`numeric`}),n.base_capital||0,t.toISOString())})(),{success:!0}}catch(e){return console.error(`[Factory Reset] Error:`,e),{success:!1,reason:`FACTORY_RESET_FAILED`,message:e?.message||String(e)}}})}