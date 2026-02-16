// Dev mode utilities
// These provide consistent UUIDs for dev mode users since Supabase requires valid UUIDs

// Deterministic UUIDs for dev mode users (namespace-based v5-like format)
export const DEV_MODE_UUIDS = {
  'dev-master': '00000000-0000-0000-0000-000000000001',
  'dev-worker': '00000000-0000-0000-0000-000000000002',
  'dev-deliverer': '00000000-0000-0000-0000-000000000003',
} as const;

/**
 * Checks if a user ID is a dev mode ID
 */
export function isDevModeUser(userId: string): boolean {
  return userId.startsWith('dev-');
}

/**
 * Converts a dev mode user ID to a valid UUID for database operations
 * Returns the original ID if it's already a valid UUID
 */
export function getValidUUID(userId: string): string {
  if (isDevModeUser(userId)) {
    return DEV_MODE_UUIDS[userId as keyof typeof DEV_MODE_UUIDS] || DEV_MODE_UUIDS['dev-master'];
  }
  return userId;
}

/**
 * Checks if a string is a valid UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
