#!/bin/bash

# Safe script to clean results/ directories from all repositories
# This will NOT affect remote repositories directly - it affects local copies

echo "🔍 Scanning for repositories with results/ directories..."

# Find all git repositories
find . -name ".git" -type d | while read git_dir; do
    repo_path=$(dirname "$git_dir")
    echo "📁 Checking: $repo_path"
    
    if [ -d "$repo_path/results" ]; then
        echo "  ⚠️  Found results/ directory in $repo_path"
        
        # Check repository status
        cd "$repo_path"
        
        # Check if results/ is tracked by git
        if git ls-files results/ >/dev/null 2>&1; then
            echo "  🗑️  Removing tracked results/ directory..."
            git rm -r --cached results/ 2>/dev/null || echo "  ⚠️  Could not remove from cache"
            
            # Remove physical directory if it still exists
            [ -d "results" ] && rm -rf results
            
            # Commit the removal
            git add -A
            git commit -m "🧹 cleanup: Remove results/ directory to reduce repository size" 2>/dev/null || echo "  ℹ️  Nothing to commit"
            
            echo "  ✅ Cleaned results/ from $repo_path"
        else
            echo "  ℹ️  results/ exists but not tracked by git"
            # Still remove it physically if user wants
            read -p "  Remove untracked results/ directory? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rm -rf results
                echo "  ✅ Removed untracked results/ directory"
            fi
        fi
        
        cd - >/dev/null
    else
        echo "  ✅ No results/ directory found"
    fi
    echo
done

echo "🎉 Cleanup completed!"
echo "💡 Note: Changes are local. Run 'git push' in each repo to update remotes."
