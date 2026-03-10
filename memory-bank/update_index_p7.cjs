const fs = require('fs');
let content = fs.readFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', 'utf8');

const insertionPoint = "## 📜 Key PRDs (Phase 6+)\n";
const newEntry = "- **[`PROMPT-007-Global-Refinements-And-Purchases.md`](docs/PROMPT-007-Global-Refinements-And-Purchases.md)** - **UI & LOGIC**: Prioritized prompt for fixing purchasing math, global font sizing, Master dashboard capabilities, and activation key issues.\n";

if (content.includes(insertionPoint)) {
    content = content.replace(insertionPoint, insertionPoint + newEntry);
    fs.writeFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', content);
    console.log('Successfully updated INDEX.md');
} else {
    console.log('Insertion point not found in INDEX.md');
}
