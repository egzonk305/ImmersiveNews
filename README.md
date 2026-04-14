# Admin Platform

Next.js-15-Admin-Oberfläche für eine Supabase-Wissensdatenbank mit Themenbaum.

## Was gegenüber dem ursprünglichen ZIP gefixt wurde

- Upgrade auf **Next 15** für bessere Kompatibilität mit dem bestehenden Code
- kaputte Dependency `@radix-ui/react-badge` entfernt
- `globals.css` so vereinfacht, dass kein `border-border`-Tailwind-Fehler mehr entsteht
- App-Router-Seiten und Route-Handler auf das Next-15-`params`/`searchParams`-Modell angepasst
- Windows-taugliches `npm run db:types` ohne Shell-Umleitungen
- Suchlogik im `TopicTreeBrowser` von Render-Side-Effect auf `useEffect` umgestellt

## Warum Next 15 und nicht 16?

Für dieses Projekt ist **Next 15** der pragmatischere Zielstand:

- kleinerer Migrationssprung vom ursprünglichen Next-14-Code
- weniger Risiko bei bestehenden App-Router-Seiten und Route-Handlern
- React-18-Stack kann beibehalten werden

## Setup

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Environment-Variablen einrichten

Windows PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

macOS / Linux:

```bash
cp .env.local.example .env.local
```

Werte aus dem Supabase-Dashboard eintragen:

- `NEXT_PUBLIC_SUPABASE_URL` → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Publishable Key oder anon Key
- `SUPABASE_SERVICE_ROLE_KEY` → Secret Key oder service_role Key
- `SUPABASE_PROJECT_ID` → Project Ref / Project ID

### 3. SQL-Hilfsfunktionen in Supabase anlegen

Im Supabase-Dashboard → SQL Editor die Datei ausführen:

```txt
supabase/migrations/20260413_helper_functions.sql
```

### 4. TypeScript-Typen generieren

```bash
npm run db:types
```

### 5. Dev-Server starten

```bash
npm run dev
```

Dann im Browser `http://localhost:3000` öffnen.

## Datenmodell

Die App ist weiterhin auf diese Tabelle zugeschnitten:

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | uuid | Primärschlüssel |
| `name` | text | Anzeigename |
| `parent_id` | uuid / null | Referenz auf Eltern-Topic |
| `level` | int | Tiefe im Baum (1–5) |
| `created_at` | timestamptz | Erstellungszeitpunkt |

Wenn eure bestehende Supabase-DB davon abweicht, müsst ihr vor allem diese Dateien anpassen:

- `src/lib/adapters/supabase.adapter.ts`
- `src/lib/services/topic.service.ts`
- `src/lib/validators/topic.schema.ts`
- `src/app/api/topics/*.ts`
