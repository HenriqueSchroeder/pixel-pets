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

# Walking it turns side on, nose to the right: an ear hanging, tail up behind.
SIDE = [
    '............',
    '............',
    '.......oooo.',
    '.d....obbbbo',
    '.d....odbebo',
    '..d..oddblle',
    '..dooooobllo',
    '..obbbbbbbo.',
    '..obbbbbbbo.',
    '..obbbbbbbo.',
    '...oooooooo.',
    '...o.o.o.o..',
]
# legs reaching out front and back, then gathered under it; the tail wagging, the tongue out
SPREAD = [(11, c, '.') for c in range(12)] + [(11, c, 'o') for c in (2, 5, 7, 10)]
GATHER = [(11, c, '.') for c in range(12)] + [(11, c, 'o') for c in (3, 4, 8, 9)]
SIDE_WAG = [(3, 1, '.'), (3, 0, 'd')]
SIDE_TONGUE = [(7, 11, 'p')]


# Breathing out, or crouching to spring: the head a pixel lower, the chin row gone.
BREATH = ['............'] + HEAD[:9] + HEAD[10:]


class breath(list):
    """A pose drawn on BREATH: the rows above the one it drops sit a row lower."""


class side(list):
    """A pose drawn on SIDE."""


def draw(pose):
    if isinstance(pose, breath):
        return paint(BREATH, [(r + 1 if r < 9 else r, c, l) for r, c, l in pose])
    return paint(SIDE if isinstance(pose, side) else HEAD, pose)

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
    # side on, facing right; the core mirrors it to walk left
    'walking': [side(SPREAD + SIDE_TONGUE), side(GATHER + SIDE_TONGUE), side(SPREAD + SIDE_WAG + SIDE_TONGUE),
                side(GATHER + SIDE_WAG + SIDE_TONGUE)],
    'watching': [DOWN + MOUTH] * 6 + [[(4, 5, 'e'), (4, 8, 'e')] + MOUTH] * 2,
    # head tilted, one ear up
    'thinking': [look(-1) + MOUTH + EAR_UP] * 4 + [look(1) + MOUTH + EAR_UP] * 4,
    'typing': [OPEN + GRIN + hop(2)] * 2 + [OPEN + GRIN + hop(9)] * 2,
    'running': [look(1) + MOUTH + TONGUE + w((11, c)) for c in range(3, 9)],
    'writing': [DOWN + GRIN + hop(2)] * 2 + [DOWN + GRIN + hop(9)] * 2,
    # reading, breathing slow
    'reading': [DOWN + MOUTH] * 6 + [breath(DOWN + MOUTH)] * 2,
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
    # or lying about content, eyes half shut, tail still
    'idle': [[HALF + MOUTH + TAIL_DOWN] * 6 + [breath(HALF + MOUTH + TAIL_DOWN)] * 2],
}
T = {
    '*>sleeping': [OPEN + MOUTH, OPEN + OMOUTH, DOWN + OMOUTH, SHUT + OMOUTH, SHUT + MOUTH],
    'happy>sleeping': [SMILE + GRIN + TONGUE, SMILE + MOUTH, OPEN + MOUTH, DOWN + OMOUTH, SHUT + OMOUTH, SHUT + MOUTH],
    'sleeping>*': [SHUT + MOUTH, DOWN + MOUTH, OPEN + OMOUTH + EAR_UP, OPEN + OMOUTH, OPEN + MOUTH],
    'deepSleep>*': [SHUT + MOUTH, DOWN + MOUTH, OPEN + OMOUTH + EAR_UP, OPEN + OMOUTH, OPEN + MOUTH],
    'deepSleep>waking': [OPEN + OMOUTH],
    'sleeping>deepSleep': [ASLEEP],
    # a crouch before it springs for joy
    '*>happy': [breath(OPEN + MOUTH), SMILE + GRIN + TONGUE + TAIL_UP + hop(2) + hop(9)],
    '*>celebrating': [breath(OPEN + OMOUTH), SMILE + GRIN + TONGUE + TAIL_UP + hop(2) + hop(9)],
    # and settling back after a reaction
    'happy>*': [SMILE + MOUTH + TAIL_DOWN, OPEN + MOUTH],
    'sad>*': [DOWN + FROWN, OPEN + MOUTH],
    # eyes up and an ear raised as a thought starts; an ear jumps when it begins to sweat
    '*>thinking': [UP + MOUTH, UP + MOUTH + EAR_UP],
    '*>sweating': [OPEN + OMOUTH + EAR_UP],
}
# celebrating winds down to sleep the way happy does
T['celebrating>sleeping'] = T['happy>sleeping']

