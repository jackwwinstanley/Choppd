# Choppd subagents (`.claude/agents/`)

Project-scoped, git-tracked agents. Each is a Markdown file with YAML frontmatter
(`name`, `description` with "use when…" triggers so the main agent auto-delegates,
`tools`, `model`). All are **read-only reporters** — they surface findings with file:line
references and NEVER edit code or silently fix anything (the honesty contract is in every
prompt). Thirteen agents, in two layers.

> One more agent lives at the **user** level (`~/.claude/agents/recipe-visualizer.md`) — it
> drives Chrome to render recipe images on Gemini. It's not in this project dir and isn't
> counted among the thirteen.

## Layer 1 — authoring-time recipe checkers (run at BUILD time, on one draft/recipe)

Spawn these when authoring or changing a single recipe, before it ships.

| agent | model | when it runs |
|---|---|---|
| `format-checker` | inherit | Validate a recipe against the RECIPE_FORMAT.md schema (fields, scan metadata, TTS coverage, image slots, one-screen budget). |
| `heat-physics-checker` | inherit | Assert the stove-physics rules (electric>gas, unreachable gates, off-heat explicit + physical, rests, burn-prone aromatics). |
| `timing-auditor` | inherit | Reconcile every stated duration against the cue ladder + totals; checkpoint spacing; timer patterns. |
| `cross-referee` | inherit | Ingredient ⇄ step closure both ways, quantity/equivalence agreement, optional-flag consistency, injectAmounts hazards. |
| `copy-checker` | inherit | Editorial: sensory-first gates, off-state fix directions, TTS constraints, checkpoint-copy completeness, reading level. |
| `beginner-red-team` | inherit | Adversarial worst-case first-timer walkthrough (electric coil, lingers at checkpoints, loud kitchen, opt paths). |
| `voice-checker` | inherit | ADVISORY brand-voice notes (register, roast ledger). Never PASS/FAIL, never blocks — the founder owns every note. |

## Layer 2 — operations layer (catalog-wide sweeps, verification, cost, demand, ops)

The retroactive / systemic / operational checks the per-recipe checkers can't do.

| agent | model | when it runs |
|---|---|---|
| `catalog-rules-sweeper` | sonnet | When a GLOBAL RULE in RECIPE_FORMAT.md is added/changed — sweeps EVERY shipped recipe against that one rule (the retroactive fan-out). Re-reads the doc each run. |
| `verify-runner` | sonnet | After any recipe build/change, before any deploy — runs the scriptable battery (tsc/build, test:match, voice-clip parity, MOCK_AI zero-spend assert) and returns only failures. Flags the browser-only checks for the main agent. |
| `cost-pin-auditor` | haiku | Before any deploy that touches AI call sites — verifies model pins (scan=Sonnet, concepts=Haiku), no dynamic model strings, spend caps, no key leaks. |
| `demand-analyst` | sonnet | Weekly, once real testers land — retention/demand report from scans + ideas + cook events; compares to a project-memory baseline; ends with "Top 3 actions the data supports". Holds honestly when data is thin. |
| `ops-triage` | haiku | On demand and around deploys — read-only prod health pass over SSH (service, journalctl, disk/mem, cert, 5xx, rate limits). Never restarts/edits/deploys; reports "blocked" if SSH is refused. |
| `security-auditor` | sonnet | **Before every prod deploy, after any auth/endpoint/dependency change, and weekly** — audits the stack's defenses (secrets hygiene + git history, npm audit, JWT/admin-route auth, endpoint exposure + rate limits + SQL/XSS, Caddy/RDS/box config, PII deletion coverage). Read-only; never prints a secret value; ends "Deploy-safe: yes/no". Diffs against a project-memory baseline. |

## Conventions

- **Read-only tools** wherever possible (`Read, Grep, Glob`; `Bash` only for running tests /
  read-only ops commands). `demand-analyst` may `Write` — but ONLY its own dated summary into
  project memory, never code.
- Every prompt carries the honesty contract verbatim and ends with a structured report
  format (a pass/fail table + a findings list) so outputs are scannable.
- Restarts, deploys, and code edits are **main-agent-with-founder** actions — no agent here
  does them; they only report that one is needed.
