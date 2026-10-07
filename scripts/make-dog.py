"""Draws the dog and writes pets/dog.json.

    python3 scripts/make-dog.py

pets/dog.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. Each frame is the head below with a few pixels painted
over it (eyes, mouth, tail, effects), so a pose is a short list of (row, column, letter).
"""

from sprites import SCHEMA, paint, write

# Floppy ears (d) hang at the sides; a light muzzle (l) with its nose (e) is built in.
HEAD = [
    '...oooooo...',
    '..obbbbbbo..',
    '.dobbbbbbod.',
    'ddobbbbbbodd',
    'ddobbbbbbodd',
    'ddobbbbbbodd',
    '.dobleelbod.',
    '..obllllbo..',
    '..obllllbo..',
    '..obbbbbbo..',
    '..oooooooo..',
    '..o......o..',
]
# small enough that the ears hang straight off the face, with no outline between
MINI = [
    '..oooo..',
    '.obbbbo.',
    'dbebbebd',
    'dbbllbbd',
    '.obeebo.',
    '..oooo..',
    '..o..o..',
]

OPEN = [(3, 4, 'e'), (4, 4, 'e'), (3, 7, 'e'), (4, 7, 'e')]
SHUT = [(4, 4, 'o'), (4, 3, 'o'), (4, 7, 'o'), (4, 8, 'o')]
DOWN = [(4, 4, 'e'), (4, 7, 'e')]
UP = [(3, 4, 'e'), (3, 7, 'e')]
# ^ ^, closed in a smile
SMILE = [(3, 4, 'o'), (4, 3, 'o'), (4, 5, 'o'), (3, 7, 'o'), (4, 6, 'o'), (4, 8, 'o')]
# heavy lids: a drooping line over half an eye
HALF = [(3, 3, 'o'), (3, 4, 'o'), (4, 4, 'e'), (3, 7, 'o'), (3, 8, 'o'), (4, 7, 'e')]
# brows slanting down to the middle, over each eye
BROW = [(1, 3, 'o'), (2, 4, 'o'), (2, 7, 'o'), (1, 8, 'o')]
# a dog at rest looks pleased: the corners of its mouth turn up under the nose
MOUTH = [(7, 4, 'o'), (8, 5, 'o'), (8, 6, 'o'), (7, 7, 'o')]
OMOUTH = [(7, 5, 'o'), (7, 6, 'o'), (8, 5, 'o'), (8, 6, 'o')]
GRIN = [(7, 4, 'o'), (8, 4, 'o'), (8, 5, 'o'), (8, 6, 'o'), (8, 7, 'o'), (7, 7, 'o')]
FROWN = [(8, 4, 'o'), (7, 5, 'o'), (7, 6, 'o'), (8, 7, 'o')]
FLAT = [(8, 4, 'o'), (8, 5, 'o'), (8, 6, 'o'), (8, 7, 'o')]
WAVY = [(8, 4, 'o'), (7, 5, 'o'), (8, 6, 'o'), (7, 7, 'o')]
# the tongue hangs out over the chin
TONGUE = [(9, 5, 'p'), (9, 6, 'p')]


def look(s):
    return [(r, c + s, l) for r, c, l in OPEN]


def scan(s):
    return [(4, 4 + s, 'e'), (4, 7 + s, 'e')]


def hop(c):
    return [(11, c, '.')]


def w(*ps):
    return [(r, c, 'w') for r, c in ps]


def t(r, c):
    return [(r, c, 't')]


# the tail pokes out at its right, up or down as it wags
TAIL_UP = [(9, 10, 'd'), (8, 11, 'd')]
TAIL_DOWN = [(9, 10, 'd'), (9, 11, 'd')]
# one ear perks up
EAR_UP = [(1, 0, 'd'), (2, 0, 'd'), (5, 0, '.'), (5, 1, '.')]
ASLEEP = SHUT + MOUTH
WAG = [TAIL_UP, TAIL_DOWN]

