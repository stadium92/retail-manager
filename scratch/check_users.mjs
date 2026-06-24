const supabaseUrl = 'https://onsqvduklnwffugsixbs.supabase.co';
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uc3F2ZHVrbG53ZmZ1Z3NpeWJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIzOTUwOCwiZXhwIjoyMDk3ODE1NTA4fQ.Z_He8ZDPltWp0x--Kaw31Xi3dWZ6j2HT0YZMeHIDO5M';

async function main() {
  console.log('Fetching users from Supabase Auth via REST...');
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    headers: {
      'apikey': supabaseServiceRole,
      'Authorization': `Bearer ${supabaseServiceRole}`
    }
  });

  if (!res.ok) {
    console.error('Error fetching users:', res.status, await res.text());
    return;
  }

  const data = await res.json();
  const users = data.users || [];
  console.log(`Found ${users.length} users:`);
  for (const user of users) {
    console.log(`- Email: ${user.email}, ID: ${user.id}, Metadata:`, user.user_metadata);
  }
}

main().catch(console.error);
