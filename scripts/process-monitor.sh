#!/bin/bash
# Real-time Process Monitor with Rich Formatting
# Usage: ./process-monitor.sh

echo "🖥️  REAL-TIME PROCESS MONITOR (Ctrl+C to stop)"
echo "=============================================="
echo "Updates every 3 seconds - Press Ctrl+C to exit"
echo ""

while true; do
    clear
    echo "🖥️  TOP CPU PROCESSES - $(date '+%H:%M:%S')"
    echo "=========================================="
    printf "%-12s %-6s %-6s %-8s %-15s %s\n" "USER" "CPU%" "MEM%" "PID" "COMMAND" "PATH"
    echo "------------------------------------------------------------"
    
    ps aux | sort -nrk 3 | head -8 | tail -7 | awk '{
        user=$1
        cpu=$3
        mem=$4
        pid=$2
        cmd=$11
        path=""
        for(i=12;i<=NF;i++) {
            if (length(path) < 30) {
                path = path " " $i
            } else {
                path = path "..."
                break
            }
        }
        printf "%-12s %-6s %-6s %-8s %-15s %s\n", user, cpu"%", mem"%", pid, substr(cmd,1,15), path
    }'
    
    echo ""
    echo "💡 Press 'top' in another terminal for interactive view"
    echo "💡 Press 'open -a \"Activity Monitor\"' for GUI"
    
    sleep 3
done
