# BUILD-NOTES — Family Feud autonomous build

Running log of decisions, harvests, and things to double-check. Newest notes at the bottom.

## Preflight (all passed)

- Internet: reachable — github.com (HTTP 200) and codepen.io (HTTP 103/200) both respond.
- git 2.50.1 available. Both reference repos cloned shallowly into the session scratchpad
  (not into this repo — they are references only).
- Write access to the repo directory confirmed.
- Guardrails honored: **no `git add` / `git commit` / `git push` at any point.**

## Recon findings

### timlohnes/familyfeud (base for the board)
- The board is literally the MacEvelly CodePen (`css/style.css` + `js/index.js`,
  jQuery + TweenMax card-flip). The repo re-themed it dark red for a Turkish
  university event; the **original MacEvelly blue gradients are still present in the
  CSS** (overridden lines), so the authentic blue board is recoverable without CodePen.
- Two-window architecture: `panel.html` (admin) opens `game.html` via `window.open`
  and pokes the child DOM directly (`window.opener`). Good idea, fragile execution —
  I rebuilt the same host/audience split on `postMessage` state snapshots instead.
- `sfx/` contains real, usable show sounds (harvested — see sound guide in README).
- `js/FF3.json` contains **1,977 real English Family Feud survey questions with
  point values** (answer arrays of 1–12). This became the main source for the game
  library. (`js/cgr.json` is Turkish-specific — not used.)

### MacEvelly CodePen (visual gold standard)
- The pen's CDN assets are dead: `bgFF.svg` on s.cdpn.io returns S3 AccessDenied, and
  codepen.io serves a Cloudflare challenge page to curl. **Not blocking** — the
  timlohnes copy of the pen's CSS/JS carries the whole look; I recreated the
  oval-pattern board background as a local inline SVG.

### joshzcold/Friendly-Feud (logic ideas only — backend NOT used)
- Ported the **point generator** logic from `scripts/point_generator.rb` /
  `scripts/get_points` into `js/points.js`: top answer gets a random 40–60% of 100,
  each following answer ≈66% of the previous, integer-floored. Used when a game file
  has answers without points.
- Borrowed logic ideas: admin/board page separation, fast-money reveal-text-then-points
  sequence, duplicate-answer handling, strike overlay pattern.
- Its Next.js/React/Go/WebSocket infrastructure was deliberately left behind (spec: 100%
  offline, no build step).
- Harvested its distinct SFX: good-answer, duplicate, fm-answer-reveal.

## Architecture decisions

- **Base**: rebuilt clean on the MacEvelly board look (blue gradients restored from
  the timlohnes CSS). Flip animation re-implemented with CSS 3D transforms, so the
  app has zero JS dependencies (no jQuery/TweenMax).
- **Two views**: `index.html` (host panel — sees everything, controls everything)
  opens `audience.html` via `window.open`. Sync is one-way `postMessage` state
  snapshots plus fx events (sound cues / strike overlay / banners), with
  `BroadcastChannel` as a redundant path. The audience window is a pure renderer:
  it never decides anything.
- **Deterministic audio**: every stage transition fires its cue automatically
  (see `js/sounds.js` cue map). Sounds play on the audience window once it has been
  clicked (browser autoplay rules require one gesture); until then they fall back to
  the host laptop. Host never picks a sound manually — only a Sound Check panel for
  pre-show testing.
- **All game logic manual**: reveals, strikes, face-off winner, play/pass, steal
  outcome, bank awards, score edits, winner declaration — all host buttons. The app
  only automates presentation + audio, plus two purely-presentational conveniences:
  3rd strike advances to the Steal stage, and a cleared board advances to Round Over
  (awarding is still manual).
- **Scoring**: bank = sum of revealed answers × round multiplier (rounds are
  1×/1×/2×/3×). Steal SUCCEEDED awards the bank to the non-controlling team,
  FAILED to the controlling team. Scores are directly editable on the host panel.
- **Fast Money**: team + 2 players chosen by host; 20s/25s clocks with ticking
  sound and on-screen countdown; host records answers by clicking the survey answer
  list (or typing free text + points); duplicate detection buzzes automatically and
  asks for another answer; big reveal is answer-then-points per cell with
  ding/buzzer, win sound at 200+.
- **Games format**: pure JSON per spec (`games/*.json` + `manifest.json`). Browsers
  block `fetch` of local JSON from `file://` pages, so the README documents the
  one-command server (`python3 -m http.server`) and `start.command` double-click
  launcher; a file-picker "Load a game file" button works even on `file://` with no
  server. Missing point values are auto-generated with the ported Friendly-Feud
  point logic.
- **Font**: Anton (SIL OFL, bundled locally at `assets/fonts/anton.woff2`) — closest
  freely-licensed match to the show's bold condensed all-caps style.
