import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatError } from '@/lib/utils'

export async function GET() {
  try {
    const supabase = await createClient()
    const [topicsRes, itemsRes, storiesRes, storyItemsRes] = await Promise.all([
      supabase
        .from('topics')
        .select('id, name, canonical_name, slug, topic_type, parent_id, description, level, usage_count, auto_created, last_seen_at')
        .eq('topic_status', 'active')
        .order('level')
        .order('name')
        .limit(1000),
      supabase
        .from('incoming_items')
        .select('id, title, ai_headline, ai_description, ai_summary_short, source_url, published_at, ai_paths, story_id')
        .not('processed_at', 'is', null)
        .order('processed_at', { ascending: false })
        .limit(500),
      supabase
        .from('news_stories')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200),
      supabase
        .from('story_items')
        .select('story_id, incoming_item_id')
        .limit(2000),
    ])

    if (topicsRes.error) throw new Error(topicsRes.error.message)
    if (itemsRes.error) throw new Error(itemsRes.error.message)
    if (storiesRes.error) throw new Error(storiesRes.error.message)
    if (storyItemsRes.error) throw new Error(storyItemsRes.error.message)

    const itemIdsByStory = new Map<string, string[]>()
    for (const row of storyItemsRes.data ?? []) {
      const ids = itemIdsByStory.get(row.story_id) ?? []
      ids.push(row.incoming_item_id)
      itemIdsByStory.set(row.story_id, ids)
    }

    return NextResponse.json({
      topics: (topicsRes.data ?? []).map(topic => ({
        id: topic.id,
        name: topic.name,
        canonicalName: topic.canonical_name,
        slug: topic.slug,
        type: topic.topic_type,
        rootTopic: topic.parent_id === null ? topic.name : null,
        parentId: topic.parent_id,
        description: topic.description,
        level: topic.level,
        usageCount: topic.usage_count,
        autoCreated: topic.auto_created,
        lastSeenAt: topic.last_seen_at,
      })),
      edges: (topicsRes.data ?? [])
        .filter(topic => topic.parent_id)
        .map(topic => ({ from: topic.parent_id, to: topic.id, relation: 'contains' })),
      items: (itemsRes.data ?? []).map(item => ({
        id: item.id,
        title: item.title,
        aiHeadline: item.ai_headline,
        aiDescription: item.ai_description,
        aiSummaryShort: item.ai_summary_short,
        sourceUrl: item.source_url,
        publishedAt: item.published_at,
        paths: Array.isArray(item.ai_paths) ? item.ai_paths : [],
      })),
      stories: (storiesRes.data ?? []).map(story => ({
        id: story.id,
        storyKey: story.story_key,
        title: story.title,
        currentSummary: story.current_summary,
        latestItemId: story.latest_item_id,
        itemIds: itemIdsByStory.get(story.id) ?? [],
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: formatError(error) }, { status: 500 })
  }
}
