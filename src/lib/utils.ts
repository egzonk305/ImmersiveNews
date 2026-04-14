import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind-Klassen zusammenführen */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** API-Fehler einheitlich formatieren */
export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Ein unbekannter Fehler ist aufgetreten'
}

/** Level-Zahl → lesbare Bezeichnung */
export function levelLabel(level: number): string {
  const labels: Record<number, string> = {
    1: 'Root-Thema',
    2: 'Hauptbereich',
    3: 'Unterbereich',
    4: 'Thema',
    5: 'Eintrag / Frage',
  }
  return labels[level] ?? `Level ${level}`
}

/** Datum formatieren */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** Pagination berechnen */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    totalPages: Math.ceil(items.length / pageSize),
    page,
    pageSize,
  }
}
