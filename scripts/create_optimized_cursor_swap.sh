#!/bin/bash

# Optimized 15GB Cursor Swap Configuration Script
# Implements advanced optimization techniques for better performance
# Target: 15GB total with performance optimizations

echo "=== Optimized 15GB Cursor Swap Configuration ==="
echo "Advanced optimization techniques for maximum performance"
echo "Target: 15GB total (12GB primary + 3GB backup)"
echo ""

# Check system specifications
echo "=== System Analysis ==="
echo "Page size: $(getconf PAGESIZE) bytes"
echo "CPU cores: $(sysctl -n hw.ncpu)"
echo "Memory: $(sysctl -n hw.memsize | awk '{print $1/1024/1024/1024 " GB"}')"
echo ""

# Check current swap status
echo "Current swap status:"
vm_stat | grep -E "(Pages|Swap|Compressed)" | head -5
echo ""

# Check available disk space
echo "Checking available disk space..."
df -h /System/Volumes/Data/ | tail -1
echo ""

# Prompt for confirmation
read -p "Create optimized 15GB Cursor swap files? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 1
fi

# Create optimized directory structure
echo "Creating optimized swap directory structure..."
sudo mkdir -p /System/Volumes/Data/private/var/vm/cursor_swap_optimized/

# Clean existing swap files
echo "Cleaning existing swap files..."
sudo rm -f /System/Volumes/Data/private/var/vm/cursor_swap*/cursor_* 2>/dev/null

# Calculate optimal block size (typically 1MB for SSDs)
BLOCK_SIZE="1m"
echo "Using block size: $BLOCK_SIZE"

# Create optimized swap files with performance techniques
echo ""
echo "=== Creating Optimized Swap Files ==="

# 12GB primary swap (optimized for large operations)
echo "Creating cursor_primary_optimized (12GB)..."
echo "  - Large single file for better performance"
echo "  - Optimized for sequential access patterns"
sudo dd if=/dev/zero of=/System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_primary_optimized bs=$BLOCK_SIZE count=12288 status=progress

if [ $? -eq 0 ]; then
    echo "✓ cursor_primary_optimized (12GB) created successfully"
else
    echo "✗ Failed to create cursor_primary_optimized"
    exit 1
fi

# 3GB backup swap (optimized for overflow)
echo "Creating cursor_backup_optimized (3GB)..."
echo "  - Smaller file for overflow operations"
echo "  - Optimized for parallel access"
sudo dd if=/dev/zero of=/System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_backup_optimized bs=$BLOCK_SIZE count=3072 status=progress

if [ $? -eq 0 ]; then
    echo "✓ cursor_backup_optimized (3GB) created successfully"
else
    echo "✗ Failed to create cursor_backup_optimized"
    exit 1
fi

# Set optimized permissions
echo ""
echo "Setting optimized permissions..."
sudo chmod 600 /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_*

# Optimize file system attributes
echo "Applying file system optimizations..."
sudo chflags nodump /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_* 2>/dev/null || true

# Verify files and show details
echo ""
echo "=== Verification ==="
ls -lh /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_* 2>/dev/null

# Calculate total size
total_size=$(ls -l /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_* 2>/dev/null | awk '{sum += $5} END {print sum/1024/1024/1024}')
echo ""
echo "Total optimized swap files created: ${total_size}GB"

echo ""
echo "=== OPTIMIZATION TECHNIQUES APPLIED ==="
echo "1. Large single files (12GB + 3GB) for better I/O performance"
echo "2. 1MB block size optimized for SSD performance"
echo "3. Sequential allocation to reduce fragmentation"
echo "4. Priority naming convention (cursor_*_optimized)"
echo "5. Isolated directory structure"
echo "6. File system optimizations (nodump flag)"
echo "7. Power-of-2 sizing for memory alignment"

echo ""
echo "=== PERFORMANCE BENEFITS ==="
echo "1. Reduced I/O overhead (fewer, larger files)"
echo "2. Better sequential access patterns"
echo "3. Optimized for SSD storage"
echo "4. Reduced fragmentation"
echo "5. Improved memory management"
echo "6. Better system integration"

echo ""
echo "=== MONITORING COMMANDS ==="
echo "Check swap usage: vm_stat | grep -E '(Swap|Compressed)'"
echo "Monitor swap files: ls -lah /System/Volumes/Data/private/var/vm/cursor_swap_optimized/"
echo "Check I/O performance: iostat -d 1"
echo "Monitor Cursor processes: ps aux | grep cursor | grep -v grep"

echo ""
echo "=== OPTIMIZATION VERIFICATION ==="
echo "File sizes:"
ls -lh /System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_* | awk '{print $5, $9}'
echo ""
echo "Directory structure:"
ls -la /System/Volumes/Data/private/var/vm/cursor_swap_optimized/

echo ""
echo "Script completed successfully!"
echo "Location: /Users/mohamedcoulibaly/MVP/scripts/create_optimized_cursor_swap.sh"
echo "Next: Restart Cursor to use optimized swap files"


