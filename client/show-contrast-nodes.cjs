const fs = require('fs');
const report = JSON.parse(fs.readFileSync('./lighthouse-home.json', 'utf8'));
const items = report.audits['color-contrast'].details.items;
items.forEach((item, idx) => {
  console.log(`\nItem ${idx + 1}:`);
  console.log('Selector:', item.node.selector);
  console.log('Snippet:', item.node.snippet);
  console.log('Explanation:', item.node.explanation);
});