MOUTH_FACES = ['idle', 'supervising', 'reading', 'compacting', 'watching']
A = {
    'blink': {'frames': [SHUT + MOUTH], 'moods': MOUTH_FACES + ['running'], 'every': [2, 6]},
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
    # proud of us: a little strut on the spot, tail wagging, then a smiling blink
    'strut': {'frames': [SMILE + GRIN + TONGUE + hop(2) + TAIL_UP, SMILE + GRIN + TONGUE + TAIL_DOWN,
                        SMILE + GRIN + TONGUE + hop(9) + TAIL_UP, SHUT + GRIN + TONGUE + TAIL_DOWN],
              'moods': ['proud'], 'every': [6, 14]},
}

# Activities: longer plays in idle, a loop held for `seconds` between a start and an end.
# Eyes up and to its left, after something by its side.
UPL = [(3, 3, 'e'), (3, 6, 'e')]


def ball(r):
    """A tennis ball at its left, two pixels square, its top on row r."""
    return [(r, 0, 'y'), (r, 1, 'y'), (r + 1, 0, 'y'), (r + 1, 1, 'y')]


# squashed flat on the ground, and held in its mouth
BOUNCE = [(11, 0, 'y'), (11, 1, 'y')]
FETCHED = [(7, 5, 'y'), (7, 6, 'y'), (8, 5, 'y'), (8, 6, 'y')]
# a bone across its chin, knobs at either end, or lying on the ground
BONE = [(9, c, 'w') for c in range(3, 9)] + [(8, 2, 'w'), (10, 2, 'w'), (8, 9, 'w'), (10, 9, 'w')]
BONE_DOWN = [(11, c, 'w') for c in range(3, 9)]


def sniffs(c):
    """A puff of breath on the ground under its nose."""
    return [(11, c, 'w')]


ACT = {
    # a ball bounces at its side; it watches, wagging, bats it and catches it at last
    'ball': {'start': [OPEN + MOUTH + TAIL_UP + ball(0), UPL + MOUTH + TAIL_DOWN + ball(3), look(-1) + MOUTH + TAIL_UP + ball(6)],
             'loop': [scan(-1) + MOUTH + TONGUE + TAIL_DOWN + BOUNCE, look(-1) + MOUTH + TONGUE + TAIL_UP + ball(9),
                      UPL + MOUTH + TONGUE + TAIL_DOWN + ball(7), UPL + OMOUTH + TAIL_UP + ball(7),
                      look(-1) + MOUTH + TONGUE + TAIL_DOWN + ball(9), scan(-1) + MOUTH + TONGUE + TAIL_UP + BOUNCE,
                      scan(-1) + GRIN + hop(2) + TAIL_DOWN + ball(9), look(-1) + GRIN + TAIL_UP + ball(7)],
             'end': [scan(-1) + OMOUTH + TAIL_DOWN + BOUNCE, SMILE + FETCHED + TAIL_UP, SMILE + FETCHED + TAIL_DOWN, OPEN + MOUTH + TAIL_UP],
             'seconds': [15, 35], 'every': [60, 150], 'label': {'en': 'playing ball', 'pt-BR': 'brincando de bolinha'}},
    # it picks up a bone and gnaws at it, eyes half shut, tail going slow
    'bone': {'start': [OPEN + MOUTH + TAIL_UP + BONE_DOWN, DOWN + MOUTH + TAIL_UP + BONE_DOWN, breath(DOWN + OMOUTH + TAIL_UP + BONE_DOWN)],
             'loop': [HALF + MOUTH + BONE + TAIL_UP, HALF + OMOUTH + BONE + TAIL_UP, HALF + MOUTH + BONE + TAIL_DOWN,
                      SHUT + OMOUTH + BONE + TAIL_DOWN],
             'end': [OPEN + MOUTH + BONE + TAIL_UP, DOWN + MOUTH + TAIL_UP + BONE_DOWN, OPEN + MOUTH + TAIL_UP + BONE_DOWN],
             'seconds': [15, 40], 'every': [60, 150], 'label': {'en': 'chewing a bone', 'pt-BR': 'roendo um osso'}},
    # nose to the ground, sniffing this way and that, an ear up now and then
    'sniff': {'start': [OPEN + MOUTH + TAIL_UP, breath(DOWN + MOUTH + TAIL_UP)],
              'loop': [breath(DOWN + MOUTH + TAIL_UP + sniffs(4)), breath(DOWN + MOUTH + TAIL_DOWN),
                       breath(scan(1) + MOUTH + TAIL_UP + sniffs(7)), breath(scan(1) + MOUTH + TAIL_DOWN),
                       breath(scan(0) + MOUTH + TAIL_UP + sniffs(5) + sniffs(6)), breath(scan(0) + MOUTH + TAIL_DOWN),
                       OPEN + MOUTH + EAR_UP + TAIL_UP, OPEN + MOUTH + EAR_UP + TAIL_UP],
              'end': [DOWN + MOUTH + TAIL_UP, OPEN + MOUTH + TAIL_UP],
              'seconds': [10, 25], 'every': [45, 120], 'label': {'en': 'sniffing around', 'pt-BR': 'farejando'}},
}

