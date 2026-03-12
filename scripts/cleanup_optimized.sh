#!/bin/bash

# ==============================================================================
# ULTRA-AGGRESSIVE REPOSITORY CLEANUP SCRIPT
# ==============================================================================
# This script applies the new .gitignore and .cursorignore patterns
# to remove large files from git tracking and optimize performance

set -e

echo "🚀 Starting Ultra-Aggressive Repository Cleanup..."
echo "=================================================="

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Backup current state
echo "📦 Creating backup of current git state..."
git status --porcelain > cleanup_backup_$(date +%Y%m%d_%H%M%S).txt

# Show current repository size
echo "📊 Current repository size:"
du -sh .git
echo ""

# Show current number of tracked files
echo "📁 Current number of tracked files:"
git ls-files | wc -l
echo ""

# Find largest tracked files
echo "🔍 Top 20 largest tracked files:"
git ls-files | xargs ls -lh 2>/dev/null | sort -k5 -hr | head -20
echo ""

# Remove large ML model files from tracking
echo "🧹 Removing ML model files from tracking..."
git rm --cached --ignore-unmatch \
    "**/*.h5" "**/*.hdf5" "**/*.pkl" "**/*.pickle" "**/*.joblib" \
    "**/*.ckpt" "**/*.pth" "**/*.pt" "**/*.model" "**/*.weights" \
    "**/*.pb" "**/*.tflite" "**/*.onnx" "**/*.safetensors" "**/*.bin" \
    2>/dev/null || true

# Remove training output directories
echo "🧹 Removing training output directories from tracking..."
git rm -r --cached --ignore-unmatch \
    "**/checkpoints" "**/saves" "**/lightning_logs" "**/tensorboard_logs" \
    "**/wandb" "**/mlruns" "**/outputs" "**/multirun" \
    "**/model_outputs" "**/training_outputs" "**/experiment_results" \
    "**/plots" "**/old_plots" \
    2>/dev/null || true

# Remove large data files
echo "🧹 Removing data files from tracking..."
git rm --cached --ignore-unmatch \
    "**/*.csv" "**/*.tsv" "**/*.parquet" "**/*.feather" "**/*.arrow" \
    "**/*.xlsx" "**/*.xls" \
    2>/dev/null || true

# Remove specific large directories
echo "🧹 Removing specific large directories from tracking..."
git rm -r --cached --ignore-unmatch \
    "Crypto/Alpha_version_1/saves" \
    "Crypto/Alpha_version_1/Data" \
    "Crypto/Alpha_version_1/logs" \
    "Crypto/temporal_fusion_transformer/lightning_logs" \
    "Crypto/temporal_fusion_transformer/checkpoints" \
    "Crypto/temporal_fusion_transformer/saves" \
    "Crypto/temporal_fusion_transformer/database" \
    "Crypto/temporal_fusion_transformer/Hmm-Models" \
    "Betting/*/Models" \
    "Betting/*/Data" \
    "Betting/*/models" \
    "Betting/*/data" \
    "Betting/*/screenshots" \
    "Betting/*/Screenshots" \
    "Voice_Clone/data" \
    "Voice_Clone/generated_songs" \
    "Mind/data" \
    "Final_Year_Project/*/models" \
    "Final_Year_Project/*/data" \
    "Final_Year_Project/*/outputs" \
    "Final_Year_Project/*/checkpoints" \
    "Final_Year_Project/*/saves" \
    2>/dev/null || true

