"""Draws the dragon and writes pets/dragon.json.

    python3 scripts/make-dragon.py

pets/dragon.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. The dragon is bigger than the other pets, so it is drawn
in layers: its body, a wing (folded, raised or beating down) and its head, with the
eyes, mouth, smoke and fire painted over them. It plays at 8 fps, flies instead of
walking, and draws no mini pets.
"""

from sprites import SCHEMA, paint, write

W, H = 36, 20
EMPTY = '.' * W


def grid(rows):
    """Rows padded with '.' to the full width; a row too long is a mistake."""
    assert len(rows) == H, len(rows)
    for r in rows:
        assert len(r) <= W, (len(r), r)
    return [r.ljust(W, '.') for r in rows]


# Sitting three-quarters on, facing right, its wing folded on its back. The space
# right of its snout is left for its fire.
BASE = grid([
    '..................nn',
    '..........n........nnn',
    '.........orh........onnoooo',
    '........omrho......ohhhhrrroo',
    '.......ommrrho....orsssshrrrroo',
    '......ommmsrrho...oraaerrrrrrrso',
    '.....ommmmmsrrho..oraaerrrrrrrro',
    '....ommmmmmmsrrhoorrrsccccccccoo',
    '...ommmmmmmmmsrrorrrccoooonoo',
    '..ommmmmmmmmmmssorrrcco',
    '...omoomoomoomrhhrrrcco',
    '....orhhhhhhhrrrrrrscccco',
    '...orhhhrrrrrrrrrrrskkkko',
    'o..orhhrrrrrrrrrrrrscccco',
    'oo.orhrrrrrrrrsrrrrskkkko',
    'ooo.orrrrrrrrsrrrrrsoorro',
    'orooorrrrrrrsrrrrrso.orro',
    '.orrorrrrsssrrrrsso..orro',
    '..orrrsss.oosssoo...orrrso',
    '...ooooo..onnnno....onnnoo',
])

# The folded wing is everything left of the body, row by row, down to its scallops.
WING_REACH = {r: 16 for r in range(1, 9)} | {9: 15, 10: 13}


def split(base):
    body = [list(r) for r in base]
    wing = [['.'] * W for _ in range(H)]
    for r, last in WING_REACH.items():
        for c in range(last + 1):
            wing[r][c], body[r][c] = body[r][c], '.'
    return [''.join(r) for r in body], [''.join(r) for r in wing]


BODY, WING_FOLDED = split(BASE)
# the back the wing hid
BODY = paint(BODY, [(10, c, 'o') for c in range(4, 14)] + [(9, 14, 'o'), (9, 15, 'o'), (8, 16, 'o')])
# breathing in, the folded wing rises a row
WING_LIFTED = WING_FOLDED[1:] + [EMPTY]

# Raised and spread, finger bones fanning out from the wrist.
WING_UP = grid([
    '...o.....n',
    '..omo...orh',
    '.ommso.orrho',
    'ommmmsoorrho',
    'ommmmmsorrrho',
    '.ommmmmmsrrrho',
    '..ommmmmmmsrrho',
    'o..ommmmmmmsrrho',
    'oo.ommmmmmmmssrho',
    '.oommmmmmmmmmssro',
    '..ooomoomoomooso',
    '..............o',
    '', '', '', '', '', '', '', '',
])
# Beating down, swept low over its side.
WING_DOWN = grid([
    '', '', '', '', '', '',
    '..............ooo',
    '............oohrho',
    '..........oohrrrso',
    '........oohrrrssmo',
    '......oohrrssmmmmo',
    '....oohrssmmmmmmo',
    '...ohrsmmmmmmmmo',
    '..osmmmmmmmmmmo',
    '.osmmmmmmmmmo',
    'osmmmmmmmmo',
    'omoomoomoo',
    '', '', '',
])
WINGS = {'fold': WING_FOLDED, 'lift': WING_LIFTED, 'up': WING_UP, 'down': WING_DOWN}

