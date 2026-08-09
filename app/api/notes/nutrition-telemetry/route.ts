import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const payloadSchema = z.object({
  eventName: z.enum([
    'internal_table_match_applied',
    'internal_table_match_ambiguous',
    'internal_table_no_match',
    'manual_calorie_edit_after_normalization',
  ]),
  normalized_table_key: z.string().max(100).optional().nullable(),
  normalized_source: z.string().max(50).optional().nullable(),
  normalization_version: z.string().max(50).optional().nullable(),
  normalization_confidence: z.coerce.number().min(0).max(1).optional().nullable(),
  previous_calories: z.coerce.number().min(0).optional().nullable(),
  updated_calories: z.coerce.number().min(0).optional().nullable(),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid telemetry payload.' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Internal telemetry only; skip unauthenticated writes.
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase
    .from('nutrition_normalization_metrics')
    .insert([{
      event_name: parsed.data.eventName,
      normalized_table_key: parsed.data.normalized_table_key ?? null,
      normalized_source: parsed.data.normalized_source ?? null,
      normalization_version: parsed.data.normalization_version ?? null,
      normalization_confidence: parsed.data.normalization_confidence ?? null,
      previous_calories: parsed.data.previous_calories ?? null,
      updated_calories: parsed.data.updated_calories ?? null,
    }])

  if (error) {
    // Telemetry must never break UX.
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
