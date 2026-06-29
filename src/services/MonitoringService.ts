import * as Sentry from '@sentry/react';

export interface MonitoringUser {
  id: string;
  email?: string;
  role?: string;
}

export class MonitoringService {
  private static isInitialized = false;

  /**
   * Initializes Sentry with configuration parameters
   */
  static init(dsn?: string, environment = 'production') {
    if (this.isInitialized) return;
    
    const FALLBACK_SENTRY_DSN = "https://6af023b576fd6069e3cbf4220463ab28@o4511632263217152.ingest.us.sentry.io/4511639554636880";
    const activeDsn = dsn || import.meta.env.VITE_SENTRY_DSN || FALLBACK_SENTRY_DSN;
    if (!activeDsn) {
      console.warn('[MonitoringService] Sentry DSN not found. Skipping initialization.');
      return;
    }

    try {
      Sentry.init({
        dsn: activeDsn,
        environment,
      });
      this.isInitialized = true;
      console.log('[MonitoringService] Sentry initialized successfully.');
    } catch (error) {
      console.error('[MonitoringService] Failed to initialize Sentry:', error);
    }
  }

  /**
   * Logs an exception directly to Sentry
   */
  static captureException(error: any, context?: Record<string, any>) {
    if (!this.isInitialized) return;

    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, val]) => {
          scope.setExtra(key, val);
        });
      }
      Sentry.captureException(error);
    });
  }

  /**
   * Logs a message / event to Sentry
   */
  static captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
    if (!this.isInitialized) return;

    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, val]) => {
          scope.setExtra(key, val);
        });
      }
      Sentry.captureMessage(message, level);
    });
  }

  /**
   * Sets the current logged-in user context in Sentry
   */
  static setUser(user: MonitoringUser | null) {
    if (!this.isInitialized) return;
    if (!user) {
      Sentry.setUser(null);
    } else {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.role,
      });
    }
  }

  /**
   * Adds a breadcrumb to the current tracking session
   */
  static addBreadcrumb(message: string, category = 'action', level: Sentry.SeverityLevel = 'info') {
    if (!this.isInitialized) return;
    Sentry.addBreadcrumb({
      message,
      category,
      level,
    });
  }
}
