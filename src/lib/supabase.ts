import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let supabaseClient: any = null

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase env vars not set')
    return null
  }

  if (!supabaseClient) {
    // Browser: createBrowserClient reads session from cookies → sends JWT in requests
    // This makes RLS auth.uid() work correctly for each logged-in user
    // Server: createClient with anon key (used by API routes)
    if (typeof window !== 'undefined') {
      supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
    } else {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
    }
  }

  return supabaseClient
}

export const supabase = {
  from: (table: string) => {
    const client = getSupabaseClient()
    if (!client) {
      throw new Error('Supabase not initialized. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    return client.from(table)
  },
  storage: (bucket: string) => {
    const client = getSupabaseClient()
    if (!client) {
      throw new Error('Supabase not initialized. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    return client.storage.from(bucket)
  },
}

export async function initializeDatabase() {
  try {
    const client = getSupabaseClient()
    if (!client) return

    const { error: postsError } = await client
      .from('posts')
      .select('id')
      .limit(1)

    if (postsError?.code === 'PGRST116') {
      console.log('Creating tables...')
    }
  } catch (error) {
    console.error('Database initialization error:', error)
  }
}
