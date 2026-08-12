# Family Feud — Autonomous Build Spec

> **You are Claude Code, running autonomously with permissions skipped.** Read this
> entire file, then build the project end to end **without stopping to ask
> questions**. The user has started you and walked away. Make reasonable decisions
> on anything ambiguous and keep going. The only hard rule you must never break is
> the commit rule below.

---

## 0. Autonomy & guardrails (read first)

- **Run start to finish with no check-ins.** Do not pause for confirmation. If a
  choice is ambiguous, pick the option that best matches this spec and proceed.
- **DO NOT COMMIT and DO NOT PUSH.** Build all files into the current repo
  directory, but never run `git commit`, `git push`, or `git add` on the user's
  behalf. The user will review and commit everything themselves. Leave the working
  tree dirty/uncommitted. This is non-negotiable.
- **No GitHub auth is needed.** The reference repos are public — clone or read them
  over HTTPS. You are not committing, so you never need the user's credentials.
- **Never freeze.** If something is blocked (a repo won't clone, a source is
  unreachable), note it in `BUILD-NOTES.md` and continue with what you *can* do.
  A partial, running game is far better than a stalled build.
- **Leave a trail.** As you go, append short notes to `BUILD-NOTES.md`: decisions
  made, what you took from each repo, anything the user should double-check.

## 1. Preflight

Before building, quickly verify and record results in `BUILD-NOTES.md`:

1. Internet access works and you can reach `github.com` and `codepen.io`.
2. `git` is available (if not, fetch raw files over HTTPS instead).
3. You can write freely into the current directory.

If any check fails, note it and continue with whatever is available.

## 2. Mission

Build a **fully authentic, fully offline Family Feud game** for the user to host at
family dinners. It must **look, sound, and behave like the real TV show**. The user
is the **host**: they run everything from their laptop while the family watches a
second screen (TV via extended display / screen share).

Best-case outcome: the user returns to a **complete, playable game** — authentic
board, working sounds, and a **library of ready-to-play games** already filled in —
with **nothing left to do**. Build toward that.

## 3. Reference repos — READ THE CODE, then decide

Two public projects are your references. **Actually clone and read their source** —
do not judge by their READMEs. Compare their real implementations against this spec
and take whatever aligns best.

- **`timlohnes/familyfeud`** — <https://github.com/timlohnes/familyfeud>
  Plain HTML/JS. Uses the **MacEvelly CodePen board** (the authentic blue flip
  board) and adds an admin panel that separates host operations from the audience
  view. **Strongest on authentic look + simplicity.**
- **MacEvelly CodePen** (the underlying board) — <https://codepen.io/MacEvelly/pen/rLWeYP>
  The recognizable realistic blue board with flip animation. This is the visual
  gold standard.
- **`joshzcold/Friendly-Feud`** — <https://github.com/joshzcold/Friendly-Feud>
  Next.js + React + Go backend. **Too heavy for our offline goal — do NOT bring in
  its backend.** But it has the **best logic ideas**: a clean admin/audience split,
  a game creator, and a **point-value generator** (`scripts/get_points`) that
  fabricates realistic point spreads from bare questions. Mine it for logic and
  reuse ideas, not infrastructure.

**Decision logic (do this from the actual code):**
- If `timlohnes` + MacEvelly give the more authentic board and simpler structure —
  **build on that as the base** (expected default).
- Where `Friendly-Feud`'s code has cleaner, working logic that matches this spec
  (host/audience separation, game-creation, point generation) — **port those ideas
  in** rather than reinventing them.
- **Wherever solid working logic already exists and matches this design, keep it.**
  Don't rebuild what already works. Reinvent only what doesn't fit.
- Record in `BUILD-NOTES.md` what you took from each repo and why.

## 4. Architecture & tech constraints

- **100% offline. No server, no backend, no build step.** It must run by opening a
  file (or a trivial `python -m http.server` at most, only if a browser blocks
  local audio/JSON loading — if so, document the one command in the README).