F = {
    # 4 fps: a frame repeated is a pose held for another quarter second
    'sleeping': [ASLEEP] * 4 + [ASLEEP + w((1, 10))] * 2 + [ASLEEP + w((0, 11))] * 2,
    'deepSleep': [ASLEEP, ASLEEP + w((1, 10)), ASLEEP + w((1, 10)), ASLEEP + w((1, 10), (0, 11)),
                  ASLEEP + w((1, 10), (0, 11)), ASLEEP + w((0, 11), (0, 9)), ASLEEP + w((0, 11), (0, 9)), ASLEEP],
    'waking': [OPEN + OMOUTH + EAR_UP] * 3 + [SHUT + OMOUTH],
    # sitting around, tail going
    'idle': [OPEN + MOUTH + TAIL_UP] * 2 + [OPEN + MOUTH + TAIL_DOWN] * 2,
    'sleepy': [HALF + MOUTH] * 5 + [SHUT + MOUTH] * 3,
    'tired': [HALF + FLAT] * 4 + [HALF + OMOUTH] * 2 + [SHUT + OMOUTH] * 2,
    # drawn facing right; the core mirrors it to walk left
    'walking': [look(1) + MOUTH + TONGUE + hop(2) + TAIL_UP, look(1) + MOUTH + TONGUE + hop(9) + TAIL_DOWN],
    'watching': [DOWN + MOUTH] * 6 + [[(4, 5, 'e'), (4, 8, 'e')] + MOUTH] * 2,
    # head tilted, one ear up
    'thinking': [look(-1) + MOUTH + EAR_UP] * 4 + [look(1) + MOUTH + EAR_UP] * 4,
    'typing': [OPEN + GRIN + hop(2)] * 2 + [OPEN + GRIN + hop(9)] * 2,
    'running': [look(1) + MOUTH + TONGUE + w((11, c)) for c in range(3, 9)],
    'writing': [DOWN + GRIN + hop(2)] * 2 + [DOWN + GRIN + hop(9)] * 2,
    'reading': [DOWN + MOUTH],
    'searching': [scan(-1) + MOUTH + EAR_UP] * 2 + [scan(0) + MOUTH] * 2 + [scan(1) + MOUTH + EAR_UP] * 2 + [scan(0) + MOUTH] * 2,
    # eyes on the agents beside it (drawn on its right), tail going
    'supervising': [look(1) + MOUTH + TAIL_UP] * 3 + [look(1) + MOUTH + TAIL_DOWN] * 3 + [OPEN + MOUTH] * 2,
    'compacting': [DOWN + MOUTH + w((0, 1), (1, 10))] * 2 + [DOWN + MOUTH + w((1, 1), (0, 10))] * 2,
    'sweating': [OPEN + FROWN + t(r, 8) for r in (2, 2, 3, 3, 4, 4)],
    'worried': [look(-1) + WAVY] * 3 + [OPEN + WAVY] + [look(1) + WAVY + t(3, 8)] * 3 + [OPEN + WAVY],
    'grumpy': [OPEN + BROW + FLAT] * 4 + [OPEN + BROW + FLAT + w((1, 10))] * 2 + [OPEN + BROW + FLAT + w((0, 11))] * 2,
    'proud': [SMILE + GRIN + TONGUE] * 4 + [SMILE + GRIN + TONGUE + w((1, 10))] * 2 + [SMILE + GRIN + TONGUE + w((0, 11))] * 2,
    # tongue out, tail wagging hard
    'happy': [SMILE + GRIN + TONGUE + WAG[i % 2] + (hop(2) + hop(9) if i >= 2 else []) for i in range(4)],
    # a long job done: hopping in falling confetti, tail a blur
    'celebrating': [SMILE + GRIN + TONGUE + TAIL_UP + hop(2) + hop(9) + [(0, 1, 'p'), (1, 10, 't'), (0, 10, 'w')],
                    SMILE + GRIN + TONGUE + TAIL_DOWN + [(1, 1, 'w'), (0, 11, 'p'), (0, 2, 't')]] * 4,
    'sad': [OPEN + FROWN + t(r, 3) for r in (6, 6, 7, 7, 8, 8)],
}
V = {
    'thinking': [[UP + MOUTH + EAR_UP] * 8],
    'reading': [[scan(-1) + MOUTH] * 3 + [scan(0) + MOUTH] * 3 + [scan(1) + MOUTH] * 2],
}
T = {
    '*>sleeping': [OPEN + MOUTH, OPEN + OMOUTH, DOWN + OMOUTH, SHUT + OMOUTH, SHUT + MOUTH],
    'happy>sleeping': [SMILE + GRIN + TONGUE, SMILE + MOUTH, OPEN + MOUTH, DOWN + OMOUTH, SHUT + OMOUTH, SHUT + MOUTH],
    'sleeping>*': [SHUT + MOUTH, DOWN + MOUTH, OPEN + OMOUTH + EAR_UP, OPEN + OMOUTH, OPEN + MOUTH],
    'deepSleep>*': [SHUT + MOUTH, DOWN + MOUTH, OPEN + OMOUTH + EAR_UP, OPEN + OMOUTH, OPEN + MOUTH],
    'deepSleep>waking': [OPEN + OMOUTH],
    'sleeping>deepSleep': [ASLEEP],
}
# celebrating winds down to sleep the way happy does
T['celebrating>sleeping'] = T['happy>sleeping']

