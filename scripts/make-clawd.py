"""Draws Clawd, the Claude Code mascot, and writes pets/clawd.json.

    python3 scripts/make-clawd.py

Fan art of the critter on Claude Code's welcome screen, not made by Anthropic.
pets/clawd.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. Each frame is Clawd below with a few pixels painted over
it. Like the original it is one flat block with no outline and no mouth, so its
face lives in its eyes and its arms; a mouth shows only when it yawns or cheers.
"""

from sprites import SCHEMA, paint, write

# Two rows of sky over it for effects; then its body, arms and four legs, as on
# the welcome screen.
CLAWD = [
    '................',
    '................',
    '..bbbbbbbbbbbb..',
    '..bbbbbbbbbbbb..',
    '..bbbbbbbbbbbb..',
    'bbbbbbbbbbbbbbbb',
    '..bbbbbbbbbbbb..',
    '..bbbbbbbbbbbb..',
    '...b.b....b.b...',
    '...b.b....b.b...',
]
# Breathing out, or crouching to spring: the body a row shorter, the head a pixel lower.
BREATH = ['................'] + CLAWD[:7] + CLAWD[8:]
# Asleep it dims (d), dimmer still (h) in a deep sleep.
DIM, DIMMER = 'd', 'h'


# Six columns of air on each side, for the whip it cracks at its agents; pixels are
# given as on Clawd itself and shifted in.
PAD = 6


def f(*parts, dim=None, breath=False):
    pixels = [p for part in parts for p in part]
    if breath:
        # the rows above the one it drops sit a row lower
        pixels = [(r + 1 if r < 7 else r, c, l) for r, c, l in pixels]
    base = BREATH if breath else CLAWD
    body = ['.' * PAD + (row.replace('b', dim) if dim else row) + '.' * PAD for row in base]
    return paint(body, [(r, c + PAD, dim if l == 'b' and dim else l) for r, c, l in pixels])


OPEN = [(3, 4, 'e'), (4, 4, 'e'), (3, 11, 'e'), (4, 11, 'e')]
SHUT = [(4, 3, 'e'), (4, 4, 'e'), (4, 11, 'e'), (4, 12, 'e')]
DOWN = [(4, 4, 'e'), (4, 11, 'e')]
UP = [(3, 4, 'e'), (3, 11, 'e')]
# ^ ^
JOY = [(4, 3, 'e'), (3, 4, 'e'), (4, 5, 'e'), (4, 10, 'e'), (3, 11, 'e'), (4, 12, 'e')]
# heavy lids: eyes half shut under a dimmer lid
HALF = [(4, 3, 'e'), (4, 4, 'e'), (3, 4, 'd'), (4, 11, 'e'), (4, 12, 'e'), (3, 11, 'd')]
# a scowl: eyes narrowed under heavy brows
GLARE = [(4, 4, 'e'), (4, 11, 'e'), (3, 3, 'e'), (3, 4, 'e'), (3, 5, 'e'), (3, 10, 'e'), (3, 11, 'e'), (3, 12, 'e')]
BLUSH = [(5, 3, 'p'), (5, 12, 'p')]
# no mouth, until it opens one
OMOUTH = [(6, 7, 'e'), (6, 8, 'e'), (7, 7, 'e'), (7, 8, 'e')]
CHEER = [(6, 6, 'e'), (7, 7, 'e'), (7, 8, 'e'), (6, 9, 'e')]
WOBBLE = [(7, 6, 'e'), (6, 7, 'e'), (7, 8, 'e'), (6, 9, 'e')]

# its arms: out at the sides, raised, or bent down at a keyboard
LEFT_UP = [(5, 0, '.'), (5, 1, '.'), (4, 1, 'b'), (3, 0, 'b')]
RIGHT_UP = [(5, 14, '.'), (5, 15, '.'), (4, 14, 'b'), (3, 15, 'b')]
LEFT_DOWN = [(5, 0, '.'), (6, 1, 'b')]
RIGHT_DOWN = [(5, 15, '.'), (6, 14, 'b')]


def look(s):
    return [(r, c + s, l) for r, c, l in OPEN]


def scan(s):
    return [(4, 4 + s, 'e'), (4, 11 + s, 'e')]


def step(c):
    """It lifts the leg at column `c`."""
    return [(9, c, '.')]


def w(*ps):
    return [(r, c, 'w') for r, c in ps]


