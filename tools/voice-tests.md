# Voice-command match suite (run against window.__matchVoiceCommand)

Official commands: NEXT / BACK / REPEAT. Matching = lowercase, punctuation
stripped, leading/trailing fillers dropped, then EXACT phrase match —
deliberately NOT word-boundary, so conversational sentences never fire.

Run headless or in the console: each row asserts `__matchVoiceCommand(input) === want`.

| input | want | why |
|---|---|---|
| next | advance | the official advance word |
| Next. | advance | punctuation stripped |
| NEXT | advance | case-insensitive |
| ok next | advance | leading filler dropped |
| please next | advance | leading filler dropped |
| continue | null | REMOVED 2026-07-07 — no longer a voice command |
| please continue | null | removal asserted incl. filler form |
| Continue. | null | removal asserted |
| ok continue | null | removal asserted |
| background | null | superstring of "back" never fires |
| continental | null | superstring guard |
| nextel | null | superstring of "next" never fires |
| what's next | null | DESIGN RECORD: exact-phrase (not word-boundary) — conversational "next" is safe |
| next time I'll add garlic | null | DESIGN RECORD: the kitchen-collision case cannot fire |
| the next time | null | DESIGN RECORD |
| back | back | unchanged |
| go back | back | unchanged |
| repeat | repeat | unchanged |
| say again | repeat | unchanged |
| okay repeat | repeat | filler + unchanged |

Last full run: 2026-07-07 — 20/20 PASS (headless, live matcher).
Lifecycle invariants (700ms echo guard, voice+tap idempotence, mic-after-
voice sequencing) are structural and re-verified at every checkpoint E2E.
