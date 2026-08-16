const fs = require('fs');
const xlsx = require('xlsx');

const dbPath = './database.json';
const excelPath = 'c:\\Users\\ms24\\Downloads\\V5_مرتب.xlsx';

try {
  const dbText = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(dbText);

  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  if (!db.ic_compatibilities) db.ic_compatibilities = [];
  let maxId = db.ic_compatibilities.reduce((max, ic) => Math.max(max, ic.id), 0);

  let added = 0;
  let updated = 0;
  let ignored = 0;

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;
    
    const category = row[0] ? String(row[0]).trim() : 'General';
    const icCode = String(row[1]).trim();
    const devicesStr = row[2] ? String(row[2]).trim() : '';
    
    if (!icCode) continue;

    const existingIdx = db.ic_compatibilities.findIndex(ic => ic.ic_number.toLowerCase() === icCode.toLowerCase());
    
    if (existingIdx !== -1) {
      const existingDevices = db.ic_compatibilities[existingIdx].compatible_devices.split(/[,=]/).map(d => d.trim()).filter(Boolean);
      const newDevices = devicesStr.split(/[,=]/).map(d => d.trim()).filter(Boolean);
      
      const deviceMap = new Map();
      [...existingDevices, ...newDevices].forEach(d => {
        deviceMap.set(d.toLowerCase(), d);
      });
      const uniqueDevices = Array.from(deviceMap.values());
      
      if (uniqueDevices.length > existingDevices.length) {
        db.ic_compatibilities[existingIdx].compatible_devices = uniqueDevices.join(' = ');
        updated++;
      } else {
        ignored++;
      }
    } else {
      maxId++;
      db.ic_compatibilities.unshift({
        id: maxId,
        ic_number: icCode,
        component_type: category,
        compatible_devices: devicesStr.split(/[,=]/).map(d => d.trim()).filter(Boolean).join(' = '),
        notes: ''
      });
      added++;
    }
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log(`Success: Added ${added}, Updated ${updated}, Ignored ${ignored}`);
} catch (err) {
  console.error('Error:', err);
}