# Crypto Alpha Version 1 - RESPECT GIT REPOSITORY STRUCTURE
# Note: Crypto/Alpha_version_1 is a Git repository (https://github.com/mohcly/TimeSeries-Forcasting.git)
# Only remove large generated content, not the repository structure
echo "🧹 Removing Crypto Alpha Version 1 large files (respecting Git repository structure)..."
git rm --cached --ignore-unmatch \
    "Crypto/Alpha_version_1/.DS_Store" \
    "Crypto/Alpha_version_1/*.log" \
    "Crypto/Alpha_version_1/build/" \
    "Crypto/Alpha_version_1/dist/" \
    "Crypto/Alpha_version_1/.cache/" \
    "Crypto/Alpha_version_1/.temp/" \
    "Crypto/Alpha_version_1/tmp/" \
    "Crypto/Alpha_version_1/coverage/" \
    "Crypto/Alpha_version_1/.nyc_output/" \
    "Crypto/Alpha_version_1/.next/" \
    "Crypto/Alpha_version_1/out/" \
    "Crypto/Alpha_version_1/.nuxt/" \
    "Crypto/Alpha_version_1/.parcel-cache/" \
    "Crypto/Alpha_version_1/.fusebox/" \
    "Crypto/Alpha_version_1/.serverless/" \
    "Crypto/Alpha_version_1/.dynamodb/" \
    "Crypto/Alpha_version_1/.terraform/" \
    "Crypto/Alpha_version_1/*.tfstate" \
    "Crypto/Alpha_version_1/*.tfstate.*" \
    "Crypto/Alpha_version_1/*tfplan*" \
    "Crypto/Alpha_version_1/*.tfvars" \
    "Crypto/Alpha_version_1/*.tfvars.json" \
    "Crypto/Alpha_version_1/override.tf" \
    "Crypto/Alpha_version_1/override.tf.json" \
    "Crypto/Alpha_version_1/*_override.tf" \
    "Crypto/Alpha_version_1/*_override.tf.json" \
    "Crypto/Alpha_version_1/.terraformrc" \
    "Crypto/Alpha_version_1/terraform.rc" \
    "Crypto/Alpha_version_1/*.zip" \
    "Crypto/Alpha_version_1/*.tar" \
    "Crypto/Alpha_version_1/*.tar.gz" \
    "Crypto/Alpha_version_1/*.tgz" \
    "Crypto/Alpha_version_1/*.rar" \
    "Crypto/Alpha_version_1/*.7z" \
    "Crypto/Alpha_version_1/*.bz2" \
    "Crypto/Alpha_version_1/*.xz" \
    "Crypto/Alpha_version_1/*.gz" \
    "Crypto/Alpha_version_1/*.lz" \
    "Crypto/Alpha_version_1/*.lzma" \
    "Crypto/Alpha_version_1/*.bak" \
    "Crypto/Alpha_version_1/*.backup" \
    "Crypto/Alpha_version_1/*.orig" \
    "Crypto/Alpha_version_1/*.swp" \
    "Crypto/Alpha_version_1/*.swo" \
    "Crypto/Alpha_version_1/*.tmp" \
    "Crypto/Alpha_version_1/*.temp" \
    "Crypto/Alpha_version_1/*~" \
    "Crypto/Alpha_version_1/*.key" \
    "Crypto/Alpha_version_1/*.pem" \
    "Crypto/Alpha_version_1/*.p12" \
    "Crypto/Alpha_version_1/*.pfx" \
    "Crypto/Alpha_version_1/secrets.json" \
    "Crypto/Alpha_version_1/config.json" \
    "Crypto/Alpha_version_1/.env.*" \
    "Crypto/Alpha_version_1/mcp.json" \
    "Crypto/Alpha_version_1/*.png" \
    "Crypto/Alpha_version_1/*.jpg" \
    "Crypto/Alpha_version_1/*.jpeg" \
    "Crypto/Alpha_version_1/*.gif" \
    "Crypto/Alpha_version_1/*.bmp" \
    "Crypto/Alpha_version_1/*.tiff" \
    "Crypto/Alpha_version_1/*.svg" \
    "Crypto/Alpha_version_1/*.ico" \
    "Crypto/Alpha_version_1/*.wav" \
    "Crypto/Alpha_version_1/*.mp3" \
    "Crypto/Alpha_version_1/*.mp4" \
    "Crypto/Alpha_version_1/*.avi" \
    "Crypto/Alpha_version_1/*.mov" \
    "Crypto/Alpha_version_1/*.mkv" \
    "Crypto/Alpha_version_1/*.flv" \
    "Crypto/Alpha_version_1/*.wmv" \
    "Crypto/Alpha_version_1/*.m4a" \
    "Crypto/Alpha_version_1/*.aac" \
    "Crypto/Alpha_version_1/*.ogg" \
    "Crypto/Alpha_version_1/*.flac" \
    "Crypto/Alpha_version_1/*.pdf" \
    "Crypto/Alpha_version_1/*.doc" \
    "Crypto/Alpha_version_1/*.docx" \
    "Crypto/Alpha_version_1/*.xls" \
    "Crypto/Alpha_version_1/*.xlsx" \
    "Crypto/Alpha_version_1/*.ppt" \
    "Crypto/Alpha_version_1/*.pptx" \
    "Crypto/Alpha_version_1/*.numbers" \
    "Crypto/Alpha_version_1/*.pages" \
    "Crypto/Alpha_version_1/*.keynote" \
    "Crypto/Alpha_version_1/*.dwg" \
    "Crypto/Alpha_version_1/*.dxf" \
    "Crypto/Alpha_version_1/*.step" \
    "Crypto/Alpha_version_1/*.stp" \
    "Crypto/Alpha_version_1/*.iges" \
    "Crypto/Alpha_version_1/*.igs" \
    "Crypto/Alpha_version_1/*.stl" \
    "Crypto/Alpha_version_1/*.obj" \
    "Crypto/Alpha_version_1/*.3ds" \
    "Crypto/Alpha_version_1/*.blend" \
    "Crypto/Alpha_version_1/*.skp" \
    "Crypto/Alpha_version_1/*.brd" \
    "Crypto/Alpha_version_1/*.sch" \
    "Crypto/Alpha_version_1/*.pcb" \
    "Crypto/Alpha_version_1/*.h5" \
    "Crypto/Alpha_version_1/*.hdf5" \
    "Crypto/Alpha_version_1/*.pkl" \
    "Crypto/Alpha_version_1/*.pickle" \
    "Crypto/Alpha_version_1/*.joblib" \
    "Crypto/Alpha_version_1/*.ckpt" \
    "Crypto/Alpha_version_1/*.pth" \
    "Crypto/Alpha_version_1/*.pt" \
    "Crypto/Alpha_version_1/*.model" \
    "Crypto/Alpha_version_1/*.weights" \
    "Crypto/Alpha_version_1/*.pb" \
    "Crypto/Alpha_version_1/*.tflite" \
    "Crypto/Alpha_version_1/*.onnx" \
    "Crypto/Alpha_version_1/*.safetensors" \
    "Crypto/Alpha_version_1/*.bin" \
    "Crypto/Alpha_version_1/checkpoints/" \
    "Crypto/Alpha_version_1/saves/" \
    "Crypto/Alpha_version_1/lightning_logs/" \
    "Crypto/Alpha_version_1/tensorboard_logs/" \
    "Crypto/Alpha_version_1/wandb/" \
    "Crypto/Alpha_version_1/mlruns/" \
    "Crypto/Alpha_version_1/outputs/" \
    "Crypto/Alpha_version_1/multirun/" \
    "Crypto/Alpha_version_1/model_outputs/" \
    "Crypto/Alpha_version_1/training_outputs/" \
    "Crypto/Alpha_version_1/experiment_results/" \
    "Crypto/Alpha_version_1/plots/" \
    "Crypto/Alpha_version_1/old_plots/" \
    "Crypto/Alpha_version_1/*.csv" \
    "Crypto/Alpha_version_1/*.tsv" \
    "Crypto/Alpha_version_1/*.parquet" \
    "Crypto/Alpha_version_1/*.feather" \
    "Crypto/Alpha_version_1/*.arrow" \
    "Crypto/Alpha_version_1/*.xlsx" \
    "Crypto/Alpha_version_1/*.xls" \
    "Crypto/Alpha_version_1/*.tfrecord" \
    "Crypto/Alpha_version_1/*.tfrecords" \
    "Crypto/Alpha_version_1/events.out.tfevents.*" \
    "Crypto/Alpha_version_1/.ipynb_checkpoints/" \
    "Crypto/Alpha_version_1/*/.ipynb_checkpoints/" \
    "Crypto/Alpha_version_1/.mypy_cache/" \
    "Crypto/Alpha_version_1/.dmypy.json" \
    "Crypto/Alpha_version_1/dmypy.json" \
    "Crypto/Alpha_version_1/.pyre/" \
    "Crypto/Alpha_version_1/.pytype/" \
    "Crypto/Alpha_version_1/cython_debug/" \
    "Crypto/Alpha_version_1/venv/" \
    "Crypto/Alpha_version_1/env/" \
    "Crypto/Alpha_version_1/ENV/" \
    "Crypto/Alpha_version_1/.venv/" \
    "Crypto/Alpha_version_1/.env/" \
    "Crypto/Alpha_version_1/.spyderproject" \
    "Crypto/Alpha_version_1/.spyproject" \
    "Crypto/Alpha_version_1/.ropeproject" \
    "Crypto/Alpha_version_1/.DS_Store" \
    "Crypto/Alpha_version_1/Thumbs.db" \
    "Crypto/Alpha_version_1/*.sqlite" \
    "Crypto/Alpha_version_1/*.sqlite3" \
    "Crypto/Alpha_version_1/*.db" \
    "Crypto/Alpha_version_1/*.database" \
    "Crypto/Alpha_version_1/*.log" \
    "Crypto/Alpha_version_1/*.out" \
    "Crypto/Alpha_version_1/*.err" \
    "Crypto/Alpha_version_1/debug.log" \
    "Crypto/Alpha_version_1/app_log.txt" \
    "Crypto/Alpha_version_1/*.tmp" \
    "Crypto/Alpha_version_1/*.temp" \
    "Crypto/Alpha_version_1/*~" \
    "Crypto/Alpha_version_1/*.bak" \
    "Crypto/Alpha_version_1/*.backup" \
    "Crypto/Alpha_version_1/*.orig" \
    "Crypto/Alpha_version_1/*.swp" \
    "Crypto/Alpha_version_1/*.swo" \
    "Crypto/Alpha_version_1/*.dmp" \
    "Crypto/Alpha_version_1/core.*" \
    "Crypto/Alpha_version_1/*.test" \
    "Crypto/Alpha_version_1/test_*.log" \
    "Crypto/Alpha_version_1/test_output/" \
    "Crypto/Alpha_version_1/test_results/" \
    "Crypto/Alpha_version_1/backup/" \
    "Crypto/Alpha_version_1/backups/" \
    "Crypto/Alpha_version_1/archive/" \
    "Crypto/Alpha_version_1/archives/" \
    "Crypto/Alpha_version_1/old_*/" \
    "Crypto/Alpha_version_1/Old_*/" \
    "Crypto/Alpha_version_1/OLD_*/" \
    "Crypto/Alpha_version_1/legacy/" \
    "Crypto/Alpha_version_1/Legacy/" \
    "Crypto/Alpha_version_1/deprecated/" \
    "Crypto/Alpha_version_1/Deprecated/" \
    "Crypto/Alpha_version_1/data/" \
    "Crypto/Alpha_version_1/Data/" \
    "Crypto/Alpha_version_1/dataset/" \
    "Crypto/Alpha_version_1/datasets/" \
    "Crypto/Alpha_version_1/models/" \
    "Crypto/Alpha_version_1/Models/" \
    "Crypto/Alpha_version_1/screenshots/" \
    "Crypto/Alpha_version_1/Screenshots/" \
    "Crypto/Alpha_version_1/memory-bank/" \
    "Crypto/Alpha_version_1/Memory_bank/" \
    "Crypto/Alpha_version_1/memory_bank/" \
    "Crypto/Alpha_version_1/Memory_Bank/" \
    "Crypto/Alpha_version_1/public/" \
    "Crypto/Alpha_version_1/Public/" \
    "Crypto/Alpha_version_1/cache/" \
    "Crypto/Alpha_version_1/Cache/" \
    "Crypto/Alpha_version_1/temp/" \
    "Crypto/Alpha_version_1/Temp/" \
    "Crypto/Alpha_version_1/tmp/" \
    "Crypto/Alpha_version_1/Tmp/" \
    "Crypto/Alpha_version_1/build/" \
    "Crypto/Alpha_version_1/Build/" \
    "Crypto/Alpha_version_1/dist/" \
    "Crypto/Alpha_version_1/Dist/" \
    "Crypto/Alpha_version_1/out/" \
    "Crypto/Alpha_version_1/Out/" \
    "Crypto/Alpha_version_1/target/" \
    "Crypto/Alpha_version_1/Target/" \
    "Crypto/Alpha_version_1/generated/" \
    "Crypto/Alpha_version_1/Generated/" \
    "Crypto/Alpha_version_1/auto-generated/" \
    "Crypto/Alpha_version_1/Auto-generated/" \
    "Crypto/Alpha_version_1/bin/" \
    "Crypto/Alpha_version_1/Bin/" \
    "Crypto/Alpha_version_1/obj/" \
    "Crypto/Alpha_version_1/Obj/" \
    "Crypto/Alpha_version_1/.cache/" \
    "Crypto/Alpha_version_1/.temp/" \
    "Crypto/Alpha_version_1/tmp/" \
    "Crypto/Alpha_version_1/.tmp/" \
    "Crypto/Alpha_version_1/build/" \
    "Crypto/Alpha_version_1/Build/" \
    "Crypto/Alpha_version_1/dist/" \
    "Crypto/Alpha_version_1/Dist/" \
    "Crypto/Alpha_version_1/output/" \
    "Crypto/Alpha_version_1/Output/" \
    "Crypto/Alpha_version_1/generated/" \
    "Crypto/Alpha_version_1/Generated" \
    2>/dev/null || true

