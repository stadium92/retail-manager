/**
 * Product family / category display helpers.
 *
 * Data-model note: in this codebase `products.category` is NOT free text — it is a
 * TEXT column holding a FOREIGN KEY to `product_families(id)` (see the SQLite schema:
 * `FOREIGN KEY (category) REFERENCES product_families(id) ON DELETE SET NULL`).
 * The same value travels through the frontend under several aliases depending on the
 * mapping layer: `category`, `category_id` and `family_id`.
 *
 * Rendering any of those raw therefore prints a UUID to the user. Always route family
 * display through `resolveFamilyName()`, which prefers the backend-joined
 * `category_name`, falls back to a client-side families lookup, and — critically —
 * never lets a UUID or the string "undefined" reach the screen.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the value looks like a bare UUID (i.e. an id that must never be displayed). */
export function isUuidLike(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/** Minimal shape of a product family record, as returned by the bridge / offline store. */
export interface FamilyLike {
  id: string;
  name?: string | null;
}

/** Any product-ish record that may carry a family reference under one of its aliases. */
export interface ProductFamilyRefLike {
  category_name?: string | null;
  category?: string | null;
  category_id?: string | null;
  family_id?: string | null;
}

/**
 * Resolve a human-readable family name for a product.
 *
 * Resolution order:
 *  1. `category_name` served by the backend LEFT JOIN on product_families
 *  2. a client-side lookup in `families` by id (and, for legacy rows, by name)
 *  3. the raw reference only when it is clearly a human label, never a UUID
 *  4. `fallback`
 */
export function resolveFamilyName(
  product: ProductFamilyRefLike | null | undefined,
  families?: readonly FamilyLike[] | null,
  fallback: string = '—'
): string {
  if (!product) return fallback;

  // 1. Backend-joined name always wins.
  const joined = product.category_name;
  if (typeof joined === 'string' && joined.trim() && !isUuidLike(joined)) {
    return joined.trim();
  }

  // The family reference, whichever alias this mapping layer used.
  const ref =
    product.category_id ?? product.family_id ?? product.category ?? null;
  if (typeof ref !== 'string' || !ref.trim()) return fallback;
  const needle = ref.trim();

  // 2. Client-side lookup: by id first, then by name for legacy name-valued rows.
  if (families?.length) {
    const match =
      families.find((f) => f.id === needle) ??
      families.find((f) => (f.name ?? '').toLowerCase() === needle.toLowerCase());
    if (match?.name && match.name.trim()) return match.name.trim();
  }

  // 3. Legacy free-text categories are safe to show; unresolved UUIDs are not.
  if (isUuidLike(needle)) return fallback;
  return needle;
}