- **Preview hook**: `audience.html#state=<base64 JSON>` renders any state statically
  (used for the build's screenshot smoke tests; harmless to keep).

## Sound mapping — judgment calls to double-check by ear

All 11 cues are real harvested sounds (no placeholders). Mappings I'd sanity-check:
- `survey-says.wav` ← timlohnes `ff-bankroll.wav` (used as the "bank awarded" sting).
- `face-off.mp3` ← timlohnes `dun.mp3` (dramatic sting; used at each face-off).
- `round-transition.mp3` ← timlohnes `bonus.mp3`.
If any feels wrong, drop a replacement file with the same name into `sounds/` — no
code changes needed. Unused-but-available extras in the reference repo: `boo.ogg`,
`yeah.ogg`, `beep.ogg`, `ff_dogru.mp3`, Friendly-Feud `try-again.mp3` / `buzzer.wav` /
`title.mp3`.

## Verification done

- `node --check` passes on all JS; DOM id/class cross-check host↔audience passes.
- Headless-Chrome screenshots verified: host panel (setup), audience splash,
  mid-round board (2 revealed answers, strikes, control glow, bank), Fast Money
  reveal board with timer + total. All render correctly.
- All game JSON validated programmatically (shape, multipliers, descending points).

## Game library (games/)

- **Source decision**: the timlohnes repo ships 1,977 real English survey questions
  with authentic point values (`js/FF3.json`) — far better raw material than fresh
  web research, so the library was built from it instead of scraping question sites.
- Pipeline: quality gates (3–8 usable answers, top answer ≥15 pts, sane totals,
  clean text) left 1,932 candidates → deterministically sampled into **28 games**,
  each 4 rounds (multipliers 1,1,2,3; bigger boards in early rounds) + 5 fast-money
  questions, **no question used twice** across the library (252 unique questions).
- A curation pass then reviewed every question: **19 replaced** (7 too adult/awkward
  for a family dinner, 12 badly dated or US-celebrity-specific), **16 typo fixes**
  (wording only — answers and points untouched), and every game hand-retitled
  (e.g. "Game 18 — Fridge Raiders").
- Validated twice (curation pass + independent script): JSON shape, multipliers,
  descending integer points, manifest ↔ files exact match.

## Things the user should double-check

1. **Sound mappings by ear** (see the sound-mapping section above) — especially
   `survey-says.wav` and `face-off.mp3`, which are judgment calls.
2. **Survey data is from the reference repo** (1970s–90s US show era). The obviously
   dated items were swapped out, but expect the occasional retro flavor — part of the
   charm, easy to edit in any text editor.
3. **The theme sound** (`sounds/theme.mp3`, from the reference repo) is ~28s and, like
   all harvested audio, is for private home use only — fine for family dinners, but
   don't redistribute/publish this repo with the sounds included.
4. First run: macOS may require right-click → Open on `start.command`.

## Deliverables checklist (from the spec)

- [x] Runnable offline app: host panel + audience board on the MacEvelly-style board
- [x] Deterministic stage-based audio; every game decision manual
- [x] Full show: face-off, play/pass, rounds, strikes, steals, multipliers, fast money, reset
- [x] Dynamic host-entered team names on the scoreboard
- [x] sounds/ — 11 cues, all real harvested audio, all swappable by filename
- [x] games/ — 28 complete curated games + manifest
- [x] README.md — run/offline instructions, two-screen setup, game format, sound guide, game list
- [x] BUILD-NOTES.md — this file
- [x] No commits, no pushes — working tree left entirely for review

## Note on git state

Per the spec I ran **zero** git commands (no add/commit/push). During the build,
two commits authored as NoahSabb appeared in the repo ("Create feud-build-spec.md",
then "Sounds" at 18:27 covering sounds/ + the early BUILD-NOTES.md + the font) —
presumably you or an auto-commit tool. I left them untouched; everything newer is
sitting uncommitted in the working tree for your review.

## REAL Rounds game (added later, on request)

`games/29-real-rounds.json` — five boards transcribed from fan archives of the
actual show (values as documented there, not generated):
- R1 burglar-deterrent + R3 burglar-hate-to-see: familyfeudinfo.com question
  pages 112227 / 119869 (R3 is the "Naked Grandma" question family).
- R2 profession bitten by a dog (classic mail-carrier round): familyfeudinfo 103643.
- R4 yellow fruit (the viral "Orange!" clip; shown as double points): familyfeudinfo 113646.
- R5 three-letter animal (the viral "Frog!"/"Alligator!" clip; triple): familyfeudinfo 101568.
Caveats: familyfeudinfo is a fan-transcribed database — some of its pages carry
app-rank scores instead of real survey values; these five were picked because their
values look authentic (sums 82–103). The famous "pork ___" board has no documented
values anywhere I could find, so it was left out rather than faked. This game has
no fast_money block (the app hides the Fast Money button for it).

## UPDATE — REAL Rounds replaced by five full REAL games

`29-real-rounds.json` (single 5-round game) was replaced, at the user's request, by
**REAL Games 1–5** (`games/29..33-real-game-*.json`) — five full games, each 4 rounds
(multipliers 1,1,2,3) + 5 fast-money questions, all 45 boards transcribed from the
real show via familyfeudinfo.com. Boards were gathered by three parallel research
passes (embarrassing situations / family & relationships / weird hypotheticals) with
a strict authenticity gate: integer values 1–99, descending, per-board sums 60–105;
app-rank junk (1000/999/998), synonym dumps, and garbage rows were rejected. The five
previously-verified viral boards (yellow fruit, three-letter animal, both burglar
boards, mail carrier) were folded in as anchors. Every board's source URL is listed
in REAL-GAMES-SOURCES.md (repo root); spot-check any board by
visiting its familyfeudinfo question page.

## Fix — Fast Money entry (post-playtest)

Two bugs from the first family playtest: (1) a focus guard meant to protect
typing during the ticking clock also blocked re-renders after button clicks, so
recorded answers never appeared on the host panel (they were recorded, just
invisible); guard now only applies while a text input is focused. (2) The
audience board stayed blank during answer collection; now, like the real show,
each recorded answer's TEXT appears on the TV board immediately (with the reveal
whoosh) and only the POINTS wait for the Big Reveal step.

## Fix — Fast Money cover/recap (post-playtest #2)

Added show-accurate covering: switching to Player 2 automatically covers Player 1's
answers on the TV board, and "Cover Player 1's answers" buttons (in both the entry
and Big Reveal stages) let the host cover/re-reveal at will. In the Big Reveal grid,
"Reveal answer" uncovers an answer (whoosh) and "Reveal points" scores it, one at a
time. "Go to the Big Reveal" is now always visible during Fast Money so the points
step can't be missed.
