import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const key = readFileSync('C:\\Users\\DELL\\AppData\\Local\\Temp\\opencode\\svc_key.txt', 'utf8').trim();
const url = 'https://pstjxxheucfliuzydgzw.supabase.co';

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  // 1. Try to get auth config to see if service role key works
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.log('Auth admin error:', usersError.message);
  } else {
    console.log('Auth admin works! Total users:', users.users.length);
  }

  // 2. Find the user's email to make them admin
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user (anon token):', user?.email ?? 'none');
}

run().catch(console.error);
