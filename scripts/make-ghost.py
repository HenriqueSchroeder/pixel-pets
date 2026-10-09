"""Draws the ghost, which floats instead of walking, and writes pets/ghost.json.

    python3 scripts/make-ghost.py

pets/ghost.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. Each frame is the ghost below, floating up or down a row
and fading in its sleep, with a few pixels painted over it (eyes, mouth, effects).
"""

from sprites import SCHEMA, paint, write

GHOST = [
    '....oooo....',
    '..oobbbboo..',
    '.obbbbbbbbo.',
    '.obbbbbbbbo.',
    'obbbbbbbbbbo',
    'obbbbbbbbbbo',
    'obbbbbbbbbbo',
    'obbbbbbbbbbo',
    'obbbbbbbbbbo',
    'obbbbbbbbbbo',
    'obo.obbo.obo',
    '.o...oo...o.',
]
BLANK = '.' * 12
# Asleep it fades: f is faint, h fainter still.
FAINT, FAINTER = 'f', 'h'


def body(lift, fade):
    rows = GHOST + [BLANK] if lift else [BLANK] + GHOST
    return [row.replace('b', fade) for row in rows] if fade else rows


def f(face, lift=True, fade=None, effects=()):
    """A frame: `face` drawn on the ghost floating up (`lift`) or down a row;
    `effects` are painted where they are, outside the ghost."""
    down = 0 if lift else 1
    return paint(body(lift, fade), [(r + down, c, l) for r, c, l in face] + list(effects))


OPEN = [(4, 4, 'e'), (5, 4, 'e'), (4, 7, 'e'), (5, 7, 'e')]
SHUT = [(5, 3, 'e'), (5, 4, 'e'), (5, 7, 'e'), (5, 8, 'e')]
DOWN = [(5, 4, 'e'), (5, 7, 'e')]
UP = [(4, 4, 'e'), (4, 7, 'e')]
# ^ ^ set wide apart, so the two arcs don't run together
JOY = [(5, 2, 'e'), (4, 3, 'e'), (5, 4, 'e'), (5, 7, 'e'), (4, 8, 'e'), (5, 9, 'e')]
# heavy lids: eyes half shut, a paler lid over each
HALF = [(5, 3, 'e'), (5, 4, 'e'), (4, 4, 'o'), (5, 7, 'e'), (5, 8, 'e'), (4, 7, 'o')]
# brows slanting down to the middle, over each eye
BROW = [(2, 3, 'e'), (3, 4, 'e'), (3, 7, 'e'), (2, 8, 'e')]
BLUSH = [(6, 2, 'p'), (6, 9, 'p')]
MOUTH = [(7, 5, 'e'), (7, 6, 'e')]
OMOUTH = [(7, 5, 'e'), (7, 6, 'e'), (8, 5, 'e'), (8, 6, 'e')]
GRIN = [(7, 4, 'e'), (8, 5, 'e'), (8, 6, 'e'), (7, 7, 'e')]
FROWN = [(8, 4, 'e'), (7, 5, 'e'), (7, 6, 'e'), (8, 7, 'e')]
FLAT = [(8, 4, 'e'), (8, 5, 'e'), (8, 6, 'e'), (8, 7, 'e')]
WAVY = [(8, 4, 'e'), (7, 5, 'e'), (8, 6, 'e'), (7, 7, 'e')]
# a playful "bleh"
TONGUE = [(8, 5, 'p'), (8, 6, 'p')]
# eyes wide for a "boo!"
WIDE = [(3, 4, 'e'), (4, 4, 'e'), (5, 4, 'e'), (3, 7, 'e'), (4, 7, 'e'), (5, 7, 'e')]


def wisp():
    """All of it translucent, outline too, no face: half there."""
    return [row.replace('b', FAINTER).replace('o', FAINTER) for row in body(True, None)]


def sparks(*ps):
    """Only a few sparks where it floats."""
    return paint([BLANK] * len(body(True, None)), [(r, c, 'w') for r, c in ps])


def look(s):
    return [(r, c + s, l) for r, c, l in OPEN]


def scan(s):
    return [(5, 4 + s, 'e'), (5, 7 + s, 'e')]


