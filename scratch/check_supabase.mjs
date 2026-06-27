import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = 'https://onsqvduklnwffugsiybs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uc3F2ZHVrbG53ZmZ1Z3NpeWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk1MDgsImV4cCI6MjA5NzgxNTUwOH0.39u7eCzwZonAVbxdEYTQBv9cMONWHSCD5SBKeKSmUkE';

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: ws,
  },
});

async function testAuth() {
  const email = 'ursula@master.com';
  const passwords = ['Password123!', '1234567890', '12345678@', '1234567890@'];

  for (const password of passwords) {
    console.log(`\nAttempting SIGN IN for ${email} with password ${password}...`);
    const signinResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signinResult.error) {
      console.error(`Sign In Error for ${password}:`, signinResult.error.message || signinResult.error);
    } else {
      console.log(`🎉 SUCCESS! Password "${password}" worked!`);
      console.log('User:', signinResult.data.user?.id);
      console.log('Session exists:', !!signinResult.data.session);
      return;
    }
  }
}

testAuth();
