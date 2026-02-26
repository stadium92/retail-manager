#!/bin/bash

# Swap Performance Optimization and Monitoring Script
# Analyzes and optimizes swap performance for Cursor

echo "=== Swap Performance Optimization Script ==="
echo "Analyzing current swap performance and providing optimizations"
echo ""

# System analysis
echo "=== System Analysis ==="
echo "CPU: $(sysctl -n machdep.cpu.brand_string)"
echo "Memory: $(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024) " GB"}')"
echo "Page size: $(getconf PAGESIZE) bytes"
echo "CPU cores: $(sysctl -n hw.ncpu)"
echo ""

# Current swap analysis
echo "=== Current Swap Analysis ==="
echo "System swap usage:"
sysctl vm.swapusage
echo ""

echo "Memory pressure indicators:"
vm_stat | grep -E "(Pages|Swap|Compressed)" | head -8
echo ""

# Check for existing swap files
echo "=== Existing Swap Files ==="
echo "System swap files:"
ls -lah /System/Volumes/Data/private/var/vm/ 2>/dev/null | grep -v "cursor_swap" | head -5

echo ""
echo "Cursor swap files:"
find /System/Volumes/Data/private/var/vm/ -name "*cursor*" -type f 2>/dev/null | head -5

echo ""
echo "=== Performance Analysis ==="

# Check swap activity
swapins=$(vm_stat | grep "Swapins" | awk '{print $2}' | tr -d '.')
swapouts=$(vm_stat | grep "Swapouts" | awk '{print $2}' | tr -d '.')
compressions=$(vm_stat | grep "Compressions" | awk '{print $2}' | tr -d '.')

echo "Swap activity:"
echo "  Swapins: $swapins"
echo "  Swapouts: $swapouts"
echo "  Compressions: $compressions"

# Performance assessment
if [ "$swapins" -gt 10000000 ]; then
    echo "  ⚠️  HIGH swap activity detected - system under memory pressure"
elif [ "$swapins" -gt 1000000 ]; then
    echo "  ⚠️  Moderate swap activity - some memory pressure"
else
    echo "  ✅ Low swap activity - good memory management"
fi

echo ""
echo "=== Optimization Recommendations ==="

# Check if Cursor is running
if pgrep -f "Cursor" > /dev/null; then
    echo "✅ Cursor is running"
    echo "Cursor processes: $(pgrep -f "Cursor" | wc -l)"
    
    # Check Cursor memory usage
    echo "Cursor memory usage:"
    ps aux | grep -i cursor | grep -v grep | awk '{sum += $6} END {print "Total RSS: " sum/1024 " MB"}'
else
    echo "❌ Cursor is not running"
fi

echo ""
echo "=== Optimization Strategies ==="

# Check available space
available_space=$(df /System/Volumes/Data | tail -1 | awk '{print $4}')
echo "Available disk space: $available_space"

if [ "$available_space" -gt 20000000 ]; then
    echo "✅ Sufficient space for swap optimization"
    echo "Recommended: Create 15GB optimized swap files"
elif [ "$available_space" -gt 10000000 ]; then
    echo "⚠️  Limited space - consider 10GB swap files"
else
    echo "❌ Low disk space - optimize existing files first"
fi

echo ""
echo "=== Performance Optimization Commands ==="
echo "1. Create optimized swap: ./create_optimized_cursor_swap.sh"
echo "2. Monitor performance: watch -n 5 'vm_stat | grep Swap'"
echo "3. Check I/O: iostat -d 1"
echo "4. Monitor Cursor: ps aux | grep cursor"

echo ""
echo "=== Current Swap File Status ==="
if [ -d "/System/Volumes/Data/private/var/vm/cursor_swap_optimized" ]; then
    echo "Optimized swap directory found:"
    ls -lah /System/Volumes/Data/private/var/vm/cursor_swap_optimized/
else
    echo "No optimized swap directory found"
fi

echo ""
echo "=== Quick Performance Test ==="
echo "Testing swap file access performance..."
if [ -f "/System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_primary_optimized" ]; then
    echo "Testing primary swap file..."
    time dd if=/System/Volumes/Data/private/var/vm/cursor_swap_optimized/cursor_primary_optimized of=/dev/null bs=1m count=100 2>/dev/null
else
    echo "No optimized swap files found for testing"
fi

echo ""
echo "Script completed!"
echo "For best performance, run: ./create_optimized_cursor_swap.sh"


