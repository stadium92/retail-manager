import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LicenseBanner } from '@/components/shared/LicenseBanner';
import { ActivationGate } from '@/components/license/ActivationGate';
import { LicenseService, LicenseStatus, LicenseStore } from '@/services/LicenseService';
import { getDataClient } from '@/lib/dataClient';
export type { LicenseStatus, LicenseStore };

interface LicenseContextType {
  license: LicenseStatus | null;
  loading: boolean;
  activate: (key: string, storeName: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  getDeviceHash: () => Promise<string>;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGate, setShowGate] = useState(false);
  const [trialSkipped, setTrialSkipped] = useState(() => 
    sessionStorage.getItem('rm_trial_skipped') === 'true'
  );

  const refreshStatus = async () => {
    try {
      const dc = getDataClient();
      // Completely bypass the activation gate in cloud mode (Vercel)
      if (!dc.isLocalFirst) {
        setLicense({
          status: 'active',
          days_remaining: 365,
          stores: [],
          device_hash: 'cloud',
        });
        setShowGate(false);
        setLoading(false);
        return;
      }

      // Fallback for web dev in local-first mode
      if (!(window as any).__TAURI_INTERNALS__) {
        const isActivated = localStorage.getItem('rm_activated') === 'true';
        setLicense({
          status: isActivated ? 'active' : 'trial',
          days_remaining: 30,
          stores: isActivated ? [{
            store_id: 'store-001',
            store_name: 'Store 0x8842',
            activated_at: new Date().toISOString()
          }] : [],
          device_hash: '0x8842',
        });
        
        const isSessionSkipped = sessionStorage.getItem('rm_trial_skipped') === 'true';
        setTrialSkipped(isSessionSkipped);
        
        // Show gate if NOT active AND NOT skipped this session
        setShowGate(!isActivated && !isSessionSkipped);
        return;
      }
      const status = await LicenseService.getStatus();
      setLicense(status);
      
      // If active, save to local storage to hide gate forever
      if (status.status === 'active') {
        localStorage.setItem('rm_activated', 'true');
        setShowGate(false);
      } else {
        // For trial/expired:
        // 1. Check if permanently activated (shouldn't happen if status is not active, but for safety)
        const isPermanentlyActivated = localStorage.getItem('rm_activated') === 'true';
        // 2. Check if skipped in this session
        const isSessionSkipped = sessionStorage.getItem('rm_trial_skipped') === 'true';
        setTrialSkipped(isSessionSkipped);
        
        // Show gate if NOT active AND NOT skipped this session
        // (We ignore rm_activated from localStorage if the actual status is trial/expired to force re-verification)
        setShowGate(!isSessionSkipped);
      }
    } catch (error) {
      console.error('Failed to get license status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const activate = async (key: string, storeName: string) => {
    // We DON'T set loading(true) here because it unmounts the UI and prevents error messages from showing
    try {
      console.log('[LicenseContext] Attempting activation for store:', storeName);
      await LicenseService.activate(key, storeName);
      console.log('[LicenseContext] Activation successful!');
      localStorage.setItem('rm_activated', 'true');
      await refreshStatus();
    } catch (error) {
      console.error('[LicenseContext] Activation failed:', error);
      // We don't set loading(false) because we never set it to true
      throw error;
    }
  };

  const getDeviceHash = async () => {
    if (!(window as any).__TAURI_INTERNALS__) return '0x8842';
    return await invoke<string>('get_device_hash_command');
  };

  if (loading) return null;

  if (showGate && license) {
    return (
      <LicenseContext.Provider value={{ license, loading, activate, refreshStatus, getDeviceHash }}>
        <ActivationGate 
          status={license} 
          onActivated={refreshStatus} 
          onSkip={() => {
            // Mark as skipped for this session only
            sessionStorage.setItem('rm_trial_skipped', 'true');
            setTrialSkipped(true);
            // Remove the permanent flag if it was wrongly set
            localStorage.removeItem('rm_activated');
            
            setShowGate(false);
            // Use replace to ensure we land on the get started page without being able to go back to the gate
            window.location.replace('/');
          }} 
        />
      </LicenseContext.Provider>
    );
  }

  return (
    <LicenseContext.Provider value={{ license, loading, activate, refreshStatus, getDeviceHash }}>
      <div className="flex flex-col h-screen overflow-hidden">
        {license && license.status !== 'active' && (
          <LicenseBanner status={license} />
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return context;
}
