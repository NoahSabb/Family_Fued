# Family Feud — Home Edition (fully offline)

A faithful, fully offline Family Feud party game for hosting at family dinners.
You (the host) run everything from the laptop; the family watches the classic
blue flip-board on a second screen. No internet, no server, no install.

Board look based on the [MacEvelly CodePen](https://codepen.io/MacEvelly/pen/rLWeYP)
(via [timlohnes/familyfeud](https://github.com/timlohnes/familyfeud)); logic ideas
from [joshzcold/Friendly-Feud](https://github.com/joshzcold/Friendly-Feud).

---

## Quick start

**Easiest (macOS):** double-click **`start.command`**. It starts a tiny local
server and opens the host panel. (First time, you may need to right-click →
Open, or allow it in System Settings → Privacy & Security.)

**Or by hand:** run this in the project folder, then open the printed URL:

```sh
python3 -m http.server 8765
# then browse to http://localhost:8765/
```

**Or with no server at all:** open `index.html` directly in your browser.
Everything works except the game *list* (browsers block pages opened from disk
from reading local JSON) — use the **“Load a game file (.json)…”** button and
pick any file from `games/` instead.

## Two-screen setup (host + TV)

1. Connect the TV (HDMI or AirPlay) in **extended display** mode, not mirroring.
2. Open the host panel and click **“Open audience window.”**
3. Drag the audience window onto the TV screen.
4. **Click the audience window once** — this enables sound and goes fullscreen.
   The header shows **“Audience window: connected ✓”** when you're set.
5. Sound plays from the audience window; if the TV has no speakers, sound
   automatically comes from the laptop when the audience window isn't connected.

## Running the show

The host panel walks you through a real episode, top to bottom. The **stage
indicator** (top of the screen) always shows where you are, and every stage
change fires the right sound automatically — you never pick a sound, and you
can never reveal something by accident (the audience only ever sees what you
explicitly reveal).

1. **Setup** — pick a game, type the two family names, *Start the show* (theme plays).
2. **Face-off** — read the question aloud. Reveal answers the players give;
   wrong guesses get the buzzer (no strike during face-offs). Click who won.
3. **Play or pass** — the winning family chooses.
4. **Round play** — reveal correct answers (ding + flip), click **STRIKE** for
   misses (big red X + buzzer). Three strikes moves to the steal automatically.
5. **Steal** — one guess for the other family. If it's on the board, reveal it
   first, then click *Steal SUCCEEDED* (bank goes to them) or *FAILED*.
6. **Round over** — award the bank (buttons on the right suggest it, you
   confirm), reveal any leftover answers, then *Next round*. Rounds 3 and 4 are
   **double** and **triple** points — the board shows the multiplier.
7. **Fast Money** — pick the team, send Player 2 out of earshot, start the
   20-second clock (25 for Player 2). Record each answer by clicking the
   matching survey answer, or type their exact words with a point value.
   Duplicate answers buzz automatically. Then run the **Big Reveal**: answer,
   points, answer, points — 200 points wins (gold flash + applause).
8. **Winner** — *Declare winner* shows the champion screen with the final score.
9. **New game (reset)** — loads a fresh game file for another round of feuding.

Scores are always editable from the right-hand panel — the app suggests, you
commit. Nothing moves points without a click from you.

## The games library

`games/` ships with **33 ready-to-play games** — each with 4 main rounds
(single, single, double, triple) and a 5-question Fast Money — built from
**1,977 real Family Feud survey questions** (harvested from the
timlohnes/familyfeud repo) and curated for family-friendliness. Browse the
list in the host panel's game picker, or open `games/manifest.json`.

### Adding your own game

Create `games/my-game.json` (copy any existing file as a template):

```json
{
  "title": "Game 29 — Our Family Classics",
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

- Up to **8 answers** per round; they're sorted by points automatically.
- `multiplier` of 2 or 3 makes a double/triple round (shown on the board).
- **Leave `points` out entirely and the app generates a realistic spread**
  (top answer 40–60, each next ≈ two-thirds of the previous).
- Add it to `games/manifest.json` to make it show in the picker:
  `{ "file": "my-game.json", "title": "Game 29 — Our Family Classics" }`
  — or skip the manifest and load it with the file-picker button.

Watch any Family Feud clip, pause on the board, and type the answers and
numbers straight in — that's the intended workflow.

## Sound guide

All cues live in `sounds/`, one file per cue, fired automatically by stage
changes. **To swap any sound: drop your MP3/WAV into `sounds/` with the same
name** (or edit the map at the top of `js/sounds.js`).

| Cue | File | When it plays | Source |
|---|---|---|---|
| Theme | `theme.mp3` | Show open, winner screen | harvested (timlohnes `ff_open.mp3`) |
| Survey says | `survey-says.wav` | Bank awarded to a team | harvested (timlohnes `ff-bankroll.wav`) |
| Correct ding | `correct-ding.mp3` | Correct answer revealed | harvested (Friendly-Feud `good-answer.mp3`) |
| Reveal | `reveal.wav` | Non-scoring reveals (cleanup flips) | harvested (timlohnes `ff-clang.wav`) |
| Strike buzzer | `strike-buzzer.wav` | Strikes, wrong answers, time up | harvested (timlohnes `ff-strike.wav`) |
| Duplicate | `duplicate.mp3` | Fast Money duplicate answer | harvested (Friendly-Feud) |
| Face-off | `face-off.mp3` | Start of each face-off | harvested (timlohnes `dun.mp3`) |
| Round transition | `round-transition.mp3` | Between rounds, into Fast Money | harvested (timlohnes `bonus.mp3`) |
| FM reveal | `fm-reveal.mp3` | Fast Money answer text flips | harvested (Friendly-Feud) |
| Clock | `clock.mp3` | Fast Money countdown (loops) | harvested (timlohnes `ticking_clock_10sec.mp3`) |
| Win | `win.mp3` | Winner declared, Fast Money target hit | harvested (timlohnes `applause.mp3`) |

Every cue is a real harvested sound — **no placeholders**. A couple of
mappings are judgment calls (see `BUILD-NOTES.md`); swap freely.

## Files

```
index.html      host panel (open this)
audience.html   the board (opened by the host panel)
css/, js/       styles and logic — plain HTML/CSS/JS, no build step
games/          28 game files + manifest.json
sounds/         one file per audio cue (see table above)
assets/         board font (Anton, SIL OFL) + background pattern
start.command   double-click launcher (macOS)
```

### The 33 games

- **Game 01 — Vroom Vroom** (`games/01-vroom-vroom.json`) — opens with: *Name a vehicle you can recognize by the sound it makes*
- **Game 02 — Spoon Fed** (`games/02-spoon-fed.json`) — opens with: *Name a fruit you eat with a spoon*
- **Game 03 — House Keys** (`games/03-house-keys.json`) — opens with: *Name someone who has a key to your home*
- **Game 04 — Dog Toys** (`games/04-dog-toys.json`) — opens with: *Name something dogs like to play with*
- **Game 05 — Live Music** (`games/05-live-music.json`) — opens with: *Name a place where you often see a band performing*
- **Game 06 — Scary Sounds** (`games/06-scary-sounds.json`) — opens with: *Name a sound that has always frightened you*
- **Game 07 — Deadly Bites** (`games/07-deadly-bites.json`) — opens with: *Name an animal that can kill with its bite*
- **Game 08 — Party Time** (`games/08-party-time.json`) — opens with: *Name something that happens at every child's birthday party*
- **Game 09 — Holy Titles** (`games/09-holy-titles.json`) — opens with: *Give me another name for clergyman*
- **Game 10 — Crunch Time** (`games/10-crunch-time.json`) — opens with: *Name a crunchy food*
- **Game 11 — Sticker Shock** (`games/11-sticker-shock.json`) — opens with: *Name something comfortable to wear that was once cheap but now isn't*
- **Game 12 — On the Rise** (`games/12-on-the-rise.json`) — opens with: *Name something that rises, besides the sun and the moon*
- **Game 13 — Weeknight Dinners** (`games/13-weeknight-dinners.json`) — opens with: *Name a dish you serve your family at least once a week*
- **Game 14 — Tough Jobs** (`games/14-tough-jobs.json`) — opens with: *Name an occupation in which you think there's a large divorce rate*
- **Game 15 — Stocking Stuffers** (`games/15-stocking-stuffers.json`) — opens with: *Name something you find in your Christmas stocking*
- **Game 16 — Memory Lane** (`games/16-memory-lane.json`) — opens with: *Name something besides an old diary that would bring back memories*
- **Game 17 — Feel Good** (`games/17-feel-good.json`) — opens with: *Name something that makes people feel better about themselves*
- **Game 18 — Fridge Raiders** (`games/18-fridge-raiders.json`) — opens with: *What might you have two or three different kinds of in your fridge?*
- **Game 19 — Coloring Book** (`games/19-coloring-book.json`) — opens with: *Name an animal in children's coloring books*
- **Game 20 — Mantel Pieces** (`games/20-mantel-pieces.json`) — opens with: *Name something that you often see on a fireplace mantel*
- **Game 21 — Morning Routine** (`games/21-morning-routine.json`) — opens with: *Name something you use in the mornings*
- **Game 22 — Moving Day** (`games/22-moving-day.json`) — opens with: *Name someone you should tell your change of address to when you move*
- **Game 23 — Sharp Objects** (`games/23-sharp-objects.json`) — opens with: *Name something around the house that has blades*
- **Game 24 — Gift Wrapped** (`games/24-gift-wrapped.json`) — opens with: *Name a kind of party where you would be expected to bring a gift*
- **Game 25 — Due Dates** (`games/25-due-dates.json`) — opens with: *If you're short of money, what's the one bill you're sure to pay?*
- **Game 26 — Sports Seasons** (`games/26-sports-seasons.json`) — opens with: *Name a sport with a specific season*
- **Game 27 — Daily Reads** (`games/27-daily-reads.json`) — opens with: *Name something you read every day, without fail*
- **Game 28 — Home Cooking** (`games/28-home-cooking.json`) — opens with: *Name a food you can cook just as well as most restaurants*
- **REAL Game 1** (`games/29-real-game-1.json`) — real-show boards: husband expertise, date-night disasters, grandpa vs. technology; FM incl. Frosty the Snowman's beverage ban.
- **REAL Game 2** (`games/30-real-game-2.json`) — weddings vs. funerals, husband "repairs", the funeral home clearance sale, Santa/Easter Bunny/Tooth Fairy; FM incl. "roller ___".
- **REAL Game 3** (`games/31-real-game-3.json`) — honeymoon contraband, if elephants could fly, wife criticism no-gos, the classic mail-carrier round; FM incl. the viral yellow-fruit board.
- **REAL Game 4** (`games/32-real-game-4.json`) — hair horrors, dog commands from your boss, sharing a bathroom, the "Naked Grandma" burglar question; FM incl. the viral three-letter-animal board.
- **REAL Game 5** (`games/33-real-game-5.json`) — purchases that need wife approval, burglar deterrents, dates gone wrong, the dreaded one-word text; FM incl. "shark ___".