# PaymentGateway - RESPECT SUBMODULE STRUCTURE
# Note: PaymentGateway is a GitHub repository with submodules
# Only remove large generated content, not the repository structure
echo "🧹 Removing PaymentGateway large files (respecting submodule structure)..."
git rm --cached --ignore-unmatch \
    "PaymentGateway/.DS_Store" \
    "PaymentGateway/*.log" \
    "PaymentGateway/build/" \
    "PaymentGateway/dist/" \
    "PaymentGateway/.cache/" \
    "PaymentGateway/.temp/" \
    "PaymentGateway/tmp/" \
    "PaymentGateway/coverage/" \
    "PaymentGateway/.nyc_output/" \
    "PaymentGateway/.next/" \
    "PaymentGateway/out/" \
    "PaymentGateway/.nuxt/" \
    "PaymentGateway/.parcel-cache/" \
    "PaymentGateway/.fusebox/" \
    "PaymentGateway/.serverless/" \
    "PaymentGateway/.dynamodb/" \
    "PaymentGateway/.terraform/" \
    "PaymentGateway/*.tfstate" \
    "PaymentGateway/*.tfstate.*" \
    "PaymentGateway/*tfplan*" \
    "PaymentGateway/*.tfvars" \
    "PaymentGateway/*.tfvars.json" \
    "PaymentGateway/override.tf" \
    "PaymentGateway/override.tf.json" \
    "PaymentGateway/*_override.tf" \
    "PaymentGateway/*_override.tf.json" \
    "PaymentGateway/.terraformrc" \
    "PaymentGateway/terraform.rc" \
    "PaymentGateway/*.zip" \
    "PaymentGateway/*.tar" \
    "PaymentGateway/*.tar.gz" \
    "PaymentGateway/*.tgz" \
    "PaymentGateway/*.rar" \
    "PaymentGateway/*.7z" \
    "PaymentGateway/*.bz2" \
    "PaymentGateway/*.xz" \
    "PaymentGateway/*.gz" \
    "PaymentGateway/*.lz" \
    "PaymentGateway/*.lzma" \
    "PaymentGateway/*.bak" \
    "PaymentGateway/*.backup" \
    "PaymentGateway/*.orig" \
    "PaymentGateway/*.swp" \
    "PaymentGateway/*.swo" \
    "PaymentGateway/*.tmp" \
    "PaymentGateway/*.temp" \
    "PaymentGateway/*~" \
    "PaymentGateway/*.key" \
    "PaymentGateway/*.pem" \
    "PaymentGateway/*.p12" \
    "PaymentGateway/*.pfx" \
    "PaymentGateway/secrets.json" \
    "PaymentGateway/config.json" \
    "PaymentGateway/.env.*" \
    "PaymentGateway/mcp.json" \
    "PaymentGateway/*.png" \
    "PaymentGateway/*.jpg" \
    "PaymentGateway/*.jpeg" \
    "PaymentGateway/*.gif" \
    "PaymentGateway/*.bmp" \
    "PaymentGateway/*.tiff" \
    "PaymentGateway/*.svg" \
    "PaymentGateway/*.ico" \
    "PaymentGateway/*.wav" \
    "PaymentGateway/*.mp3" \
    "PaymentGateway/*.mp4" \
    "PaymentGateway/*.avi" \
    "PaymentGateway/*.mov" \
    "PaymentGateway/*.mkv" \
    "PaymentGateway/*.flv" \
    "PaymentGateway/*.wmv" \
    "PaymentGateway/*.m4a" \
    "PaymentGateway/*.aac" \
    "PaymentGateway/*.ogg" \
    "PaymentGateway/*.flac" \
    "PaymentGateway/*.pdf" \
    "PaymentGateway/*.doc" \
    "PaymentGateway/*.docx" \
    "PaymentGateway/*.xls" \
    "PaymentGateway/*.xlsx" \
    "PaymentGateway/*.ppt" \
    "PaymentGateway/*.pptx" \
    "PaymentGateway/*.numbers" \
    "PaymentGateway/*.pages" \
    "PaymentGateway/*.keynote" \
    "PaymentGateway/*.dwg" \
    "PaymentGateway/*.dxf" \
    "PaymentGateway/*.step" \
    "PaymentGateway/*.stp" \
    "PaymentGateway/*.iges" \
    "PaymentGateway/*.igs" \
    "PaymentGateway/*.stl" \
    "PaymentGateway/*.obj" \
    "PaymentGateway/*.3ds" \
    "PaymentGateway/*.blend" \
    "PaymentGateway/*.skp" \
    "PaymentGateway/*.brd" \
    "PaymentGateway/*.sch" \
    "PaymentGateway/*.pcb" \
    "PaymentGateway/*.h5" \
    "PaymentGateway/*.hdf5" \
    "PaymentGateway/*.pkl" \
    "PaymentGateway/*.pickle" \
    "PaymentGateway/*.joblib" \
    "PaymentGateway/*.ckpt" \
    "PaymentGateway/*.pth" \
    "PaymentGateway/*.pt" \
    "PaymentGateway/*.model" \
    "PaymentGateway/*.weights" \
    "PaymentGateway/*.pb" \
    "PaymentGateway/*.tflite" \
    "PaymentGateway/*.onnx" \
    "PaymentGateway/*.safetensors" \
    "PaymentGateway/*.bin" \
    "PaymentGateway/checkpoints/" \
    "PaymentGateway/saves/" \
    "PaymentGateway/lightning_logs/" \
    "PaymentGateway/tensorboard_logs/" \
    "PaymentGateway/wandb/" \
    "PaymentGateway/mlruns/" \
    "PaymentGateway/outputs/" \
    "PaymentGateway/multirun/" \
    "PaymentGateway/model_outputs/" \
    "PaymentGateway/training_outputs/" \
    "PaymentGateway/experiment_results/" \
    "PaymentGateway/plots/" \
    "PaymentGateway/old_plots/" \
    "PaymentGateway/*.csv" \
    "PaymentGateway/*.tsv" \
    "PaymentGateway/*.parquet" \
    "PaymentGateway/*.feather" \
    "PaymentGateway/*.arrow" \
    "PaymentGateway/*.xlsx" \
    "PaymentGateway/*.xls" \
    "PaymentGateway/*.tfrecord" \
    "PaymentGateway/*.tfrecords" \
    "PaymentGateway/events.out.tfevents.*" \
    "PaymentGateway/.ipynb_checkpoints/" \
    "PaymentGateway/*/.ipynb_checkpoints/" \
    "PaymentGateway/.mypy_cache/" \
    "PaymentGateway/.dmypy.json" \
    "PaymentGateway/dmypy.json" \
    "PaymentGateway/.pyre/" \
    "PaymentGateway/.pytype/" \
    "PaymentGateway/cython_debug/" \
    "PaymentGateway/venv/" \
    "PaymentGateway/env/" \
    "PaymentGateway/ENV/" \
    "PaymentGateway/.venv/" \
    "PaymentGateway/.env/" \
    "PaymentGateway/.spyderproject" \
    "PaymentGateway/.spyproject" \
    "PaymentGateway/.ropeproject" \
    "PaymentGateway/.DS_Store" \
    "PaymentGateway/Thumbs.db" \
    "PaymentGateway/*.sqlite" \
    "PaymentGateway/*.sqlite3" \
    "PaymentGateway/*.db" \
    "PaymentGateway/*.database" \
    "PaymentGateway/*.log" \
    "PaymentGateway/*.out" \
    "PaymentGateway/*.err" \
    "PaymentGateway/debug.log" \
    "PaymentGateway/app_log.txt" \
    "PaymentGateway/*.tmp" \
    "PaymentGateway/*.temp" \
    "PaymentGateway/*~" \
    "PaymentGateway/*.bak" \
    "PaymentGateway/*.backup" \
    "PaymentGateway/*.orig" \
    "PaymentGateway/*.swp" \
    "PaymentGateway/*.swo" \
    "PaymentGateway/*.dmp" \
    "PaymentGateway/core.*" \
    "PaymentGateway/*.test" \
    "PaymentGateway/test_*.log" \
    "PaymentGateway/test_output/" \
    "PaymentGateway/test_results/" \
    "PaymentGateway/backup/" \
    "PaymentGateway/backups/" \
    "PaymentGateway/archive/" \
    "PaymentGateway/archives/" \
    "PaymentGateway/old_*/" \
    "PaymentGateway/Old_*/" \
    "PaymentGateway/OLD_*/" \
    "PaymentGateway/legacy/" \
    "PaymentGateway/Legacy/" \
    "PaymentGateway/deprecated/" \
    "PaymentGateway/Deprecated/" \
    "PaymentGateway/data/" \
    "PaymentGateway/Data/" \
    "PaymentGateway/dataset/" \
    "PaymentGateway/datasets/" \
    "PaymentGateway/models/" \
    "PaymentGateway/Models/" \
    "PaymentGateway/screenshots/" \
    "PaymentGateway/Screenshots/" \
    "PaymentGateway/memory-bank/" \
    "PaymentGateway/Memory_bank/" \
    "PaymentGateway/memory_bank/" \
    "PaymentGateway/Memory_Bank/" \
    "PaymentGateway/public/" \
    "PaymentGateway/Public/" \
    "PaymentGateway/cache/" \
    "PaymentGateway/Cache/" \
    "PaymentGateway/temp/" \
    "PaymentGateway/Temp/" \
    "PaymentGateway/tmp/" \
    "PaymentGateway/Tmp/" \
    "PaymentGateway/build/" \
    "PaymentGateway/Build/" \
    "PaymentGateway/dist/" \
    "PaymentGateway/Dist/" \
    "PaymentGateway/out/" \
    "PaymentGateway/Out/" \
    "PaymentGateway/target/" \
    "PaymentGateway/Target/" \
    "PaymentGateway/generated/" \
    "PaymentGateway/Generated/" \
    "PaymentGateway/auto-generated/" \
    "PaymentGateway/Auto-generated/" \
    "PaymentGateway/bin/" \
    "PaymentGateway/Bin/" \
    "PaymentGateway/obj/" \
    "PaymentGateway/Obj/" \
    "PaymentGateway/.cache/" \
    "PaymentGateway/.temp/" \
    "PaymentGateway/tmp/" \
    "PaymentGateway/.tmp/" \
    "PaymentGateway/build/" \
    "PaymentGateway/Build/" \
    "PaymentGateway/dist/" \
    "PaymentGateway/Dist/" \
    "PaymentGateway/output/" \
    "PaymentGateway/Output/" \
    "PaymentGateway/generated/" \
    "PaymentGateway/Generated" \
    2>/dev/null || true

