"""Draws the capybara and writes pets/capybara.json.

    python3 scripts/make-capybara.py

pets/capybara.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. The capybara is drawn side on and in layers, like the
dragon: its body, its legs (standing, mid-stride or tucked under as it lies down)
and its head, with the eyes, ear, mouth, a visiting bird, an orange and the like
painted over them. It plays at 8 fps and draws no mini pets.
"""

from sprites import SCHEMA, paint, write

W, H = 28, 16
EMPTY = '.' * W


def grid(rows):
    """Rows padded with '.' to the full width; a row too long is a mistake."""
    assert len(rows) == H, len(rows)
    for r in rows:
        assert len(r) <= W, (len(r), r)
    return [r.ljust(W, '.') for r in rows]


# Side on, facing right: a barrel of a body, a big square head, a small round ear
# and short legs. The rows above its head are left for a bird or an orange.
BASE = grid([
    '',
    '',
    '',
    '...................oo',
    '..................ohso',
    '.......oooooooooooo' + 'ss' + 'ooooo',
    '.....oohhhhhhhhhhhshhhhhbbo',
    '....ohhbbbbbbbbbbbsbbbbebbbo',
    '...ohbbbbbbbbbbbbbsbbbbbddeo',
    '...obbbbbsbbbbbbbbsbbbbbdddo',
    '..obbbbbbbbbbbbbbbbsbbbbood' + 'o',
    '..obbbbbbbbsbbbbbbbbsbbbsoo',
    '..osbbbbbbbbbbbbbbbbbsooo',
    '...ossbbbbbbbbbbbbbbsso',
    '....osbbo......osbbo',
    '....ooooo......ooooo',
])

# Its legs: standing, or mid-stride one way or the other (rows 14 and 15).
LEGS = {
    'stand': BASE[14:],
    'reach': grid([''] * 14 + ['.....osbbo....osbbo', '.....ooooo....ooooo'])[14:],
    'pass': grid([''] * 14 + ['...osbbo........osbbo', '...ooooo........ooooo'])[14:],
}

# The eye, a single dark bead, and the lid and brow over it.
OPEN = []
SHUT = [(7, 22, 'o'), (7, 23, 'o')]
HALF = [(6, 22, 's'), (6, 23, 's'), (6, 24, 's')]
UP = [(7, 23, 'b'), (6, 23, 'e')]
DOWN = [(7, 23, 'b'), (8, 23, 'e')]
BACK = [(7, 23, 'b'), (7, 22, 'e')]
WIDE = [(6, 23, 'e'), (6, 24, 'w')]
# ^, content
ZEN = [(7, 22, 'o'), (6, 23, 'o'), (7, 24, 'o'), (7, 23, 'b')]
# a brow pulled down towards its nose
GLARE = [(6, 22, 'o'), (6, 23, 'o'), (7, 24, 'o')]
# a brow raised at the middle, eye low
SAD = [(6, 23, 'o'), (6, 22, 'o'), (7, 23, 'b'), (8, 23, 'e')]

# laid flat: a bump on its head, the outline under it unbroken
EAR_BACK = [(3, 19, '.'), (3, 20, '.'), (4, 20, '.'), (4, 21, '.'), (4, 18, 'o'), (4, 19, 'o'), (5, 19, 'o'), (5, 20, 'o')]
EAR_FLICK = [(3, 19, '.'), (3, 21, 'o'), (4, 18, '.'), (4, 19, 'o'), (4, 21, 'h'), (4, 22, 'o')]
NOSE = [(8, 26, 'd'), (9, 26, 'e')]

# Mouths under its muzzle: chewing, a yawn that bares its big front teeth.
CHEW = [(10, 24, 'p'), (11, 24, 'o')]
YAWN = [(10, 23, 'o'), (10, 24, 'n'), (10, 25, 'n'), (11, 23, 'o'), (11, 24, 'p'), (11, 25, 'p'), (11, 26, 'o'),
        (12, 24, 'o'), (12, 25, 'o')]
FROWN = [(10, 23, 'o'), (11, 23, 'o')]
GRASS = [[(10, 26, 'g'), (11, 26, 'g'), (11, 27, 'g'), (12, 27, 'g')], [(10, 26, 'g'), (11, 26, 'g'), (11, 27, 'g')],
         [(10, 26, 'g'), (11, 26, 'g')], [(10, 26, 'g')]]

# breathing in, its back swells
BREATH = [(4, c, 'o') for c in range(9, 17)] + [(5, c, 'h') for c in range(9, 17)]
# the front leg lifted a row off the ground
PAW = [(15, c, '.') for c in range(15, 20)] + [(14, c, 'o') for c in range(15, 20)]

