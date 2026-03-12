#!/bin/bash

# Improved script to clean results/ from remote repositories
echo "🧹 Starting remote repository cleanup..."
echo "📋 Target repositories: Timeseries-forcasting, Data-factory, mineral-exploration-ai"
echo

# Array of repositories to clean
REPOS=("Timeseries-forcasting" "Data-factory" "mineral-exploration-ai")
TEMP_DIR="/tmp/repo_cleanup_$(date +%s)"

echo "📁 Using temp directory: $TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

for repo in "${REPOS[@]}"; do
    echo "🔄 Processing repository: $repo"
    echo "  📥 Cloning repository..."
    
    # Clone with timeout and error checking
    if timeout 60 gh repo clone "mohcly/$repo" "$repo" 2>&1; then
        echo "  ✅ Clone successful"
        
        cd "$repo"
        
        # Check current branch
        CURRENT_BRANCH=$(git branch --show-current)
        echo "  🌿 Current branch: $CURRENT_BRANCH"
        
        # Check for results directory
        if [ -d "results" ]; then
            echo "  🗑️ Found results/ directory - removing..."
            
            # Count files before removal
            FILE_COUNT=$(find results/ -type f 2>/dev/null | wc -l)
            echo "  📊 Found $FILE_COUNT files in results/"
            
            # Remove from git tracking
            git rm -r results/ 2>/dev/null || echo "  ⚠️ Could not remove from git tracking"
            
            # Remove physical directory
            rm -rf results/
            
            # Check if there are changes to commit
            if git diff --cached --quiet; then
                echo "  ℹ️ No changes to commit"
            else
                echo "  💾 Committing changes..."
                git add -A
                git commit -m "🧹 cleanup: Remove results/ directory to reduce repository size" 2>/dev/null
                
                echo "  📤 Pushing changes..."
                git push origin "$CURRENT_BRANCH" 2>/dev/null && echo "  ✅ Push successful" || echo "  ❌ Push failed"
            fi
            
            echo "  ✅ Successfully cleaned $repo"
        else
            echo "  ℹ️ No results/ directory found in $repo"
        fi
        
        cd ..
        rm -rf "$repo"
        echo "  🧽 Cleaned up temp files for $repo"
        
    else
        echo "  ❌ Failed to clone $repo (timeout or authentication issue)"
    fi
    
    echo
done

cd /
rm -rf "$TEMP_DIR"
echo "🎉 Remote cleanup completed!"
echo "🧽 Cleaned up temp directory: $TEMP_DIR"