# Eyes: three wide and two tall, amber with a slit pupil, under a dark brow.
OPEN = []
SHUT = [(5, 20, 's'), (5, 21, 's'), (5, 22, 's'), (6, 20, 'o'), (6, 21, 'o'), (6, 22, 'o')]
HALF = [(5, 20, 's'), (5, 21, 's'), (5, 22, 's')]
BACK = [(5, 20, 'e'), (5, 22, 'a'), (6, 20, 'e'), (6, 22, 'a')]
DOWN = [(5, 22, 'a')]
UP = [(6, 22, 'a')]
# ^, closed in a smile
JOY = [(5, 20, 'r'), (5, 21, 'o'), (5, 22, 'r'), (6, 20, 'o'), (6, 21, 'r'), (6, 22, 'o')]
# narrowed under a heavy brow
GLARE = [(4, c, 'o') for c in range(20, 24)] + [(5, 20, 's'), (5, 21, 's'), (5, 22, 'o')]
# brow raised, eye wide
WIDE = [(3, c, 's') for c in range(20, 24)] + [(4, 20, 'a'), (4, 21, 'a'), (4, 22, 'e'), (4, 23, 'r')]
# looking low, the outer lid dropped
SAD = [(5, 20, 's'), (5, 22, 'a'), (6, 22, 'e')]

# Mouths: the jaw opens below the upper lip, fangs at either end.
OPEN_MOUTH = ([(7, c, 's') for c in range(22, 30)] + [(7, 23, 'n'), (7, 28, 'n')]
              + [(8, c, 'c') for c in range(22, 29)] + [(8, 29, 'o')] + [(9, c, 'o') for c in range(22, 30)])
ROAR = ([(7, c, 's') for c in range(22, 30)] + [(8, c, 's') for c in range(22, 29)]
        + [(7, 23, 'n'), (7, 28, 'n'), (8, 25, 'q'), (8, 26, 'q')]
        + [(9, c, 'c') for c in range(22, 29)] + [(9, 29, 'o')] + [(10, c, 'o') for c in range(22, 30)])
SMALL = [(7, 27, 's'), (7, 28, 's'), (7, 29, 's')]

EMBER = [(5, 30, 'f')]
HOT = [(5, 30, 'y')]
# chest swelling as it breathes in
BREATH = [(r, 25, 'o') for r in range(11, 15)] + [(11, 24, 'c'), (12, 24, 'k'), (13, 24, 'c'), (14, 24, 'k')]
# a claw lifted off the ground
TAP_FRONT = [(19, c, 'o') for c in range(21, 24)] + [(18, c, 'n') for c in range(21, 24)]
TAP_HIND = [(19, c, 'o') for c in range(11, 15)] + [(18, c, 'n') for c in range(11, 15)]

HEAD_ROWS, HEAD_COLS = range(0, 9), range(17, 32)
# where the neck meets the head: it stretches when the head moves sideways
NECK = {(r, c) for r in (7, 8) for c in range(17, 22)}
# lying down, its head rests on its front paws
SLEEP_DROP = 9


def move_head(g, dx, dy):
    if not (dx or dy):
        return g
    cells = [list(r) for r in g]
    head = [(r, c, g[r][c]) for r in HEAD_ROWS for c in HEAD_COLS if g[r][c] != '.']
    for r, c, _ in head:
        if dy or (r, c) not in NECK:
            cells[r][c] = '.'
    for r, c, ch in head:
        if 0 <= r + dy < H and 0 <= c + dx < W:
            cells[r + dy][c + dx] = ch
    return [''.join(r) for r in cells]


# Turned to face you: both eyes, nostrils and horns, its chin on its chest.
FRONT_HEAD = [
    '.n.........n.',
    '.nno.....onn.',
    '..nohhhhhon..',
    '.ohhrrrrrrho.',
    'orssrrrrrssro',
    'oraearrraearo',
    'oraearrraearo',
    '.orrrhhhrrro.',
    '..orhorohro..',
    '..oscccccso..',
    '...ooooooo...',
]
FRONT_LEFT = 16
FRONT_SHUT = [(5, FRONT_LEFT + c, 's') for c in (2, 3, 4, 8, 9, 10)] + [(6, FRONT_LEFT + c, 'o') for c in (2, 3, 4, 8, 9, 10)]


def over(g, layer):
    return [''.join(b if l == '.' else l for b, l in zip(gr, lr)) for gr, lr in zip(g, layer)]


def lift(g, dy):
    """The whole frame flown `dy` rows up."""
    return g[dy:] + [EMPTY] * dy if dy > 0 else g


def at(pixels, dx=0, dy=0):
    return [(r + dy, c + dx, ch) for r, c, ch in pixels]


