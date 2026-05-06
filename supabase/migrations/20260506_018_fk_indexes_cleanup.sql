-- Migration 018: FK-Indizes für Performance + Duplikat-Index entfernen
-- Ausgeführt: 2026-05-06
-- Grund: Supabase Performance Advisor — fehlende Indizes auf Foreign Keys + doppelter Index

-- Fehlende FK-Indizes anlegen
CREATE INDEX IF NOT EXISTS idx_incoming_items_source_id       ON public.incoming_items(source_id);
CREATE INDEX IF NOT EXISTS idx_incoming_items_story_id        ON public.incoming_items(story_id);
CREATE INDEX IF NOT EXISTS idx_incoming_items_target_topic_id ON public.incoming_items(target_topic_id);
CREATE INDEX IF NOT EXISTS idx_news_stories_latest_item_id    ON public.news_stories(latest_item_id);
CREATE INDEX IF NOT EXISTS idx_topics_merged_into_topic_id    ON public.topics(merged_into_topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_proposed_from_item_id   ON public.topics(proposed_from_item_id);

-- Duplikat-Index entfernen (identisch zu rss_feeds_active_idx)
DROP INDEX IF EXISTS public.idx_rss_feeds_active;
