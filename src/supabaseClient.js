import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This keeps the build from silently using the wrong database.
  // Add these in Vercel Project Settings -> Environment Variables.
  // Also add them to .env.local for local testing.
  // REACT_APP_SUPABASE_URL=https://your-project.supabase.co
  // REACT_APP_SUPABASE_ANON_KEY=your-publishable-or-anon-key
  // eslint-disable-next-line no-console
  console.warn("Missing Supabase environment variables.");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
