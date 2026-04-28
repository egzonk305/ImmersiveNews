import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

// GET /api/topics/tree — flache Liste aller Topics mit full_path
// Wird vom TopicPicker (Review-UI) und vom Klassifizierer-Prompt benutzt.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('topics_with_path')
      .select('*')
      .order('full_path')

    if (error) throw new Error(error.message)
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
