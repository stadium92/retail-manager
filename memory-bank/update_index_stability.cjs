const fs = require('fs');
let content = fs.readFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', 'utf8');

const insertionPoint = "## 📊 Analysis & Insights\n";
const newEntry = "- [Analysis: Post-Supabase Stability & Multi-Interface Coverage](analysis/STABILITY_CONSOLIDATION_REPORT.md)\n  - **Focus:** Technical documentation of the Heartbeat, ACID transactions, and No-Ghost logic covering both Master and Worker sides.\n";

if (content.includes(insertionPoint)) {
    content = content.replace(insertionPoint, insertionPoint + newEntry);
    fs.writeFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', content);
    console.log('Successfully updated INDEX.md');
} else {
    console.log('Insertion point not found in INDEX.md');
}
