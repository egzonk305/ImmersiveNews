import type { Topic, RssFeed, IncomingItem } from './database.types'

// Topic mit geladenen Kindern (für Tree-Ansicht)
export interface TopicNode extends Topic {
  children?: TopicNode[]
  childCount?: number
  isLeaf?: boolean
}

// Breadcrumb-Pfad zu einem Topic
export type TopicBreadcrumb = {
  id: string
  name: string
  level: number
}[]

// Für die Tree-Browser-Komponente
export interface TopicTreeState {
  expandedIds: Set<string>
  selectedId: string | null
}

// Import/Export
export type ImportFormat = 'csv' | 'json' | 'excel' | 'txt'
export type ExportFormat = 'csv' | 'json' | 'excel'

export interface ImportRow {
  name: string
  parent_id?: string
  level?: number
  [key: string]: unknown
}

export interface ImportResult {
  total: number
  success: number
  errors: { row: number; message: string }[]
}

// Review/Incoming
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_edit'
export type SourceType = 'manual' | 'import_csv' | 'import_json' | 'rss' | 'api' | 'xml'

// Feed mit Statistiken
export interface FeedWithStats extends RssFeed {
  pending_count?: number
}

// Incoming Item mit Feed-Info
export interface IncomingItemWithFeed extends IncomingItem {
  feed?: Pick<RssFeed, 'id' | 'name' | 'url'> | null
  target_topic?: Pick<Topic, 'id' | 'name' | 'level'> | null
}

// Schema-Info (für dynamische UI)
export interface SchemaColumn {
  table_name: string
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

export interface TableSchema {
  name: string
  columns: SchemaColumn[]
}

// API-Response-Wrapper
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}
