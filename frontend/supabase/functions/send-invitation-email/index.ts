import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Create client with user's auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Verify user has master role
    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role, store_id')
      .eq('user_id', user.id);

    if (roleError || !roles || roles.length === 0) {
      console.error('No valid role found for user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No role assigned' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const isMaster = roles.some(r => r.role === 'master');
    if (!isMaster) {
      console.error('User is not a master:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only masters can send invitations' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    console.log(`User ${user.id} authenticated with master role`);

    const { invitation_id } = await req.json();
    
    // Use service role key for reading invitation data
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: invitation, error } = await supabaseAdmin
      .from('worker_invitations')
      .select('*, stores(name)')
      .eq('id', invitation_id)
      .single();

    if (error || !invitation) {
      console.error('Invitation not found:', error);
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Verify the master has access to the store for this invitation
    if (invitation.store_id) {
      const masterStoreIds = roles.map(r => r.store_id).filter(Boolean);
      if (!masterStoreIds.includes(invitation.store_id)) {
        console.error('Master does not have access to store:', invitation.store_id);
        return new Response(
          JSON.stringify({ error: 'Forbidden - No access to this store' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:8080';
    const invitationUrl = `${siteUrl}/auth?token=${invitation.token}`;

    console.log('Invitation email details:', {
      to: invitation.email,
      url: invitationUrl,
      role: invitation.role,
      store: invitation.stores?.name || 'No store',
    });

    // TODO: Integrate with email service (Resend, SendGrid, etc.)
    // For now, just log the invitation URL
    console.log(`
      ========================================
      INVITATION EMAIL
      ========================================
      To: ${invitation.email}
      Role: ${invitation.role}
      Store: ${invitation.stores?.name || 'No store assigned'}
      
      Click here to accept: ${invitationUrl}
      
      This invitation expires on ${new Date(invitation.expires_at).toLocaleDateString()}
      ========================================
    `);

    return new Response(
      JSON.stringify({ success: true, invitation_url: invitationUrl }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in send-invitation-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
