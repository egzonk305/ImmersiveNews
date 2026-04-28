// Aktualisierte Datenbank-Typen mit RSS-Feeds, Incoming Items, KI-Klassifizierung
// Idealerweise automatisch generiert via: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ProcessingState = 'pending' | 'processing' | 'classified' | 'failed' | 'done'
export type CandidateSource = 'llm' | 'manual'
export type CandidateStatus = 'suggested' | 'confirmed' | 'rejected'
export type ClassificationRunStatus = 'pending' | 'success' | 'failed' | 'parse_error'

export interface Database {
  public: {
    Tables: {
      topics: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          level: number
          description: string | null
          is_fixed_root: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          level?: number
          description?: string | null
          is_fixed_root?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          level?: number
          description?: string | null
          is_fixed_root?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'topics_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      rss_feeds: {
        Row: {
          id: string
          name: string
          url: string
          is_active: boolean
          interval: 'hourly' | '15min' | '6hours' | 'daily'
          root_topic_id: string | null
          start_topic_id: string | null
          last_fetched_at: string | null
          last_error: string | null
          item_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          url: string
          is_active?: boolean
          interval?: 'hourly' | '15min' | '6hours' | 'daily'
          root_topic_id?: string | null
          start_topic_id?: string | null
          last_fetched_at?: string | null
          last_error?: string | null
          item_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          url?: string
          is_active?: boolean
          interval?: 'hourly' | '15min' | '6hours' | 'daily'
          root_topic_id?: string | null
          start_topic_id?: string | null
          last_fetched_at?: string | null
          last_error?: string | null
          item_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      incoming_items: {
        Row: {
          id: string
          title: string
          description: string | null
          content: string | null
          source_type: 'manual' | 'import_csv' | 'import_json' | 'rss' | 'api' | 'xml'
          source_id: string | null
          feed_id: string | null
          source_url: string | null
          published_at: string | null
          raw_data: Json | null
          status: 'pending' | 'approved' | 'rejected' | 'needs_edit'
          processing_state: ProcessingState
          processing_error: string | null
          target_topic_id: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          content?: string | null
          source_type?: 'manual' | 'import_csv' | 'import_json' | 'rss' | 'api' | 'xml'
          source_id?: string | null
          feed_id?: string | null
          source_url?: string | null
          published_at?: string | null
          raw_data?: Json | null
          status?: 'pending' | 'approved' | 'rejected' | 'needs_edit'
          processing_state?: ProcessingState
          processing_error?: string | null
          target_topic_id?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          content?: string | null
          source_type?: 'manual' | 'import_csv' | 'import_json' | 'rss' | 'api' | 'xml'
          source_id?: string | null
          feed_id?: string | null
          source_url?: string | null
          published_at?: string | null
          raw_data?: Json | null
          status?: 'pending' | 'approved' | 'rejected' | 'needs_edit'
          processing_state?: ProcessingState
          processing_error?: string | null
          target_topic_id?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      incoming_item_topics: {
        Row: {
          id: string
          incoming_item_id: string
          topic_id: string
          rank: number
          confidence: number | null
          is_primary: boolean
          reason: string | null
          source: CandidateSource
          status: CandidateStatus
          created_at: string
        }
        Insert: {
          id?: string
          incoming_item_id: string
          topic_id: string
          rank?: number
          confidence?: number | null
          is_primary?: boolean
          reason?: string | null
          source: CandidateSource
          status?: CandidateStatus
          created_at?: string
        }
        Update: {
          id?: string
          incoming_item_id?: string
          topic_id?: string
          rank?: number
          confidence?: number | null
          is_primary?: boolean
          reason?: string | null
          source?: CandidateSource
          status?: CandidateStatus
          created_at?: string
        }
        Relationships: []
      }
      classification_runs: {
        Row: {
          id: string
          incoming_item_id: string | null
          model: string | null
          status: ClassificationRunStatus
          duration_ms: number | null
          prompt: string | null
          raw_response: string | null
          parsed_response: Json | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          incoming_item_id?: string | null
          model?: string | null
          status: ClassificationRunStatus
          duration_ms?: number | null
          prompt?: string | null
          raw_response?: string | null
          parsed_response?: Json | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          incoming_item_id?: string | null
          model?: string | null
          status?: ClassificationRunStatus
          duration_ms?: number | null
          prompt?: string | null
          raw_response?: string | null
          parsed_response?: Json | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: []
      }
      classifier_settings: {
        Row: {
          id: string
          ollama_base_url: string
          model_name: string
          max_candidates: number
          max_depth: number
          confidence_threshold: number
          auto_accept_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          ollama_base_url?: string
          model_name?: string
          max_candidates?: number
          max_depth?: number
          confidence_threshold?: number
          auto_accept_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          ollama_base_url?: string
          model_name?: string
          max_candidates?: number
          max_depth?: number
          confidence_threshold?: number
          auto_accept_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      review_stats: {
        Row: {
          status: string
          item_count: number
        }
      }
      topics_with_path: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          level: number
          description: string | null
          is_fixed_root: boolean
          path_array: string[]
          full_path: string
        }
      }
      dashboard_stats: {
        Row: {
          active_feeds: number
          pending_items: number
          processing_items: number
          classified_items: number
          failed_items: number
          done_items: number
          review_pending: number
          items_last_24h: number
          avg_primary_confidence: number | null
        }
      }
      items_per_root: {
        Row: {
          root_id: string
          root_name: string
          item_count: number
        }
      }
      low_confidence_items: {
        Row: {
          item_id: string
          title: string
          created_at: string
          topic_id: string
          confidence: number | null
          reason: string | null
          confidence_threshold: number
        }
      }
      recent_classifications: {
        Row: {
          id: string
          incoming_item_id: string | null
          item_title: string | null
          model: string | null
          status: ClassificationRunStatus
          duration_ms: number | null
          error_message: string | null
          created_at: string
        }
      }
    }
    Functions: {
      get_topic_subtree: {
        Args: { root_id: string }
        Returns: Database['public']['Tables']['topics']['Row'][]
      }
      get_topic_ancestors: {
        Args: { topic_id: string }
        Returns: { id: string; name: string; level: number }[]
      }
      get_allowed_topics: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          level: number
          full_path: string
          path_array: string[]
        }[]
      }
      topic_root_id: {
        Args: { t: string }
        Returns: string
      }
      get_schema_info: {
        Args: Record<string, never>
        Returns: {
          table_name: string
          column_name: string
          data_type: string
          is_nullable: string
          column_default: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience-Typen
export type Topic = Database['public']['Tables']['topics']['Row']
export type TopicInsert = Database['public']['Tables']['topics']['Insert']
export type TopicUpdate = Database['public']['Tables']['topics']['Update']

export type RssFeed = Database['public']['Tables']['rss_feeds']['Row']
export type RssFeedInsert = Database['public']['Tables']['rss_feeds']['Insert']
export type RssFeedUpdate = Database['public']['Tables']['rss_feeds']['Update']

export type IncomingItem = Database['public']['Tables']['incoming_items']['Row']
export type IncomingItemInsert = Database['public']['Tables']['incoming_items']['Insert']
export type IncomingItemUpdate = Database['public']['Tables']['incoming_items']['Update']

export type IncomingItemTopic = Database['public']['Tables']['incoming_item_topics']['Row']
export type IncomingItemTopicInsert = Database['public']['Tables']['incoming_item_topics']['Insert']
export type IncomingItemTopicUpdate = Database['public']['Tables']['incoming_item_topics']['Update']

export type ClassificationRun = Database['public']['Tables']['classification_runs']['Row']
export type ClassificationRunInsert = Database['public']['Tables']['classification_runs']['Insert']

export type ClassifierSettings = Database['public']['Tables']['classifier_settings']['Row']
export type ClassifierSettingsUpdate = Database['public']['Tables']['classifier_settings']['Update']

export type TopicWithPath = Database['public']['Views']['topics_with_path']['Row']
export type DashboardStats = Database['public']['Views']['dashboard_stats']['Row']
export type ItemsPerRoot = Database['public']['Views']['items_per_root']['Row']
export type LowConfidenceItem = Database['public']['Views']['low_confidence_items']['Row']
export type RecentClassification = Database['public']['Views']['recent_classifications']['Row']
