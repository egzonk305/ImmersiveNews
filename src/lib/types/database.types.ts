// Diese Datei wird idealerweise automatisch generiert via:
// npm run db:types
//
// Manuell gepflegt als Basis bis zur Generierung.

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
          id: string           // uuid
          name: string
          parent_id: string | null
          level: number
          created_at: string   // timestamptz
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
      // Weitere Tabellen hier ergänzen sobald bekannt
    }
    Views: {
      [_ in never]: never
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