def w(*ps):
    return [(r, c, 'w') for r, c in ps]


def t(r, c):
    return [(r, c, 't')]


def bob(face, effects=(), fade=None, hold=2):
    """Floating: `hold` frames up, `hold` frames down."""
    return [f(face, True, fade, effects)] * hold + [f(face, False, fade, effects)] * hold


ZZ = [w((1, 10)), w((0, 11))]
F = {
    # fading as it drifts off, floating low and slow
    'sleeping': [f(SHUT + MOUTH, False, FAINT)] * 4 + [f(SHUT + MOUTH, False, FAINT, ZZ[0])] * 2 + [f(SHUT + MOUTH, True, FAINT, ZZ[1])] * 2,
    'deepSleep': [f(SHUT + MOUTH, False, FAINTER)] * 5 + [f(SHUT + MOUTH, False, FAINTER, ZZ[0])] * 3,
    'waking': [f(WIDE + OMOUTH)] * 3 + [f(SHUT + OMOUTH, False)],
    'idle': bob(OPEN + MOUTH + BLUSH),
    'sleepy': bob(HALF + MOUTH, fade=FAINT, hold=3) + [f(SHUT + MOUTH, False, FAINT)] * 2,
    'tired': [f(HALF + FLAT, False)] * 4 + [f(HALF + OMOUTH, False)] * 2 + [f(SHUT + OMOUTH, False, FAINT)] * 2,
    'watching': [f(DOWN + MOUTH)] * 3 + [f(DOWN + MOUTH, False)] * 3 + [f([(5, 5, 'e'), (5, 8, 'e')] + MOUTH)] * 2,
    'thinking': [f(look(-1) + MOUTH)] * 2 + [f(look(-1) + MOUTH, False)] * 2 + [f(look(1) + MOUTH)] * 2 + [f(look(1) + MOUTH, False)] * 2,
    'typing': bob(OPEN + GRIN, hold=1) * 2,
    # zipping about: quick bobs
    'running': [f(look(1) + MOUTH), f(look(1) + MOUTH, False)] * 3,
    'writing': bob(DOWN + GRIN, hold=1) * 2,
    'reading': [f(DOWN + MOUTH)] * 2 + [f(DOWN + MOUTH, False)] * 2,
    'searching': [f(scan(-1) + MOUTH)] * 2 + [f(scan(0) + MOUTH, False)] * 2 + [f(scan(1) + MOUTH)] * 2 + [f(scan(0) + MOUTH, False)] * 2,
    # drawn with its agents on the right; the core mirrors it when they are on the left
    'supervising': bob(look(1) + MOUTH, hold=3) + [f(OPEN + MOUTH)] * 2,
    'compacting': [f(DOWN + MOUTH, effects=w((0, 1), (1, 10)))] * 2 + [f(DOWN + MOUTH, False, effects=w((1, 1), (0, 10)))] * 2,
    'sweating': [f(OPEN + FROWN + t(r, 9), r % 2 == 0) for r in (3, 3, 4, 4, 5, 5)],
    'worried': bob(look(-1) + WAVY, hold=1) + [f(OPEN + WAVY)] + [f(look(1) + WAVY + t(3, 9), False)] * 3 + [f(OPEN + WAVY)],
    'grumpy': [f(OPEN + BROW + FLAT, False)] * 4 + [f(OPEN + BROW + FLAT, False, effects=w((1, 10)))] * 2 + [f(OPEN + BROW + FLAT, False, effects=w((0, 11)))] * 2,
    'proud': bob(JOY + GRIN + BLUSH) + [f(JOY + GRIN + BLUSH, effects=w((0, 10)))] * 2 + [f(JOY + GRIN + BLUSH, effects=w((1, 11)))] * 2,
    'happy': [f(JOY + GRIN + TONGUE + BLUSH)] * 2 + [f(JOY + GRIN + TONGUE + BLUSH, False)] * 2,
    # a long job done: bouncing in confetti
    'celebrating': [f(JOY + GRIN + BLUSH, True, None, [(0, 1, 'p'), (1, 10, 't'), (0, 10, 'w')]),
                    f(JOY + GRIN + BLUSH, False, None, [(1, 1, 'w'), (0, 11, 'p'), (0, 2, 't')])] * 4,
    'sad': [f(OPEN + FROWN + t(r, 3), False) for r in (6, 6, 7, 7, 8, 8)],
}
V = {
    'thinking': [[f(UP + [(7, 6, 'e'), (7, 7, 'e')])] * 4 + [f(UP + [(7, 6, 'e'), (7, 7, 'e')], False)] * 4],
    'reading': [[f(scan(-1) + MOUTH)] * 3 + [f(scan(0) + MOUTH, False)] * 3 + [f(scan(1) + MOUTH)] * 2],
    # or lazing low, eyes half shut, rising only now and then
    'idle': [[f(HALF + MOUTH + BLUSH, False)] * 5 + [f(HALF + MOUTH + BLUSH)] * 3],
}
T = {
    '*>sleeping': [f(OPEN + MOUTH), f(OPEN + OMOUTH), f(DOWN + OMOUTH, False), f(SHUT + OMOUTH, False, FAINT), f(SHUT + MOUTH, False, FAINT)],
    'happy>sleeping': [f(JOY + GRIN + BLUSH), f(JOY + MOUTH), f(OPEN + MOUTH, False), f(SHUT + OMOUTH, False, FAINT), f(SHUT + MOUTH, False, FAINT)],
    'sleeping>*': [f(SHUT + MOUTH, False, FAINT), f(DOWN + MOUTH, False), f(OPEN + OMOUTH), f(OPEN + MOUTH)],
    'deepSleep>*': [f(SHUT + MOUTH, False, FAINTER), f(SHUT + MOUTH, False, FAINT), f(DOWN + MOUTH, False), f(OPEN + OMOUTH), f(OPEN + MOUTH)],
    'deepSleep>waking': [f(SHUT + MOUTH, False, FAINT)],
    'sleeping>deepSleep': [f(SHUT + MOUTH, False, FAINT)],
    # a dip before it rises for joy
    '*>happy': [f(OPEN + MOUTH, False), f(JOY + GRIN + TONGUE + BLUSH)],
    '*>celebrating': [f(OPEN + OMOUTH, False), f(JOY + GRIN + BLUSH)],
    # and settling back after a reaction
    'happy>*': [f(JOY + MOUTH + BLUSH), f(OPEN + MOUTH)],
    'sad>*': [f(DOWN + FROWN, False), f(OPEN + MOUTH)],
    # eyes up as a thought starts; a start when it begins to sweat
    '*>thinking': [f(UP + MOUTH)] * 2,
    '*>sweating': [f(WIDE + OMOUTH)],
}
# celebrating winds down to sleep the way happy does
T['celebrating>sleeping'] = T['happy>sleeping']