def k(*ps):
    return [(r, c, 'k') for r, c in ps]


def y(*ps):
    return [(r, c, 'y') for r, c in ps]


def t(r, c):
    return [(r, c, 't')]


ZZ = [w((1, 13)), w((0, 14))]
F = {
    # 4 fps: a frame repeated is a pose held for another quarter second
    'sleeping': [f(SHUT, dim=DIM)] * 4 + [f(SHUT, ZZ[0], dim=DIM)] * 2 + [f(SHUT, ZZ[1], dim=DIM)] * 2,
    'deepSleep': [f(SHUT, dim=DIMMER)] * 5 + [f(SHUT, ZZ[0], dim=DIMMER)] * 3,
    'waking': [f(OPEN, OMOUTH, LEFT_UP, RIGHT_UP)] * 3 + [f(SHUT, OMOUTH)],
    'idle': [f(OPEN)] * 6 + [f(OPEN, RIGHT_UP)] * 2,
    'sleepy': [f(HALF)] * 5 + [f(SHUT, dim=DIM)] * 3,
    'tired': [f(HALF, LEFT_DOWN, RIGHT_DOWN)] * 4 + [f(HALF, OMOUTH)] * 2 + [f(SHUT, OMOUTH, dim=DIM)] * 2,
    # drawn facing right; the core mirrors it to walk left
    'walking': [f(look(1), step(3), step(10)), f(look(1)), f(look(1), step(5), step(12)), f(look(1))],
    'watching': [f(DOWN)] * 6 + [f([(4, 5, 'e'), (4, 12, 'e')])] * 2,
    'thinking': [f(look(-1))] * 4 + [f(look(1), RIGHT_UP)] * 4,
    # at the keyboard: arms down, tapping
    'typing': [f(OPEN, LEFT_DOWN), f(OPEN, RIGHT_DOWN)] * 2,
    'running': [f(look(1), step(3 if i % 2 else 5), step(10 if i % 2 else 12)) for i in range(6)],
    'writing': [f(DOWN, LEFT_DOWN), f(DOWN, RIGHT_DOWN)] * 2,
    # reading, breathing slow
    'reading': [f(DOWN)] * 6 + [f(DOWN, breath=True)] * 2,
    'searching': [f(scan(-1))] * 2 + [f(scan(0))] * 2 + [f(scan(1))] * 2 + [f(scan(0))] * 2,
    # drawn with its agents on the right; the core mirrors it when they are on the left
    'supervising': [f(look(1))] * 4 + [f(look(1), RIGHT_UP)] * 2 + [f(OPEN)] * 2,
    'compacting': [f(DOWN, w((0, 1), (1, 14)))] * 2 + [f(DOWN, w((1, 1), (0, 14)))] * 2,
    'sweating': [f(OPEN, t(r, 13)) for r in (2, 2, 3, 3, 4, 4)],
    'worried': [f(look(-1), WOBBLE)] * 3 + [f(OPEN, WOBBLE)] + [f(look(1), WOBBLE, t(2, 13))] * 3 + [f(OPEN, WOBBLE)],
    'grumpy': [f(GLARE, LEFT_DOWN, RIGHT_DOWN)] * 4 + [f(GLARE, LEFT_DOWN, RIGHT_DOWN, w((1, 13)))] * 2
              + [f(GLARE, LEFT_DOWN, RIGHT_DOWN, w((0, 14)))] * 2,
    'proud': [f(JOY, BLUSH)] * 4 + [f(JOY, BLUSH, LEFT_UP, w((1, 13)))] * 2 + [f(JOY, BLUSH, LEFT_UP, w((0, 14)))] * 2,
    'happy': [f(JOY, BLUSH, RIGHT_UP)] * 2 + [f(JOY, BLUSH, LEFT_UP, step(3), step(12))] * 2,
    # a long job done: both arms up, cheering, in falling confetti
    'celebrating': [f(JOY, BLUSH, CHEER, LEFT_UP, RIGHT_UP, step(3), step(12), [(0, 2, 'p'), (1, 8, 't'), (0, 13, 'y')]),
                    f(JOY, BLUSH, CHEER, LEFT_UP, RIGHT_UP, [(1, 3, 'y'), (0, 7, 'p'), (1, 12, 't')])] * 4,
    'sad': [f(DOWN, LEFT_DOWN, RIGHT_DOWN, t(r, 3), dim=DIM) for r in (5, 5, 6, 6, 7, 7)],
}
V = {
    'thinking': [[f(UP)] * 4 + [f(UP, LEFT_UP)] * 4],
    'reading': [[f(scan(-1))] * 3 + [f(scan(0))] * 3 + [f(scan(1))] * 2],
    # or sitting content, eyes half shut, breathing slow
    'idle': [[f(HALF)] * 6 + [f(HALF, breath=True)] * 2],
}
T = {
    '*>sleeping': [f(OPEN), f(HALF), f(SHUT, OMOUTH), f(SHUT, dim=DIM)],
    'happy>sleeping': [f(JOY, BLUSH), f(JOY), f(OPEN), f(HALF), f(SHUT, dim=DIM)],
    # it stretches both arms as it wakes
    'sleeping>*': [f(SHUT, dim=DIM), f(HALF), f(OPEN, OMOUTH, LEFT_UP, RIGHT_UP), f(OPEN, LEFT_UP, RIGHT_UP), f(OPEN)],
    'deepSleep>*': [f(SHUT, dim=DIMMER), f(SHUT, dim=DIM), f(HALF), f(OPEN, OMOUTH, LEFT_UP, RIGHT_UP), f(OPEN)],
    'deepSleep>waking': [f(SHUT, dim=DIM)],
    'sleeping>deepSleep': [f(SHUT, dim=DIM)],
    # a crouch before it springs for joy
    '*>happy': [f(OPEN, breath=True), f(JOY, BLUSH, LEFT_UP, step(3), step(12))],
    '*>celebrating': [f(OPEN, LEFT_DOWN, RIGHT_DOWN, breath=True), F['celebrating'][0]],
    # and settling back after a reaction
    'happy>*': [f(JOY, BLUSH), f(OPEN)],
    'sad>*': [f(DOWN, LEFT_DOWN, RIGHT_DOWN, dim=DIM), f(DOWN)],
    # eyes up as a thought starts; a start when it begins to sweat
    '*>thinking': [f(UP), f(UP)],
    '*>sweating': [f(OPEN, OMOUTH, LEFT_UP, RIGHT_UP)],
}
# celebrating winds down to sleep the way happy does
T['celebrating>sleeping'] = T['happy>sleeping']

