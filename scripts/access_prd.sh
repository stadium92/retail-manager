#!/bin/bash
echo "=== RESULTS ORGANIZATION PRD ACCESS ==="
echo "File Location: /Users/mohamedcoulibaly/MVP/memory-bank/docs/PRD/results-organization-prd.md"
echo "File Size: $(ls -lh /Users/mohamedcoulibaly/MVP/memory-bank/docs/PRD/results-organization-prd.md | awk '{print $5}')"
echo "Last Modified: $(ls -l /Users/mohamedcoulibaly/MVP/memory-bank/docs/PRD/results-organization-prd.md | awk '{print $6, $7, $8}')"
echo ""
echo "To access the PRD:"
echo "1. Open terminal and run: cd /Users/mohamedcoulibaly/MVP/memory-bank/docs/PRD"
echo "2. Then run: cat results-organization-prd.md"
echo "3. Or use: open /Users/mohamedcoulibaly/MVP/memory-bank/docs/PRD/results-organization-prd.md"
echo ""
echo "File preview:"
head -10 /Users/mohamedcoulibaly/MVP/memory-bank/docs/PRD/results-organization-prd.md
