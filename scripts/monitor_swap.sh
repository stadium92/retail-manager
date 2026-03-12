#!/bin/bash

# Comprehensive Swap Monitoring Script for macOS
# Provides multiple monitoring options and real-time analysis

echo "=== Swap Monitoring Script ==="
echo "Choose your monitoring method:"
echo "1. Real-time monitoring with watch (requires Homebrew)"
echo "2. Native macOS monitoring loop"
echo "3. Single snapshot"
echo "4. Continuous monitoring with custom interval"
echo ""

read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "Starting real-time monitoring with watch..."
        echo "Press Ctrl+C to stop"
        echo ""
        watch -n 5 'vm_stat | grep -E "(Swap|Compressed)"'
        ;;
    2)
        echo "Starting native macOS monitoring loop..."
        echo "Press Ctrl+C to stop"
        echo ""
        while true; do
            clear
            echo "=== Swap Status - $(date) ==="
            echo ""
            echo "System Swap Usage:"
            sysctl vm.swapusage
            echo ""
            echo "Memory Statistics:"
            vm_stat | grep -E "(Pages|Swap|Compressed)" | head -8
            echo ""
            echo "Cursor Processes:"
            ps aux | grep -i cursor | grep -v grep | wc -l | xargs echo "Active processes:"
            echo ""
            echo "Press Ctrl+C to stop monitoring"
            sleep 5
        done
        ;;
    3)
        echo "=== Single Snapshot - $(date) ==="
        echo ""
        echo "System Swap Usage:"
        sysctl vm.swapusage
        echo ""
        echo "Memory Statistics:"
        vm_stat | grep -E "(Pages|Swap|Compressed)"
        echo ""
        echo "Cursor Processes:"
        ps aux | grep -i cursor | grep -v grep | head -5
        echo ""
        echo "Swap Files:"
        ls -lah /System/Volumes/Data/private/var/vm/ 2>/dev/null | grep -E "(swap|cursor)" | head -5
        ;;
    4)
        read -p "Enter interval in seconds (default 5): " interval
        interval=${interval:-5}
        echo "Starting continuous monitoring with ${interval}s interval..."
        echo "Press Ctrl+C to stop"
        echo ""
        while true; do
            clear
            echo "=== Swap Status - $(date) ==="
            echo "Monitoring interval: ${interval}s"
            echo ""
            echo "System Swap Usage:"
            sysctl vm.swapusage
            echo ""
            echo "Memory Statistics:"
            vm_stat | grep -E "(Pages|Swap|Compressed)" | head -8
            echo ""
            echo "Cursor Memory Usage:"
            ps aux | grep -i cursor | grep -v grep | awk '{sum += $6} END {if(sum>0) print "Total RSS: " sum/1024 " MB"; else print "No Cursor processes running"}'
            echo ""
            echo "Swap File Status:"
            if [ -d "/System/Volumes/Data/private/var/vm/cursor_swap_optimized" ]; then
                echo "Optimized swap files:"
                ls -lah /System/Volumes/Data/private/var/vm/cursor_swap_optimized/ 2>/dev/null | head -3
            else
                echo "No optimized swap files found"
            fi
            echo ""
            echo "Press Ctrl+C to stop monitoring"
            sleep $interval
        done
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