A = {
    'blink': {'frames': [f(SHUT)], 'moods': ['idle', 'supervising', 'searching', 'reading', 'compacting', 'watching', 'running', 'thinking'], 'every': [2, 6]},
    'blinkTwice': {'frames': [f(SHUT), f(OPEN), f(SHUT)], 'moods': ['idle'], 'every': [9, 20]},
    'blinkTyping': {'frames': [f(SHUT, LEFT_DOWN)], 'moods': ['typing', 'writing'], 'every': [2, 6]},
    'blinkWorried': {'frames': [f(SHUT, WOBBLE)], 'moods': ['worried'], 'every': [2, 5]},
    'blinkGrumpy': {'frames': [f(SHUT, [(3, 3, 'e'), (3, 5, 'e'), (3, 10, 'e'), (3, 12, 'e')], LEFT_DOWN, RIGHT_DOWN)], 'moods': ['grumpy'], 'every': [3, 7]},
    'blinkSweating': {'frames': [f(SHUT)], 'moods': ['sweating'], 'every': [2, 5]},
    # a little wave hello
    'wave': {'frames': [f(OPEN, RIGHT_UP), f(OPEN), f(OPEN, RIGHT_UP), f(OPEN)], 'moods': ['idle'], 'every': [12, 30]},
    # a happy shuffle of its feet
    'shuffle': {'frames': [f(OPEN, step(3)), f(OPEN, step(12)), f(OPEN, step(5)), f(OPEN, step(10))], 'moods': ['idle'], 'every': [15, 35]},
    'stretch': {'frames': [f(SHUT, OMOUTH, LEFT_UP, RIGHT_UP), f(SHUT, LEFT_UP, RIGHT_UP), f(OPEN)], 'moods': ['idle'], 'every': [25, 50]},
    'sleepyYawn': {'frames': [f(HALF, OMOUTH), f(SHUT, OMOUTH), f(SHUT, OMOUTH), f(HALF)], 'moods': ['sleepy'], 'every': [15, 35]},
    'nod': {'frames': [f(SHUT, dim=DIM)] * 3 + [f(HALF)], 'moods': ['sleepy', 'tired'], 'every': [8, 20]},
    'dreamTwitch': {'frames': [f(SHUT, step(3), dim=DIM), f(SHUT, dim=DIM), f(SHUT, step(12), dim=DIM)], 'moods': ['sleeping', 'deepSleep'], 'every': [8, 25]},
    # proud of us: a little strut on the spot, and a pleased blink
    'strut': {'frames': [f(JOY, BLUSH, step(3)), f(JOY, BLUSH), f(JOY, BLUSH, step(12)), f(JOY, BLUSH)], 'moods': ['proud'], 'every': [6, 14]},
    'blinkProud': {'frames': [f(SHUT, BLUSH)], 'moods': ['proud'], 'every': [3, 8]},
    # keeping its agents at it: the whip coiled back over its head, swung round and
    # cracked out at them in a spark, then let fall; they jump from the crack on
    'whip': {'frames': [f(GLARE, RIGHT_UP, k((2, 14), (1, 13), (0, 12), (0, 11)))] * 2
                       + [f(GLARE, k((4, 16), (3, 17), (2, 18), (2, 19)))]
                       + [f(GLARE, k(*[(5, c) for c in range(16, 21)]), y((5, 21)), w((4, 21), (6, 21)))] * 2
                       + [f(OPEN, k((6, 16), (7, 17), (7, 18), (6, 19)))],
             'moods': ['supervising'], 'every': [3, 7], 'startles': 3},
}

