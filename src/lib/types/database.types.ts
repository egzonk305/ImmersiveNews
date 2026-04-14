// Aktualisierte Datenbank-Typen mit RSS-Feeds und Incoming Items
// Idealerweise automatisch generiert via: npm run db:types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      topics: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          level: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          level: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          level?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "topics"
            referencedColumns: ["id"]
          }
        ]
      }
      rss_feeds: {
        Row: {
          id: string
          name: string
          url: string
          is_active: boolean
          interval: 'hourly' | '15min' | '6hours' | 'daily'
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
          source_type: 'manual' | 'import_csv' | 'import_json' | 'rss' | 'api' | 'xml'
          source_id: string | null
          source_url: string | null
          raw_data: Json | null
          status: 'pending' | 'approved' | 'rejected' | 'needs_edit'
          target_topic_id: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          source_type?: 'manual' | 'import_csv' | 'import_json' | 'rss' | 'api' | 'xml'
          source_id?: string | null
          source_url?: string | null
          raw_data?: Json | null
          status?: 'pending' | 'approved' | 'rejected' | 'needs_edit'
          target_topic_id?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          source_type?: 'manual' | 'import_csv' | 'import_json' | 'rss' | 'api' | 'xml'
          source_id?: string | null
          source_url?: string | null
          raw_data?: Json | null
          status?: 'pending' | 'approved' | 'rejected' | 'needs_edit'
          target_topic_id?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incoming_items_source_id_fkey"
            columns: ["source_id"]
            referencedRelation: "rss_feeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incoming_items_target_topic_id_fkey"
            columns: ["target_topic_id"]
            referencedRelation: "topics"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      review_stats: {
        Row: {
          status: string
          item_count: number
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
