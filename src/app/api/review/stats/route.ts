import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

// GET /api/review/stats
export async function GET() {
  try {
    const supabase = await createClient()

    const [pending, approved, rejected, needsEdit] = await Promise.all([
      supabase.from('incoming_items').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('incoming_items').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('incoming_items').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabase.from('incoming_items').select('*', { count: 'exact', head: true }).eq('status', 'needs_edit'),
    ])

    const stats = {
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
      needs_edit: needsEdit.count ?? 0,
      total: (pending.count ?? 0) + (approved.count ?? 0) + (rejected.count ?? 0) + (needsEdit.count ?? 0),
    }

    return NextResponse.json({ data: stats })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
