const fs = require('fs');
let content = fs.readFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', 'utf8');

const insertionPoint = "## 📜 Key PRDs (Phase 6+)\n";
const newEntry = "- **[`CLAUDE_ULTIMATE_STABILIZATION_PROMPT.md`](CLAUDE_ULTIMATE_STABILIZATION_PROMPT.md)** - **ULTIMATE**: Comprehensive prompt for total system stabilization, security hardening (Heartbeat/Interceptors), and schema consistency across the entire codebase.\n";

if (content.includes(insertionPoint)) {
    content = content.replace(insertionPoint, insertionPoint + newEntry);
    fs.writeFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', content);
    console.log('Successfully updated INDEX.md');
} else {
    console.log('Insertion point not found in INDEX.md');
}
