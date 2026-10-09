"""Draws the capybara and writes pets/capybara.json.

    python3 scripts/make-capybara.py

pets/capybara.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. The capybara faces you, drawn symmetric so it looks the
same mirrored, with its eyes, ears, mouth, a visiting bird, an orange and the like
painted over it; only its walk turns it side on. It plays at 8 fps and draws no
mini pets.
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


def symmetric(halves):
    """Rows from their left halves, each mirrored onto the right."""
    for h in halves:
        assert len(h) <= 10, h
    return grid(['....' + h.ljust(10, '.') + h.ljust(10, '.')[::-1] for h in halves])


# Facing you: a big blunt head with small round ears and its eyes set high, a
# dark nose on its square muzzle, its shoulders either side and two short front
# legs. It is drawn symmetric, so it looks the same mirrored. The rows above its
# head are left for a bird or an orange.
BASE = symmetric([
    '',
    '',
    '.....oo...',
    '....oshooo',
    '....ohhhhh',
    '....ohbbbb',
    '...oobebbb',
    '.oohsbbbbb',
    'ohhbsbbbbb',
    'ohbbsbbsdd',
    'obbbsbsded',
    'obbbsbsddd',
    'osbbbsbsbo',
    '.osbbbsooo',
    '...osbbo',
    '...ooooo',
])


def both(pixels):
    """`pixels` on its left, and mirrored on its right."""
    return list(pixels) + [(r, W - 1 - c, ch) for r, c, ch in pixels]


# Its eyes, a dark bead each, and the lids and brows over them.
OPEN = []
SHUT = both([(6, 9, 'o'), (6, 10, 'o')])
HALF = both([(5, 9, 's'), (5, 10, 's'), (5, 11, 's')])
UP = both([(6, 10, 'b'), (5, 10, 'e')])
DOWN = both([(6, 10, 'b'), (7, 10, 'e')])
# glancing aside
BACK = [(6, 10, 'b'), (6, 9, 'e'), (6, 17, 'b'), (6, 16, 'e')]
WIDE = both([(5, 10, 'e'), (5, 11, 'w')])
# ^ ^, content
ZEN = both([(6, 9, 'o'), (5, 10, 'o'), (6, 11, 'o'), (6, 10, 'b')])
# brows pulled down towards its nose
GLARE = both([(5, 9, 'o'), (5, 10, 'o'), (6, 11, 'o')])
# brows raised in the middle, eyes low
SAD = both([(5, 11, 'o'), (5, 10, 'o'), (6, 9, 'o'), (6, 10, 'b'), (7, 10, 'e')])

# laid flat on its head
EAR_BACK = both([(2, 9, '.'), (2, 10, '.'), (3, 9, 'o'), (3, 10, 'o')])
# the left one tipped out
EAR_FLICK = [(2, 10, '.'), (2, 8, 'o'), (3, 7, 'o'), (3, 8, 's'), (3, 9, 'h'), (3, 10, 'o')]
# nostrils flaring up
NOSE = both([(10, 12, 'd'), (9, 12, 'e')])

# Mouths under its nose: chewing, a yawn that bares its big front teeth.
CHEW = both([(12, 12, 'o'), (12, 13, 'p')])
YAWN = both([(12, 12, 'o'), (12, 13, 'n'), (13, 12, 'o'), (13, 13, 'p'), (14, 12, 'o'), (14, 13, 'o')])
FROWN = both([(12, 12, 'o'), (12, 13, 's')])
# a blade of grass out of the corner of its mouth, getting shorter
GRASS = [[(12, 15, 'g'), (12, 16, 'g'), (13, 17, 'g'), (13, 18, 'g')], [(12, 15, 'g'), (12, 16, 'g'), (13, 17, 'g')],
         [(12, 15, 'g'), (12, 16, 'g')], [(12, 15, 'g')]]

# breathing in, its shoulders rise
BREATH = both([(6, 5, 'o'), (6, 6, 'o'), (7, 4, 'o'), (7, 5, 'h'), (7, 6, 'h')])
# the left front paw lifted a row off the ground
PAW = [(15, c, '.') for c in range(7, 12)] + [(14, c, 'o') for c in range(7, 12)]

# its head, ears to chin, without the shoulders and belly round it
HEAD = {(r, c) for r in range(2, 13) for c in range(8, 20)} | {(13, c) for c in range(11, 17)}


def move_head(g, dy, head=HEAD):
    """The head lowered `dy` rows."""
    if not dy:
        return g
    cells = [list(r) for r in g]
    moved = [(r, c, g[r][c]) for r, c in head if g[r][c] != '.']
    for r, c, _ in moved:
        cells[r][c] = '.'
    for r, c, ch in moved:
        if r + dy < H:
            cells[r + dy][c] = ch
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


def frame(face=(), breath=False, dy=0, body=(), fx=(), lying=False, up=0, sx=0, sky=()):
    """`face` is painted on the head before it lowers `dy` rows; lying, it sinks
    two rows with its legs tucked under; `fx` is painted after, where it is; `up`
    hops the whole frame up and `sx` jolts it sideways; `sky` stays put."""
    g = paint(BASE, list(face) + (BREATH if breath else []) + list(body))
    g = move_head(g, dy)
    if lying:
        g = [EMPTY, EMPTY] + g[:14]
    g = paint(g, list(fx))
    return paint(shift(g, sx, -up), list(sky))


def lie(face=SHUT, breath=False, fx=(), **kw):
    return frame(face, breath=breath, fx=fx, lying=True, **kw)


# Walking, it turns side on, facing right: a barrel of a body, a big square head
# and short legs mid-stride. Only the walk draws it.
SIDE = grid([
    '', '', '',
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
    '', '',
])
# rows 14 and 15: standing, or mid-stride one way or the other
LEGS = {
    'stand': ['....osbbo......osbbo', '....ooooo......ooooo'],
    'reach': ['.....osbbo....osbbo', '.....ooooo....ooooo'],
    'pass': ['...osbbo........osbbo', '...ooooo........ooooo'],
}
SIDE_HEAD = ({(r, c) for r in range(3, 10) for c in range(18, 28)} | {(r, c) for r in (10, 11) for c in range(19, 28)}
             | {(12, c) for c in range(22, 28)})


def side(legs, dy=0):
    g = move_head(SIDE[:14] + [r.ljust(W, '.') for r in LEGS[legs]], dy, SIDE_HEAD)
    # the body behind its head shows where the head moved off it
    return [r[:18] + ('b' if dy and 6 <= i < 10 and r[18] == '.' else r[18]) + r[19:] for i, r in enumerate(g)]


BIRD = {
    'sit': ['..yef', 'yyyy.', '.o.o.'],
    'asleep': ['..yyf', 'yyyy.', '.....'],
    'up': ['y.y..', '.yyef', '.....'],
    'down': ['.....', 'yyyef', 'y.y..'],
}
ORANGE = ['..g.', '.ff.', 'ffff', '.qq.']
# on its head, standing and lying down
PERCH, NAP_PERCH = (0, 11), (3, 11)
# the orange sits on its head, or a row above as it bounces
ON_HEAD = (1, 12)


def bird(pose, r, c):
    return at(BIRD[pose], r, c)


def drop(r, c):
    return [(r, c, 't')]


def puff(i):
    """Steam off the top of its head, either side."""
    return both([[(1, 8, 'w')], [(0, 7, 'w'), (1, 8, 'w')], [(0, 7, 'w')], []][i % 4])


ZZ = [[], [(2, 21, 'w')], [(2, 21, 'w'), (1, 22, 'w')], [(1, 22, 'w')]]
SPARKLES = [[(0, 7, 'w'), (1, 20, 'y')], [(1, 8, 'y'), (0, 19, 'w')], [(0, 6, 'w'), (1, 21, 'y')], [(1, 7, 'y'), (0, 20, 'w')]]
SPLASH = [[(4, 2, 't'), (1, 7, 't'), (3, 24, 't'), (12, 1, 't')], [(3, 1, 't'), (0, 20, 't'), (2, 25, 't'), (11, 26, 't')]]


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


def hop(i):
    return 1 if i % 4 < 2 else 0


STRIDE = ['reach', 'reach', 'stand', 'stand', 'pass', 'pass', 'stand', 'stand']

F = {
    # 8 fps: 16 frames is a two-second loop
    'sleeping': [lie(breath=i >= 8, fx=bird('asleep', *NAP_PERCH) + ZZ[i // 4]) for i in range(16)],
    'deepSleep': [lie(EAR_BACK + SHUT, breath=i >= 8) for i in range(16)],
    'waking': [frame(WIDE + EAR_FLICK)] * 4 + [frame(SHUT)] * 2 + [frame(OPEN)] * 2,
    'idle': [frame(eyes(OPEN, i) + (NOSE if i % 8 < 2 else []), breath=i >= 8) for i in range(16)],
    'sleepy': [frame(HALF, breath=6 <= i < 12) for i in range(12)] + [frame(SHUT)] * 4,
    'tired': breathing(HALF, EAR_BACK, dy=1),
    # side on as it plods, its head bobbing
    'walking': [side(legs, dy=1 if legs == 'stand' else 0) for legs in STRIDE],
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
    'sweating': [frame(eyes(OPEN, i) + FROWN, breath=i % 2 == 0, fx=drop(4 + i // 2, 20)) for i in range(8)],
    'worried': [frame(eyes(BACK if 6 <= i < 10 else SAD, i, 3) + EAR_BACK + FROWN) for i in range(16)],
    'grumpy': [frame(eyes(GLARE, i, 10) + EAR_BACK + FROWN, fx=puff(i // 2)) for i in range(16)],
    # an orange balanced on its head
    'proud': [frame(ZEN, breath=i >= 8, fx=at(ORANGE, *ON_HEAD)) for i in range(16)],
    # popcorning: little hops straight up
    'happy': [frame(ZEN, up=hop(i)) for i in range(16)],
    # birds flutter round it as an orange bounces on its head
    'celebrating': [frame(ZEN, up=hop(i), fx=at(ORANGE, ON_HEAD[0] - 1 + hop(i), ON_HEAD[1]),
                          sky=bird('up' if i % 2 else 'down', 1 + i % 2, 0) + bird('down' if i % 2 else 'up', 2 - i % 2, 23)
                          + SPARKLES[i % 4]) for i in range(16)],
    'sad': [frame(eyes(SAD, i, 2) + EAR_BACK + FROWN, dy=1, fx=drop(8 + (i // 4) % 3, 9)) for i in range(16)],
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
    # a crouch, head down, before it springs for joy
    '*>happy': [frame(OPEN, dy=1), frame(ZEN, dy=1), frame(ZEN, up=1), frame(ZEN)],
    '*>celebrating': [frame(OPEN, dy=1), frame(ZEN, dy=1), frame(ZEN, up=1, fx=at(ORANGE, *ON_HEAD)),
                      frame(ZEN, fx=at(ORANGE, *ON_HEAD))],
    # and settling back after a reaction
    'happy>*': [frame(ZEN, dy=1), frame(ZEN), frame(OPEN)],
    'sad>*': [frame(SAD + EAR_BACK, dy=1), frame(DOWN), frame(OPEN)],
    # eyes up as a thought starts; a start when it begins to sweat
    '*>thinking': [frame(OPEN), frame(UP), frame(UP)],
    '*>sweating': [frame(WIDE + EAR_FLICK, up=1), frame(WIDE), frame(WIDE + FROWN)],
}

# A bird flies in, sits on its head a while, and flies off.
FLIGHT_IN = [('up', 0, 23), ('down', 0, 20), ('up', 1, 17), ('down', 0, 14)]
FLIGHT_OUT = [('up', 0, 8), ('down', 0, 5), ('up', 0, 2)]
# An orange drops onto its head and rolls off down its shoulder.
ORANGE_FALL = [(-3, 12), (-1, 12), ON_HEAD]
ORANGE_ROLL = [(1, 15), (2, 18), (4, 20), (7, 22), (10, 24), (13, 25)]

A = {
    'birdVisit': {'frames': [frame(OPEN, fx=bird(*f)) for f in FLIGHT_IN]
                            + [frame(UP, fx=bird('sit', *PERCH))] * 2 + [frame(ZEN, fx=bird('sit', *PERCH))] * 6
                            + [frame(ZEN, fx=bird(*f)) for f in FLIGHT_OUT] + [frame(OPEN)],
                  'moods': ['idle'], 'every': [30, 70]},
    'orange': {'frames': [frame(UP, fx=at(ORANGE, r, c)) for r, c in ORANGE_FALL]
                         + [frame(WIDE, fx=at(ORANGE, *ON_HEAD))] * 2 + [frame(ZEN, fx=at(ORANGE, *ON_HEAD))] * 4
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
    # a blink now and then where the loop has none of its own, or only one
    'blink': {'frames': [frame(SHUT)], 'moods': ['thinking', 'reading', 'typing', 'writing', 'running', 'compacting'],
              'every': [3, 8]},
    # head low: nose to the ground, or worn out
    'blinkLow': {'frames': [frame(SHUT, dy=1)], 'moods': ['searching', 'tired'], 'every': [3, 8]},
    'blinkFrown': {'frames': [frame(SHUT + EAR_BACK + FROWN)], 'moods': ['worried', 'grumpy'], 'every': [3, 8]},
    # proud of us: a little hop, the orange still on its head
    'proudHop': {'frames': [frame(ZEN, dy=1, fx=at(ORANGE, ON_HEAD[0] + 1, ON_HEAD[1])), frame(ZEN, up=1, fx=at(ORANGE, *ON_HEAD)),
                            frame(ZEN, fx=at(ORANGE, *ON_HEAD))], 'moods': ['proud'], 'every': [6, 14]},
    # deep asleep, the laid back ear twitches
    'dreamFlick': {'frames': [lie(SHUT + EAR_FLICK), lie(EAR_BACK + SHUT), lie(SHUT + EAR_FLICK)], 'moods': ['deepSleep'],
                   'every': [8, 25]},
    # the bird on its head stirs in its sleep
    'dreamBird': {'frames': [lie(fx=bird('up', *NAP_PERCH)), lie(fx=bird('down', *NAP_PERCH)),
                             lie(fx=bird('up', *NAP_PERCH)), lie(fx=bird('asleep', *NAP_PERCH))],
                  'moods': ['sleeping'], 'every': [10, 30]},
}

# Activities: longer plays in idle, a loop held for `seconds` between a start and an end.


def water(top, ripple=0):
    """Warm water from row `top` down, light glinting on its surface."""
    return ([(r, c, 't') for r in range(top, H) for c in range(W)]
            + [(top, c + ripple, 'w') for c in (2, 9, 17, 24)])


def floating(i):
    """An orange bobbing on the water at its side."""
    return at(ORANGE, 8 + (i // 4) % 2, 0)


# A second bird, on its left shoulder.
SHOULDER = (4, 3)
SHOULDER_IN = [('up', 2, 0), ('down', 3, 1), ('up', 3, 2)]
# A slice of watermelon at its chin, bitten down a little at a time, then the rind.
MELON = ['rrrrrr', 'rerrer', 'gggggg']
BITES = [MELON, ['.rrrr.', 'rerrer', 'gggggg'], ['......', '.errr.', 'gggggg'], ['......', '......', 'gggggg']]


def melon(i):
    return at(BITES[i * 4 // 16], 13, 11)


ACT = {
    # into a hot spring: the water rises, an orange bobs by, steam curls off its head;
    # out again, it shakes itself dry
    'onsen': {'start': [frame(OPEN), frame(OPEN, fx=water(15)), frame(DOWN, fx=water(14, 1)), frame(HALF, fx=water(13)),
                        frame(ZEN, fx=water(12, 1) + floating(0))],
              'loop': [frame(ZEN, breath=i >= 8, fx=water(12, (i // 4) % 2) + floating(i) + puff(i // 2)) for i in range(16)],
              'end': [frame(HALF, fx=water(12)), frame(OPEN, fx=water(13, 1)), frame(OPEN, fx=water(14)), frame(OPEN, fx=water(15, 1))]
                     + [frame(SHUT, sx=1 if i % 2 else -1, fx=SPLASH[i % 2]) for i in range(4)] + [frame(OPEN)],
              'seconds': [20, 45], 'every': [60, 150], 'label': {'en': 'soaking in a hot spring', 'pt-BR': 'de molho na água quente'}},
    # two birds drop by: one on its head, one on its shoulder, fluttering now and then
    'birds': {'start': [frame(OPEN, fx=bird(*f) + bird(*g)) for f, g in zip(FLIGHT_IN[:3], SHOULDER_IN)]
                       + [frame(UP, fx=bird(*FLIGHT_IN[3]) + bird('sit', *SHOULDER))],
              'loop': [frame(ZEN if i < 12 else eyes(OPEN, i, 14), breath=i >= 8,
                             fx=bird('up' if i in (2, 3) else 'sit', *PERCH) + bird('up' if i in (9, 10) else 'sit', *SHOULDER))
                       for i in range(16)],
              'end': [frame(ZEN, fx=bird(*f) + bird('up', 3 - k, 2 - 2 * k)) for k, f in enumerate(FLIGHT_OUT[:2])]
                     + [frame(OPEN, fx=bird(*FLIGHT_OUT[2])), frame(OPEN)],
              'seconds': [20, 45], 'every': [60, 150], 'label': {'en': 'hosting some birds', 'pt-BR': 'recebendo passarinhos'}},
    # a slice of watermelon, eaten bite by bite, eyes shut with joy
    'watermelon': {'start': [frame(OPEN, fx=at(MELON, 14, 11)), frame(DOWN, fx=at(MELON, 13, 11))],
                   'loop': [frame((ZEN if i % 8 < 6 else HALF) + (CHEW if i % 2 else []), fx=melon(i)) for i in range(16)],
                   'end': [frame(ZEN, fx=at(BITES[3], 13, 11)), frame(OPEN)],
                   'seconds': [15, 30], 'every': [60, 150], 'label': {'en': 'eating watermelon', 'pt-BR': 'comendo melancia'}},
}
# Anything can cut an activity short, so it starts and ends with idle's face: no jump in the eyes.
for name, a in ACT.items():
    for first in (a['start'][0], a['end'][-1]):
        assert all(first[r][c] == frame(OPEN)[r][c] for r in range(5, 8) for c in range(W)), name

PALETTE = {
    'o': '#2b1a10', 'b': '#9c6b3f', 'h': '#c08a55', 's': '#6e4526', 'd': '#4a2e1b',
    'e': '#111111', 'n': '#f3ead2', 'f': '#ff9a1f', 'q': '#d9731a', 'g': '#5cae4a',
    'y': '#ffd23f', 't': '#7cc8f2', 'w': '#ffffff', 'p': '#e58c8c',
    'r': '#e8484f',
}

pack = {
    '$schema': SCHEMA,
    'name': 'capybara', 'author': 'Henrique Schroeder',
    'description': 'A calm capybara that chews grass, lets birds sit on its head and balances an orange.',
    'palette': PALETTE,
    'fps': 8,
    'main': {'moods': F, 'variants': V, 'transitions': T, 'actions': A,
             'activities': {k: {**a, 'moods': ['idle']} for k, a in ACT.items()}},
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
