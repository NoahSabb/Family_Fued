#!/usr/bin/env python3
"""Regenerate GAMES-CATALOG.md — a one-file overview of every round in every game.
Run from the project folder after adding or editing games:  python3 make-catalog.py"""
import json
from pathlib import Path

gdir = Path(__file__).parent / 'games'
m = json.loads((gdir / 'manifest.json').read_text())
out = ['# Games Catalog — every round in every game', '',
       'Auto-generated overview so you can skim the whole library and pick favorites.',
       'Each answer is shown as `text (points)`. Regenerate after editing games with:',
       '`python3 make-catalog.py`', '']

for g in m['games']:
    d = json.loads((gdir / g['file']).read_text())
    out.append(f"## {d['title']}  ·  `games/{g['file']}`")
    out.append('')
    for i, r in enumerate(d['rounds']):
        mult = r.get('multiplier', 1)
        lab = f"Round {i + 1}" + {2: ' (double)', 3: ' (triple)'}.get(mult, '')
        ans = ' · '.join(f"{a['text']} ({a['points']})" for a in r['answers'])
        out.append(f"- **{lab}:** {r['question']}")
        out.append(f"  - {ans}")
    fm = d.get('fast_money')
    if fm:
        out.append(f"- **Fast Money** (target {fm['target']}):")
        for q in fm['questions']:
            top = q['answers'][0]
            out.append(f"  - {q['question']}  — top answer: {top['text']} ({top['points']})")
    out.append('')

(Path(__file__).parent / 'GAMES-CATALOG.md').write_text('\n'.join(out) + '\n')
print('wrote GAMES-CATALOG.md,', len(m['games']), 'games')