A = {
    # blinks hold the ghost where most of its loop floats
    'blink': {'frames': [f(SHUT + MOUTH)], 'moods': ['thinking', 'reading', 'searching', 'compacting', 'watching', 'supervising', 'running'], 'every': [2, 6]},
    'blinkIdle': {'frames': [f(SHUT + MOUTH + BLUSH)], 'moods': ['idle'], 'every': [2, 6]},
    'blinkGrin': {'frames': [f(SHUT + GRIN)], 'moods': ['typing', 'writing'], 'every': [2, 6]},
    'blinkFrown': {'frames': [f(SHUT + FROWN)], 'moods': ['sweating'], 'every': [2, 5]},
    'blinkWorried': {'frames': [f(SHUT + WAVY)], 'moods': ['worried'], 'every': [2, 5]},
    'blinkGrumpy': {'frames': [f(SHUT + BROW + FLAT, False)], 'moods': ['grumpy'], 'every': [3, 7]},
    # it can't help itself
    'boo': {'frames': [f(WIDE + OMOUTH)] * 3 + [f(OPEN + GRIN + BLUSH)], 'moods': ['idle'], 'every': [20, 45]},
    # it flickers out of being for a moment
    'flicker': {'frames': [f(OPEN + MOUTH, fade=FAINT), f(OPEN + MOUTH, fade=FAINTER), f(OPEN + MOUTH, fade=FAINT)], 'moods': ['idle'], 'every': [12, 30]},
    'bleh': {'frames': [f(JOY + TONGUE + BLUSH)] * 3, 'moods': ['idle', 'proud'], 'every': [15, 35]},
    'blinkProud': {'frames': [f(SHUT + GRIN + BLUSH)], 'moods': ['proud'], 'every': [3, 8]},
    # dimming and brightening as it dreams
    'sleepFlicker': {'frames': [f(SHUT + MOUTH, False, FAINTER)] * 2 + [f(SHUT + MOUTH, False, FAINT)], 'moods': ['sleeping'], 'every': [10, 25]},
    'sleepyYawn': {'frames': [f(HALF + OMOUTH, fade=FAINT), f(SHUT + OMOUTH, fade=FAINT), f(SHUT + OMOUTH, fade=FAINT), f(HALF + MOUTH, fade=FAINT)], 'moods': ['sleepy'], 'every': [15, 35]},
    'nod': {'frames': [f(SHUT + MOUTH, False, FAINT)] * 3 + [f(HALF + MOUTH, False)], 'moods': ['sleepy', 'tired'], 'every': [8, 20]},
    'dreamDrift': {'frames': [f(SHUT + MOUTH, True, FAINTER), f(SHUT + MOUTH, True, FAINTER), f(SHUT + MOUTH, False, FAINTER)], 'moods': ['deepSleep'], 'every': [10, 30]},
}

