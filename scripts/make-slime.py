"""Draws the slime, which never walks and writes pets/slime.json.

    python3 scripts/make-slime.py

pets/slime.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. Each frame is a base sprite with a few pixels painted
over it (eyes, mouth, effects), so a pose is a short list of (row, column, letter).
"""

import json
from pathlib import Path

# Bodies, 12x10. The face sits at eye row ER and mouth row MR of each body.
BASE = ['....oooo....', '..oobbbboo..', '.obbbbbbbbo.', '.obwbbbbbbo.', 'obbbbbbbbbbo',
        'obbbbbbbbbbo', 'obbbbbbbbbbo', 'obbbbbbbbbbo', '.oooooooooo.', '............']
SQUISH = ['............', '....oooo....', '..oobbbboo..', '.obwbbbbbbo.', 'obbbbbbbbbbo',
          'obbbbbbbbbbo', 'obbbbbbbbbbo', 'obbbbbbbbbbo', 'oooooooooooo', '............']
TALL = ['...oooooo...', '..obbbbbbo..', '..obbbbbbo..', '.obwbbbbbbo.', '.obbbbbbbbo.',
        '.obbbbbbbbo.', '.obbbbbbbbo.', '.obbbbbbbbo.', '..oooooooo..', '............']
FLAT = ['............', '............', '............', '...oooooo...', '.oobbbbbboo.',
        'obwbbbbbbbbo', 'obbbbbbbbbbo', 'obbbbbbbbbbo', 'oooooooooooo', '............']
ER = {'base': 4, 'squish': 4, 'tall': 4, 'flat': 5}
BODY = {'base': BASE, 'squish': SQUISH, 'tall': TALL, 'flat': FLAT}


def open_(er, s=0): return [(er, 4 + s, 'e'), (er + 1, 4 + s, 'e'), (er, 7 + s, 'e'), (er + 1, 7 + s, 'e')]
def shut(er): return [(er + 1, 4, 'o'), (er + 1, 7, 'o')]
def down(er): return [(er + 1, 4, 'e'), (er + 1, 7, 'e')]
def up(er, s=0): return [(er, 4 + s, 'e'), (er, 7 + s, 'e')]
# ^ ^ set wider apart than open eyes, so the two arcs don't run together
def joy(er): return [(er + 1, 2, 'o'), (er, 3, 'o'), (er + 1, 4, 'o'), (er + 1, 7, 'o'), (er, 8, 'o'), (er + 1, 9, 'o')]
def mouth(mr, s=0): return [(mr, 5 + s, 'o'), (mr, 6 + s, 'o')]
def smile(mr): return [(mr + 1, 5, 'o'), (mr + 1, 6, 'o')]
def omouth(mr): return [(mr, 5, 'o'), (mr, 6, 'o'), (mr + 1, 5, 'o'), (mr + 1, 6, 'o')]
def grin(mr): return [(mr, 3, 'o'), (mr + 1, 4, 'o'), (mr + 1, 5, 'o'), (mr + 1, 6, 'o'), (mr + 1, 7, 'o'), (mr, 8, 'o')]
def frown(mr): return [(mr + 1, 4, 'o'), (mr, 5, 'o'), (mr, 6, 'o'), (mr + 1, 7, 'o')]


def paint(body, px):
    g = [list(r) for r in BODY[body]]
    for r, c, l in px:
        if 0 <= r < len(g) and 0 <= c < len(g[r]):
            g[r][c] = l
    return [''.join(r) for r in g]


def f(body, eyes, mouth_=None, extra=()):
    er = ER[body]
    mr = er + 2
    px = eyes(er) + (mouth_(mr) if mouth_ else []) + list(extra)
    return paint(body, px)


look = lambda s: (lambda er: open_(er, s))
glance_up = lambda s: (lambda er: up(er, s))
small = lambda mr: mouth(mr)
side = lambda mr: mouth(mr, 1)
w = lambda *ps: [(r, c, 'w') for r, c in ps]
t = lambda *ps: [(r, c, 't') for r, c in ps]

