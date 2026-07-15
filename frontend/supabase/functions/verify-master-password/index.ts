import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface VerifyRequest {
  password: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerId = userData.user.id;

    const body: VerifyRequest = await req.json();
    const { password } = body;
    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve the caller's store: their own user_roles row first, falling back
    // to user_metadata.store_id (same fallback chain used across the app).
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('store_id')
      .eq('user_id', callerId);

    const callerStoreId =
      callerRoles?.find((r) => r.store_id)?.store_id ||
      (userData.user.user_metadata?.store_id as string | undefined);

    if (!callerStoreId) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve store for caller' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // The master is the store's owner (stores.owner_id), matching the
    // ownership-fallback convention used elsewhere for master resolution.
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('owner_id')
      .eq('id', callerStoreId)
      .maybeSingle();

    if (storeError || !store?.owner_id) {
      console.error('Error resolving store owner:', storeError);
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: masterUser, error: masterError } = await supabaseAdmin.auth.admin.getUserById(store.owner_id);
    if (masterError || !masterUser?.user?.email) {
      console.error('Error resolving master email:', masterError);
      return new Response(
        JSON.stringify({ valid: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the password by attempting a sign-in against the master's own
    // email, using a stateless client (autoRefreshToken/persistSession off) so
    // this never touches the caller's actual browser session or cookies.
    const verifyClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: masterUser.user.email,
      password,
    });

    return new Response(
      JSON.stringify({ valid: !signInError }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('verify-master-password error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
