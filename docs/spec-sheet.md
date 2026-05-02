# Carmen Co-Writer — Technical Spec Sheet

*Last updated: April 30, 2026*

---

## Architecture

Carmen is a **single-page web application** — one HTML file (~445KB), no build framework, no React/Vue/Angular. Vanilla JavaScript, CSS, and HTML. The entire app loads in one request and runs client-side, with serverless functions handling authentication, AI requests, and payments.

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS + CSS (single `index.html`) |
| Backend | Netlify Functions (Node.js) |
| Database | Firebase Firestore (cloud) + IndexedDB (local) |
| Auth | Firebase Authentication (Google OAuth) |
| AI | Anthropic Claude Haiku 4.5 |
| Rhymes (EN) | Datamuse API |
| Rhymes (FR) | Drime API (drime.a3nm.net) |
| Payments | Stripe Checkout + Webhooks |
| Analytics | PostHog (proxied through Netlify) |
| Hosting | Netlify |
| Domains | `app.carmencowriter.com` (app), `carmencowriter.com` (marketing) |

---

## External Services & APIs

### Anthropic Claude API
- **Model:** `claude-haiku-4-5`
- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **API version:** `2023-06-01`
- **Proxied through:** `/.netlify/functions/ai`
- **Max tokens:** 350 (line tools) to 700 (bridge/flow tools)
- **Temperature:** 0.88
- **Auth:** Server-side API key (`ANTHROPIC_API_KEY` env var). Never exposed to browser.
- **Rate limiting:** 50 requests/month (free), 500 (creator), unlimited (pro). Tracked per-user in Firestore.

### Datamuse API (English rhymes)
- **Endpoint:** `https://api.datamuse.com/words`
- **Queries used:**
  - `?rel_rhy={word}&max=50&md=s` — perfect rhymes with syllable metadata
  - `?rel_nry={word}&max=50&md=s` — near/slant rhymes
- **Auth:** None (public API, no key required)
- **Rate limit:** Generous; no issues observed
- **Language:** English only

### Drime API (French rhymes)
- **Endpoint:** `https://drime.a3nm.net/query`
- **Query format:** `?query={word}&json=1`
- **Proxied through:** `/rhyme-fr/*` (Netlify redirect to avoid CORS)
- **Auth:** None (public API)
- **Data source:** Lexique database (French phonetic dictionary)
- **Returns:** Word, phonetic transcription, phon_rhyme score (phonemes matching from end), syllable count (min/max), frequency score, word type (noun/adj/verb)
- **Rhyme classification:** `phon_rhyme >= 3` = perfect rhyme; `1-2` = near rhyme

### Firebase
- **Project:** `inkwell-app-619f9`
- **Auth:** Google OAuth (popup on desktop, redirect fallback on iOS)
- **Firestore REST base:** `https://firestore.googleapis.com/v1/projects/inkwell-app-619f9/databases/(default)/documents`
- **Client SDK:** Firebase JS v10.14.0 (compat mode)
- **Firebase API key (client):** `AIzaSyBuEpnxGya3KgBRjfuz4hvwz_i7BOZFHTU`

### Stripe
- **Checkout:** Hosted checkout via `create-checkout` function on marketing site (`carmencowriter.com`)
- **Webhooks:** `checkout.session.completed`, `customer.subscription.deleted`
- **Webhook URL:** `https://app.carmencowriter.com/.netlify/functions/stripe-webhook`
- **Plans:** Creator ($9/mo), Pro ($19/mo)
- **Env vars:** `STRIPE_SECRET_KEY`, `STRIPE_PRICE_CREATOR`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET`

### PostHog
- **Project token:** `phc_rKACNDfxEQoinnSgUXBUNjJX3XVnVJycyrknjpm55MJB`
- **Host:** `https://us.i.posthog.com`
- **Proxied through:** `/ingest/*` and `/ingest/static/*` (bypasses ad blockers)
- **Custom events tracked:** `onboarding_completed`, `first_line_typed`, `cowriter_tool_used`, `suggestion_applied`, `song_created`, `song_loaded`, `feedback_submitted`
- **UTM attribution:** First-touch + last-touch captured in localStorage, registered as super-properties on all events, set as user properties on `identify()`