MINI = [
    '..oooo..',
    '.obbbbo.',
    'obebbebo',
    'obbbbbbo',
    'obbbbbbo',
    'obobbobo',
    '.o.oo.o.',
]
MINI_BLANK = '.' * 8


def mini(px, lift=True):
    rows = MINI + [MINI_BLANK] if lift else [MINI_BLANK] + MINI
    return paint(rows, [(r + (0 if lift else 1), c, l) for r, c, l in px])


# Activities: longer plays in idle, a loop held for `seconds` between a start and an end.
IDLE = f(OPEN + MOUTH + BLUSH)
UPL, UPR = [(4, 3, 'e'), (4, 6, 'e')], [(4, 5, 'e'), (4, 8, 'e')]
DOWNL, DOWNR = [(5, 3, 'e'), (5, 6, 'e')], [(5, 5, 'e'), (5, 8, 'e')]
# will-o'-wisps circling it, out of its way all round, and where its eyes follow the first
RING = [(0, 3), (0, 8), (2, 11), (12, 11), (12, 8), (12, 3), (12, 0), (2, 0)]
FOLLOW = [UPL, UPR, look(1), DOWNR, DOWN, DOWNL, look(-1), UPL]


def wisps(i):
    return [(*RING[i % 8], 't'), (*RING[(i + 4) % 8], 't')]


