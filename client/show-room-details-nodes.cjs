const fs = require('fs');
const report = JSON.parse(fs.readFileSync('./lighthouse-room-details.json', 'utf8'));

['color-contrast', 'heading-order'].forEach(id => {
  const audit = report.audits[id];
  console.log(`\n=== AUDIT: ${id} ===`);
  if (audit && audit.details && audit.details.items) {
    audit.details.items.forEach((item, idx) => {
      console.log(`Item ${idx + 1}:`, item.node ? item.node.snippet : item);
      if (item.node && item.node.explanation) console.log('Explanation:', item.node.explanation);
    });
  }
});