# Remove Python cache
echo "🧹 Removing Python cache from tracking..."
git rm -r --cached --ignore-unmatch "**/__pycache__" 2>/dev/null || true
git rm --cached --ignore-unmatch "**/*.pyc" "**/*.pyo" "**/*.pyd" 2>/dev/null || true

# Remove Node.js dependencies
echo "🧹 Removing Node.js dependencies from tracking..."
git rm -r --cached --ignore-unmatch "**/node_modules" 2>/dev/null || true

# Remove build artifacts
echo "🧹 Removing build artifacts from tracking..."
git rm -r --cached --ignore-unmatch \
    "**/build" "**/dist" "**/out" "**/target" "**/generated" "**/auto-generated" \
    "**/bin" "**/obj" \
    2>/dev/null || true

# Remove cache and temporary directories
echo "🧹 Removing cache and temporary directories from tracking..."
git rm -r --cached --ignore-unmatch \
    "**/cache" "**/Cache" "**/temp" "**/Temp" "**/tmp" "**/Tmp" \
    2>/dev/null || true

# Remove log files
echo "🧹 Removing log files from tracking..."
git rm --cached --ignore-unmatch "**/*.log" "**/*.out" "**/*.err" 2>/dev/null || true

# Remove media files
echo "🧹 Removing media files from tracking..."
git rm --cached --ignore-unmatch \
    "**/*.png" "**/*.jpg" "**/*.jpeg" "**/*.gif" "**/*.bmp" "**/*.tiff" \
    "**/*.svg" "**/*.ico" "**/*.wav" "**/*.mp3" "**/*.mp4" "**/*.avi" \
    "**/*.mov" "**/*.mkv" "**/*.flv" "**/*.wmv" "**/*.m4a" "**/*.aac" \
    "**/*.ogg" "**/*.flac" \
    2>/dev/null || true

