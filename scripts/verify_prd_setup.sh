#!/bin/bash
echo "=== TIMESERIES-FORCASTING RESULTS PRD VERIFICATION ==="
echo ""

echo "1. Checking PRD file location:"
if [ -f "/Users/mohamedcoulibaly/MVP/Crypto/Timeseries-forcasting/memory-bank/docs/PRD/results-organization-prd.md" ]; then
    echo "✅ PRD file exists in Timeseries-forcasting memory-bank"
    echo "   Size: $(ls -lh /Users/mohamedcoulibaly/MVP/Crypto/Timeseries-forcasting/memory-bank/docs/PRD/results-organization-prd.md | awk '{print $5}')"
    echo "   Modified: $(ls -l /Users/mohamedcoulibaly/MVP/Crypto/Timeseries-forcasting/memory-bank/docs/PRD/results-organization-prd.md | awk '{print $6, $7, $8}')"
else
    echo "❌ PRD file NOT found in Timeseries-forcasting memory-bank"
fi

echo ""
echo "2. Checking file content:"
head -3 /Users/mohamedcoulibaly/MVP/Crypto/Timeseries-forcasting/memory-bank/docs/PRD/results-organization-prd.md

echo ""
echo "3. Checking INDEX.md references:"
if grep -q "results-organization-prd.md" /Users/mohamedcoulibaly/MVP/Crypto/Timeseries-forcasting/memory-bank/INDEX.md; then
    echo "✅ PRD referenced in Timeseries-forcasting INDEX.md"
else
    echo "❌ PRD NOT referenced in Timeseries-forcasting INDEX.md"
fi

echo ""
echo "4. Checking target directory structure:"
if [ -d "/Users/mohamedcoulibaly/MVP/Crypto/Timeseries-forcasting/results" ]; then
    echo "✅ Target results directory exists"
    echo "   Files: $(find /Users/mohamedcoulibaly/MVP/Crypto/Timeseries-forcasting/results -type f | wc -l)"
    echo "   Directories: $(find /Users/mohamedcoulibaly/MVP/Crypto/Timeseries-forcasting/results -type d | wc -l)"
else
    echo "❌ Target results directory NOT found"
fi

echo ""
echo "=== VERIFICATION COMPLETE ==="
