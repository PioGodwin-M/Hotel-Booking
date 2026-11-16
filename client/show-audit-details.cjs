const fs = require('fs');
const file = process.argv[2] || './lighthouse-home.json';
const report = JSON.parse(fs.readFileSync(file, 'utf8'));

['color-contrast', 'heading-order', 'target-size'].forEach(id => {
  const audit = report.audits[id];
  console.log(`\n=== AUDIT: ${id} ===`);
  if (audit && audit.details && audit.details.items) {
    audit.details.items.forEach((item, idx) => {
      console.log(`Item ${idx + 1}:`, item.node ? item.node.snippet : item);
    });
  }
});
