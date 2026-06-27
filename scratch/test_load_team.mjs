import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = 'https://onsqvduklnwffugsiybs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uc3F2ZHVrbG53ZmZ1Z3NpeWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk1MDgsImV4cCI6MjA5NzgxNTUwOH0.39u7eCzwZonAVbxdEYTQBv9cMONWHSCD5SBKeKSmUkE';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

async function testLoadTeam() {
  const email = 'master@example.com';
  const password = 'Password123!';

  console.log(`1. Logging in as ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('Login failed:', authError.message);
    return;
  }

  const userId = authData.user.id;
  console.log(`Login successful! User ID: ${userId}`);

  // Query 1: user_roles
  console.log('\n2. Querying public.user_roles...');
  const { data: dbRoles, error: dbRolesError } = await supabase
    .from('user_roles')
    .select('*')
    .in('role', ['worker', 'master']);

  if (dbRolesError) {
    console.error('Error querying user_roles:', dbRolesError);
  } else {
    console.log(`Found ${dbRoles.length} roles:`);
    console.log(dbRoles);
  }

  // Query 2: profiles
  if (dbRoles && dbRoles.length > 0) {
    const userIds = dbRoles.map(r => r.user_id);
    console.log('\n3. Querying public.profiles...');
    const { data: dbProfiles, error: dbProfilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    if (dbProfilesError) {
      console.error('Error querying profiles:', dbProfilesError);
    } else {
      console.log(`Found ${dbProfiles.length} profiles:`);
      console.log(dbProfiles);
    }
  }
}

testLoadTeam();