# its head, ear to chin, without the chest and belly under it
HEAD = ({(r, c) for r in range(3, 10) for c in range(18, 28)} | {(r, c) for r in (10, 11) for c in range(19, 28)}
        | {(12, c) for c in range(22, 28)})


def move_head(g, dy):
    """The head lowered `dy` rows."""
    if not dy:
        return g
    cells = [list(r) for r in g]
    head = [(r, c, g[r][c]) for r, c in HEAD if g[r][c] != '.']
    for r, c, _ in head:
        cells[r][c] = '.'
    for r, c, ch in head:
        if r + dy < H:
            cells[r + dy][c] = ch
    # the body behind its head shows where the head moved off it
    for r in range(6, 10):
        if cells[r][18] == '.':
            cells[r][18] = 'b'
    return [''.join(r) for r in cells]


def shift(g, dx=0, dy=0):
    """The whole frame moved `dx` columns right and `dy` rows down."""
    rows = [EMPTY] * dy + g[:H - dy] if dy > 0 else g[-dy:] + [EMPTY] * -dy if dy < 0 else g
    if dx > 0:
        rows = ['.' * dx + r[:W - dx] for r in rows]
    elif dx < 0:
        rows = [r[-dx:] + '.' * -dx for r in rows]
    return rows


def at(sprite, r, c):
    """`sprite` (rows of letters) as pixels with its top left at (r, c)."""
    return [(r + i, c + j, ch) for i, row in enumerate(sprite) for j, ch in enumerate(row) if ch != '.']


def frame(face=(), legs='stand', breath=False, dy=0, body=(), fx=(), lying=False, up=0, sx=0, sky=()):
    """`face` is painted on the head before it lowers `dy` rows; lying, it sinks
    two rows with its legs tucked under; `fx` is painted after, where it is; `up`
    hops the whole frame up and `sx` jolts it sideways; `sky` stays put."""
    g = BASE[:14] + LEGS[legs]
    g = paint(g, list(face) + (BREATH if breath else []) + list(body))
    g = move_head(g, dy)
    if lying:
        g = [EMPTY, EMPTY] + g[:14]
    g = paint(g, list(fx))
    return paint(shift(g, sx, -up), list(sky))


def lie(face=SHUT, breath=False, fx=(), **kw):
    return frame(face, breath=breath, fx=fx, lying=True, **kw)


BIRD = {
    'sit': ['..yef', 'yyyy.', '.o.o.'],
    'asleep': ['..yyf', 'yyyy.', '.....'],
    'up': ['y.y..', '.yyef', '.....'],
    'down': ['.....', 'yyyef', 'y.y..'],
}
ORANGE = ['..g.', '.ff.', 'ffff', '.qq.']
# on its head, and on its back as it lies asleep
PERCH, NAP_PERCH = (2, 22), (5, 10)


def bird(pose, r, c):
    return at(BIRD[pose], r, c)


def drop(r, c):
    return [(r, c, 't')]


def puff(i):
    """A huff from its nose, drifting off."""
    return [[(6, 27, 'w')], [(5, 27, 'w')], [(4, 27, 'w')], []][i % 4]


ZZ = [[], [(2, 26, 'w')], [(2, 26, 'w'), (1, 27, 'w')], [(1, 27, 'w')]]
SPARKLES = [[(1, 3, 'w'), (3, 12, 'y')], [(2, 4, 'y'), (0, 13, 'w')], [(0, 2, 'w'), (2, 14, 'y')], [(3, 3, 'y'), (1, 12, 'w')]]
SPLASH = [[(4, 2, 't'), (2, 10, 't'), (3, 24, 't'), (13, 0, 't')], [(3, 1, 't'), (1, 11, 't'), (2, 25, 't'), (12, 1, 't')]]


# Blinks live in the loops, one frame in each, so a blink never drops a breath,
# a blade of grass or a huff the way a separate action would.
BLINK = 4


def eyes(look, i, blink=BLINK):
    return SHUT if i == blink else look


