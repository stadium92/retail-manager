/**
 * Token Manager Utility
 * Helps prevent infinite loops by validating tokens before they are used
 */

interface ParsedToken {
  exp?: number;
  [key: string]: any;
}

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
        // Add 60s buffer
        if (payload.exp < now + 60) {
          console.warn('Token expired or about to expire');
          return false;
        }
      }
      
      return true;
    } catch (e) {
      console.error('Invalid token format:', e);
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem('localbridge:session');
      // Also clear any other auth related keys if needed
    } catch (e) {
      console.error('Error clearing tokens:', e);
    }
  }
};
