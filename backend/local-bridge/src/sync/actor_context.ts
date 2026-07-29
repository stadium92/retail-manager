import { AsyncLocalStorage } from 'async_hooks';

/**
 * Who is making the change that is about to be journalled.
 *
 * The journal has to answer "who did this" months after the fact, but the
 * repository layer - where mutations are actually emitted to the outbox -
 * has no idea: every repo method takes ids and values, never the caller.
 * Threading an actor argument through ~40 repository methods and their call
 * sites would be a large, mechanical, easy-to-get-wrong change to code that
 * is currently working.
 *
 * Instead the HTTP layer stashes the authenticated caller here for the
 * duration of the request. Every database call in this process is synchronous
 * (better-sqlite3), so the store is always present and correct for the whole
 * of a handler, including inside transactions.
 *
 * Anything written outside a request (the startup scheduler, the outbox
 * backfill sweep) simply has no actor, which is itself accurate and is
 * recorded as NULL rather than guessed.
 */
export interface ActorContext {
  user_id: string | null;
  role?: string | null;
  store_id?: string | null;
}

const storage = new AsyncLocalStorage<ActorContext>();

export const runWithActor = <T>(actor: ActorContext, fn: () => T): T =>
  storage.run(actor, fn);

export const getActor = (): ActorContext | undefined => storage.getStore();

export const getActorUserId = (): string | null => storage.getStore()?.user_id ?? null;
