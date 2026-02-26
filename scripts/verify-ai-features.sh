#!/bin/bash

echo "🔍 COMPREHENSIVE AI FEATURES VERIFICATION"
echo "=========================================="
echo ""

# Function to check repository AI features
check_repo_ai() {
    local repo_path="$1"
    local repo_name="$2"
    
    echo "📂 Checking $repo_name..."
    
    if [ ! -d "$repo_path" ]; then
        echo "   ❌ Repository directory not found: $repo_path"
        return 1
    fi
    
    cd "$repo_path" || return 1
    
    # Check for memory-bank directories
    local memory_dirs=("memory-bank" "Memory_Bank")
    local found_memory=false
    
    for mem_dir in "${memory_dirs[@]}"; do
        if [ -d "$mem_dir" ]; then
            echo "   ✅ Found memory-bank: $mem_dir/"
            found_memory=true
            
            # Check for AI features
            if [ -d "$mem_dir/ai-features" ]; then
                echo "   ✅ Found AI features: $mem_dir/ai-features/"
                
                # Check key AI files
                local ai_files=(
                    "ai-config.json"
                    "ai-dashboard.py"
                    "ai-activation.py"
                    "agents/smart-agent.py"
                    "insights/context-analyzer.py"
                    "automation/task-manager.py"
                    "learning/pattern-recognizer.py"
                    "nlp/doc-assistant.py"
                )
                
                local missing_files=()
                for ai_file in "${ai_files[@]}"; do
                    if [ ! -f "$mem_dir/ai-features/$ai_file" ]; then
                        missing_files+=("$ai_file")
                    fi
                done
                
                if [ ${#missing_files[@]} -eq 0 ]; then
                    echo "   ✅ All AI feature files present"
                else
                    echo "   ⚠️  Missing AI files: ${missing_files[*]}"
                fi
            else
                echo "   ⚠️  AI features directory not found"
            fi
            break
        fi
    done
    
    if [ "$found_memory" = false ]; then
        echo "   ⚠️  No memory-bank directory found"
    fi
    
    # Check for .cursorignore
    if [ -f ".cursorignore" ]; then
        echo "   ✅ .cursorignore file present"
        
        # Check if AI features are included
        if grep -q "!memory-bank/" .cursorignore; then
            echo "   ✅ Memory-bank inclusion rules found"
        else
            echo "   ⚠️  Memory-bank inclusion rules missing"
        fi
    else
        echo "   ❌ .cursorignore file missing"
    fi
    
    echo ""
    cd - > /dev/null
}

# Check each repository
check_repo_ai "." "Root MVP Repository"
check_repo_ai "PaymentGateway" "PaymentGateway Repository"
check_repo_ai "Crypto/TimeSeries-Forcasting" "TimeSeries-Forcasting Repository"
check_repo_ai "Swiss-Knife" "Swiss-Knife Repository"

echo "🎯 VERIFICATION COMPLETE"
echo ""
echo "📋 Summary:"
echo "   ✅ = Feature working correctly"
echo "   ⚠️  = Feature may need attention"
echo "   ❌ = Feature not working"
echo ""
echo "🔄 Restart Cursor IDE to apply .cursorignore changes"
