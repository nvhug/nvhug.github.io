import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// user_id FKs on these tables lack ON DELETE CASCADE (see sql/62.fix_user_owned_tables_cascade_delete.sql),
// so auth.admin.deleteUser() 500s with a foreign key violation unless their rows are cleared first.
const OWNED_TABLES = [
  'notes', 'todos', 'goals', 'goal_items', 'meals', 'daily_foods',
  'weight_logs', 'quotes', 'ai_analysis_history', 'buy_picks',
] as const

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (data?.role !== 'admin') return null
  return user
}

/** DELETE /api/admin/users/[id] */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (id === admin.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const svc = serviceClient()

  for (const table of OWNED_TABLES) {
    const { error } = await svc.from(table).delete().eq('user_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { error } = await svc.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