def breathing(look=(), rest=(), n=16, **kw):
    """A slow breath: out for half the loop, in for the other half."""
    return [frame(eyes(look, i) + list(rest), breath=i >= n // 2, **kw) for i in range(n)]


def chewing(look, n=16, grass=True, every=2, blink=BLINK + 1, **kw):
    """Jaw going, a blade of grass getting shorter."""
    return [frame(eyes(look, i, blink) + (CHEW if (i // every) % 2 else []), fx=GRASS[i * 4 // n] if grass else [], **kw)
            for i in range(n)]


STRIDE = ['reach', 'reach', 'stand', 'stand', 'pass', 'pass', 'stand', 'stand']

F = {
    # 8 fps: 16 frames is a two-second loop
    # the bird on its back rises and falls with its breath
    'sleeping': [lie(breath=i >= 8, fx=bird('asleep', NAP_PERCH[0] - (i >= 8), NAP_PERCH[1]) + ZZ[i // 4]) for i in range(16)],
    'deepSleep': [lie(EAR_BACK + SHUT, breath=i >= 8) for i in range(16)],
    'waking': [frame(WIDE + EAR_FLICK)] * 4 + [frame(SHUT)] * 2 + [frame(OPEN)] * 2,
    'idle': [frame(eyes(OPEN, i) + (NOSE if i % 8 < 2 else []), breath=i >= 8) for i in range(16)],
    'sleepy': [frame(HALF, breath=6 <= i < 12) for i in range(12)] + [frame(SHUT)] * 4,
    'tired': breathing(HALF, EAR_BACK, dy=1),
    # side on already: it plods, its head bobbing
    'walking': [frame(OPEN, legs, dy=1 if legs == 'stand' else 0) for legs in STRIDE],
    # chewing it over, eyes up
    'thinking': chewing(UP),
    'typing': [frame(DOWN, body=PAW)] * 2 + [frame(DOWN)] * 2,
    'running': chewing(OPEN + NOSE, 8, grass=False, every=1, blink=None),
    'writing': [frame(DOWN, body=PAW), frame(DOWN)] * 4,
    'reading': breathing(DOWN),
    # nose to the ground, sniffing
    'searching': [frame(DOWN + (NOSE if i % 2 else []), dy=1 + (i // 4) % 2) for i in range(16)],
    'supervising': breathing(OPEN),
    'compacting': chewing(DOWN, 8, every=1, blink=None),
    'sweating': [frame(eyes(OPEN, i) + FROWN, breath=i % 2 == 0, fx=drop(5 + i // 2, 24)) for i in range(8)],
    'worried': [frame(eyes(BACK if 6 <= i < 10 else SAD, i, 3) + EAR_BACK + FROWN) for i in range(16)],
    'grumpy': [frame(eyes(GLARE, i, 10) + EAR_BACK + FROWN, fx=puff(i // 2)) for i in range(16)],
    # an orange balanced on its head
    'proud': [frame(ZEN, breath=i >= 8, fx=at(ORANGE, 1, 22)) for i in range(16)],
    # popcorning: little hops straight up
    'happy': [frame(ZEN, up=1 if i % 4 < 2 else 0, legs='reach' if i % 4 < 2 else 'stand') for i in range(16)],
    # birds flutter round it as an orange bounces on its head
    'celebrating': [frame(ZEN, up=1 if i % 4 < 2 else 0, fx=at(ORANGE, 1 if i % 4 < 2 else 0, 22),
                          sky=bird('up' if i % 2 else 'down', 1 + i % 2, 3) + bird('down' if i % 2 else 'up', 2 - i % 2, 12)
                          + SPARKLES[i % 4]) for i in range(16)],
    'sad': [frame(eyes(SAD, i, 2) + EAR_BACK + FROWN, dy=1, fx=drop(9 + (i // 4) % 3, 22)) for i in range(16)],
}

V = {
    'idle': [breathing(BACK)],
    'thinking': [chewing(HALF)],
    'reading': [[frame(eyes(BACK if i < 4 else OPEN if i < 8 else DOWN, i, 10)) for i in range(16)]],
}


def lie_down(face):
    """From standing with `face` to lying down."""
    return [frame(face), frame(HALF), frame(SHUT), frame(SHUT, up=-1), lie()]


def get_up(start):
    return start + [frame(SHUT, up=-1), frame(SHUT + YAWN), frame(HALF + YAWN), frame(HALF), frame(OPEN)]


T = {
    '*>sleeping': lie_down(OPEN),
    'happy>sleeping': lie_down(ZEN),
    'celebrating>sleeping': lie_down(ZEN),
    'sleeping>*': get_up([lie()]),
    'deepSleep>*': get_up([lie(EAR_BACK + SHUT), lie()]),
    'deepSleep>waking': [lie(EAR_BACK + SHUT), lie(WIDE), frame(WIDE, up=-1)],
    'sleeping>deepSleep': [lie(EAR_BACK + SHUT)],
}

# A bird flies in, sits on its head a while, and flies off.
FLIGHT_IN = [('up', 0, 26), ('down', 0, 25), ('up', 1, 24), ('down', 1, 23)]
FLIGHT_OUT = [('up', 1, 20), ('down', 0, 17), ('up', 0, 14)]
# An orange drops onto its head and rolls off down its back.
ORANGE_FALL = [(-3, 22), (-1, 22), (1, 22)]
ORANGE_ROLL = [(1, 17), (1, 13), (1, 9), (1, 5), (3, 1), (7, -1)]

A = {
    'birdVisit': {'frames': [frame(OPEN, fx=bird(*f)) for f in FLIGHT_IN]
                            + [frame(UP, fx=bird('sit', *PERCH))] * 2 + [frame(ZEN, fx=bird('sit', *PERCH))] * 6
                            + [frame(ZEN, fx=bird(*f)) for f in FLIGHT_OUT] + [frame(OPEN)],
                  'moods': ['idle'], 'every': [30, 70]},
    'orange': {'frames': [frame(UP, fx=at(ORANGE, r, c)) for r, c in ORANGE_FALL]
                         + [frame(WIDE, fx=at(ORANGE, 1, 22))] * 2 + [frame(ZEN, fx=at(ORANGE, 1, 22))] * 4
                         + [frame(OPEN, fx=at(ORANGE, r, c)) for r, c in ORANGE_ROLL] + [frame(OPEN)],
               'moods': ['idle'], 'every': [40, 90]},
    'chew': {'frames': chewing(OPEN, 8), 'moods': ['idle'], 'every': [10, 25]},
    # shaking itself dry, water flying off
    'shake': {'frames': [frame(SHUT, sx=1 if i % 2 else -1, fx=SPLASH[i % 2]) for i in range(6)] + [frame(OPEN)] * 2,
              'moods': ['idle'], 'every': [30, 60]},
    'noseWiggle': {'frames': [frame(NOSE), frame(OPEN)] * 2, 'moods': ['idle'], 'every': [6, 15]},
    'earFlick': {'frames': [frame(EAR_FLICK), frame(OPEN)] * 2, 'moods': ['idle', 'supervising'], 'every': [6, 15]},
    'idleYawn': {'frames': [frame(HALF + YAWN), frame(SHUT + YAWN), frame(SHUT + YAWN), frame(SHUT + YAWN), frame(HALF), frame(OPEN)],
                 'moods': ['idle'], 'every': [20, 45]},
    'sleepyYawn': {'frames': [frame(HALF + YAWN), frame(SHUT + YAWN), frame(SHUT + YAWN), frame(HALF)],
                   'moods': ['sleepy'], 'every': [15, 35]},
    'nod': {'frames': [frame(SHUT, dy=1), frame(SHUT, dy=2), frame(SHUT, dy=2), frame(HALF)], 'moods': ['sleepy'], 'every': [8, 20]},
    # the bird on its back stirs in its sleep
    'dreamBird': {'frames': [lie(fx=bird('up', *NAP_PERCH)), lie(fx=bird('down', *NAP_PERCH)),
                             lie(fx=bird('up', *NAP_PERCH)), lie(fx=bird('asleep', *NAP_PERCH))],
                  'moods': ['sleeping'], 'every': [10, 30]},
}

PALETTE = {
    'o': '#2b1a10', 'b': '#9c6b3f', 'h': '#c08a55', 's': '#6e4526', 'd': '#4a2e1b',
    'e': '#111111', 'n': '#f3ead2', 'f': '#ff9a1f', 'q': '#d9731a', 'g': '#5cae4a',
    'y': '#ffd23f', 't': '#7cc8f2', 'w': '#ffffff', 'p': '#e58c8c',
}

pack = {
    '$schema': SCHEMA,
    'name': 'capybara', 'author': 'Henrique Schroeder',
    'description': 'A calm capybara that chews grass, lets birds sit on its head and balances an orange.',
    'palette': PALETTE,
    'fps': 8,
    'main': {'moods': F, 'variants': V, 'transitions': T, 'actions': A},
    'mini': False,
    # the calmest of them all, and the fondest
    'personality': {'energetic': 0.2, 'curious': 0.4, 'affectionate': 0.9},
    'speech': {
        'en': {'longThink': ['*chews grass* hmm…', 'no rush… hmm…'], 'manyReads': ['so many files… *chews*'],
               'manyAgents': ['everyone welcome, sit with me'], 'lateNight': ['late… a warm bath, then bed?'],
               'bored': ['*chews* just chilling', '*sighs* a bird would be nice…'],
               'dreaming': ['zzz… warm water…', 'zzz… *nose twitches*']},
        'pt-BR': {'longThink': ['*mastiga capim* hmm…', 'sem pressa… hmm…'], 'manyReads': ['quanto arquivo… *mastiga*'],
                  'manyAgents': ['chega mais, senta aqui comigo'], 'lateNight': ['tarde… um banho quente e cama?'],
                  'bored': ['*mastiga* de boa', '*suspira* um passarinho cairia bem…'],
                  'dreaming': ['zzz… água quentinha…', 'zzz… *nariz mexe*']},
    },
}

write(pack)
