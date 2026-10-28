import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://kxnkdhznnpwvnljjmfwl.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bmtkaHpubnB3dm5samptZndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODQ2MDcsImV4cCI6MjA5NDU2MDYwN30.9oZ5dtOOQtOzkyuu8t_lSauQAH1e992ED0HGI8WOs9M';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Safe lock handler to prevent browser Navigator LockManager timeout collisions in dev/multi-tab
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return await fn();
    },
  },
});
