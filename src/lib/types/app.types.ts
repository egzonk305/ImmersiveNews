import type { Topic } from './database.types'

// Topic mit geladenen Kindern (für Tree-Ansicht)
export interface TopicNode extends Topic {
  children?: TopicNode[]
  childCount?: number
  isLeaf?: boolean   // level === 5 oder keine Kinder
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

// Review/Incoming (für spätere Feed-Integration)
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_edit'
export type SourceType = 'manual' | 'import_csv' | 'import_json' | 'rss' | 'api' | 'xml'

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
