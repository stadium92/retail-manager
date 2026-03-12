const fs = require('fs');
let content = fs.readFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', 'utf8');

const insertionPoint = "## 📜 Key PRDs (Phase 6+)\n";
const newEntry = "- **[`CLAUDE_STICKY_HEADERS_MISSION.md`](CLAUDE_STICKY_HEADERS_MISSION.md)** - **UI REFINEMENT**: Mission to implement sticky table headers across all modules for better data visibility during scrolling.\n";

if (content.includes(insertionPoint)) {
    content = content.replace(insertionPoint, insertionPoint + newEntry);
    fs.writeFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', content);
    console.log('Successfully updated INDEX.md');
} else {
    console.log('Insertion point not found in INDEX.md');
}