def frame(face=(), wing='fold', breath=False, dx=0, dy=0, body=(), fx=(), up=0, ground=()):
    """`face` is painted on the head before it moves by (`dx`, `dy`); `fx` is
    painted where it is, after; `up` flies the whole frame up, and `ground`
    stays on the ground."""
    g = over(BODY, WINGS[wing])
    g = paint(g, list(face) + (BREATH if breath else []) + list(body))
    g = move_head(g, dx, dy)
    return paint(lift(paint(g, list(fx)), up), list(ground))


def facing(face=(), wing='fold', breath=False):
    """Its head turned to the front, `face` painted over it."""
    g = [list(r) for r in frame((), wing, breath)]
    for r in HEAD_ROWS:
        for c in HEAD_COLS:
            if (r, c) not in NECK:
                g[r][c] = '.'
    for r, row in enumerate(FRONT_HEAD):
        for c, ch in enumerate(row):
            if ch != '.':
                g[r][FRONT_LEFT + c] = ch
    return paint([''.join(r) for r in g], list(face))


def asleep(face=SHUT, breath=False, fx=(), dy=SLEEP_DROP):
    return frame(face, 'lift' if breath else 'fold', dy=dy, fx=fx)


# Smoke curls up from its nostril; `puff(i, dx, dy)` is the i-th step of one puff.
PUFF_PATH = [[(4, 31, 'g')], [(3, 32, 'g'), (4, 31, 'l')], [(2, 33, 'g'), (3, 32, 'l')],
             [(1, 33, 'l'), (2, 34, 'g')], [(0, 34, 'l'), (1, 35, 'g')], [(0, 35, 'l')]]


def puff(i, dx=0, dy=0, dark=False):
    if not 0 <= i < len(PUFF_PATH):
        return []
    swap = {'g': 'e', 'l': 'g'} if dark else {}
    return at([(r, c, swap.get(ch, ch)) for r, c, ch in PUFF_PATH[i]], dx, dy)


# Fire from its mouth, from a spark to a full jet to smoke, drawn from (4, 29).
FIRE = [
    ['.......', '.......', '.......', '..fy...', '..qf...', '.......', '.......', '.......'],
    ['.......', '.......', '...q...', '..fyyf.', '..nyyfq', '...fq..', '.......', '.......'],
    ['....q.q', '...qfqf', '..qfyyf', '.fyynyy', '.nnnnyy', '.fyyyff', '..qffqf', '...q.q.'],
    ['...q..q', '..qffqf', '.qfyyyf', '.fynnyy', '.nnnyyf', '.fyynyf', '..qffyq', '....qf.'],
    ['.....gl', '....qgl', '...qffg', '..fyfq.', '..ffq.g', '...q.gl', '.....g.', '.......'],
    ['....l.g', '.....gl', '....g..', '...g.l.', '....g..', '.....l.', '.......', '.......'],
]


def fire(i, dx=0, dy=0):
    return [(4 + r + dy, 29 + c + dx, ch) for r, row in enumerate(FIRE[i]) for c, ch in enumerate(row) if ch != '.']


def drop(r, c):
    return [(r, c, 't')]


DUST = [(19, 7, 'g'), (18, 8, 'l'), (19, 18, 'l'), (18, 17, 'g'), (19, 27, 'g'), (18, 26, 'l')]
# sparks drifting down around it as it celebrates
SPARKS = [[(0, 2, 'y'), (2, 26, 'f'), (1, 13, 'n'), (3, 33, 'y')],
          [(1, 3, 'f'), (3, 27, 'y'), (2, 13, 'y'), (0, 31, 'n')],
          [(2, 2, 'n'), (0, 25, 'y'), (3, 12, 'f'), (1, 32, 'f')],
          [(3, 3, 'y'), (1, 24, 'n'), (0, 14, 'y'), (2, 33, 'n')]]
COIN = [(18, 28, 'y'), (18, 29, 'y'), (19, 28, 'f'), (19, 29, 'f')]
GLINT = [(17, 30, 'n'), (16, 31, 'n'), (17, 27, 'n')]


