import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { AlertCircle, CheckCircle, Download, Loader2 } from 'lucide-react';

type InstallerStep = 'idle' | 'selecting' | 'verifying' | 'extracting' | 'installing' | 'success' | 'error';

interface InstallerState {
  step: InstallerStep;
  progress: number;
  message: string;
  filename: string;
  error: string;
  changes: string[];
}

export default function PatchInstaller() {
  const [state, setState] = useState<InstallerState>({
    step: 'idle',
    progress: 0,
    message: '',
    filename: '',
    error: '',
    changes: [
      'Updated Dashboard UI',
      'Fixed inventory sync bug',
      'New product filters',
      'Backend stability improvements',
    ],
  });

  const handleSelectFile = async () => {
    try {
      setState((prev) => ({ ...prev, step: 'selecting' }));

      const file = await open({
        filters: [{ name: 'Patch File', extensions: ['zip'] }],
      });

      if (!file) {
        setState((prev) => ({ ...prev, step: 'idle' }));
        return;
      }

      setState((prev) => ({ ...prev, step: 'verifying', filename: file.name || 'patch.zip' }));
      await installPatchFile(file as unknown as string);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
    }
  };

  const installPatchFile = async (filePath: string) => {
    try {
      setState((prev) => ({ ...prev, progress: 10, message: 'Verifying patch integrity...' }));

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + Math.random() * 15, 85),
        }));
      }, 500);

      const result = await invoke('install_patch', { patchPath: filePath });

      clearInterval(progressInterval);
      setState((prev) => ({
        ...prev,
        progress: 100,
        message: 'Installation complete!',
        step: 'success',
      }));

      // Auto-restart after 3 seconds
      setTimeout(() => {
        relaunch().catch((error) => console.error('Failed to relaunch:', error));
      }, 3000);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Installation failed',
      }));
    }
  };

  const handleRetry = () => {
    setState({
      step: 'idle',
      progress: 0,
      message: '',
      filename: '',
      error: '',
      changes: state.changes,
    });
  };

  const handleCancel = () => {
    setState({
      step: 'idle',
      progress: 0,
      message: '',
      filename: '',
      error: '',
      changes: state.changes,
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900 rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h2 className="text-xl font-bold text-white">Update & Patches</h2>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Idle State - File Selection */}
        {state.step === 'idle' && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-300">Current Version</p>
              <p className="text-2xl font-bold text-white mt-1">v1.0.0</p>
            </div>

            <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-500 transition">
              <Download className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-white font-medium mb-2">Select Patch File</p>
              <p className="text-sm text-slate-400 mb-4">Drag patch here or click to browse</p>
              <p className="text-xs text-slate-500">(patch-v1.0.1.zip)</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSelectFile}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Browse Files...
              </button>
            </div>
          </div>
        )}

        {/* Loading State - Progress */}
        {(state.step === 'verifying' || state.step === 'extracting' || state.step === 'installing') && (
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-300">Installing Patch v1.0.1</p>
              <p className="text-lg font-bold text-white mt-1">{state.filename}</p>
            </div>

            <div className="space-y-3">
              {state.step === 'verifying' && (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <p className="text-white">Verifying patch integrity...</p>
                </div>
              )}

              {state.step === 'extracting' && (
                <>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <p className="text-white">Checksums verified</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    <p className="text-white">Extracting files...</p>
                  </div>
                </>
              )}

              {state.step === 'installing' && (
                <>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <p className="text-white">Checksums verified</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <p className="text-white">Files extracted</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    <p className="text-white">Installing updates...</p>
                  </div>
                </>
              )}
            </div>

            {/* Progress Bar */}
            <div className="bg-slate-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                style={{ width: `${state.progress}%` }}
              />
            </div>

            <p className="text-center text-sm text-slate-400">
              {Math.round(state.progress)}% • {state.message}
            </p>
          </div>
        )}

        {/* Success State */}
        {state.step === 'success' && (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Installation Complete!</h3>
              <p className="text-slate-300">Patch v1.0.1 installed successfully</p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-sm text-slate-300 font-medium mb-3">What's New:</p>
              <ul className="space-y-2">
                {state.changes.map((change, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-200">
                The app will restart in 3 seconds...
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => relaunch()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Restart Now
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {state.step === 'error' && (
          <div className="space-y-6">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Installation Failed</h3>
              <p className="text-red-300">{state.error}</p>
            </div>

            <div className="bg-red-900 border border-red-700 rounded-lg p-4">
              <p className="text-sm text-red-200">
                Please check the patch file and try again.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
