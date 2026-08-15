const fs = require('fs');
const dbPath = './database.json';

const defaultIcs = [
  {
    "id": Date.now() + 1,
    "ic_number": "1610A3",
    "component_type": "آيسي شحن (USB / Tristar)",
    "compatible_devices": "iPhone 6, iPhone 6 Plus, iPhone 6s, iPhone 6s Plus, iPhone 7, iPhone 7 Plus",
    "notes": "بديل ممتاز لمعظم عائلة الأيفون 6 و 7"
  },
  {
    "id": Date.now() + 2,
    "ic_number": "1612A1",
    "component_type": "آيسي شحن (USB / Hydra)",
    "compatible_devices": "iPhone 8, iPhone 8 Plus, iPhone X, iPhone XR, iPhone XS, iPhone 11",
    "notes": ""
  },
  {
    "id": Date.now() + 3,
    "ic_number": "338S00105",
    "component_type": "آيسي صوت (Audio IC)",
    "compatible_devices": "iPhone 7, iPhone 7 Plus",
    "notes": "عطل الصوت الشهير (Loop Disease)"
  },
  {
    "id": Date.now() + 4,
    "ic_number": "WTR3925",
    "component_type": "آيسي شبكة (RF Transceiver)",
    "compatible_devices": "iPhone 6s, iPhone 6s Plus, iPhone 7, iPhone 7 Plus, Samsung S7",
    "notes": "شائع التلف، يسبب فقدان الشبكة (No Service)"
  },
  {
    "id": Date.now() + 5,
    "ic_number": "PMI8952",
    "component_type": "آيسي شحن وباور",
    "compatible_devices": "Redmi Note 3, Redmi 3S, Xiaomi Mi Max, Lenovo K6",
    "notes": ""
  },
  {
    "id": Date.now() + 6,
    "ic_number": "PM660 / PM660L",
    "component_type": "آيسي باور (Power IC)",
    "compatible_devices": "Redmi Note 5, Redmi Note 7, Mi A2",
    "notes": "يأتيان غالباً معاً كزوج رئيسي وفرعي"
  },
  {
    "id": Date.now() + 7,
    "ic_number": "BQ24193",
    "component_type": "آيسي شحن (Charging IC)",
    "compatible_devices": "Nintendo Switch, Lenovo Yoga, Huawei P8 Lite",
    "notes": ""
  },
  {
    "id": Date.now() + 8,
    "ic_number": "SM5713",
    "component_type": "آيسي شحن (Charging IC)",
    "compatible_devices": "Samsung A50, Samsung A70, Samsung A30, Samsung A51",
    "notes": "مسؤول عن أعطال الشحن الوهمي"
  },
  {
    "id": Date.now() + 9,
    "ic_number": "S2MU005X03",
    "component_type": "آيسي باور رئيسي",
    "compatible_devices": "Samsung J7 Prime, Samsung J5 Prime, Samsung J7 Pro",
    "notes": ""
  },
  {
    "id": Date.now() + 10,
    "ic_number": "MT6358W",
    "component_type": "آيسي باور (Power IC)",
    "compatible_devices": "Redmi Note 8 Pro, Redmi 10X",
    "notes": "معالجات ميدياتيك"
  }
];

try {
  const dbText = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(dbText);
  
  if (!db.ic_compatibilities) {
    db.ic_compatibilities = [];
  }
  
  // Only add if empty to avoid duplicates
  if (db.ic_compatibilities.length === 0) {
    db.ic_compatibilities = defaultIcs;
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log('Successfully added default ICs');
  } else {
    console.log('ICs array not empty, skipping to avoid duplicates');
  }
} catch (err) {
  console.error('Error:', err);
}
