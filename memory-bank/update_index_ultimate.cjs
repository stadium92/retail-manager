const fs = require('fs');
let content = fs.readFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', 'utf8');

const insertionPoint = "## 📜 Key PRDs (Phase 6+)\n";
const newEntry = "- **[`CLAUDE_UNIVERSAL_SYNC_FIX.md`](CLAUDE_UNIVERSAL_SYNC_FIX.md)** - **SYNC FIX**: Comprehensive prompt to resolve 'failed to load' errors in Edition/Gestion and enable real-time stock reactivity via secure request interceptors.\n";

if (content.includes(insertionPoint)) {
    content = content.replace(insertionPoint, insertionPoint + newEntry);
    fs.writeFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', content);
    console.log('Successfully updated INDEX.md');
} else {
    console.log('Insertion point not found in INDEX.md');
}
