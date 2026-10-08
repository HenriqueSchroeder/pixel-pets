"""Draws the owl and writes pets/owl.json.

    python3 scripts/make-owl.py

pets/owl.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. Each frame is the owl below with a few pixels painted
over it, so a pose is a short list of (row, column, letter). An owl's beak doesn't
smile: its face lives in the eyes, each a pale disc (y) round a pupil.
"""

from sprites import SCHEMA, paint, write

OWL = [
    'oo........oo',
    'obo......obo',
    'obboooooobbo',
    'obbbbbbbbbbo',
    'oyyybbbbyyyo',
    'oyyybkkbyyyo',
    'obbbbkkbbbbo',
    'obllllllllbo',
    'obllllllllbo',
    '.obllllllbo.',
    '..oooooooo..',
    '..k......k..',
]
MINI = [
    'oo....oo',
    'oboooobo',
    'oyebbeyo',
    'obbkkbbo',
    'obllllbo',
    '.oooooo.',
    '.k....k.',
]

DISCS = (1, 2, 3, 8, 9, 10)
OPEN = [(4, 2, 'e'), (5, 2, 'e'), (4, 9, 'e'), (5, 9, 'e')]
DOWN = [(5, 2, 'e'), (5, 9, 'e')]
UP = [(4, 2, 'e'), (4, 9, 'e')]
# eyes shut: a dark lid line along the bottom of each disc
SHUT = [(5, c, 'o') for c in DISCS]
# heavy lids: the top of each disc shut
HALF = [(4, c, 'o') for c in DISCS] + [(5, 2, 'e'), (5, 9, 'e')]
# ^ ^, drawn dark on the pale discs
JOY = [(4, 2, 'o'), (4, 9, 'o')] + [(5, c, 'o') for c in (1, 3, 8, 10)]
# brows pulled down over the inner edge of each disc
BROW = [(3, 3, 'o'), (3, 4, 'o'), (3, 7, 'o'), (3, 8, 'o')]
BLUSH = [(6, 1, 'p'), (6, 10, 'p')]
# the beak opens
HOOT = [(6, 5, 'e'), (6, 6, 'e')]
# its head turned all the way round: discs and beak out of sight
BACK = [(r, c, 'b') for r in (4, 5) for c in DISCS] + [(5, 5, 'b'), (5, 6, 'b'), (6, 5, 'b'), (6, 6, 'b')]
# feathers ruffled on its chest
RUFFLE = [(7, 3, 'b'), (7, 6, 'b'), (8, 4, 'b'), (8, 8, 'b')]


def look(s):
    return [(r, c + s, l) for r, c, l in OPEN]


def hop(c):
    return [(11, c, '.')]


def w(*ps):
    return [(r, c, 'w') for r, c in ps]


def t(r, c):
    return [(r, c, 't')]


ASLEEP = SHUT
F = {
    # 4 fps: a frame repeated is a pose held for another quarter second
    'sleeping': [ASLEEP] * 4 + [ASLEEP + w((1, 5))] * 2 + [ASLEEP + w((0, 6))] * 2,
    'deepSleep': [ASLEEP + RUFFLE] * 4 + [ASLEEP + RUFFLE + w((1, 5))] * 2 + [ASLEEP + RUFFLE + w((1, 5), (0, 6))] * 2,
    'waking': [OPEN + HOOT + RUFFLE] * 3 + [SHUT],
    'idle': [OPEN],
    'sleepy': [HALF] * 5 + [SHUT] * 3,
    'tired': [HALF] * 4 + [HALF + HOOT] * 2 + [SHUT + HOOT] * 2,
    # drawn facing right; the core mirrors it to walk left
    'walking': [look(1) + hop(2), look(1) + hop(9)],
    'watching': [DOWN] * 6 + [[(5, 3, 'e'), (5, 10, 'e')]] * 2,
    'thinking': [look(-1)] * 4 + [look(1)] * 4,
    'typing': [DOWN + hop(2)] * 2 + [DOWN + hop(9)] * 2,
    'running': [look(1) + w((11, c)) for c in range(3, 9)],
    'writing': [DOWN + RUFFLE + hop(2)] * 2 + [DOWN + hop(9)] * 2,
    'reading': [DOWN],
    'searching': [look(-1)] * 2 + [OPEN] * 2 + [look(1)] * 2 + [OPEN] * 2,
    # drawn with its agents on the right; the core mirrors it when they are on the left
    'supervising': [look(1)] * 6 + [OPEN] * 2,
    'compacting': [DOWN + w((0, 3), (1, 8))] * 2 + [DOWN + w((1, 3), (0, 8))] * 2,
    'sweating': [OPEN + RUFFLE + t(r, 10) for r in (3, 3, 4, 4, 5, 5)],
    'worried': [look(-1)] * 3 + [OPEN] + [look(1) + t(3, 10)] * 3 + [OPEN + RUFFLE],
    'grumpy': [HALF + BROW] * 4 + [HALF + BROW + w((1, 5))] * 2 + [HALF + BROW + w((0, 6))] * 2,
    # chest out, beaming, a sparkle on its head
    'proud': [JOY + BLUSH] * 4 + [JOY + BLUSH + w((1, 5))] * 2 + [JOY + BLUSH + w((0, 6))] * 2,
    'happy': [JOY + BLUSH] * 2 + [JOY + BLUSH + hop(2) + hop(9)] * 2,
    # a long job done: hooting and hopping in falling confetti
    'celebrating': [JOY + BLUSH + HOOT + hop(2) + hop(9) + [(0, 3, 'p'), (1, 6, 't'), (0, 8, 'w')],
                    JOY + BLUSH + [(1, 4, 'w'), (0, 6, 'p'), (1, 8, 't')]] * 4,
    'sad': [DOWN + t(r, 2) for r in (6, 6, 7, 7, 8, 8)],
}
V = {
    'thinking': [[UP] * 8],
    'reading': [[look(-1)] * 3 + [DOWN] * 3 + [look(1)] * 2],
}
T = {
    '*>sleeping': [OPEN, HALF, HALF, SHUT],
    'happy>sleeping': [JOY + BLUSH, JOY, OPEN, HALF, SHUT],
    'sleeping>*': [SHUT, HALF, OPEN + RUFFLE, OPEN],
    'deepSleep>*': [SHUT + RUFFLE, HALF, OPEN + HOOT + RUFFLE, OPEN],
    'deepSleep>waking': [OPEN + HOOT],
    'sleeping>deepSleep': [ASLEEP],
}
# celebrating winds down to sleep the way happy does
T['celebrating>sleeping'] = T['happy>sleeping']