### Google Fonts (CDN)
Loaded fonts: Cinzel, Cormorant Garamond, Crimson Pro, Jost, Inter, IBM Plex Mono, Courier Prime, Libre Baskerville, Lora, Merriweather, Playfair Display, Source Sans 3, Nunito, Raleway, Bitter, Space Mono, DM Sans, Crimson Text

### lamejs (MP3 encoder)
- **CDN:** `https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js`
- **Loaded:** On-demand only (when user exports audio as MP3)
- **Purpose:** Encodes WAV AudioBuffer to MP3 Blob for download

---

## Netlify Functions

| Function | Path | Purpose |
|---|---|---|
| `ai.js` | `/.netlify/functions/ai` | Proxies AI requests to Anthropic, verifies Firebase auth, enforces usage limits |
| `verify-checkout.js` | `/.netlify/functions/verify-checkout` | Validates Stripe checkout session, writes plan to Firestore |
| `stripe-webhook.js` | `/.netlify/functions/stripe-webhook` | Receives Stripe events, upgrades/downgrades user plan |

### Netlify Redirects (Proxies)

| From | To | Purpose |
|---|---|---|
| `/api/*` | `/.netlify/functions/:splat` | API shorthand |
| `/ingest/static/*` | `https://us-assets.i.posthog.com/static/:splat` | PostHog JS SDK (bypasses ad blockers) |
| `/ingest/*` | `https://us.i.posthog.com/:splat` | PostHog event capture (bypasses ad blockers) |
| `/rhyme-fr/*` | `https://drime.a3nm.net/:splat` | French rhyme API (bypasses CORS) |

---

## Data Storage

### Firebase Firestore (cloud, per-user)

```
users/{uid}/
  prefs/current          — plan, aiUsage, lang, fontTheme, currentSongId, etc.
  songs/{songId}         — title, sections[], key, tempo, mood, tags[], touchstones[]
  profiles/all           — voice profiles (profileName, genres, voiceAnalysis, etc.)
  scratch/{songId}       — collected/scratch pad items per song

feedback/               — user-submitted feedback (category, message, context)
```

### IndexedDB (browser-local, per-device)

```
inkwell-audio-v2 (version 1)
  backingTracks          — { songId (key), blob, label, ts }
  takes                  — { id (auto), songId, blob, label, section, ts, starred }
                           Index: bySong (on songId)
```

Audio blobs (backing tracks, vocal takes) are stored locally in IndexedDB. They are NOT synced to the cloud — each device has its own recordings.

### Translation Store (separate Firebase project)

```
Project: charlotte-dashboard
Collection: inkwell_app/translations
```

Stores i18n string overrides. The app ships with hardcoded EN/FR translations and falls back to this Firestore collection for live updates.

---

## Co-Writer Tools — Data Sources by Language

### Tools using Claude AI (both languages)

These tools send a prompt to Claude Haiku 4.5 with language-specific prompt text. The AI generates the response in the target language. No external API involved.

| Tool | FR Name | Mode | What it does |
|---|---|---|---|
| Match this rhythm | Même rythme | `match` | 3 alternatives matching syllable count |
| Rewrite 3 ways | Réécrire 3 façons | `rewrite` | 3 rewrites with different angles |
| Fix the flow | Améliorer le débit | `prosody` | 3 rewrites with better melodic stress |
| Find phrases | Trouver des expressions | `phrases` | 15 idioms/expressions containing a keyword |
| Word family | Familles de mots | `wordfamily` | Creative replacements: synonyms, poetic alternatives, intensifiers (JSON response) |
| Simile | En comparaison | `simile` | Rewrite using "like/as" or "comme" |
| Alliteration | Ajouter allitération | `alliteration` | Rewrite with repeated consonant sounds |
| Rhythm analysis | Flow | `flow` | Stress pattern (•/◦) mapped per syllable |
| Match syllables | Ajuster | `fit` | Rewrite to match section's average syllable count |
| Get specific | Être précis | `specific` | 3 questions to make lyrics more concrete |
| Shift POV | Changer de point de vue | `perspective` | Perspective shift suggestions |
| Write a hook | Écrire un hook | `hook` | 4 hook/title lines from section theme |
| Find a metaphor | Trouver une métaphore | `metaphor` | 3 fresh metaphors with example lines |
| Bridge builder | Suggérer un pont | `bridge` | 3 bridge drafts (4 lines each) |
| I'm stuck | Je suis bloqué | `unstuck` | 3 creative directions (concepts, not lyrics) |

