import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'worker' | 'deliverer';
  store_id?: string;
  vehicle_type?: string;
  sub_role?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the calling user is authenticated and has master role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller's token and get user info
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    
    if (userError || !userData?.user) {
      console.error('Error getting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerId = userData.user.id;

    // Check if caller has master role
    const { data: callerRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId);

    if (rolesError) {
      console.error('Error checking caller roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasMasterRole = callerRoles?.some(r => r.role === 'master');
    if (!hasMasterRole) {
      return new Response(
        JSON.stringify({ error: 'Only masters can perform this action' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE') {
      const body = await req.json().catch(() => ({}));
      const { user_id } = body;
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: user_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (deleteError) {
        console.error('Error deleting user:', deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`User deleted: ${user_id} by master ${callerId}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'PATCH') {
      const body = await req.json().catch(() => ({}));
      const { user_id, email, password, full_name, phone, role, store_id, sub_role } = body;

      let targetUserId = user_id;
      if (!targetUserId && email) {
        // Resolve email to user_id using profiles
        const { data: profileData } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (profileData?.id) {
          targetUserId = profileData.id;
        } else {
          // Fallback to auth.admin.listUsers()
          const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
          const foundUser = userList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (foundUser) {
            targetUserId = foundUser.id;
          }
        }
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'Missing required target identifier: user_id or email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update auth user if password or email is changed
      const updateData: any = {};
      if (password) updateData.password = password;
      if (email) updateData.email = email;

      const metadataUpdates: any = {};
      if (full_name) metadataUpdates.full_name = full_name;
      if (phone) metadataUpdates.phone = phone;
      if (role) metadataUpdates.role = role;
      if (store_id) metadataUpdates.store_id = store_id;
      if (sub_role) metadataUpdates.sub_role = sub_role;

      if (Object.keys(metadataUpdates).length > 0) {
        updateData.user_metadata = metadataUpdates;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, updateData);
        if (authUpdateErr) {
          console.error('Error updating auth user:', authUpdateErr);
          return new Response(
            JSON.stringify({ error: authUpdateErr.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update profile
      if (full_name !== undefined || phone !== undefined || email !== undefined) {
        const profileUpdates: any = {};
        if (full_name !== undefined) profileUpdates.full_name = full_name;
        if (phone !== undefined) profileUpdates.phone = phone;
        if (email !== undefined) profileUpdates.email = email;

        const { error: profileUpdateErr } = await supabaseAdmin
          .from('profiles')
          .update(profileUpdates)
          .eq('id', targetUserId);

        if (profileUpdateErr) {
          console.warn('Profile update warning:', profileUpdateErr.message);
        }
      }

      // Update role
      if (role !== undefined || store_id !== undefined || sub_role !== undefined) {
        const roleUpdates: any = {};
        if (role !== undefined) roleUpdates.role = role;
        if (store_id !== undefined) roleUpdates.store_id = store_id;
        if (sub_role !== undefined) roleUpdates.sub_role = sub_role;

        const { error: roleUpdateErr } = await supabaseAdmin
          .from('user_roles')
          .upsert({
            user_id: targetUserId,
            ...roleUpdates
          }, { onConflict: 'user_id' });

        if (roleUpdateErr) {
          console.warn('Role update warning:', roleUpdateErr.message);
        }
      }

      console.log(`User updated: ${targetUserId} by master ${callerId}`);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CreateUserRequest = await req.json();
    const { email, password, full_name, phone, role, store_id, vehicle_type, sub_role } = body;

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['worker', 'deliverer'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be worker or deliverer' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'A user with this email already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the user using admin API (doesn't affect current session)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email since master is creating the account
      user_metadata: {
        full_name,
        phone,
        created_by: callerId,
        role,
        sub_role: sub_role || undefined,
        store_id: store_id || undefined,
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = newUser.user.id;

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name,
        phone,
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Rollback: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role,
        store_id: store_id || null,
        sub_role: sub_role || null,
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: 'Failed to assign role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If it's a deliverer with vehicle info, we could store that in a deliverers table
    // For now, we'll store it in user metadata (already done above)
    if (role === 'deliverer' && vehicle_type) {
      // Update user metadata with vehicle type
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...newUser.user.user_metadata,
          vehicle_type,
        },
      });
    }

    // Log the action for audit purposes
    console.log(`User created: ${email} with role ${role} (sub_role: ${sub_role}) by master ${callerId}`);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email,
          full_name,
          role,
          sub_role,
          store_id,
          sub_role: sub_role || null,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