OPEN_EYED = ['idle', 'thinking', 'supervising', 'searching', 'reading', 'compacting', 'watching', 'typing', 'running']
A = {
    # owls blink slowly, lid by lid
    'slowBlink': {'frames': [HALF, SHUT, SHUT, HALF], 'moods': OPEN_EYED, 'every': [3, 8]},
    'blinkWorried': {'frames': [SHUT], 'moods': ['worried', 'sweating'], 'every': [2, 5]},
    'blinkGrumpy': {'frames': [SHUT + BROW], 'moods': ['grumpy'], 'every': [3, 7]},
    # the head goes all the way round, and back
    'headTurn': {'frames': [look(-1), BACK, BACK, BACK, look(1), OPEN], 'moods': ['idle', 'supervising'], 'every': [12, 30]},
    'hoot': {'frames': [OPEN + HOOT, OPEN, OPEN + HOOT], 'moods': ['idle'], 'every': [15, 40]},
    'ruffle': {'frames': [OPEN + RUFFLE] * 2 + [OPEN], 'moods': ['idle', 'reading'], 'every': [10, 25]},
    'sleepyYawn': {'frames': [HALF + HOOT, SHUT + HOOT, SHUT + HOOT, HALF], 'moods': ['sleepy'], 'every': [15, 35]},
    'nod': {'frames': [SHUT] * 3 + [HALF], 'moods': ['sleepy', 'tired'], 'every': [8, 20]},
    'dreamRuffle': {'frames': [ASLEEP + RUFFLE, ASLEEP, ASLEEP + RUFFLE], 'moods': ['sleeping'], 'every': [8, 25]},
}

MINI_STEP = [(6, 1, '.')], [(6, 6, '.')]
MINI_HAPPY = [(2, 1, 'y'), (2, 2, 'o'), (2, 5, 'o'), (2, 6, 'y')]
MINI_SAD = [(3, 1, 't')], [(4, 1, 't')]

pack = {
    '$schema': SCHEMA,
    'name': 'owl', 'author': 'Henrique Schroeder',
    'description': 'A round owl that turns its head all the way round and blinks slowly.',
    'palette': {'o': '#3a2a1e', 'b': '#8a6a4a', 'l': '#d9c2a0', 'y': '#f5e6a8', 'e': '#1a1a1a',
                'k': '#f0a030', 'p': '#f2a0b6', 'w': '#ffffff', 't': '#7cc4f2'},
    'fps': 4,
    'main': {
        'moods': {m: [paint(OWL, f) for f in fr] for m, fr in F.items()},
        'variants': {m: [[paint(OWL, f) for f in loop] for loop in loops] for m, loops in V.items()},
        'transitions': {k: [paint(OWL, f) for f in fr] for k, fr in T.items()},
        'actions': {k: {'frames': [paint(OWL, f) for f in a['frames']], 'moods': a['moods'], 'every': a['every']}
                    for k, a in A.items()},
    },
    'mini': {'tint': 'b', 'moods': {
        'working': [paint(MINI, MINI_STEP[0])] * 2 + [paint(MINI, MINI_STEP[1])] * 2,
        'happy': [paint(MINI, MINI_HAPPY)] * 2 + [paint(MINI, MINI_HAPPY + MINI_STEP[0] + MINI_STEP[1])] * 2,
        'sad': [paint(MINI, MINI_SAD[0])] * 2 + [paint(MINI, MINI_SAD[1])] * 2,
    }},
    'personality': {'energetic': 0.4, 'curious': 0.5, 'affectionate': 0.4},
    'speech': {
        'en': {'longThink': ['hoo… hmm'], 'manyReads': ['so much to read! hoo!'],
               'manyAgents': ['a parliament of agents!'], 'lateNight': ['hoo! night owls, us.'], 'bored': ['hoo… nothing to read'], 'dreaming': ['hoo… zzz… mice…']},
        'pt-BR': {'longThink': ['huu… hmm'], 'manyReads': ['quanta leitura! huu!'],
                  'manyAgents': ['um parlamento de agents!'], 'lateNight': ['huu! somos corujas, né?'], 'bored': ['huu… nada pra ler'], 'dreaming': ['huu… zzz… ratinhos…']},
    },
}
write(pack)
