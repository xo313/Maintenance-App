export interface Settings {
  id: number;
  base_capital: number;
  shop_name: string;
  whatsapp_template?: string;
  theme?: 'light' | 'dark';
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BackupMetadata {
  filename: string;
  created_at: string;
  size_kb: number;
  operations_count: number;
  months_count: number;
  technicians_count: number;
  withdrawals_count: number;
}

export interface Month {
  id: number;
  month_name: string;
  start_capital: number;
  is_closed: boolean;
  created_at: string;
  closed_at: string | null;
}

export interface Technician {
  id: number;
  name: string;
  profit_percentage: number;
  start_balance: number;
  is_active: boolean;
}

export interface Operation {
  id: number;
  date: string;
  customer_id?: number;
  customer_name: string;
  customer_phone?: string;
  device: string;
  device_code?: string;
  faults?: string[];
  cost: number;
  price: number;
  tech_profit_percentage?: number;
  technician_id: number;
  technician_name?: string;
  shop_profit: number;
  tech_profit: number;
  payment_status: 'cash' | 'debt' | 'partial';
  status: 'under_maintenance' | 'completed' | 'delivered' | 'cancelled';
  month_id: number;
  paid_in_month_id?: number;
  delivered_in_month_id?: number;
  paid_at?: string;
  paid_amount?: number;
  notes?: string;
  accessories?: string;
  warranty_enabled?: boolean;
  warranty_days?: number;
  warranty_note?: string;
  warranty_expiry_date?: string;
}

export interface Withdrawal {
  id: number;
  date: string;
  amount: number;
  description: string;
  technician_id: number | null;
  technician_name?: string | null;
  type: 'shop_withdrawal' | 'tech_withdrawal';
  month_id: number;
}

export interface DashboardStats {
  cashBox: number;
  totalProfit: number;
  debtTotal: number;
  totalWithdrawals: number;
  
  // New Stats for Reports Card
  totalTechProfit: number;
  totalShopProfit: number;
  uncollectedProfit: number;
  receivedDevicesCount: number;
  
  // For compatibility with settlement modal:
  baseCapital: number;
  availableCapital: number;
  tiedCapital: number;
  realizedShopProfit: number;
  totalShopWithdrawal: number;
  shopDue: number;
}

export interface TechnicianStats {
  id: number;
  name: string;
  profit_percentage: number;
  is_active: boolean;
  totalCost: number; // Cost of parts used by this tech
  totalProfit: number; // Tech's share of REALIZED profit
  unrealizedProfit: number; // Tech's share of UNPAID debts
  totalWithdrawal: number;
  remainingBalance: number;
}

export interface IcCompatibility {
  id: number;
  ic_number: string;
  component_type: string;
  compatible_devices: string;
  notes?: string;
}

export interface ScrapDevice {
  id: number;
  device_name: string;
  device_model?: string;
  quantity: number;
}
