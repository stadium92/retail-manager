#!/bin/bash

# Simple Swap Force Script
# Focuses on the most promising method: symbolic links

echo "=== Simple Swap Force Script ==="
echo "Creating symbolic links to force system to use our swap files"
echo ""

# Check if our swap files exist
if [ ! -f "/System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_primary_optimized" ]; then
    echo "❌ Cursor swap files not found. Run create_optimized_cursor_swap.sh first."
    exit 1
fi

echo "✅ Cursor swap files found"
echo ""

# Method: Create symbolic links in system swap directory
echo "=== Creating Symbolic Links ==="
echo "This method tricks the system into using our swap files as system swap files"
echo ""

# Create symbolic links
echo "Creating swapfile3 -> cursor_primary_optimized"
sudo ln -sf /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_primary_optimized /System/Volumes/VM/swapfile3

echo "Creating swapfile4 -> cursor_backup_optimized"
sudo ln -sf /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_backup_optimized /System/Volumes/VM/swapfile4

echo ""
echo "=== Verification ==="
echo "Checking symbolic links:"
ls -lah /System/Volumes/VM/swapfile* | tail -5

echo ""
echo "=== Testing ==="
echo "Creating memory pressure to test swap usage..."

# Create a simple memory pressure test
python3 -c "
import time
print('Creating memory pressure...')
data = []
for i in range(50):
    data.append(bytearray(20 * 1024 * 1024))  # 20MB chunks
    print(f'Allocated {(i+1)*20}MB', end='\r')
    time.sleep(0.1)
print('\nReleasing memory...')
del data
print('Memory pressure test completed')
" 2>/dev/null || echo "Memory pressure test failed"

echo ""
echo "=== Current Status ==="
echo "System swap usage:"
sysctl vm.swapusage

echo ""
echo "Swap file activity:"
ls -lt /System/Volumes/VM/swapfile* | head -5

echo ""
echo "=== Instructions ==="
echo "1. Restart Cursor: killall Cursor && open -a Cursor"
echo "2. Monitor: watch -n 5 'vm_stat | grep Swap'"
echo "3. Check usage: lsof /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_*"

echo ""
echo "Script completed!"

