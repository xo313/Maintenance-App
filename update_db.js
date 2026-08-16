const fs = require('fs');

function parseCSV(text) {
  let result = [];
  let row = [];
  let startValueB = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      let val = text.substring(startValueB, i);
      row.push(val.replace(/^"|"$/g, '').trim());
      startValueB = i + 1;
    } else if (char === '\n' && !inQuotes) {
      let val = text.substring(startValueB, i);
      row.push(val.replace(/^"|"$/g, '').trim());
      result.push(row);
      row = [];
      startValueB = i + 1;
    }
  }
  if (startValueB < text.length) {
    let val = text.substring(startValueB);
    row.push(val.replace(/^"|"$/g, '').trim());
    result.push(row);
  }
  return result;
}

try {
  const dbPath = './database.json';
  const csvPath = './devices.csv';

  const dbText = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(dbText);
  
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(csvText);
  
  const devicesSet = new Set(db.common_devices || []);
  
  // start from 1 to skip header
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length >= 3) {
      const deviceStr = row[2]; // Device/Generations column
      if (!deviceStr) continue;
      
      const parts = deviceStr.split('/').map(d => d.trim());
      parts.forEach(p => {
        if (p) devicesSet.add(p);
      });
    }
  }
  
  db.common_devices = Array.from(devicesSet);
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log('Successfully updated common_devices in database.json with ' + db.common_devices.length + ' devices.');
} catch (err) {
  console.error('Error updating db:', err);
}
