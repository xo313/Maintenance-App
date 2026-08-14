const fs = require('fs');
const dbPath = 'database.json';
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const currentMonth = data.months[data.months.length - 1];
currentMonth.start_capital = 500; // Fake capital

data.technicians = [
  { id: 1, name: 'أحمد صالح', profit_percentage: 0.3, start_balance: 0 },
  { id: 2, name: 'خالد عمر', profit_percentage: 0.4, start_balance: 0 },
  { id: 3, name: 'ياسر محمد', profit_percentage: 0.25, start_balance: 0 }
];

data.operations = [
  {
    id: 1,
    date: '10/08/2026',
    month_id: currentMonth.id,
    device: 'iPhone 13 - شاشة',
    customer_name: 'محمد عبدالله',
    price: 300,
    cost: 150,
    technician_id: 1,
    payment_status: 'cash',
    shop_profit: 105,
    tech_profit: 45
  },
  {
    id: 2,
    date: '11/08/2026',
    month_id: currentMonth.id,
    device: 'MacBook Pro - بطارية',
    customer_name: 'شركة الأفق',
    price: 500,
    cost: 200,
    technician_id: 2,
    payment_status: 'debt',
    shop_profit: 180,
    tech_profit: 120
  },
  {
    id: 3,
    date: '12/08/2026',
    month_id: currentMonth.id,
    device: 'Samsung S22 - مدخل شحن',
    customer_name: 'سالم',
    price: 100,
    cost: 30,
    technician_id: 3,
    payment_status: 'cash',
    shop_profit: 52.5,
    tech_profit: 17.5
  },
  {
    id: 4,
    date: '12/08/2026',
    month_id: currentMonth.id,
    device: 'iPad Air - زجاج خلفي',
    customer_name: 'فاطمة',
    price: 250,
    cost: 100,
    technician_id: 1,
    payment_status: 'cash',
    shop_profit: 105,
    tech_profit: 45
  },
  {
    id: 5,
    date: '13/08/2026',
    month_id: currentMonth.id,
    device: 'PlayStation 5 - صيانة',
    customer_name: 'عبدالرحمن',
    price: 150,
    cost: 50,
    technician_id: 2,
    payment_status: 'debt',
    shop_profit: 60,
    tech_profit: 40
  }
];

data.withdrawals = [
  { id: 1, date: '11/08/2026', month_id: currentMonth.id, type: 'shop_withdrawal', amount: 50, note: 'ضيافة' },
  { id: 2, date: '12/08/2026', month_id: currentMonth.id, type: 'tech_withdrawal', technician_id: 1, amount: 20, note: 'سلفة' }
];

fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
console.log('Database seeded successfully!');