# Remove archive files
echo "🧹 Removing archive files from tracking..."
git rm --cached --ignore-unmatch \
    "**/*.zip" "**/*.tar" "**/*.tar.gz" "**/*.tgz" "**/*.rar" "**/*.7z" \
    "**/*.bz2" "**/*.xz" "**/*.gz" "**/*.lz" "**/*.lzma" \
    2>/dev/null || true

# Remove backup files
echo "🧹 Removing backup files from tracking..."
git rm --cached --ignore-unmatch \
    "**/*.bak" "**/*.backup" "**/*.orig" "**/*.swp" "**/*.swo" \
    "**/*.tmp" "**/*.temp" "**/*~" \
    2>/dev/null || true

# Remove IDE files
echo "🧹 Removing IDE files from tracking..."
git rm -r --cached --ignore-unmatch "**/.vscode" "**/.idea" 2>/dev/null || true

# Remove OS files
echo "🧹 Removing OS files from tracking..."
git rm --cached --ignore-unmatch "**/.DS_Store" "**/Thumbs.db" 2>/dev/null || true

# Remove database files
echo "🧹 Removing database files from tracking..."
git rm --cached --ignore-unmatch "**/*.sqlite" "**/*.sqlite3" "**/*.db" 2>/dev/null || true

# Remove Jupyter checkpoints
echo "🧹 Removing Jupyter checkpoints from tracking..."
git rm -r --cached --ignore-unmatch "**/.ipynb_checkpoints" 2>/dev/null || true

# Remove large project directories that are not actively developed
echo "🧹 Removing large inactive project directories from tracking..."
git rm -r --cached --ignore-unmatch \
    "minecraft-clone" "Science" "Swiss-Knife" \
    2>/dev/null || true

# Show what will be committed
echo "📋 Files staged for removal:"
git status --porcelain
echo ""

# Ask for confirmation
read -p "⚠️  Do you want to commit these changes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "💾 Committing changes..."
    git add .
    git commit -m "🚀 Ultra-aggressive cleanup: Remove large files and optimize repository (PaymentGateway submodule safe)"
    
    echo "🧹 Cleaning up git repository..."
    git gc --aggressive --prune=now
    
    echo "📊 New repository size:"
    du -sh .git
    
    echo "📁 New number of tracked files:"
    git ls-files | wc -l
    
    echo "✅ Cleanup completed successfully!"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Restart Cursor to apply new .cursorignore patterns"
    echo "2. Test indexing performance improvement"
    echo "3. Monitor repository size over time"
    echo "4. Consider splitting large projects into separate repositories"
    echo "5. Note: PaymentGateway submodule structure preserved"
else
    echo "❌ Cleanup cancelled. Files are still staged but not committed."
    echo "Run 'git reset' to unstage all changes."
fi
