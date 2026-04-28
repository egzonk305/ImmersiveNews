# ImmersiveNews — Datenstruktur für das Frontend

Diese Doku erklärt welche Daten wo liegen und wie man sie abfragt.
Datenbank: **Supabase (PostgreSQL)**

---

## Zugangsdaten

Vom Projektverantwortlichen erhalten:
- `SUPABASE_URL` — z.B. `https://xxxxx.supabase.co`
- `SUPABASE_ANON_KEY` — öffentlicher Key für lesende Zugriffe

```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

---

## Tabellen-Übersicht

| Tabelle | Was drin steckt |
|---|---|
| `topics` | Themenbaum (Level 1–5), fixe Root-Topics: Sport, Natur, Technik, Politik |
| `rss_feeds` | Feed-Konfiguration (Name, URL, Intervall) |
| `incoming_items` | Eingehende RSS-Artikel (Titel, Beschreibung, URL, Status) |
| `incoming_item_topics` | Zuordnung Artikel → Topic (mit KI-Konfidenz) |
| `classification_runs` | KI-Logs pro Klassifizierungsversuch |
| `classifier_settings` | Ollama-Einstellungen (intern, für Frontend nicht relevant) |

---

## Die wichtigsten Felder

### `topics`
```
id            uuid       Primärschlüssel
name          text       Anzeigename (z.B. "Sport", "Fußball", "Bundesliga")
parent_id     uuid|null  Eltern-Topic (null = Root-Topic Level 1)
level         int        Tiefe im Baum: 1 = Root, 2–5 = Unterthemen
is_fixed_root boolean    true nur bei Sport/Natur/Technik/Politik
description   text|null  Kurzbeschreibung
```

### `incoming_items` (= die Artikel/Cards)
```
id              uuid      Primärschlüssel
title           text      Artikeltitel
description     text|null Kurzbeschreibung
content         text|null Volltext (oft leer bei RSS)
source_url      text|null Original-URL des Artikels
published_at    timestamp Veröffentlichungsdatum
feed_id         uuid      Referenz auf rss_feeds
status          text      'pending' | 'approved' | 'rejected' | 'needs_edit'
processing_state text     'pending' | 'classified' | 'done' | 'failed'
```

### `incoming_item_topics` (= Zuordnung Artikel ↔ Topic)
```
id                uuid    Primärschlüssel
incoming_item_id  uuid    Referenz auf incoming_items
topic_id          uuid    Referenz auf topics
is_primary        boolean true = Haupt-Topic des Artikels
confidence        float   KI-Konfidenz 0.0–1.0
status            text    'suggested' | 'confirmed' | 'rejected'
source            text    'llm' (KI) | 'manual' (manuell)
reason            text|null Begründung der KI
rank              int     Sortierung (1 = primär)
```

---

## Typische Queries

### Alle bestätigten Artikel mit ihrem Haupt-Topic

```js
const { data } = await supabase
  .from('incoming_items')
  .select(`
    id,
    title,
    description,
    source_url,
    published_at,
    incoming_item_topics!inner(
      confidence,
      topic_id,
      topics(id, name, level, parent_id)
    )
  `)
  .eq('status', 'approved')
  .eq('incoming_item_topics.is_primary', true)
  .eq('incoming_item_topics.status', 'confirmed')
  .order('published_at', { ascending: false })
```

### Alle Root-Topics (Sport / Natur / Technik / Politik)

```js
const { data } = await supabase
  .from('topics')
  .select('id, name, description')
  .eq('is_fixed_root', true)
  .order('name')
```

### Artikel nach Root-Topic filtern (z.B. nur Sport)

```js
// Erst Root-Topic ID holen
const { data: root } = await supabase
  .from('topics')
  .select('id')
  .eq('name', 'Sport')
  .single()

// Dann Artikel holen die einem Unterthema von Sport zugeordnet sind
const { data } = await supabase
  .from('incoming_item_topics')
  .select(`
    incoming_items(id, title, description, source_url, published_at),
    topics(id, name, level),
    confidence
  `)
  .eq('is_primary', true)
  .eq('status', 'confirmed')
  .order('created_at', { ascending: false })
  .limit(50)
```

### Kompletten Themenbaum laden

```js
const { data } = await supabase
  .from('topics')
  .select('id, name, parent_id, level, description, is_fixed_root')
  .order('level')
  .order('name')
```

Daraus lässt sich clientseitig ein Baum aufbauen:
```js
function buildTree(topics) {
  const map = {}
  topics.forEach(t => map[t.id] = { ...t, children: [] })
  const roots = []
  topics.forEach(t => {
    if (t.parent_id) map[t.parent_id]?.children.push(map[t.id])
    else roots.push(map[t.id])
  })
  return roots
}
```

### Artikel mit niedrigster KI-Konfidenz (zur manuellen Prüfung)

```js
const { data } = await supabase
  .from('incoming_item_topics')
  .select(`
    confidence,
    incoming_items(id, title, source_url),
    topics(name)
  `)
  .eq('is_primary', true)
  .eq('source', 'llm')
  .lt('confidence', 0.7)
  .order('confidence', { ascending: true })
  .limit(20)
```

---

## Datenfluss (wie ein Artikel entsteht)

```
RSS-Feed → incoming_items (status: pending)
         → KI klassifiziert → incoming_item_topics (status: suggested)
         → Admin bestätigt  → incoming_item_topics (status: confirmed)
                            → incoming_items (status: approved, processing_state: done)
```

**Für das Frontend relevant:** Nur Artikel mit `status = 'approved'` und Zuordnungen mit `status = 'confirmed'`.

---

## Hinweise

- Ein Artikel kann **mehrere Topic-Zuordnungen** haben (max. 4), aber immer genau **einen Primary** (`is_primary = true`)
- Topics haben max. **5 Ebenen** — Root-Topics (Level 1) sind fix und können nicht gelöscht werden
- `confidence` ist ein Float von 0.0 bis 1.0 — Werte unter 0.65 sollten manuell geprüft werden
- Artikel werden **nie direkt als Topics gespeichert** — nur als `incoming_items` mit Zuordnung
