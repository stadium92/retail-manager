import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = 'https://onsqvduklnwffugsiybs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uc3F2ZHVrbG53ZmZ1Z3NpeWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk1MDgsImV4cCI6MjA5NzgxNTUwOH0.39u7eCzwZonAVbxdEYTQBv9cMONWHSCD5SBKeKSmUkE';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const usersToTest = [
  'master@example.com',
  'worker@example.com',
  'deliverer@example.com',
  'customer@example.com',
  'test_master_1782499029420@master.com',
  'test_master_1782506493160@master.com',
  'test_master_1782500078297@master.com',
  'test_master_1782504246734@master.com',
  'test_master_1782549751763@master.com',
  'test_master_manual_1782550430699@master.com'
];

async function testAllLogins() {
  console.log("Starting login test for all accounts with password: 'Password123!'\n");
  for (const email of usersToTest) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: 'Password123!',
      });
      if (error) {
        console.log(`❌ Fail: ${email} | Error: ${error.message}`);
      } else {
        console.log(`✅ Success: ${email} | User ID: ${data.user.id}`);
      }
    } catch (err) {
      console.log(`💥 Exception: ${email} | ${err.message}`);
    }
  }
}

testAllLogins();
