/**
 * Token Manager Utility
 * Handles token validation, expiration checks, and cross-tab refresh locking
 */

const REFRESH_LOCK_KEY = 'localbridge:refresh_lock';

export const TokenManager = {
  isValid(token: string): boolean {
    if (!token) return false;
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiration if present
      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        // Add 60s buffer to be safe
        if (payload.exp < now + 60) {
          console.warn('[TokenManager] Access token expired or about to expire');
          return false;
        }
      }
      
      return true;
    } catch (e) {
      console.error('[TokenManager] Invalid token format:', e);
      return false;
    }
  },

  isAboutToExpire(token: string, withinSeconds: number = 300): boolean {
    if (!token) return true;
    try {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false;
      
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < (now + withinSeconds);
    } catch (e) {
      return true;
    }
  },

  // Cross-tab locking for refresh process
  acquireRefreshLock(): boolean {
    const now = Date.now();
    const lockStr = localStorage.getItem(REFRESH_LOCK_KEY);
    
    if (lockStr) {
      try {
        const lock = JSON.parse(lockStr);
        // Lock exists and is fresh (less than 10 seconds old)
        if (now - lock.timestamp < 10000) {
          return false; 
        }
      } catch (e) {
        // Corrupted lock, allow overwrite
      }
    }
    
    // Acquire lock
    localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ timestamp: now }));
    return true;
  },

  releaseRefreshLock(): void {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  },

  clear() {
    try {
      localStorage.removeItem('localbridge:session');
      this.releaseRefreshLock();
    } catch (e) {
      console.error('[TokenManager] Error clearing tokens:', e);
    }
  }
};