### Tools using dedicated APIs (language-specific)

| Tool | FR Name | Mode | English | French |
|---|---|---|---|---|
| **Find rhymes** | Trouver des rimes | `rhyme` | **Datamuse API** — phonetic database, perfect + near rhymes, syllable counts, frequency scores. Fast, deterministic, comprehensive. | **Drime API** (drime.a3nm.net) — Lexique-based phonetic dictionary, phon_rhyme scoring, syllable counts, frequency. Fast, deterministic, accurate. Proxied through `/rhyme-fr/`. |

### Tools using local data

| Tool | Mode | English | French |
|---|---|---|---|
| **Intensifiers by mood** | (intensifiers panel) | `INTENSIFIERS_BY_MOOD` — 10 mood categories × 8 verbs + 8 adjectives | `INTENSIFIERS_BY_MOOD_FR` — same 10 categories, fully translated French verbs + adjectives |

**Mood categories:** melancholic, hopeful, anthemic, bittersweet, raw, dreamy, urgent, tender, dark, playful

The app auto-selects the language-appropriate word list based on the current UI language (`currentLang`).

---

## Audio System

| Feature | Technology |
|---|---|
| Playback engine | Web Audio API (`AudioContext`, `BufferSource`) |
| Waveform rendering | HTML5 Canvas (2D context), computed per-pixel amplitude |
| Recording | `MediaRecorder` API (MIME: `audio/webm;codecs=opus` or `audio/mp4`) |
| Backing track | Persisted per-song in IndexedDB. Import from file or record in-app. |
| Vocal takes | Recorded over backing track, stored per-song in IndexedDB. Starred, renamed, filtered by section. |
| Dual playback | Two `BufferSource` nodes through separate `GainNode` chains → `destination` |
| Metronome | `OscillatorNode` (sine wave, 800Hz normal / 1200Hz accent) scheduled via Web Audio clock look-ahead pattern. Independent volume control. Plays during recording and playback. |
| Audio export | `OfflineAudioContext` → WAV (raw PCM encoder) or MP3 (`lamejs` on-demand from CDN). User chooses which layers to include (backing, vocal, metronome). |
| Loop system | DOM-based loop region overlay + Web Audio `loopStart`/`loopEnd`. Draggable handles + region. |
| Speed control | 0.5× to 1.5× via `playbackRate` on BufferSource |
| Storage | IndexedDB (`inkwell-audio-v2`) — blobs stored per-song |

### Signal routing
```
backingBuffer → BufferSource → backingGain (1.0) ──→ destination (speakers)
takeBuffer    → BufferSource → takeGain (1.0)    ──→ destination (speakers)
metronome     → OscillatorNode → clickGain → metronomeGain (0.5) → destination
```

### Audio workflow
1. Import or record a **backing track** (guitar, piano, etc.) — persists with the song
2. Enable **metronome** with BPM from song tempo (or manual override)
3. Hit **🎤 Record Take** — backing track + metronome play while mic records vocals only
4. **Vocal takes** appear in a list, filtered by section, star-able, renamable
5. Tap ▶ on a take to hear it **layered over the backing track** (dual-source playback)
6. **Export** a mix: choose backing + vocal + optional metronome → WAV or MP3 download

### Audio NOT synced to cloud
Backing tracks and vocal takes live in the browser's IndexedDB only. Moving to a different device = no audio. Cloud audio sync would require a storage backend (e.g., Firebase Storage, S3) and is not currently implemented.

---

## iPhone Experience

Carmen has a dedicated iPhone layout (`@media (max-width: 480px)`) with native iOS idioms:

| Feature | Implementation |
|---|---|
| Song picker | Pill-shaped tappable button at top, fixed dropdown |
| Section navigation | Section pill + ◀/▶ buttons in bottom bar |
| Touchstones | Horizontally scrolling strip below song title |
| Co-Writer | Bottom sheet (slide-up from bottom, 80vh) |
| Suggestions | Separate bottom sheet, auto-replaces tool list |
| "Use this" | Direct replace (no modal), auto-closes panel, toast with undo button |
| Haptic feedback | `navigator.vibrate()` on key interactions |
| Safe areas | `env(safe-area-inset-bottom)` padding on bottom bar and sheets |
| Swipe navigation | Touch gesture to swipe between sections |

