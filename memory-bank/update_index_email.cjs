const fs = require('fs');
let content = fs.readFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', 'utf8');

const insertionPoint = "## 📚 Documentation & Resources\n\n### Docs Directory Structure\n\n";
const newEntry = "- **[`EMAIL-047-UPDATE-CLIENT.md`](docs/EMAIL-047-UPDATE-CLIENT.md)** - **Email Client**: E-mail rédigé pour présenter les améliorations de la v0.4.7 sous un angle positif et optimisé.\n";

if (content.includes(insertionPoint)) {
    content = content.replace(insertionPoint, insertionPoint + newEntry);
    fs.writeFileSync('/Users/mohamedcoulibaly/MVP/Pro/retail-manager/memory-bank/INDEX.md', content);
    console.log('Successfully updated INDEX.md');
} else {
    console.log('Insertion point not found in INDEX.md');
}
