-- Migration: classifier_settings um Ollama-Tuning, Vorschlags-, Enrichment- und Lifecycle-Parameter erweitern

ALTER TABLE classifier_settings
  ADD COLUMN IF NOT EXISTS temperature numeric(3,2) NOT NULL DEFAULT 0.10
    CHECK (temperature >= 0 AND temperature <= 2),
  ADD COLUMN IF NOT EXISTS num_ctx int NOT NULL DEFAULT 8192
    CHECK (num_ctx BETWEEN 512 AND 131072),
  ADD COLUMN IF NOT EXISTS num_predict int NOT NULL DEFAULT 400
    CHECK (num_predict BETWEEN 16 AND 8192),
  ADD COLUMN IF NOT EXISTS timeout_ms int NOT NULL DEFAULT 360000
    CHECK (timeout_ms BETWEEN 1000 AND 1800000),

  ADD COLUMN IF NOT EXISTS min_stage_confidence numeric(5,4) NOT NULL DEFAULT 0.5
    CHECK (min_stage_confidence >= 0 AND min_stage_confidence <= 1),
  ADD COLUMN IF NOT EXISTS topic_similarity_threshold numeric(5,4) NOT NULL DEFAULT 0.7
    CHECK (topic_similarity_threshold >= 0 AND topic_similarity_threshold <= 1),
  ADD COLUMN IF NOT EXISTS max_new_topics_per_item int NOT NULL DEFAULT 2
    CHECK (max_new_topics_per_item BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS auto_accept_new_topics boolean NOT NULL DEFAULT false,

  ADD COLUMN IF NOT EXISTS enrichment_enabled_global boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enrichment_min_description_chars int NOT NULL DEFAULT 200
    CHECK (enrichment_min_description_chars BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS enrichment_fetch_timeout_ms int NOT NULL DEFAULT 10000
    CHECK (enrichment_fetch_timeout_ms BETWEEN 1000 AND 60000),
  ADD COLUMN IF NOT EXISTS enrichment_max_chars int NOT NULL DEFAULT 50000
    CHECK (enrichment_max_chars BETWEEN 1000 AND 500000),

  ADD COLUMN IF NOT EXISTS prompt_template text,

  ADD COLUMN IF NOT EXISTS reclassify_on_update boolean NOT NULL DEFAULT false,

  ADD COLUMN IF NOT EXISTS fresh_ttl_hours int NOT NULL DEFAULT 48
    CHECK (fresh_ttl_hours BETWEEN 1 AND 8760),
  ADD COLUMN IF NOT EXISTS archive_retention_days int NOT NULL DEFAULT 30
    CHECK (archive_retention_days BETWEEN 1 AND 3650),
  ADD COLUMN IF NOT EXISTS keep_approved_forever boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS keep_with_topic_associations boolean NOT NULL DEFAULT true;

-- Default max_depth auf 5 anheben (existierende Werte 3 unverändert lassen)
ALTER TABLE classifier_settings
  ALTER COLUMN max_depth SET DEFAULT 5;

-- rss_feeds: Per-Feed Overrides
ALTER TABLE rss_feeds
  ADD COLUMN IF NOT EXISTS enrichment_enabled boolean,
  ADD COLUMN IF NOT EXISTS fresh_ttl_hours_override int
    CHECK (fresh_ttl_hours_override IS NULL OR fresh_ttl_hours_override BETWEEN 1 AND 8760);

CREATE INDEX IF NOT EXISTS rss_feeds_active_idx
  ON rss_feeds(is_active) WHERE is_active = true;
