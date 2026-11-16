const fs = require('fs');
const file = process.argv[2] || './lighthouse-home.json';
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const scores = {};
for (const [key, val] of Object.entries(report.categories)) {
  scores[val.title] = Math.round(val.score * 100);
}
console.log('Scores for ' + file + ':', scores);

const a11yAudits = [];
for (const [key, a] of Object.entries(report.audits)) {
  // If audit belongs to accessibility category and failed
  if (report.categories.accessibility.auditRefs.some(ref => ref.id === key) && a.score !== null && a.score < 1) {
    a11yAudits.push({ id: a.id, title: a.title, score: a.score, description: a.description });
  }
}
console.log('Failed A11y audits count:', a11yAudits.length);
if (a11yAudits.length > 0) {
  console.log('Failures:', JSON.stringify(a11yAudits, null, 2));
}