- **Plain HTML + CSS + vanilla JS** (jQuery is fine if the base board uses it).
  No Next, no React, no Go, no database.
- **Two synchronized views:**
  - **Host view** (user's laptop): shows **all answers**, point values, and every
    control. Clear, hard to misclick, unambiguous.
  - **Audience view** (TV via extended display): the **classic hidden board** —
    concealed slots that flip to reveal, strikes, scores, team names. No spoilers.
  - Keep the two views in sync locally (e.g. same page in two windows sharing state
    via `BroadcastChannel`/`localStorage`, or an audience window opened by the host
    view). Pick whatever is simplest and reliable **offline**.
- **Host-friendliness is a top priority.** The host must never be able to reveal the
  wrong thing by accident. Big, labeled controls; clear current-state indicator.

## 5. Game flow, states & DETERMINISTIC audio

The app is **state-aware** and walks through a real episode. **The host controls
game logic**; the app controls **presentation and sound**. When the host advances a
stage, the app **automatically fires the correct sound** — the host never hunts for
a sound button and can't play the wrong cue.

Stages (in order), each with its own audio cue:
1. **Show open** → theme music.
2. **Face-off** → face-off/tension cue; then correct **ding** or wrong **buzzer**
   on the buzz-in.
3. **Play or pass** → host decides which family plays or passes.
4. **Normal round** → board play: **ding** on each correct reveal, **strike buzzer**
   on each X; three strikes → steal.
5. **Steal** → host decides success/fail and awards the bank accordingly.
6. **Round transition** → transition sting between rounds.
7. **Fast Money** → its own faster, higher-pressure feel; see §8.
8. **Win** → win sound.

Keep sound **on rails** (tied to stage transitions) while all **decisions stay
manual** (host buttons). The app must **never auto-decide game logic** — only
presentation and audio are automatic.

## 6. Host controls (all manual, per stage)

The host must be able to, via clear buttons:
- **Enter team names** at game start (dynamic — whatever each family calls
  themselves). These populate the scoreboard.
- Mark **who buzzed in first** at the face-off; choose **play or pass**.
- **Reveal each answer** individually (fires ding + flip on the audience board).
- **Add strikes (X)** — the app shows the big red X on the audience view and fires
  the buzzer.
- **Award/adjust points** and assign the round bank to the correct team.
- Trigger and resolve the **steal** (success/fail).
- **Advance** to the next stage; **reset** to load a new game (see §9).
- A visible **current-stage indicator** so the host always knows where they are.

## 7. Scoring rules (standard Family Feud)

Implement the real rules so the host just clicks:
- Revealed answers add their point values to the **round bank**.
- The controlling family banks the round's points if they clear the board or if the
  other family **fails the steal**; the stealing family banks the bank if the
  **steal succeeds**.
- Track and display **cumulative team scores** on the master scoreboard.
- Support **round multipliers** if the data provides them (e.g. double round).
- All point movement is host-confirmed — the app suggests, the host commits.

## 8. Fast Money (required)

- Two-player fast-money round with the classic feel: faster cue, countdown vibe,
  the reveal-then-score sequence, and the target (traditionally 200) to win.
- Host enters/reveals answers and points for each fast-money question and the app
  tallies the total against the target, with the ding/buzzer/duplicate cues as
  appropriate. Match real-show behavior as closely as the offline format allows.

## 9. Question/answer data format (local, dead-simple to edit)

Games live in **local files** the user can edit in any text editor. Use a clean
**JSON** format (one file per game, in a `games/` folder). Make it obvious and
copy-paste friendly so the user can watch a Steve Harvey clip and type answers +
the on-screen numbers straight in. Suggested shape:

```json
{
  "title": "Game 1 — Classic",
  "rounds": [
    {
      "question": "Name something you'd find in a refrigerator.",
      "multiplier": 1,
      "answers": [
        { "text": "Milk", "points": 30 },
        { "text": "Eggs", "points": 22 },
        { "text": "Leftovers", "points": 15 }
      ]
    }
  ],
  "fast_money": {
    "target": 200,
    "questions": [
      {
        "question": "Name a fruit that is yellow.",
        "answers": [ { "text": "Banana", "points": 58 } ]
      }
    ]
  }
}
```

- Up to **8 answers** per normal round.
- If a game has questions but no point values, **generate realistic point spreads**
  (borrow the logic from `Friendly-Feud`'s point generator).
- **Reset loads a new game**: the host picks any file in `games/` to start fresh
  with new team names and new questions (main rounds + fast money).

## 10. Sound assets

Create a **`sounds/` folder** with **clearly named files**, one per cue:
`theme`, `survey-says`, `correct-ding`, `strike-buzzer`, `reveal`, `face-off`,
`duplicate`, `win` (plus any transition sting you use).

Rules:
1. **First, harvest sounds from the reference repos.** If a repo (especially the one
   with the better UI) ships usable sound effects, **wire those in as the real
   working audio** so the game has authentic sound out of the box with **no external
   downloads**. Name them to match the cue names above.
2. **Only where a good sound isn't available**, drop in a clearly named **placeholder**
   file (a short silent/beep clip is fine) so the app is fully wired and runnable.
3. Keep every sound file **easily swappable**: the user will later hand you a real
   MP3 from their Downloads and say *"use this for the strike buzzer"* — you'll drop
   it into `sounds/`, rename it to the matching cue, and it just works.
4. At the end, **print a sound guide** (in `BUILD-NOTES.md` and the README) listing
   each cue, which file currently fills it, and whether it's a real harvested sound
   or a placeholder to replace.

## 11. Visual authenticity

- **Do not invent the set from scratch.** Base the look on the MacEvelly board so it
  reads as the real show: the deep-blue set, the numbered answer slots, and the
  **flip-to-reveal animation**.
- Match the **Family Feud font** as closely as possible (bold, condensed, all-caps
  style). Getting the font close is what pushes it from "good" to "uncanny."
- The **big red X** strike overlay must look right on the audience view.
- Design so static parts read as authentic and only the dynamic elements (flipping
  cells, strikes, scores) are live.

## 12. FINAL STEP — build a game library

**After the app is built and working**, populate `games/` with as many complete,
ready-to-play games as you can find **easily**:
1. **First, pull every usable game** already present in the reference repos.
2. **Then research popular, genuinely fun Family Feud rounds** on the public web and
   fill in real questions + answers + point values.
3. Produce **fully filled-out games** in the JSON format above — main rounds **and**
   a fast-money set each.
4. **Keep going while it's easy.** Soft ceiling of **~30 games**, but **do not
   strain** to hit it and **do not pad with weak content**. Quality and ease over
   quantity — stop when good sources dry up.
5. Name them clearly (`games/01-classic.json`, etc.) and list them in the README so
   the user can browse and pick favorites.

## 13. Deliverables checklist

When done, the repo should contain:
- [ ] A runnable offline app (host view + audience view) built on the authentic board.
- [ ] Deterministic stage-based audio; manual host controls for all game logic.
- [ ] Full show: face-off, normal rounds, steals, scoring, **fast money**, reset.
- [ ] Dynamic host-entered team names on the scoreboard.
- [ ] `sounds/` with real harvested audio where possible, clearly named placeholders
      otherwise, all swappable.
- [ ] `games/` populated with a library of ready-to-play games (up to ~30).
- [ ] `README.md`: how to run offline, how to set up the two-screen host/audience
      layout, how to add a new game, and the **sound guide**.
- [ ] `BUILD-NOTES.md`: what you took from each repo, decisions, and anything the
      user should double-check.
- [ ] **No commits. No pushes.** Working tree left for the user to review.

**Now build it, end to end, autonomously. Do not stop to ask. Do not commit.**