# Zz bubbles drift up from its top right, outside the body.
Z1, Z2, Z3 = w((2, 11)), w((1, 10)), w((0, 11))

F = {
    # 4 fps: a frame repeated is a pose held another quarter second.
    'sleeping': [f('base', shut, small)] * 3 + [f('squish', shut, small, Z1)] * 2 + [f('squish', shut, small, Z2)]
                + [f('base', shut, small, Z3)] * 2,
    # a puddle, breathing slow
    'deepSleep': [f('flat', shut, small)] * 3 + [f('flat', shut, small, w((2, 9)))] * 2 + [f('flat', shut, small, w((1, 10), (2, 9)))] * 2
                 + [f('flat', shut, small, w((0, 11), (1, 10)))],
    'waking': [f('tall', open_, omouth)] * 3 + [f('squish', open_, omouth)],
    'idle': [f('base', open_, small)] * 3 + [f('squish', open_, small)],
    'watching': [f('base', down, small)] * 6 + [f('base', lambda er: [(er + 1, 5, 'e'), (er + 1, 8, 'e')], small)] * 2,
    'thinking': [f('base', glance_up(-1), side)] * 2 + [f('base', glance_up(-1), side, w((0, 9)))] * 2
                + [f('base', glance_up(-1), side, w((0, 9), (0, 10)))] * 2 + [f('base', glance_up(-1), side, w((0, 9), (0, 10), (0, 11)))] * 2,
    'typing': [f('base', open_, grin)] * 2 + [f('squish', open_, grin)] * 2,
    # quick jiggle, a frame each
    'running': [f('base', look(1), grin), f('squish', look(1), grin)] * 3,
    'writing': [f('base', down, grin)] * 2 + [f('squish', down, grin)] * 2,
    'reading': [f('base', down, small)],
    'searching': [f('base', look(-1), small)] * 2 + [f('base', open_, small)] * 2 + [f('base', look(1), small)] * 2 + [f('base', open_, small)] * 2,
    # drawn with its agents on the right; the core mirrors it when they are on the left
    'supervising': [f('base', look(1), small)] * 6 + [f('base', open_, small)] * 2,
    # squeezed down and back up
    'compacting': [f('base', shut, small), f('squish', shut, small), f('flat', shut, small), f('flat', shut, small), f('squish', shut, small)],
    'sweating': [f('base', open_, frown, t((r, 11))) for r in (1, 1, 2, 2, 3, 3)],
    'happy': [f('tall', joy, smile)] * 2 + [f('squish', joy, smile)] * 2,
    'sad': [f('squish', open_, frown, t((r, 3))) for r in (6, 6, 7, 7)],
}

V = {
    'thinking': [[f('base', glance_up(1), side)] * 4 + [f('base', glance_up(-1), side)] * 4],
    'idle': [[f('base', look(-1), small)] * 3 + [f('base', look(1), small)] * 3 + [f('squish', open_, small)] * 2],
}

T = {
    # it melts a little as it drifts off
    '*>sleeping': [f('base', open_, small), f('base', down, omouth), f('squish', shut, omouth), f('squish', shut, small)],
    'sleeping>deepSleep': [f('squish', shut, small), f('flat', shut, small)],
    # and pops back up when it wakes
    'sleeping>*': [f('squish', shut, small), f('squish', down, small), f('tall', open_, omouth), f('base', open_, small)],
    'deepSleep>*': [f('flat', shut, small), f('squish', down, small), f('tall', open_, omouth), f('base', open_, small)],
    'deepSleep>waking': [f('flat', shut, small), f('squish', open_, omouth)],
    'happy>sleeping': [f('tall', joy, smile), f('base', joy, smile), f('squish', shut, omouth), f('squish', shut, small)],
}

