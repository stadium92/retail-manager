import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface CreateProductRequest {
  store_id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unit_price?: number;
  cost_price?: number;
  wholesale_price?: number;
  quantity?: number;
  min_quantity?: number;
  category?: string;
  image_url?: string;
}

const columnMissingIndicators = ['cost_price', 'wholesale_price', 'min_quantity'];

const needsLegacyInsert = (message?: string, code?: string) => {
  if (!message && !code) return false;
  if (code === '42703') return true; // undefined_column
  return columnMissingIndicators.some((indicator) => message?.includes(indicator));
};

const buildLegacyProductPayload = (body: CreateProductRequest) => ({
  store_id: body.store_id,
  name: body.name,
  description: body.description || null,
  sku: body.sku || null,
  barcode: body.barcode || null,
  unit_price: body.unit_price ?? 0,
  quantity: body.quantity ?? 0,
  category: body.category || null,
  image_url: body.image_url || null,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const callerId = userData.user.id;

    const body: CreateProductRequest = await req.json();
    if (!body || !body.name || !body.store_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: name, store_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify permissions: master OR worker assigned to the store
    // Verify permissions: master OR worker assigned to the store
    // Use both user_roles and the helper RPC get_user_store_ids to be robust across schema variants
    try {
      const { data: roles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('role, store_id')
        .eq('user_id', callerId);

      if (rolesError) {
        console.warn('roles lookup error:', rolesError);
      }

      const isMaster = roles?.some((r: any) => r.role === 'master');

      // RPC fallback: ask the DB which store ids the user belongs to
      const { data: storeIds, error: storeIdsError } = await supabaseAdmin.rpc('get_user_store_ids', { _user_id: callerId });
      if (storeIdsError) {
        console.warn('get_user_store_ids RPC error:', storeIdsError);
      }

      const normalizedStoreIds: string[] = Array.isArray(storeIds) ? storeIds : (storeIds?.data || []);
      const isWorkerForStore = normalizedStoreIds.includes(body.store_id) || roles?.some((r: any) => r.role === 'worker' && r.store_id === body.store_id);

      if (!isMaster && !isWorkerForStore) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions to create product for this store', reason: 'not_assigned' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (roleCheckErr) {
      console.error('Permission check failed:', roleCheckErr);
      return new Response(JSON.stringify({ error: 'Failed to verify permissions' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Insert product using service role (bypass client-side RLS)
    const insertPayload = {
      store_id: body.store_id,
      name: body.name,
      description: body.description || null,
      sku: body.sku || null,
      barcode: body.barcode || null,
      unit_price: body.unit_price ?? 0,
      cost_price: body.cost_price ?? null,
      wholesale_price: body.wholesale_price ?? null,
      quantity: body.quantity ?? 0,
      min_quantity: body.min_quantity ?? 0,
      category: body.category || null,
      image_url: body.image_url || null,
    };

    const { data: product, error: insertError } = await supabaseAdmin
      .from('products')
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) {
      if (needsLegacyInsert(insertError.message, insertError.code)) {
        console.warn('Falling back to legacy product insert (missing pricing columns).');
        const legacyPayload = buildLegacyProductPayload(body);
        const { data: legacyProduct, error: legacyInsertError } = await supabaseAdmin
          .from('products')
          .insert([legacyPayload])
          .select()
          .single();

        if (!legacyInsertError) {
          return new Response(
            JSON.stringify({ success: true, product: legacyProduct, legacyFallback: true }),
            { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        console.error('Legacy insert error:', legacyInsertError);
        return new Response(
          JSON.stringify({ error: legacyInsertError.message || insertError.message || 'Insert failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message || 'Insert failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, product }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Unexpected error in create-product function:', err);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
