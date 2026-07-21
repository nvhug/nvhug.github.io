import { createClient } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from './supabase-browser'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server-side singleton (API routes, server components — no session)
let serverClient: ReturnType<typeof createClient> | null = null
function getServerClient() {
  if (!serverClient) {
    serverClient = createClient(supabaseUrl, supabaseAnonKey)
  }
  return serverClient
}

// Single entry point — browser uses the shared session-aware singleton,
// server uses the anon client.
function getClient() {
  if (typeof window !== 'undefined') {
    return getSupabaseBrowserClient() // same instance as RootLayoutClient → session is shared
  }
  return getServerClient()
}

export const supabase = {
  from: (table: string) => getClient().from(table),
  storage: (bucket: string) => getClient().storage.from(bucket),
}

export async function initializeDatabase() {
  try {
    const { error } = await getClient().from('posts').select('id').limit(1)
    if (error?.code === 'PGRST116') console.log('Creating tables...')
  } catch (error) {
    console.error('Database initialization error:', error)
  }
}