MINI = [
    '..bbbbbbbb..',
    '..bebbbbeb..',
    'bbbbbbbbbbbb',
    '..bbbbbbbb..',
    '..b.b..b.b..',
]
MINI_STEP = [(4, 2, '.'), (4, 7, '.')], [(4, 4, '.'), (4, 9, '.')]
MINI_CHEER = [(2, 0, '.'), (1, 0, 'b'), (2, 11, '.'), (1, 11, 'b'), (1, 3, 'b'), (0, 3, 'e'), (1, 8, 'b'), (0, 8, 'e')]
MINI_SAD = [(3, 3, 't')], [(3, 2, 't')]
# at the crack of the whip: arms up, feet off the ground, a bead of sweat
MINI_JUMP = [(4, c, '.') for c in range(12)] + [(2, 0, '.'), (1, 0, 'b'), (2, 11, '.'), (1, 11, 'b'), (0, 11, 't')]

pack = {
    '$schema': SCHEMA,
    'name': 'clawd', 'author': 'Henrique Schroeder',
    'description': "Clawd, the critter on Claude Code's welcome screen (fan art, not by Anthropic), waving its little arms.",
    'palette': {'b': '#d77757', 'd': '#9c4f38', 'h': '#6e3a2a', 'e': '#1a1a1a',
                'p': '#f2a0b6', 'w': '#ffffff', 't': '#7cc4f2', 'y': '#ffd166', 'k': '#5a3a22'},
    'fps': 4,
    'main': {'moods': F, 'variants': V, 'transitions': T, 'actions': A},
    'mini': {'tint': 'b', 'moods': {
        'working': [paint(MINI, MINI_STEP[0])] * 2 + [paint(MINI, MINI_STEP[1])] * 2,
        'happy': [paint(MINI, MINI_CHEER)] * 2 + [paint(MINI, MINI_CHEER + MINI_STEP[0])] * 2,
        'sad': [paint(MINI, MINI_SAD[0])] * 2 + [paint(MINI, MINI_SAD[1])] * 2,
        'startled': [paint(MINI, MINI_JUMP)],
    }},
    'personality': {'energetic': 0.7, 'curious': 0.8, 'affectionate': 0.6},
    'speech': {
        'en': {'longThink': ['hmm… let me think', 'hmm…'], 'manyReads': ['so many files to read!'],
               'manyAgents': ['the whole team is here!'], 'lateNight': ['late night coding, huh?'], 'bored': ['nothing to build…'], 'dreaming': ['zzz… so many tokens…']},
        'pt-BR': {'longThink': ['hmm… deixa eu pensar', 'hmm…'], 'manyReads': ['quanto arquivo pra ler!'],
                  'manyAgents': ['o time todo tá aqui!'], 'lateNight': ['codando de madrugada, hein?'], 'bored': ['nada pra construir…'], 'dreaming': ['zzz… quanto token…']},
    },
}
write(pack)
