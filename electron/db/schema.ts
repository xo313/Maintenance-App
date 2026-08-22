export const CURRENT_SCHEMA_VERSION = 4;

export const CREATE_TABLES_SQL = `
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
`;

export const CREATE_INDEXES_SQL = `
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
`;
