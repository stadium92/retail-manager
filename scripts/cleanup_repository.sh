#!/bin/bash

# ==============================================================================
# REPOSITORY CLEANUP SCRIPT
# ==============================================================================
# This script helps remove already-tracked files that should now be ignored
# Run this CAREFULLY and review each step

echo "🧹 Repository Cleanup Script"
echo "⚠️  WARNING: This will remove files from Git tracking"
echo "💾 Make sure you have backups before proceeding"
echo ""

# Step 1: Check current repository size
echo "📊 Current repository status:"
git count-objects -vH

echo ""
echo "📁 Largest files currently tracked:"
git ls-files | head -20

echo ""
echo "🔍 Files that should be ignored but are currently tracked:"

# Check for files that match .gitignore patterns but are still tracked
echo "  - Python cache files:"
git ls-files | grep -E '__pycache__|\.pyc$|\.pyo$' | head -10

echo "  - Node modules (if any tracked):"
git ls-files | grep node_modules | head -10

echo "  - Model/checkpoint files:"
git ls-files | grep -E '\.ckpt$|\.h5$|\.pkl$|\.joblib$|\.pth$' | head -10

echo "  - Log files:"
git ls-files | grep -E '\.log$|debug\.log|app_log\.txt' | head -10

echo "  - Build artifacts:"
git ls-files | grep -E 'build/|dist/|target/' | head -10

echo ""
echo "🚀 To remove these files from tracking (CAREFUL!):"
echo "git rm --cached <file-or-pattern>"
echo "git commit -m 'Remove files that should be ignored'"

echo ""
echo "📝 To remove entire directories:"
echo "git rm -r --cached <directory>"

echo ""
echo "🔄 To apply .gitignore to already tracked files:"
echo "git rm -r --cached ."
echo "git add ."
echo "git commit -m 'Apply .gitignore to remove ignored files'"

echo ""
echo "⚠️  The last command removes ALL files from tracking and re-adds only non-ignored ones"
echo "⚠️  Only run this if you're confident in your .gitignore patterns"
