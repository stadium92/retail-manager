#!/bin/bash

# Simple script to clean results/ from remote repositories
echo "🧹 Starting remote repository cleanup..."

REPOS=("Timeseries-forcasting" "Data-factory" "mineral-exploration-ai")
TEMP_DIR="/tmp/simple_cleanup_$(date +%s)"

echo "📁 Using temp directory: $TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

for repo in "${REPOS[@]}"; do
    echo "🔄 Processing: $repo"
    echo "  📥 Cloning..."
    
    # Try to clone with simple error checking
    if gh repo clone "mohcly/$repo" "$repo" 2>&1; then
        echo "  ✅ Clone successful"
        
        cd "$repo"
        
        # Check current branch
        CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
        echo "  🌿 Branch: $CURRENT_BRANCH"
        
        # Check for results directory
        if [ -d "results" ]; then
            echo "  🗑️ Found results/ - cleaning..."
            
            # Remove from git
            git rm -r results/ 2>/dev/null || echo "  ⚠️ Could not remove from git"
            rm -rf results/
            
            # Commit and push
            git add -A 2>/dev/null
            
            if git diff --cached --quiet 2>/dev/null; then
                echo "  ℹ️ No changes to commit"
            else
                echo "  💾 Committing..."
                git commit -m "🧹 cleanup: Remove results/ directory" 2>/dev/null
                echo "  📤 Pushing..."
                git push origin "$CURRENT_BRANCH" 2>/dev/null && echo "  ✅ Push successful" || echo "  ❌ Push failed"
            fi
        else
            echo "  ℹ️ No results/ directory"
        fi
        
        cd ..
        rm -rf "$repo"
        echo "  ✅ Completed $repo"
    else
        echo "  ❌ Clone failed for $repo"
        echo "  💡 Check: gh auth status"
        echo "  💡 Check: gh repo list mohcly"
    fi
    
    echo
done

cd /
rm -rf "$TEMP_DIR" 2>/dev/null
echo "🎉 Cleanup completed!"