def breathing(face, n=16, **kw):
    """A slow breath: in for half the loop, out for the other half."""
    return [frame(face, 'lift' if i >= n // 2 else 'fold', breath=i >= n // 2, **kw) for i in range(n)]


F = {
    # 8 fps: 16 frames is a two-second loop
    'sleeping': [asleep(breath=i >= 8, fx=puff(i - 8, dy=SLEEP_DROP)) for i in range(16)],
    'deepSleep': [asleep(breath=i >= 8) for i in range(16)],
    'waking': [frame(WIDE + SMALL)] * 4 + [frame(SHUT)] * 2 + [frame(OPEN)] * 2,
    'idle': [frame(OPEN, 'lift' if i >= 8 else 'fold', breath=i >= 8, fx=EMBER if i % 8 < 4 else []) for i in range(16)],
    'sleepy': [frame(HALF, 'lift' if 6 <= i < 12 else 'fold', breath=6 <= i < 12) for i in range(12)] + [frame(SHUT)] * 4,
    'tired': [frame(HALF + SMALL, dy=1)] * 8 + [frame(SHUT + SMALL, 'lift', breath=True, dy=1)] * 8,
    'watching': breathing(DOWN),
    # smoke curling from its nostril as it thinks
    'thinking': [frame(UP, 'lift' if i >= 8 else 'fold', breath=i >= 8, fx=puff(i // 2)) for i in range(16)],
    'typing': [frame(DOWN, body=TAP_FRONT)] * 2 + [frame(DOWN)] * 2 + [frame(DOWN, body=TAP_HIND)] * 2 + [frame(DOWN)] * 2,
    # snorting smoke, its ember flaring
    'running': [frame(OPEN, fx=(HOT if i % 2 else EMBER) + puff(i % 6)) for i in range(12)],
    # a claw scratching away, quicker than typing
    'writing': [frame(DOWN, body=TAP_FRONT), frame(DOWN)] * 4,
    'reading': breathing(DOWN),
    # its long neck sweeps back and forth
    'searching': [frame(BACK, dx=-1)] * 4 + [frame(OPEN)] * 4 + [frame(OPEN, dx=1)] * 4 + [frame(OPEN)] * 4,
    # leaning towards its agents (drawn on its right)
    'supervising': breathing(OPEN, dx=1),
    'compacting': [frame(HALF, breath=i < 4, fx=puff(i % 6) + puff((i + 3) % 6)) for i in range(8)],
    # panting, a drop running down its brow
    'sweating': [frame(OPEN + SMALL, breath=i % 2 == 0, fx=drop(3 + i // 2, 25)) for i in range(8)],
    'worried': [frame(SAD + SMALL)] * 6 + [frame(BACK + SMALL)] * 4 + [frame(SAD + SMALL)] * 6,
    # dark smoke from a glaring dragon
    'grumpy': [frame(GLARE, fx=EMBER + puff(i // 2 - 2, dark=True)) for i in range(16)],
    # chest out, wings half spread
    'proud': [frame(JOY, 'up', breath=True, fx=EMBER + ([(12, 22, 'n')] if i % 8 < 2 else []))
              for i in range(16)],
    # wings flapping, hopping off all four feet
    'happy': [frame(JOY + OPEN_MOUTH, 'up' if i % 4 < 2 else 'down', body=TAP_FRONT + TAP_HIND if i % 4 < 2 else ())
              for i in range(16)],
    # a long job done: a roar of fire, wings beating, sparks raining down
    'celebrating': [frame(JOY + ROAR, 'up' if i % 4 < 2 else 'down', fx=fire(2 + i % 2) + SPARKS[i % 4]) for i in range(16)],
    # head low, a tear running down
    'sad': [frame(SAD, dy=1, fx=drop(7 + (i // 4) % 3, 21)) for i in range(16)],
}

V = {
    'idle': [breathing(BACK)],
    'thinking': [[frame(UP, 'lift' if i >= 8 else 'fold', breath=i >= 8, fx=EMBER if i % 4 < 2 else HOT) for i in range(16)]],
    'reading': [[frame(BACK)] * 4 + [frame(OPEN)] * 4 + [frame(DOWN)] * 8],
}


def lie_down(face):
    """From sitting with `face` to its head on its paws."""
    return [frame(face), frame(HALF), frame(SHUT), frame(SHUT, dy=3), frame(SHUT, dy=6), asleep()]


def get_up(start):
    return start + [frame(SHUT, dy=6), frame(HALF, dy=3), frame(HALF + ROAR), frame(SHUT + ROAR), frame(HALF), frame(OPEN)]


T = {
    '*>sleeping': lie_down(OPEN),
    'happy>sleeping': lie_down(JOY),
    'celebrating>sleeping': lie_down(JOY),
    'sleeping>*': get_up([asleep()]),
    'deepSleep>*': get_up([asleep(), asleep(HALF)]),
    'deepSleep>waking': [asleep(HALF), frame(WIDE, dy=6), frame(WIDE, dy=3)],
    'sleeping>deepSleep': [asleep()],
    # a crouch, head low, before it springs up with its wings spread
    '*>happy': [frame(OPEN, dy=1)] * 2 + [frame(JOY + OPEN_MOUTH, 'up', body=TAP_FRONT + TAP_HIND)] * 2,
    '*>celebrating': [frame(OPEN + SMALL, dy=1)] * 2 + [frame(JOY + ROAR, 'up', fx=fire(0)), frame(JOY + ROAR, 'up', fx=fire(1))],
    # and settling back after a reaction
    'happy>*': [frame(JOY, 'down'), frame(JOY, 'lift'), frame(JOY), frame(OPEN)],
    'sad>*': [frame(SAD, dy=1), frame(DOWN, dy=1), frame(DOWN), frame(OPEN)],
    # eyes up as a thought starts; a start, rearing back, when it begins to sweat
    '*>thinking': [frame(UP)] * 4,
    '*>sweating': [frame(WIDE + SMALL, dx=-1)] * 2 + [frame(WIDE + SMALL)],
}

# Flying: it spreads its wings, beats them, and rises out of sight; landing is the reverse.
TELEPORT = {
    'vanish': [frame(OPEN, 'up'), frame(OPEN, 'down', ground=DUST), frame(OPEN, 'up', ground=DUST, up=2),
               frame(OPEN, 'down', up=5), frame(OPEN, 'up', up=9), frame(OPEN, 'down', up=14), [EMPTY] * H],
    'appear': [frame(OPEN, 'down', up=14), frame(OPEN, 'up', up=9), frame(OPEN, 'down', up=5),
               frame(OPEN, 'up', up=2), frame(OPEN, 'down', ground=DUST), frame(OPEN, 'up', ground=DUST), frame(OPEN)],
}

# one frame, so a blink never holds up a loop's smoke or claws for long
# Activities: longer plays in idle, a loop held for `seconds` between a start and an end.
IDLE = frame(OPEN, fx=EMBER)
# Its hoard: a heap of gold before its claws, glinting, one coin flipped up and caught.
HOARD = ([(19, c, 'y' if c % 2 else 'a') for c in range(27, 34)] + [(18, c, 'a' if c % 2 else 'y') for c in range(28, 33)]
         + [(17, c, 'y') for c in range(29, 32)] + [(16, 30, 'a')])
HOARD_GLINTS = [(17, 29, 'n')], [(18, 32, 'n')], [(19, 28, 'n')], []
FLIP = [(15, 31), (13, 32), (11, 33), (10, 33), (11, 33), (13, 32), (15, 31), (16, 31)]


def hoard(i):
    return HOARD + HOARD_GLINTS[(i // 4) % 4] + [(*FLIP[i // 2], 'y')]


def ring(r, c, ch='l'):
    """A smoke ring three wide with its top left at (r, c)."""
    return [(r, c + 1, ch), (r + 1, c, ch), (r + 1, c + 2, ch), (r + 2, c + 1, ch)]


# a smoke ring's way up off its snout: a wisp, a ring widening and rising, fading out
RING_WAY = [[(6, 32, 'g')], ring(4, 32), ring(2, 33), ring(0, 33), [(0, 34, 'g')], [], [], []]


def rings(i):
    return RING_WAY[i // 2 % 8] + RING_WAY[(i // 2 + 4) % 8]


ACT = {
    # it counts its hoard: eyes on the gold, a coin flipped up and caught, a glint here and there
    'hoard': {'start': [frame(OPEN, fx=EMBER + HOARD), frame(DOWN, fx=HOARD)],
              'loop': [frame(DOWN if i < 12 else JOY, 'lift' if i >= 8 else 'fold', breath=i >= 8,
                             body=TAP_FRONT if i in (0, 1) else [], fx=hoard(i)) for i in range(16)],
              'end': [frame(JOY, fx=HOARD), frame(OPEN, fx=EMBER + HOARD)],
              'seconds': [15, 35], 'every': [60, 150], 'label': {'en': 'counting its hoard', 'pt-BR': 'contando o tesouro'}},
    # lazy smoke rings off its snout, widening as they rise
    'smokeRings': {'start': [IDLE, frame(HALF + SMALL)],
                   'loop': [frame(HALF + (SMALL if i % 8 < 2 else []), 'lift' if i >= 8 else 'fold', breath=i >= 8, fx=rings(i))
                            for i in range(16)],
                   'end': [frame(HALF, fx=RING_WAY[2]), IDLE],
                   'seconds': [15, 30], 'every': [60, 150], 'label': {'en': 'blowing smoke rings', 'pt-BR': 'soprando anéis de fumaça'}},
    # it hovers on the spot, wings beating, rising and dipping a row, dust stirring under it
    'hover': {'start': [IDLE, frame(OPEN, 'up'), frame(OPEN, 'down', up=1)],
              'loop': [frame(JOY if i >= 12 else OPEN, 'up' if i % 4 < 2 else 'down', up=1 if i % 8 >= 4 else 0,
                             ground=[(19, c, 'g') for c in (3 + i % 2, 10 - i % 2, 30 + i % 2)]) for i in range(16)],
              'end': [frame(OPEN, 'down', up=1), frame(OPEN, 'up'), IDLE],
              'seconds': [10, 25], 'every': [45, 120], 'label': {'en': 'hovering', 'pt-BR': 'pairando no ar'}},
}
# Anything can cut an activity short, so it starts and ends with idle's face: no jump in the eyes.
for name, a in ACT.items():
    for first in (a['start'][0], a['end'][-1]):
        assert all(first[r][c] == IDLE[r][c] for r in range(3, 8) for c in range(19, 25)), name

QUIET = ['idle', 'watching', 'thinking', 'typing', 'writing', 'reading', 'running', 'searching', 'compacting']
A = {
    'blink': {'frames': [frame(SHUT)], 'moods': QUIET, 'every': [2, 6]},
    'blinkLean': {'frames': [frame(SHUT, dx=1)], 'moods': ['supervising'], 'every': [2, 6]},
    'blinkGlare': {'frames': [frame(GLARE + SHUT)], 'moods': ['grumpy'], 'every': [3, 7]},
    'blinkWorried': {'frames': [frame(SHUT + SMALL)], 'moods': ['worried', 'sweating'], 'every': [2, 5]},
    # proud: a beat of its spread wings and a puff of smoke
    'proudFlare': {'frames': [frame(JOY, 'down' if i in (0, 3) else 'up', breath=True, fx=(HOT if i < 3 else EMBER) + puff(i - 1))
                              for i in range(7)],
                   'moods': ['proud'], 'every': [8, 18]},
    # it draws a deep breath, rears back, and lets loose
    'fireBreath': {'frames': [frame(OPEN, 'lift', breath=True, fx=EMBER),
                              frame(WIDE, 'lift', breath=True, dx=-1, fx=at(EMBER, -1)),
                              frame(WIDE, 'lift', breath=True, dx=-1, fx=at(HOT, -1)),
                              frame(GLARE, 'lift', breath=True, dx=-2, fx=at(HOT, -2))]
                             + [frame(GLARE + ROAR, fx=fire(i)) for i in (0, 1, 2, 3, 2, 3, 2, 3)]
                             + [frame(OPEN + OPEN_MOUTH, fx=fire(4)), frame(OPEN + SMALL, fx=fire(5)),
                                frame(OPEN, fx=puff(1)), frame(OPEN, fx=puff(3))],
                   'moods': ['idle'], 'every': [25, 60]},
    'snort': {'frames': [frame(OPEN, fx=HOT + puff(i)) for i in range(6)], 'moods': ['idle'], 'every': [8, 20]},
    'wingStretch': {'frames': [frame(SHUT, 'up')] * 3 + [frame(SHUT, 'down')] * 2 + [frame(SHUT, 'up')] * 2 + [frame(OPEN)],
                    'moods': ['idle'], 'every': [20, 45]},
    'idleYawn': {'frames': [frame(HALF + OPEN_MOUTH), frame(SHUT + ROAR), frame(SHUT + ROAR, fx=fire(0)), frame(SHUT + ROAR),
                            frame(HALF + SMALL), frame(OPEN)],
                 'moods': ['idle'], 'every': [20, 45]},
    'sleepyYawn': {'frames': [frame(HALF + OPEN_MOUTH), frame(SHUT + ROAR), frame(SHUT + ROAR), frame(HALF + SMALL), frame(HALF)],
                   'moods': ['sleepy'], 'every': [15, 35]},
    # it turns to look at you for a while, blinks, and turns back
    'lookFront': {'frames': [facing()] * 7 + [facing(FRONT_SHUT)] + [facing(wing='lift', breath=True)] * 7 + [frame(OPEN)],
                  'moods': ['idle'], 'every': [12, 30]},
    'scratch': {'frames': [frame(JOY, body=TAP_HIND), frame(JOY)] * 3 + [frame(OPEN)], 'moods': ['idle'], 'every': [20, 45]},
    # it checks on its hoard
    'treasure': {'frames': [frame(DOWN, fx=COIN)] * 2 + [frame(DOWN, fx=COIN + GLINT)] * 2 + [frame(JOY, fx=COIN)] * 3 + [frame(OPEN)],
                 'moods': ['idle'], 'every': [40, 90]},
    # a little flame as it snores
    'dreamFlame': {'frames': [asleep(fx=fire(0, dy=SLEEP_DROP)), asleep(fx=fire(1, dy=SLEEP_DROP)),
                              asleep(fx=fire(0, dy=SLEEP_DROP)), asleep(fx=puff(1, dy=SLEEP_DROP))],
                   'moods': ['sleeping', 'deepSleep'], 'every': [10, 30]},
    'nod': {'frames': [frame(SHUT, dy=1), frame(SHUT, dy=2), frame(SHUT, dy=2), frame(HALF)], 'moods': ['sleepy'], 'every': [8, 20]},
    'nodTired': {'frames': [frame(SHUT + SMALL, dy=2), frame(SHUT + SMALL, dy=3), frame(SHUT + SMALL, dy=3), frame(HALF + SMALL, dy=1)],
                 'moods': ['tired'], 'every': [8, 20]},
}

PALETTE = {
    'o': '#2a0a0a', 'r': '#c0392b', 'h': '#e8604c', 's': '#7a1f1a',
    'c': '#f2d29b', 'k': '#c9a56b', 'n': '#efe6cf', 'a': '#ffb92e', 'e': '#1a1a1a',
    'm': '#8e2a3a', 'y': '#ffd84a', 'f': '#ff8a1e', 'q': '#e8401c', 'g': '#8a8a8a',
    'l': '#c8c8c8', 't': '#5ab4ff',
}

pack = {
    '$schema': SCHEMA,
    'name': 'dragon', 'author': 'Henrique Schroeder',
    'description': 'A red dragon that breathes fire, guards its hoard and flies off to land elsewhere.',
    'palette': PALETTE,
    'fps': 8,
    'main': {'moods': F, 'variants': V, 'transitions': T, 'actions': A, 'teleport': TELEPORT,
             'activities': {k: {**a, 'moods': ['idle']} for k, a in ACT.items()}},
    'mini': False,
    # slow to stir, curious enough, and fond of its keeper
    'personality': {'energetic': 0.4, 'curious': 0.5, 'affectionate': 0.8},
    'speech': {
        'en': {'longThink': ['*smoke curls* hmm…', 'hrrm… *taps a claw*'], 'manyReads': ['so many scrolls for my hoard!'],
               'manyAgents': ['a whole flight of agents!'], 'lateNight': ['dragons love the dark… you too?'],
               'bored': ['*counts its gold* 1… 2…', '*puffs a smoke ring* so bored…'],
               'dreaming': ['zzz… gold… so much gold…', 'zzz… *a little flame*']},
        'pt-BR': {'longThink': ['*fumaça sobe* hmm…', 'hrrm… *bate a garra*'], 'manyReads': ['quanto pergaminho pro meu tesouro!'],
                  'manyAgents': ['uma revoada de agents!'], 'lateNight': ['dragão adora o escuro… você também?'],
                  'bored': ['*conta o ouro* 1… 2…', '*solta um anel de fumaça* que tédio…'],
                  'dreaming': ['zzz… ouro… tanto ouro…', 'zzz… *uma chaminha*']},
    },
}

write(pack)
