import * as Sentry from '@sentry/react';
import { makeBrowserOfflineTransport, makeFetchTransport } from '@sentry/browser';

export interface MonitoringUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Keys whose values must never leave the till.
 *
 * This app handles real invoices for real people. Customer names, phone
 * numbers and addresses are the shop's data, not ours, and shipping them to a
 * third-party service in another jurisdiction is not a decision a crash
 * reporter should make silently. A report needs the SHAPE of a failure, never
 * the customer's identity.
 */
const PII_KEYS = [
  'customer_name', 'customername', 'customer_phone', 'customerphone',
  'customer_address', 'customeraddress', 'client_name', 'clientname',
  'phone', 'email', 'address', 'full_name', 'fullname', 'password',
  'access_token', 'refresh_token', 'apikey', 'authorization',
];

const REDACTED = '[redacted]';

const scrub = (value: unknown, depth = 0): unknown => {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_KEYS.includes(k.toLowerCase()) ? REDACTED : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
};

export class MonitoringService {
  private static isInitialized = false;

  /**
   * Initializes Sentry.
   *
   * Three things here matter more than the SDK defaults:
   *
   * 1. OFFLINE TRANSPORT. This is an offline-first POS: a till runs for hours
   *    with no connectivity, and Sentry's normal transport DROPS events it
   *    cannot send. That loses the single most valuable report - the backend
   *    dying while the internet is down. makeBrowserOfflineTransport queues
   *    failed envelopes in IndexedDB and flushes them on reconnect.
   *
   * 2. IDENTITY. Every client build reports into ONE Sentry project. Without
   *    a release and a client tag, four shops produce one undifferentiated
   *    pile, and "which shop, which build?" - precisely the question still
   *    unanswered on the reported search crash - stays unanswerable.
   *
   * 3. VOLUME. A POS repeats the same error all day. Free-tier quota burns in
   *    days, and an exhausted quota drops events SILENTLY, which is worse than
   *    having no monitoring at all. Hence dedupe and no tracing.
   */
  static init(dsn?: string, environment = 'production') {
    if (this.isInitialized) return;

    // No hardcoded fallback DSN. The previous one shipped a DSN in source, so
    // every build of every client reported into one project whether or not
    // anyone intended it, and it could not be turned off without a rebuild.
    const activeDsn = dsn || import.meta.env.VITE_SENTRY_DSN;
    if (!activeDsn) {
      console.warn('[MonitoringService] No Sentry DSN configured. Monitoring disabled.');
      return;
    }

    try {
      Sentry.init({
        dsn: activeDsn,
        environment,
        release: `djati@${import.meta.env.VITE_APP_VERSION || 'unknown'}`,
        transport: makeBrowserOfflineTransport(makeFetchTransport),
        integrations: [Sentry.dedupeIntegration()],
        sampleRate: 1.0,
        tracesSampleRate: 0,
        sendDefaultPii: false,
        beforeSend(event) {
          // Scrub the whole event, not just the extras we control: breadcrumbs
          // and request bodies can carry a customer's name too.
          if (event.extra) event.extra = scrub(event.extra) as Record<string, unknown>;
          if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
          if (event.breadcrumbs) {
            event.breadcrumbs = event.breadcrumbs.map(b => ({
              ...b,
              data: b.data ? (scrub(b.data) as Record<string, unknown>) : b.data,
            }));
          }
          if (event.request?.data) event.request.data = scrub(event.request.data);
          return event;
        },
      });

      Sentry.setTags({
        client: import.meta.env.VITE_CLIENT_ID || 'unknown',
        app_version: import.meta.env.VITE_APP_VERSION || 'unknown',
        surface: 'desktop-frontend',
      });

      this.isInitialized = true;
      console.log('[MonitoringService] Sentry initialized.');
    } catch (error) {
      console.error('[MonitoringService] Failed to initialize Sentry:', error);
    }
  }

  /** Attach the store once known - login resolves it, init cannot. */
  static setStore(storeId?: string | null) {
    if (!this.isInitialized || !storeId) return;
    Sentry.setTag('store_id', storeId);
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
