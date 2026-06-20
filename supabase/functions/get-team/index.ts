import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    // Admin client (service role) — bypasses RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Caller client — to verify the session
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

    // Get the master's store_id
    const { data: masterRoles } = await supabaseAdmin
      .from('user_roles')
      .select('store_id, role')
      .eq('user_id', callerId);

    const isMaster = masterRoles?.some((r: any) => r.role === 'master');
    const masterStoreId = masterRoles?.find((r: any) => r.role === 'master')?.store_id;

    if (!isMaster) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: only masters can view the team' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all worker roles for this store
    let rolesQuery = supabaseAdmin
      .from('user_roles')
      .select('id, user_id, role, store_id, sub_role, created_at')
      .neq('role', 'master');

    if (masterStoreId) {
      rolesQuery = rolesQuery.eq('store_id', masterStoreId);
    }

    const { data: roles, error: rolesError } = await rolesQuery;
    if (rolesError) {
      return new Response(
        JSON.stringify({ error: rolesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ workers: [], deliverers: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch profiles for all users (service role bypasses RLS)
    const userIds = roles.map((r: any) => r.user_id);
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, phone')
      .in('id', userIds);

    // Fetch restaurant name
    let restaurantName: string | undefined;
    if (masterStoreId) {
      const { data: restaurant } = await supabaseAdmin
        .from('restaurants')
        .select('name')
        .eq('id', masterStoreId)
        .single();
      restaurantName = restaurant?.name;
    }

    // Build team members
    const team = roles.map((role: any) => {
      const profile = (profiles || []).find((p: any) => p.id === role.user_id);
      return {
        id: role.id,
        user_id: role.user_id,
        email: profile?.email || '',
        full_name: profile?.full_name || profile?.email || 'Unknown',
        phone: profile?.phone || null,
        role: role.role,
        sub_role: role.sub_role || null,
        store_id: role.store_id || null,
        store_name: restaurantName || null,
        is_active: true,
        created_at: role.created_at,
        sales_count: 0,
        total_revenue: 0,
        deliveries_total: 0,
        deliveries_completed: 0,
      };
    });

    const workers = team.filter((m: any) => m.role === 'worker');
    const deliverers = team.filter((m: any) => m.role === 'deliverer');

    return new Response(
      JSON.stringify({ workers, deliverers }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('get-team error:', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
