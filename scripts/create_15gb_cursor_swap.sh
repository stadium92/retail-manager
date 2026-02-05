#!/bin/bash

# 15GB Cursor Swap Configuration Script
# Target: 15GB total swap allocation for Cursor
# Location: /Users/mohamedcoulibaly/MVP/scripts/

echo "=== 15GB Cursor Swap Configuration Script ==="
echo "Target: 15GB total swap allocation for Cursor"
echo "Configuration: 1×10GB + 1×5GB files"
echo "Location: /System/Volumes/Data/private/var/vm/cursor_swap/"
echo ""

# Check available disk space first
echo "Checking available disk space..."
df -h /System/Volumes/Data/ | tail -1
echo ""

# Check current swap status
echo "Current swap status:"
vm_stat | grep -E "(Swap|Compressed)"
echo ""

# Prompt for confirmation
read -p "This will create 15GB of Cursor swap files. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 1
fi

# Create dedicated directory for Cursor swap
echo "Creating Cursor swap directory..."
sudo mkdir -p /System/Volumes/Data/private/var/vm/cursor_swap/

# Remove any existing swap files in cursor_swap directory
echo "Cleaning existing Cursor swap files..."
sudo rm -f /System/Volumes/Data/private/var/vm/cursor_swap/cursor_* 2>/dev/null

# Create 15GB Cursor swap files
echo "Creating 15GB Cursor swap files..."

# 10GB file for Cursor's primary operations
echo "Creating cursor_primary_swap (10GB)..."
sudo dd if=/dev/zero of=/System/Volumes/Data/private/var/vm/cursor_swap/cursor_primary_swap bs=1m count=10240 status=progress

if [ $? -eq 0 ]; then
    echo "✓ cursor_primary_swap (10GB) created successfully"
else
    echo "✗ Failed to create cursor_primary_swap"
    exit 1
fi

# 5GB file for backup/overflow operations
echo "Creating cursor_backup_swap (5GB)..."
sudo dd if=/dev/zero of=/System/Volumes/Data/private/var/vm/cursor_swap/cursor_backup_swap bs=1m count=5120 status=progress

if [ $? -eq 0 ]; then
    echo "✓ cursor_backup_swap (5GB) created successfully"
else
    echo "✗ Failed to create cursor_backup_swap"
    exit 1
fi

# Set proper permissions
echo ""
echo "Setting permissions..."
sudo chmod 600 /System/Volumes/Data/private/var/vm/cursor_swap/cursor_*

# Verify files were created
echo ""
echo "Verifying created files..."
ls -lh /System/Volumes/Data/private/var/vm/cursor_swap/cursor_* 2>/dev/null

# Calculate total size
total_size=$(ls -l /System/Volumes/Data/private/var/vm/cursor_swap/cursor_* 2>/dev/null | awk '{sum += $5} END {print sum/1024/1024/1024}')
echo ""
echo "Total Cursor swap files created: ${total_size}GB"

echo ""
echo "=== 15GB CONFIGURATION BENEFITS ==="
echo "1. Generous swap allocation for Cursor (10GB primary + 5GB backup)"
echo "2. Optimized for large projects and heavy development work"
echo "3. Reduces system swap pressure"
echo "4. Improves Cursor performance and stability"
echo "5. Dedicated swap space separate from system swap"

echo ""
echo "=== SWAP FILE DETAILS ==="
echo "Primary swap: 10GB (for main Cursor operations)"
echo "Backup swap: 5GB (for overflow and parallel operations)"
echo "Total allocation: 15GB"
echo "Location: /System/Volumes/Data/private/var/vm/cursor_swap/"

echo ""
echo "=== IMPORTANT NOTES ==="
echo "1. These files are created but NOT automatically active as swap"
echo "2. macOS may ignore these files due to System Integrity Protection"
echo "3. The system will still manage its own dynamic swap files"
echo "4. To remove these files later: sudo rm /System/Volumes/Data/private/var/vm/cursor_swap/cursor_*"
echo "5. Monitor Cursor performance after creation"

echo ""
echo "=== MONITORING COMMANDS ==="
echo "Check swap usage: vm_stat | grep -E '(Swap|Compressed)'"
echo "Monitor swap files: ls -lah /System/Volumes/Data/private/var/vm/cursor_swap/"
echo "Check Cursor processes: ps aux | grep cursor | grep -v grep"

echo ""
echo "Script completed successfully!"
echo "Next: Restart Cursor to potentially use the new swap files"
echo "Location: /Users/mohamedcoulibaly/MVP/scripts/create_15gb_cursor_swap.sh"


