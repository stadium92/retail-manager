import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = 'https://onsqvduklnwffugsiybs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uc3F2ZHVrbG53ZmZ1Z3NpeWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk1MDgsImV4cCI6MjA5NzgxNTUwOH0.39u7eCzwZonAVbxdEYTQBv9cMONWHSCD5SBKeKSmUkE';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function run() {
  const email = 'master@example.com';
  const password = 'Password123!';

  console.log(`Testing direct login for ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('❌ Login failed:', error.message);
  } else {
    console.log('✅ Login succeeded! User details:');
    console.log({
      id: data.user.id,
      email: data.user.email,
      role: data.user.role,
      confirmed_at: data.user.email_confirmed_at
    });
  }
}

run();
