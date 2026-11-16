const fs = require('fs');
const report = JSON.parse(fs.readFileSync('./lighthouse-rooms.json', 'utf8'));

['heading-order', 'select-name'].forEach(id => {
  const audit = report.audits[id];
  console.log(`\n=== AUDIT: ${id} ===`);
  if (audit && audit.details && audit.details.items) {
    audit.details.items.forEach((item, idx) => {
      console.log(`Item ${idx + 1}:`, item.node ? item.node.snippet : item);
    });
  }
});
