import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'

// NUR serverseitig verwenden! Umgeht Row Level Security.
// Niemals in Client Components importieren.
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt')
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