EYES_OPEN = ['idle', 'thinking', 'supervising', 'searching', 'reading', 'watching']
# its shine slides along the top as it wobbles
SHINE = lambda body, c: paint(body, open_(ER[body]) + mouth(ER[body] + 2) + [(3, 3, 'b'), (3, c, 'w')])
A = {
    'blink': {'frames': [f('base', shut, small)], 'moods': EYES_OPEN, 'every': [2, 6]},
    'blinkTwice': {'frames': [f('base', shut, small), f('base', open_, small), f('base', shut, small)], 'moods': EYES_OPEN, 'every': [9, 20]},
    'blinkGrin': {'frames': [f('base', shut, grin)], 'moods': ['typing', 'writing'], 'every': [2, 6]},
    'blinkFrown': {'frames': [f('base', shut, frown)], 'moods': ['sweating'], 'every': [2, 5]},
    'wobble': {'frames': [f('squish', open_, small), f('tall', open_, small), f('squish', open_, small), f('base', open_, small)],
               'moods': ['idle', 'supervising'], 'every': [7, 16]},
    'shine': {'frames': [SHINE('base', 4), SHINE('base', 5), SHINE('base', 6)], 'moods': ['idle', 'thinking'], 'every': [10, 24]},
    'hop': {'frames': [f('squish', open_, small), f('tall', open_, omouth), f('tall', open_, omouth), f('squish', open_, small)],
            'moods': ['idle'], 'every': [14, 30]},
    'idleYawn': {'frames': [f('base', open_, omouth), f('base', shut, omouth), f('squish', shut, omouth), f('base', open_, small)],
                 'moods': ['idle'], 'every': [20, 45]},
    'bubblePop': {'frames': [f('squish', shut, small, w((0, 10), (0, 11), (1, 10), (1, 11))), f('squish', shut, small, w((0, 9), (0, 11)))],
                  'moods': ['sleeping'], 'every': [12, 30]},
    'dreamJiggle': {'frames': [f('flat', shut, small), f('squish', shut, small), f('flat', shut, small)], 'moods': ['deepSleep'], 'every': [15, 40]},
}

MINI = ['..oooo..', '.obbbbo.', 'obbbbbbo', 'obbbbbbo', '.oooooo.', '........']
MINI_SQ = ['........', '..oooo..', 'obbbbbbo', 'obbbbbbo', 'oooooooo', '........']


def mini(base, px):
    g = [list(r) for r in base]
    for r, c, l in px:
        g[r][c] = l
    return [''.join(r) for r in g]


me = lambda r: [(r, 2, 'e'), (r, 5, 'e')]
pack = {
    '$schema': 'https://raw.githubusercontent.com/HenriqueSchroeder/pixel-pets/main/schema/pet.schema.json',
    'name': 'slime', 'author': 'Henrique Schroeder',
    'description': 'A green slime that bounces in place, melts into a puddle when it sleeps deep, and never walks.',
    'palette': {'o': '#14381c', 'b': '#5fd068', 'w': '#d9ffd9', 'e': '#0b1f0f', 't': '#5ab4ff'},
    'fps': 4,
    'main': {
        'moods': F,
        'variants': V,
        'transitions': T,
        'actions': A,
    },
    'mini': {'tint': 'b', 'moods': {
        'working': [mini(MINI, me(2))] * 2 + [mini(MINI_SQ, me(2))] * 2,
        'happy': [mini(MINI, [(2, 2, 'o'), (2, 5, 'o')])] * 2 + [mini(MINI_SQ, [(2, 2, 'o'), (2, 5, 'o')])] * 2,
        'sad': [mini(MINI_SQ, me(2) + [(3, 2, 't')])] * 2 + [mini(MINI_SQ, me(2) + [(3, 1, 't')])] * 2,
    }},
}
for m, fr in F.items():
    assert len(fr) <= 8, (m, len(fr))
out = Path(__file__).resolve().parent.parent / 'pets' / 'slime.json'
out.write_text(json.dumps(pack, indent=2) + '\n')
print(f'{out}: written')
