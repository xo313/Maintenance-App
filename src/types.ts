export interface Settings {
  id: number;
  base_capital: number;
  shop_name: string;
  whatsapp_template?: string;
  theme?: 'light' | 'dark';
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
  customer_name: string;
  customer_phone?: string;
  device: string;
  faults?: string[];
  cost: number;
  price: number;
  technician_id: number;
  technician_name?: string;
  shop_profit: number;
  tech_profit: number;
  payment_status: 'cash' | 'debt';
  status: 'under_maintenance' | 'completed' | 'delivered';
  month_id: number;
  paid_in_month_id?: number;
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
