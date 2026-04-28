# ImmersiveNews Admin Platform

Next.js 15 Admin-Oberfläche für RSS-Feed-Verwaltung, Topic-Management und lokale KI-Klassifizierung mit Ollama/Qwen.

---

## Architektur

```
Browser → Next.js 15 (App Router) → Supabase (remote)
                                  → Ollama (lokal, http://localhost:11434)
Windows Task Scheduler → /api/cron/fetch-feeds  (RSS-Abruf)
```

**Keine Auth** — lokales internes Tool.

---

## 1. Voraussetzungen

| Tool | Mindestversion |
|---|---|
| Node.js | 18 |
| npm | 9 |
| Ollama | aktuell |
| Supabase-Projekt | aktiv |

---

## 2. Installation

```bash
npm install
```

---

## 3. Environment-Variablen

```powershell
# Windows PowerShell
Copy-Item .env.local.example .env.local
```

Dann `.env.local` öffnen und befüllen:

| Variable | Woher |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon / public Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role Key |
| `SUPABASE_PROJECT_ID` | Supabase Dashboard → Project Settings → General → Reference ID |

---

## 4. Supabase-Migrationen

> **Wichtig:** Die Basis-Tabellen `topics`, `rss_feeds`, `incoming_items` müssen bereits existieren (ursprünglich manuell angelegt).

Migrationen im Supabase Dashboard → SQL Editor **in dieser Reihenfolge** ausführen:

| # | Datei | Was sie macht |
|---|---|---|
| 1 | `supabase/migrations/20260413_helper_functions.sql` | Rekursive Topic-Hilfsfunktionen (Subtree, Ancestors) |
| 2 | `supabase/migrations/20260428_001_topics_extend.sql` | `description`, `is_fixed_root`, Trigger, Unique-Index |
| 3 | `supabase/migrations/20260428_002_seed_root_topics.sql` | Fixe Root-Topics: Sport, Natur, Technik, Politik |
| 4 | `supabase/migrations/20260428_003_rss_feeds_extend.sql` | `root_topic_id`, `start_topic_id` |
| 5 | `supabase/migrations/20260428_004_incoming_items_extend.sql` | `content`, `published_at`, `processing_state`, u. a. |
| 6 | `supabase/migrations/20260428_005_incoming_item_topics.sql` | Junction-Tabelle (Item ↔ Topic) mit Konfidenz |
| 7 | `supabase/migrations/20260428_006_classification_runs.sql` | KI-Klassifizierungslogs |
| 8 | `supabase/migrations/20260428_007_classifier_settings.sql` | Singleton-Settings für den Klassifizierer |
| 9 | `supabase/migrations/20260428_008_views_and_helpers.sql` | Views: dashboard_stats, items_per_root, low_confidence_items, recent_classifications |

**Nach den Migrationen** TypeScript-Typen regenerieren (braucht Supabase-Login):

```bash
# Einmalig anmelden
npx supabase login

# Typen generieren
npm run db:types
```

---

## 5. Ollama lokal starten

### Ollama installieren

Windows: https://ollama.com/download

### Qwen-Modell herunterladen

```bash
ollama pull qwen3:8b
```

Alternativ für schwächere Hardware:

```bash
ollama pull qwen3:4b
# oder
ollama pull qwen2.5:7b
```

### Ollama starten

```bash
ollama serve
```

Ollama läuft standardmäßig auf `http://localhost:11434`.

---

## 6. Dev-Server starten

```bash
npm run dev
```

Dann im Browser öffnen: **http://localhost:3000**

Du wirst automatisch zum Dashboard weitergeleitet.

---

## 7. Klassifizierung in der Weboberfläche testen

### Schritt 1 — KI-Einstellungen konfigurieren

1. Sidebar → **KI-Einstellungen**
2. Ollama Base-URL: `http://localhost:11434`
3. Modellname: `qwen3:8b` (oder das installierte Modell)
4. **Verbindung testen** → muss grün werden
5. **Test-Klassifizierung** → KI klassifiziert einen Demo-Text
6. Speichern

### Schritt 2 — RSS-Feed hinzufügen

1. Sidebar → **Feeds**
2. → **+ Feed hinzufügen**
3. URL eintragen, Name vergeben, Root-Topic wählen
4. **Jetzt abrufen** → Feed wird sofort gefetcht

### Schritt 3 — Items klassifizieren

1. Sidebar → **Review** (Badge zeigt Anzahl pending Items)
2. Einzelnes Item: → **Klassifizieren**
3. Alle auf einmal: → **Alle pending klassifizieren** (oben rechts)

### Schritt 4 — Ergebnisse prüfen

- Sidebar → **KI-Logs** — zeigt alle Klassifizierungsläufe mit Status, Dauer und KI-Antwort
- Dashboard → **Items mit niedriger Konfidenz** — Items, die manuell geprüft werden sollten
- Review → Tab **Klassifiziert** — fertig klassifizierte Items bestätigen oder ablehnen

---

## 8. RSS-Auto-Abruf einrichten (Windows Task Scheduler)

Der Cron-Endpunkt ist: `POST /api/cron/fetch-feeds`

PowerShell-Befehl für Task Scheduler:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/cron/fetch-feeds" -Method POST
```

Empfohlenes Intervall: stündlich oder alle 15 Minuten.

---

## 9. Fachlogik (Zusammenfassung)

- **Fixe Root-Topics** (Level 1): Sport, Natur, Technik, Politik — geschützt, nicht löschbar
- **Unterthemen** Level 2–5: dynamisch über die UI pflegbar
- **RSS-Artikel** sind keine Topics, sondern `incoming_items`
- **KI darf niemals neue Topics erfinden** — nur existierende `topic_id`s zurückgeben
- **Pro Artikel** max. 3–4 Kandidaten, einer davon `is_primary = true`
- **Approval** bestätigt nur Zuordnungen, erzeugt kein neues Topic
- **Auto-Accept**: wenn Konfidenz ≥ Schwelle → automatisch bestätigt und `processing_state = done`

---

## 10. Datenmodell (Übersicht)

| Tabelle | Zweck |
|---|---|
| `topics` | Themenbaum Level 1–5 |
| `rss_feeds` | Feed-Konfiguration |
| `incoming_items` | Eingehende RSS-Artikel |
| `incoming_item_topics` | Zuordnung Item ↔ Topic (mit Konfidenz) |
| `classification_runs` | KI-Loglogs pro Klassifizierungsversuch |
| `classifier_settings` | Ollama-URL, Modell, Schwellen (Singleton) |

---

## 11. Bekannte Einschränkungen

- `@supabase/supabase-js` ist auf `2.43.4` gepinnt (Kompatibilität mit `@supabase/ssr@0.4.1`). Nach Upgrade beider Pakete bitte `npm run db:types` neu ausführen.
- Die `classifier_settings`-Tabelle hat alle Insert-Felder optional — zwei Datenbankoperationen nutzen `@ts-ignore` als Workaround (kein Runtime-Problem).
