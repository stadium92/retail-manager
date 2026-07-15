/**
 * Turn any thrown value into a human-readable diagnostic string for toasts.
 *
 * Supabase/PostgREST rejections are plain objects of the shape
 * `{ message, details, hint, code }` — none of which is an Error, so
 * `err.message` alone often loses the useful part (e.g. the RLS code 42501 or
 * the constraint name). This surfaces all of it so failures can be diagnosed
 * from the UI instead of only the console.
 */
export function describeSaleError(err: any): string {
  if (err == null) return 'Erreur inconnue';
  if (typeof err === 'string') return err;

  const parts: string[] = [];
  if (err.message) parts.push(String(err.message));
  if (err.code) parts.push(`[${err.code}]`);
  if (err.details) parts.push(String(err.details));
  if (err.hint) parts.push(`(${err.hint})`);

  if (parts.length === 0) {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return parts.join(' ');
}

/**
 * Common failures mapped to a plain-language hint the cashier can act on.
 * Falls back to the raw description when nothing matches.
 */
export function explainSaleError(err: any): string {
  const raw = describeSaleError(err);
  const code = err?.code ? String(err.code) : '';
  const msg = (err?.message ? String(err.message) : raw).toLowerCase();

  if (code === '42501' || msg.includes('row-level security')) {
    return `Session non authentifiée (RLS ${code || '42501'}). Déconnectez-vous puis reconnectez-vous. — ${raw}`;
  }
  if (code === 'PGRST204' || msg.includes('schema cache') || msg.includes('could not find')) {
    return `Colonne manquante côté base de données. — ${raw}`;
  }
  if (code === '23502') {
    return `Champ obligatoire manquant. — ${raw}`;
  }
  if (code === '23503' || msg.includes('foreign key')) {
    return `Référence invalide (boutique/produit). — ${raw}`;
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
    return `Problème réseau — impossible de joindre le serveur. — ${raw}`;
  }
  return raw;
}
