import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

// GET /api/schema — Aktuelles Datenbank-Schema abrufen
export async function GET() {
  try {
    const supabase = await createClient()

    // Versuche RPC-Funktion
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_schema_info')

    if (!rpcError && rpcData) {
      // Gruppiere nach Tabelle
      const tables: Record<string, Array<{
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
      }>> = {}

      for (const row of rpcData) {
        if (!tables[row.table_name]) {
          tables[row.table_name] = []
        }
        tables[row.table_name].push({
          column_name: row.column_name,
          data_type: row.data_type,
          is_nullable: row.is_nullable,
          column_default: row.column_default,
        })
      }

      return NextResponse.json({ data: tables })
    }

    // Fallback: Bekannte Tabellen manuell beschreiben
    const knownTables: Record<string, string[]> = {}

    // Topics prüfen
    const { data: topicsSample, error: topicsErr } = await supabase
      .from('topics')
      .select('*')
      .limit(1)

    if (!topicsErr && topicsSample) {
      knownTables['topics'] = topicsSample.length > 0 ? Object.keys(topicsSample[0]) : ['id', 'name', 'parent_id', 'level', 'created_at']
    }

    // RSS Feeds prüfen
    const { data: feedsSample, error: feedsErr } = await supabase
      .from('rss_feeds')
      .select('*')
      .limit(1)

    if (!feedsErr) {
      knownTables['rss_feeds'] = feedsSample && feedsSample.length > 0
        ? Object.keys(feedsSample[0])
        : ['id', 'name', 'url', 'is_active', 'interval', 'last_fetched_at', 'last_error', 'item_count', 'created_at', 'updated_at']
    }

    // Incoming Items prüfen
    const { data: incomingSample, error: incomingErr } = await supabase
      .from('incoming_items')
      .select('*')
      .limit(1)

    if (!incomingErr) {
      knownTables['incoming_items'] = incomingSample && incomingSample.length > 0
        ? Object.keys(incomingSample[0])
        : ['id', 'title', 'description', 'source_type', 'source_id', 'source_url', 'raw_data', 'status', 'target_topic_id', 'reviewed_at', 'created_at']
    }

    return NextResponse.json({ data: knownTables, fallback: true })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
