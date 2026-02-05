#!/bin/bash

# Force Cursor Swap Usage Script
# Attempts various techniques to influence Cursor to use dedicated swap files

echo "=== Force Cursor Swap Usage Script ==="
echo "Attempting to influence Cursor to use dedicated swap files"
echo ""

# Check current status
echo "=== Current Status ==="
echo "System swap usage:"
sysctl vm.swapusage
echo ""
echo "Cursor processes:"
ps aux | grep -i cursor | grep -v grep | wc -l | xargs echo "Active processes:"
echo ""

# Method 1: Create symbolic links to system swap location
echo "=== Method 1: Symbolic Link Approach ==="
echo "Creating symbolic links in system swap location..."

# Backup existing system swap files
echo "Backing up existing system swap files..."
sudo cp /System/Volumes/VM/swapfile0 /System/Volumes/VM/swapfile0.backup 2>/dev/null || echo "No swapfile0 to backup"
sudo cp /System/Volumes/VM/swapfile1 /System/Volumes/VM/swapfile1.backup 2>/dev/null || echo "No swapfile1 to backup"
sudo cp /System/Volumes/VM/swapfile2 /System/Volumes/VM/swapfile2.backup 2>/dev/null || echo "No swapfile2 to backup"

# Create symbolic links to our optimized swap files
echo "Creating symbolic links..."
sudo ln -sf /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_primary_optimized /System/Volumes/VM/swapfile3 2>/dev/null || echo "Failed to create swapfile3 link"
sudo ln -sf /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_backup_optimized /System/Volumes/VM/swapfile4 2>/dev/null || echo "Failed to create swapfile4 link"

echo "Symbolic links created (if successful)"
ls -lah /System/Volumes/VM/swapfile* 2>/dev/null | tail -5

echo ""
echo "=== Method 2: Process Priority Adjustment ==="
echo "Adjusting Cursor process priorities..."

# Get Cursor process IDs
cursor_pids=$(ps aux | grep -i cursor | grep -v grep | awk '{print $2}')

if [ ! -z "$cursor_pids" ]; then
    echo "Found Cursor processes: $cursor_pids"
    
    # Set higher priority for Cursor processes
    for pid in $cursor_pids; do
        echo "Adjusting priority for process $pid..."
        sudo renice -10 $pid 2>/dev/null || echo "Failed to adjust priority for $pid"
    done
    
    echo "Priority adjustment completed"
else
    echo "No Cursor processes found"
fi

echo ""
echo "=== Method 3: Memory Pressure Simulation ==="
echo "Simulating memory pressure to encourage swap usage..."

# Create temporary memory pressure
echo "Allocating temporary memory to create pressure..."
python3 -c "
import os
import time
# Allocate 2GB of memory temporarily
data = []
for i in range(200):
    data.append(bytearray(10 * 1024 * 1024))  # 10MB chunks
    if i % 20 == 0:
        print(f'Allocated {(i+1)*10}MB')
        time.sleep(0.1)
print('Memory pressure created, releasing...')
del data
" 2>/dev/null || echo "Python memory allocation failed"

echo ""
echo "=== Method 4: Swap File Permissions ==="
echo "Adjusting swap file permissions and attributes..."

# Set proper permissions
sudo chmod 600 /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_* 2>/dev/null || echo "Permission adjustment failed"

# Set file attributes
sudo chflags uchg /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_* 2>/dev/null || echo "Attribute setting failed"

echo "File attributes updated"

echo ""
echo "=== Method 5: System Configuration ==="
echo "Attempting to influence system swap configuration..."

# Try to influence swap settings (these may not work due to SIP)
echo "Current swap settings:"
sysctl vm.swap_enabled
sysctl vm.swapfileprefix

# Attempt to modify swap behavior (may require admin privileges)
echo "Attempting to optimize swap behavior..."
sudo sysctl vm.compressor_swapout_target_age=1 2>/dev/null || echo "Cannot modify compressor settings"

echo ""
echo "=== Verification ==="
echo "Checking if methods were successful..."

# Check if symbolic links exist
if [ -L "/System/Volumes/VM/swapfile3" ] && [ -L "/System/Volumes/VM/swapfile4" ]; then
    echo "✅ Symbolic links created successfully"
    echo "System should now see our swap files as system swap files"
else
    echo "❌ Symbolic link creation failed"
fi

# Check process priorities
echo "Cursor process priorities:"
ps aux | grep -i cursor | grep -v grep | awk '{print $2, $7, $11}' | head -3

# Check swap usage
echo ""
echo "Current swap usage:"
sysctl vm.swapusage

echo ""
echo "=== Important Notes ==="
echo "1. These methods may not work due to macOS security restrictions"
echo "2. Symbolic links in /System/Volumes/VM/ may be the most effective approach"
echo "3. System may still prefer its own swap management"
echo "4. Restart Cursor after running this script for best results"

echo ""
echo "=== Next Steps ==="
echo "1. Restart Cursor: killall Cursor && open -a Cursor"
echo "2. Monitor swap usage: watch -n 5 'vm_stat | grep Swap'"
echo "3. Check if our files are being used: lsof /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_*"

echo ""
echo "Script completed!"

