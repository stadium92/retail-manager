#!/bin/bash

# Script to clean up __pycache__ directories and verify gitignore setup
# Usage: ./cleanup_pycache.sh [clean|verify|both]

set -e

MVP_DIR="/Users/mohamedcoulibaly/MVP"

clean_pycache() {
    echo "🧹 Cleaning up __pycache__ directories..."
    
    # Find and remove all __pycache__ directories
    find "$MVP_DIR" -type d -name "__pycache__" 2>/dev/null | while read -r dir; do
        echo "Removing: $dir"
        rm -rf "$dir"
    done
    
    # Find and remove all .pyc files
    find "$MVP_DIR" -name "*.pyc" 2>/dev/null | while read -r file; do
        echo "Removing: $file"
        rm -f "$file"
    done
    
    echo "✅ Cleanup completed!"
}

verify_gitignore() {
    echo "🔍 Verifying __pycache__ patterns in .gitignore files..."
    
    # Check root .gitignore
    if grep -q "__pycache__" "$MVP_DIR/.gitignore"; then
        echo "✅ Root .gitignore has __pycache__ patterns"
    else
        echo "❌ Root .gitignore missing __pycache__ patterns"
    fi
    
    # Check root .cursorignore
    if grep -q "__pycache__" "$MVP_DIR/.cursorignore"; then
        echo "✅ Root .cursorignore has __pycache__ patterns"
    else
        echo "❌ Root .cursorignore missing __pycache__ patterns"
    fi
    
    # Check major project .gitignore files
    projects=("Betting/NBA" "Crypto/Alpha_version_1" "Swiss-Knife" "PaymentGateway" "Final_Year_Project/New_Algo")
    
    for project in "${projects[@]}"; do
        gitignore_file="$MVP_DIR/$project/.gitignore"
        if [ -f "$gitignore_file" ]; then
            if grep -q "__pycache__" "$gitignore_file"; then
                echo "✅ $project/.gitignore has __pycache__ patterns"
            else
                echo "❌ $project/.gitignore missing __pycache__ patterns"
            fi
        else
            echo "⚠️  $project/.gitignore not found"
        fi
    done
    
    # Check major project .cursorignore files
    cursor_projects=("Swiss-Knife" "PaymentGateway")
    
    for project in "${cursor_projects[@]}"; do
        cursorignore_file="$MVP_DIR/$project/.cursorignore"
        if [ -f "$cursorignore_file" ]; then
            if grep -q "__pycache__" "$cursorignore_file"; then
                echo "✅ $project/.cursorignore has __pycache__ patterns"
            else
                echo "❌ $project/.cursorignore missing __pycache__ patterns"
            fi
        else
            echo "⚠️  $project/.cursorignore not found"
        fi
    done
}

case "${1:-both}" in
    "clean")
        clean_pycache
        ;;
    "verify")
        verify_gitignore
        ;;
    "both")
        clean_pycache
        echo ""
        verify_gitignore
        ;;
    *)
        echo "Usage: $0 [clean|verify|both]"
        echo "  clean  - Remove all __pycache__ directories and .pyc files"
        echo "  verify - Check if .gitignore and .cursorignore files have __pycache__ patterns"
        echo "  both   - Clean and verify (default)"
        exit 1
        ;;
esac

echo ""
echo "📝 Summary:"
echo "- All __pycache__ directories should now be ignored by git and cursor"
echo "- Future Python cache files will be automatically excluded"
echo "- Run this script periodically to clean up any new cache files"