---

## Internationalization (i18n)

| Aspect | Implementation |
|---|---|
| Supported languages | English, French |
| Translation source | Hardcoded defaults in `translations.js` + Firestore live overrides |
| Translation function | `t('key')` returns string in current language |
| Inline helper | `_tr('English text', 'French text')` for quick bilingual strings |
| Language detection | Auto-detects from lyric content (French diacritics + common words) |
| UI toggle | `#langToggleBtn` switches between EN/FR |
| AI prompts | Each tool has separate EN and FR prompt text |
| Intensifiers | Separate word lists per language (`INTENSIFIERS_BY_MOOD` / `INTENSIFIERS_BY_MOOD_FR`) |
| Persistence | Language preference saved in Firestore `_prefs.lang` |

### Full French language parity
All 16 Co-Writer tools work in French. The rhyme tool uses a dedicated French phonetic API (Drime) matching the quality of the English Datamuse API. The intensifiers panel has a complete French word list. All UI strings are translated.

---

## Security Model

| Concern | Approach |
|---|---|
| API keys | All sensitive keys (Anthropic, Stripe, Firebase server key) are in Netlify env vars, never in client code |
| Firebase API key | In client code — this is by design (Firebase API keys are project identifiers, not secrets) |
| Auth tokens | Firebase ID tokens verified server-side in every Netlify function |
| AI usage | Server-side enforcement — the function checks Firestore before proxying to Anthropic |
| Stripe webhooks | Signature verification via `STRIPE_WEBHOOK_SECRET` |
| CORS | All functions return `Access-Control-Allow-Origin: *` (open, since auth is token-based) |

---

## Build & Deploy

| Item | Detail |
|---|---|
| Build script | `node build.js` (patches AI endpoint, hoists AI_TOOLS, extracts audio engine) |
| Deploy command | `node build.js --deploy` |
| Netlify site ID (app) | `a31584df-8099-4292-8607-89a982ea9cf4` |
| Netlify site ID (marketing) | `8ef78a81-8810-443a-a033-21f625c39812` |
| Auth token | `SCRUBBED_NETLIFY_AUTH_TOKEN` |
| Output directory | `netlify/` |
| App URL | `https://app.carmencowriter.com` |
| Marketing URL | `https://carmencowriter.com` |
| Marketing deploy | `cd ~/carmen-marketing && bash deploy.sh` |

---

## Netlify Environment Variables

### App site (`app.carmencowriter.com`)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API authentication |
| `FIREBASE_API_KEY` | Firebase REST API calls (token verification, Firestore writes) |
| `STRIPE_SECRET_KEY` | Stripe API authentication |
| `STRIPE_PRICE_CREATOR` | Stripe price ID for Creator plan |
| `STRIPE_PRICE_PRO` | Stripe price ID for Pro plan |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |

### Marketing site (`carmencowriter.com`)

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API (for `create-checkout` function) |
| `STRIPE_PRICE_CREATOR` | Stripe price ID for Creator plan |
| `STRIPE_PRICE_PRO` | Stripe price ID for Pro plan |

---

## Known Limitations & Future Considerations

1. **Audio not synced** — backing tracks and vocal takes are browser-local (IndexedDB). No cross-device access. Cloud audio sync would require Firebase Storage or S3.
2. **Single-file architecture** — the entire app is one ~445KB HTML file. This works but makes team collaboration harder as complexity grows.
3. **No offline support** — requires network for auth, AI, and Firestore sync. A service worker could enable offline writing.
4. **Translation store** — uses a separate Firebase project (`charlotte-dashboard`), a legacy artifact that should eventually be consolidated into the main project.
5. **Metronome BPM** — currently requires manual entry or reads from the song's tempo chip. Auto-BPM detection from an imported backing track (tap tempo or onset detection) would improve UX.
6. **Drime API dependency** — French rhymes depend on a third-party academic project (drime.a3nm.net). If it goes down, French rhymes fall back to nothing. Consider caching popular results or building a local fallback.