MINI_STEP = [(6, 2, '.')], [(6, 5, '.')]
MINI_HAPPY = [(2, 2, 'o'), (2, 5, 'o')]
MINI_SAD = [(3, 2, 't')], [(3, 1, 't')]

pack = {
    '$schema': SCHEMA,
    'name': 'dog', 'author': 'Henrique Schroeder',
    'description': 'A floppy-eared dog that wags its tail and pants when happy.',
    'palette': {'o': '#3b2416', 'b': '#c98a4b', 'd': '#7a4a2a', 'l': '#f2dcb8', 'e': '#1a1a1a',
                'p': '#f2788f', 'w': '#ffffff', 't': '#5ab4ff', 'y': '#d4e157'},
    'fps': 4,
    'main': {
        'moods': {m: [draw(f) for f in fr] for m, fr in F.items()},
        'variants': {m: [[draw(f) for f in loop] for loop in loops] for m, loops in V.items()},
        'transitions': {k: [draw(f) for f in fr] for k, fr in T.items()},
        'actions': {k: {'frames': [draw(f) for f in a['frames']], 'moods': a['moods'], 'every': a['every']}
                    for k, a in A.items()},
        'activities': {k: {'start': [draw(f) for f in a['start']], 'loop': [draw(f) for f in a['loop']],
                           'end': [draw(f) for f in a['end']], 'seconds': a['seconds'], 'moods': ['idle'],
                           'every': a['every'], 'label': a['label']} for k, a in ACT.items()},
    },
    'mini': {'tint': 'b', 'moods': {
        'working': [paint(MINI, MINI_STEP[0])] * 2 + [paint(MINI, MINI_STEP[1])] * 2,
        'happy': [paint(MINI, MINI_HAPPY)] * 2 + [paint(MINI, MINI_HAPPY + MINI_STEP[0] + MINI_STEP[1])] * 2,
        'sad': [paint(MINI, MINI_SAD[0])] * 2 + [paint(MINI, MINI_SAD[1])] * 2,
    }},
    'personality': {'energetic': 0.8, 'curious': 0.6, 'affectionate': 0.9},
    'speech': {
        'en': {'longThink': ['wuf… hmm', '*tilts head* hmm…'], 'manyReads': ['so many files! woof!'],
               'manyAgents': ['a whole pack of agents!'], 'lateNight': ['*yawn* walk tomorrow?'], 'bored': ['*sighs* ball?', '*flops* so bored…'], 'dreaming': ['wuf… wuf… squirrel…', 'zzz… *paws twitch*']},
        'pt-BR': {'longThink': ['au… hmm', '*inclina a cabeça* hmm…'], 'manyReads': ['quanto arquivo! au!'],
                  'manyAgents': ['uma matilha de agents!'], 'lateNight': ['*boceja* passeio amanhã?'], 'bored': ['*suspira* bolinha?', '*se joga* que tédio…'], 'dreaming': ['au… au… esquilo…', 'zzz… *patas mexem*']},
    },
}
# Anything can cut an activity short, so it starts and ends with idle's face: no jump in the eyes.
for name, a in pack['main']['activities'].items():
    for frame in (a['start'][0], a['end'][-1]):
        assert all(frame[r][c] == letter for r, c, letter in OPEN + MOUTH), name
write(pack)
