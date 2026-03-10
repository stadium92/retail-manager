import React, { createContext, useContext, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LicenseBanner } from '@/components/shared/LicenseBanner';
import { ActivationGate } from '@/components/license/ActivationGate';
import { LicenseService } from '@/services/LicenseService';

export interface LicenseStore {
  store_id: string;
  store_name: string;
  activated_at: string;
}

export interface LicenseStatus {
  status: 'active' | 'trial' | 'expired';
  days_remaining: number;
  stores: LicenseStore[];
  device_hash: string;
}

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
      // Fallback for web dev
      if (!(window as any).__TAURI_INTERNALS__) {
        setLicense({
          status: 'trial',
          days_remaining: 30,
          stores: [],
          device_hash: 'DEV-HASH',
        });
        
        const isActivated = localStorage.getItem('rm_activated') === 'true';
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
    setLoading(true);
    try {
      console.log('[LicenseContext] Attempting activation for store:', storeName);
      await LicenseService.activate(key, storeName);
      console.log('[LicenseContext] Activation successful!');
      localStorage.setItem('rm_activated', 'true');
      await refreshStatus();
    } catch (error) {
      console.error('[LicenseContext] Activation failed:', error);
      setLoading(false);
      throw error;
    }
  };

  const getDeviceHash = async () => {
    if (!(window as any).__TAURI_INTERNALS__) return 'DEV-HASH';
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
