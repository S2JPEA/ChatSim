# AI Coding Tool Instructions

## Purpose & user flow
- Static, client-only chat widget that lets two people connect via a short code (admin/agent pair) and exchange real-time messages through Firebase Realtime Database.
- Users land on `index.html`, generate a 6-character code, share it, and then join a chat room that mirrors messages for both roles. Admins get extra panels (transcript + typing insights) while agents only see the chat.
- The experience emphasizes a polished UI (see `style.css`), simple code-based auth, typing analytics (WPM, clipboard detection), and lightweight transcript auditing.

## Key files and responsibilities
- `index.html`: single-page layout with landing view, chat container, admin panel, and injected Firebase SDK scripts (compat build). All DOM IDs in this file are referenced directly in `app.js`.
- `style.css`: gradient background, responsive layout, animations, and utility classes used by both landing and chat states. Preserve rounded cards, gradients, and hidden/admin states if styling changes are needed.
- `app.js`: application logic (entry point described below). Everything is client-side; there is no bundler or build step.

## Architecture highlights (see `app.js`)
1. **Startup/Config** – initializes Firebase with the `firebaseConfig` object at the top (must be replaced with your own project credentials before connecting). If Firebase fails to load, the user is alerted.
2. **Code management** – `buildAccessCodes`/`parseAccessCode` append/prepend `ADM-` / `AGT-` prefixes. `generateBtn` uses `generateChatCode` to seed `chatCodeInput` and display shareable codes.
3. **Joining/Leaving** – `joinChat` normalizes codes, sets `currentRole`, clears previous listeners, toggles UI, and calls `listenForMessages`. `leaveChat` tears down listeners, resets role/text, and shrinks UI state back to landing.
4. **Realtime messaging** – `sendMessage` pushes to `chats/<code>/messages`. Messages are rendered by `displayMessage`, which also tracks reply latency, role badges, timeline, and metrics for admins.
5. **Admin transcript** – `recordTranscriptEntry` runs per agent message, analyses spelling/grammar with `analyzeTextForIssues` (dictionary + heuristic fallbacks), highlights flagged words, and renders entries in `#transcript-list`. Only admins see this panel.
6. **Typing metrics** – `typingSession` state tracks duration, characters, clipboard usage, and idle detection (`handleTypingInput`, `broadcastTypingStatus`). Admins monitor agents via `setupStatusTracking` → `updateTypingInsights` (typing, speed, clipboard badge).
7. **Utilities** – `cleanupOldChats` runs once on load to delete chats older than 24 hours, `escapeHtml` prevents injection, `formatDuration`/`formatTimestamp` keep displays readable.

## Setup & run instructions
1. Provide valid Firebase config in `app.js` before running (replace the placeholder object and ensure Realtime Database is enabled in test mode for development).
2. Start a lightweight static server at repo root (e.g., `python3 -m http.server 8000` or `npx http-server`). Opening `index.html` directly still works for read-only testing but remote Firebase connections require HTTP/HTTPS origin matching.
3. Open `http://localhost:8000` (or whichever port) in a modern browser; the Firebase SDK scripts are loaded via CDN so no additional installs are needed.

## Firebase data structure
```
chats/
  <CODE>/
    messages/
      <messageId>: { text, userId, userRole, timestamp, metrics }
    status/
      <userId>: { role, typing, typingSpeedWpm, clipboardUsed, lastUpdate }
```
Admins should only render transcripts for chats they are joined to.

## Editing guidance
- Maintain single-file simplicity: avoid adding build tooling; keep logic in `app.js` and layout/style in their respective files.
- When touching `style.css`, follow existing gradients/rounded cards patterns. Admin panel uses `.hidden` and `.admin-mode` classes—do not remove unless replacing the behavior everywhere in `updateRoleUI`.
- Any changes to DOM IDs (e.g., `#messages`, `#transcript-list`) must stay synchronized with `app.js` selectors; the script assumes these are present.
- If you adjust typing analytics, ensure `typingSession` still tracks `startedAt`, `charCount`, `clipboardUsed`, and that `broadcastTypingStatus` is invoked on key events (input/paste/clipboard shortcuts).
- The spelling analyzer prefers the Australian dictionary (`AU_DICTIONARY_URL`). If that list is updated or replaced, keep the loading logic (`loadAustralianDictionary`) so admins continue to get better highlights, and ensure `dictionaryLoaded`/`dictionaryLoading` flags remain accurate.
- Keep alerting simple—`alert` is used for invalid codes or failed messages. Replacing with custom UIs requires updating every place `alert` is called.

## Observability & future changes
- Admin transcripts include `typingSpeedWpm`, `typed duration`, `clipboard` badges. If altering metrics, update `renderTranscriptEntry`, `renderIssueNotes`, and `exportTranscript` format.
- `cleanupOldChats` runs once on load. If you remove it, stale rooms will persist; if you turn it into a cron job, ensure the removal logic still guards against missing timestamps.
- To add new features (e.g., emoji picker, AI analysis), expand `messages` data shape and ensure compatibility with both `displayMessage` (UI) and `recordTranscriptEntry` (admin view).
- Tests are manual: use two browser windows with matching codes to verify real-time sync. Admin view requires the `ADM-` prefixed code; transcripts only appear on that role.

## Tips for AI tooling
- Focus edits on matched DOM IDs/JS functions—no hidden frameworks exist, so a global search for `currentChatCode` or `typingSession` yields main flows.
- When adding data to Firebase, keep the schema symmetrical between agent/admin (message payload + metrics). Avoid restructuring without migrating UI logic (transcript, message display, typing cards all depend on metrics fields currently named `typingSpeedWpm`, `clipboardUsed`).
- The UI expects specific role strings (`admin`/`agent`). Changing them will require sweeping updates to `updateRoleUI`, transcript rendering, and status monitoring.
- Document new props or state in this instructions file so future Codex sessions have the same mental map.