# a chain hanging under it, its links swinging
CHAIN = [(12, c, 'c') for c in (1, 3, 5, 7, 9)], [(12, c, 'c') for c in (2, 4, 6, 8, 10)]
ACT = {
    # it fades to nothing, peeks out one way and the other, and pops back with a boo
    'hide': {'start': [IDLE, f(look(-1) + MOUTH + BLUSH)],
             'loop': [f(SHUT + MOUTH + BLUSH, fade=FAINT), wisp(), wisp(), f(look(-1), fade=FAINTER), f(look(-1), fade=FAINTER),
                      f(look(1), fade=FAINTER), f(look(1), fade=FAINTER), f(WIDE + OMOUTH), f(JOY + GRIN + BLUSH), f(JOY + GRIN + BLUSH, False)],
             'end': [f(JOY + GRIN + BLUSH), IDLE],
             'seconds': [15, 30], 'every': [60, 150], 'label': {'en': 'playing hide and seek', 'pt-BR': 'brincando de esconde-esconde'}},
    # two wisps circle it, its eyes after one of them, as it bobs
    'wisps': {'start': [IDLE, f(OPEN + OMOUTH + BLUSH, effects=wisps(0)[:1])],
              'loop': [f(FOLLOW[i] + MOUTH + BLUSH, i % 4 < 2, effects=wisps(i)) for i in range(8)],
              'end': [f(OPEN + OMOUTH + BLUSH, effects=wisps(0)[:1]), IDLE],
              'seconds': [15, 35], 'every': [60, 150], 'label': {'en': "playing with will-o'-wisps", 'pt-BR': 'brincando com fogos-fátuos'}},
    # it rattles a chain, looking about with a grin, and lets out a boo
    'chains': {'start': [IDLE, f(OPEN + MOUTH + BLUSH, effects=CHAIN[0])],
               'loop': [f(look(-1) + GRIN + BLUSH, effects=CHAIN[i % 2]) for i in range(2)]
                       + [f(look(1) + GRIN + BLUSH, effects=CHAIN[i % 2]) for i in range(2)]
                       + [f(WIDE + OMOUTH, effects=CHAIN[i % 2]) for i in range(2)]
                       + [f(JOY + GRIN + BLUSH, effects=CHAIN[i % 2]) for i in range(2)],
               'end': [f(OPEN + MOUTH + BLUSH, effects=CHAIN[1]), IDLE],
               'seconds': [10, 25], 'every': [45, 120], 'label': {'en': 'rattling its chains', 'pt-BR': 'arrastando correntes'}},
}
# Anything can cut an activity short, so it starts and ends with idle's face: no jump in the eyes.
for name, a in ACT.items():
    for frame in (a['start'][0], a['end'][-1]):
        assert all(frame[r][c] == IDLE[r][c] for r, c, _ in OPEN + MOUTH), name

# It never walks: it fades out, sparks, and turns up somewhere else with a boo.
SPARK_OUT, SPARK_IN = sparks((3, 3), (6, 8), (9, 5)), sparks((2, 8), (5, 2), (8, 6))
TELEPORT = {
    'vanish': [f(WIDE + OMOUTH), f(SHUT + MOUTH, True, FAINT), f(SHUT + MOUTH, True, FAINTER), wisp(), SPARK_OUT, [BLANK] * len(body(True, None))],
    'appear': [SPARK_IN, wisp(), f(SHUT + MOUTH, True, FAINTER), f(DOWN + MOUTH, True, FAINT), f(WIDE + OMOUTH)],
}

pack = {
    '$schema': SCHEMA,
    'name': 'ghost', 'author': 'Henrique Schroeder',
    'description': 'A friendly ghost that floats instead of walking, fades as it sleeps and turns up elsewhere with a boo.',
    'palette': {'c': '#c3c7d1', 'o': '#5b5b7a', 'b': '#f4f2ff', 'f': '#b9b5d6', 'h': '#7f7b9e', 'e': '#2b2b3a',
                'p': '#f2a0b6', 'w': '#ffffff', 't': '#7cc4f2'},
    'fps': 4,
    'main': {'moods': F, 'variants': V, 'transitions': T, 'actions': A, 'teleport': TELEPORT,
             'activities': {k: {**a, 'moods': ['idle']} for k, a in ACT.items()}},
    'mini': {'tint': 'b', 'moods': {
        'working': [mini([])] * 2 + [mini([], False)] * 2,
        'happy': [mini([(2, 2, 'o'), (2, 5, 'o')])] * 2 + [mini([(2, 2, 'o'), (2, 5, 'o')], False)] * 2,
        'sad': [mini([(3, 2, 't')], False)] * 2 + [mini([(4, 2, 't')], False)] * 2,
    }},
    'personality': {'energetic': 0.6, 'curious': 0.8, 'affectionate': 0.3},
    'speech': {
        'en': {'longThink': ['ooOOoo… hmm'], 'manyReads': ['so many files… spooky!'],
               'manyAgents': ['a whole haunting of agents!'], 'lateNight': ['the night is mine… boo'], 'bored': ['nothing to haunt…'], 'dreaming': ['ooo… zzz… boo…']},
        'pt-BR': {'longThink': ['uuUUuu… hmm'], 'manyReads': ['quanto arquivo… assombroso!'],
                  'manyAgents': ['uma assombração de agents!'], 'lateNight': ['a noite é minha… buu'], 'bored': ['nada pra assombrar…'], 'dreaming': ['uuu… zzz… buu…']},
    },
}
write(pack)
