import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const USER_ID_KEY = 'ipl_user_id';

/** Cache userId in sessionStorage so socket.ts can init synchronously on reload. */
function cacheUserId(id: string): void {
  if (typeof window !== 'undefined') sessionStorage.setItem(USER_ID_KEY, id);
}

export function clearCachedUserId(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem(USER_ID_KEY);
}

export function getCachedUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(USER_ID_KEY);
}

/**
 * Returns the authenticated user's stable UUID, or null if not logged in.
 * Game pages use this to gate access — redirect to / if null.
 */
export async function getOrCreateUser(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const id = session?.user?.id ?? null;
  if (id) cacheUserId(id);
  return id;
}

export async function upsertUserProfile(userId: string, email: string): Promise<void> {
  try {
    await supabase.from('users').upsert(
      { user_id: userId, email },
      { onConflict: 'user_id' }
    );
  } catch {
    // Non-fatal — don't block the user if this fails
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign up failed. Please try again.');
  cacheUserId(data.user.id);
  await upsertUserProfile(data.user.id, email);
  return data.user.id;
}

export async function signInWithEmail(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign in failed. Please try again.');
  cacheUserId(data.user.id);
  await upsertUserProfile(data.user.id, email);
  return data.user.id;
}

export async function signOutUser(): Promise<void> {
  clearCachedUserId();
  await supabase.auth.signOut();
}
