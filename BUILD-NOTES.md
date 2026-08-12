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