MOUTH_FACES = ['idle', 'supervising', 'reading', 'compacting', 'watching']
A = {
    'blink': {'frames': [SHUT + MOUTH], 'moods': MOUTH_FACES, 'every': [2, 6]},
    'blinkTwice': {'frames': [SHUT + MOUTH, OPEN + MOUTH, SHUT + MOUTH], 'moods': MOUTH_FACES, 'every': [9, 20]},
    # thinking and searching keep an ear up, blinks included
    'blinkTilt': {'frames': [SHUT + MOUTH + EAR_UP], 'moods': ['thinking', 'searching'], 'every': [2, 6]},
    'blinkGrin': {'frames': [SHUT + GRIN], 'moods': ['typing', 'writing'], 'every': [2, 6]},
    'blinkFrown': {'frames': [SHUT + FROWN], 'moods': ['sweating'], 'every': [2, 5]},
    'blinkWorried': {'frames': [SHUT + WAVY], 'moods': ['worried'], 'every': [2, 5]},
    'blinkGrumpy': {'frames': [SHUT + BROW + FLAT], 'moods': ['grumpy'], 'every': [3, 7]},
    'earPerk': {'frames': [OPEN + MOUTH + EAR_UP] * 3 + [OPEN + MOUTH], 'moods': ['idle', 'reading'], 'every': [6, 15]},
    'pant': {'frames': [OPEN + OMOUTH + TONGUE, OPEN + MOUTH + TONGUE] * 2, 'moods': ['idle'], 'every': [10, 25]},
    'scratch': {'frames': [SHUT + GRIN + hop(9), SHUT + GRIN, SHUT + GRIN + hop(9), OPEN + MOUTH], 'moods': ['idle'], 'every': [15, 35]},
    'idleYawn': {'frames': [OPEN + OMOUTH, SHUT + OMOUTH, SHUT + OMOUTH, OPEN + MOUTH], 'moods': ['idle'], 'every': [20, 45]},
    'sleepyYawn': {'frames': [HALF + OMOUTH, SHUT + OMOUTH, SHUT + OMOUTH, HALF + MOUTH], 'moods': ['sleepy'], 'every': [15, 35]},
    'nod': {'frames': [SHUT + MOUTH] * 3 + [HALF + MOUTH], 'moods': ['sleepy', 'tired'], 'every': [8, 20]},
    'dreamKick': {'frames': [ASLEEP + hop(2), ASLEEP, ASLEEP + hop(9)], 'moods': ['sleeping', 'deepSleep'], 'every': [8, 25]},
    'yawn': {'frames': [SHUT + OMOUTH] * 3, 'moods': ['sleeping'], 'every': [15, 40]},
}

MINI_STEP = [(6, 2, '.')], [(6, 5, '.')]
MINI_HAPPY = [(2, 2, 'o'), (2, 5, 'o')]
MINI_SAD = [(3, 2, 't')], [(3, 1, 't')]

pack = {
    '$schema': SCHEMA,
    'name': 'dog', 'author': 'Henrique Schroeder',
    'description': 'A floppy-eared dog that wags its tail and pants when happy.',
    'palette': {'o': '#3b2416', 'b': '#c98a4b', 'd': '#7a4a2a', 'l': '#f2dcb8', 'e': '#1a1a1a',
                'p': '#f2788f', 'w': '#ffffff', 't': '#5ab4ff'},
    'fps': 4,
    'main': {
        'moods': {m: [paint(HEAD, f) for f in fr] for m, fr in F.items()},
        'variants': {m: [[paint(HEAD, f) for f in loop] for loop in loops] for m, loops in V.items()},
        'transitions': {k: [paint(HEAD, f) for f in fr] for k, fr in T.items()},
        'actions': {k: {'frames': [paint(HEAD, f) for f in a['frames']], 'moods': a['moods'], 'every': a['every']}
                    for k, a in A.items()},
    },
    'mini': {'tint': 'b', 'moods': {
        'working': [paint(MINI, MINI_STEP[0])] * 2 + [paint(MINI, MINI_STEP[1])] * 2,
        'happy': [paint(MINI, MINI_HAPPY)] * 2 + [paint(MINI, MINI_HAPPY + MINI_STEP[0] + MINI_STEP[1])] * 2,
        'sad': [paint(MINI, MINI_SAD[0])] * 2 + [paint(MINI, MINI_SAD[1])] * 2,
    }},
    'speech': {
        'en': {'longThink': ['wuf… hmm', '*tilts head* hmm…'], 'manyReads': ['so many files! woof!'],
               'manyAgents': ['a whole pack of agents!'], 'lateNight': ['*yawn* walk tomorrow?']},
        'pt-BR': {'longThink': ['au… hmm', '*inclina a cabeça* hmm…'], 'manyReads': ['quanto arquivo! au!'],
                  'manyAgents': ['uma matilha de agents!'], 'lateNight': ['*boceja* passeio amanhã?']},
    },
}
write(pack)
