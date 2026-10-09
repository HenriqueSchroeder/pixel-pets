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
# Settling its feathers, or crouching to spring: the head a pixel lower, the body a row shorter.
BREATH = ['............'] + OWL[:8] + OWL[9:]
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
# chest puffed out: the belly as wide as the body above it
PUFF = [(9, 0, 'o'), (9, 1, 'b'), (9, 2, 'l'), (9, 9, 'l'), (9, 10, 'b'), (9, 11, 'o')]
# one eye shut, the other heavy-lidded: dozing, content
DOZY = [(5, c, 'o') for c in (1, 2, 3)] + [(4, c, 'o') for c in (8, 9, 10)] + [(5, 9, 'e')]


class breath(list):
    """A pose drawn on BREATH: the rows above the one it drops sit a row lower."""


def draw(pose):
    if isinstance(pose, breath):
        return paint(BREATH, [(r + 1 if r < 8 else r, c, l) for r, c, l in pose])
    return paint(OWL, pose)


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
    # perched, awake, breathing slow
    'idle': [OPEN] * 6 + [breath(OPEN)] * 2,
    'sleepy': [HALF] * 5 + [SHUT] * 3,
    'tired': [HALF] * 4 + [HALF + HOOT] * 2 + [SHUT + HOOT] * 2,
    # drawn facing right; the core mirrors it to walk left
    # a waddle: one foot up, both down, the other up, both down
    'walking': [look(1) + hop(2), look(1), look(1) + hop(9), look(1)],
    'watching': [DOWN] * 6 + [[(5, 3, 'e'), (5, 10, 'e')]] * 2,
    'thinking': [look(-1)] * 4 + [look(1)] * 4,
    'typing': [DOWN + hop(2)] * 2 + [DOWN + hop(9)] * 2,
    'running': [look(1) + w((11, c)) for c in range(3, 9)],
    'writing': [DOWN + RUFFLE + hop(2)] * 2 + [DOWN + hop(9)] * 2,
    # reading, breathing slow
    'reading': [DOWN] * 6 + [breath(DOWN)] * 2,
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
    'idle': [[DOZY] * 6 + [breath(DOZY)] * 2],
}
T = {
    '*>sleeping': [OPEN, HALF, HALF, SHUT],
    'happy>sleeping': [JOY + BLUSH, JOY, OPEN, HALF, SHUT],
    'sleeping>*': [SHUT, HALF, OPEN + RUFFLE, OPEN],
    'deepSleep>*': [SHUT + RUFFLE, HALF, OPEN + HOOT + RUFFLE, OPEN],
    'deepSleep>waking': [OPEN + HOOT],
    'sleeping>deepSleep': [ASLEEP],
    # a crouch before it springs for joy
    '*>happy': [breath(OPEN), JOY + BLUSH + hop(2) + hop(9)],
    '*>celebrating': [breath(OPEN + HOOT), JOY + BLUSH + HOOT + hop(2) + hop(9)],
    # and settling back after a reaction
    'happy>*': [JOY, OPEN],
    'sad>*': [DOWN, OPEN],
    # eyes up as a thought starts; a start, feathers on end, when it begins to sweat
    '*>thinking': [UP, UP],
    '*>sweating': [OPEN + HOOT + RUFFLE],
}
# celebrating winds down to sleep the way happy does
T['celebrating>sleeping'] = T['happy>sleeping']

OPEN_EYED = ['idle', 'thinking', 'supervising', 'searching', 'reading', 'compacting', 'watching', 'typing', 'running', 'writing']
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
    # proud of us: chest puffed out, then a smug slow blink
    'puffUp': {'frames': [JOY + BLUSH + PUFF] * 3 + [JOY + BLUSH + PUFF + RUFFLE, JOY + BLUSH], 'moods': ['proud'], 'every': [8, 18]},
    'blinkProud': {'frames': [SHUT + BLUSH] * 2 + [JOY + BLUSH], 'moods': ['proud'], 'every': [3, 8]},
}

# Activities: longer plays in idle, a loop held for `seconds` between a start and an end.
# Eyes down to one side and the other, along a line; up to one side and the other.
READ_L, READ_R = [(5, 1, 'e'), (5, 8, 'e')], [(5, 3, 'e'), (5, 10, 'e')]
UPL, UPR = [(4, 1, 'e'), (4, 8, 'e')], [(4, 3, 'e'), (4, 10, 'e')]
# a book held open against its chest, blue covers either side of white pages, or shut
BOOK = [(8, c, 'w') for c in (3, 4, 7, 8)] + [(8, 5, 'o'), (8, 6, 'o')] + [(9, c, 't') for c in range(3, 9)]
TURN = [(7, 6, 'w'), (8, 7, 't')], [(7, 5, 'w'), (8, 4, 't')]
SHUT_BOOK = [(8, c, 't') for c in range(4, 8)] + [(9, c, 't') for c in range(4, 8)]
# feathers ruffled the other way, and one loose, drifting down at its side
RUFFLE_2 = [(7, 4, 'b'), (7, 8, 'b'), (8, 3, 'b'), (8, 6, 'b')]


def star(r, c):
    return [(r, c, 'y')]


# stars over its head, twinkling in turn
STARS = star(0, 3) + star(1, 7), star(1, 4) + star(0, 8)
ACT = {
    # a book against its chest: eyes along a line and back, a page turned now and then
    'book': {'start': [OPEN + SHUT_BOOK, DOWN + SHUT_BOOK, DOWN + BOOK],
             'loop': [READ_L + BOOK, DOWN + BOOK, READ_R + BOOK, READ_R + BOOK,
                      READ_L + BOOK, DOWN + BOOK, READ_R + BOOK, DOWN + BOOK + TURN[0], DOWN + BOOK + TURN[1], DOWN + BOOK],
             'end': [DOWN + BOOK, HALF + SHUT_BOOK, OPEN + SHUT_BOOK],
             'seconds': [20, 45], 'every': [60, 150], 'label': {'en': 'reading a book', 'pt-BR': 'lendo um livro'}},
    # eyes on the stars twinkling over its head, and a shooting star that makes it hoot
    'stars': {'start': [OPEN + STARS[0], UP + STARS[0]],
              'loop': [UPL + STARS[0], UPL + STARS[1], UPR + STARS[0], UPR + STARS[1],
                       UP + STARS[0] + w((0, 2)), UPL + STARS[1] + w((0, 4), (0, 3)), UP + w((0, 6), (0, 5)) + STARS[0],
                       UPR + w((0, 9), (0, 8)) + HOOT, UPR + STARS[1] + HOOT, UP + STARS[0]],
             'end': [UP + STARS[1], OPEN + STARS[0]],
             'seconds': [15, 35], 'every': [60, 150], 'label': {'en': 'stargazing', 'pt-BR': 'olhando as estrelas'}},
    # it preens: head this way and that, feathers up, a slow blink of content
    'preen': {'start': [OPEN, look(1)],
              'loop': [look(1) + RUFFLE, HALF + RUFFLE, look(-1) + RUFFLE_2, SHUT + RUFFLE_2, look(1) + RUFFLE, DOZY],
              'end': [HALF + [(10, 0, 'b')], OPEN + [(11, 1, 'b')]],
              'seconds': [10, 25], 'every': [45, 120], 'label': {'en': 'preening its feathers', 'pt-BR': 'ajeitando as penas'}},
}
# Anything can cut an activity short, so it starts and ends with idle's face: no jump in the eyes.
for name, a in ACT.items():
    for frame in (draw(a['start'][0]), draw(a['end'][-1])):
        assert all(frame[r][c] == letter for r, c, letter in OPEN), name

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
    'personality': {'energetic': 0.4, 'curious': 0.5, 'affectionate': 0.4},
    'speech': {
        'en': {'longThink': ['hoo… hmm'], 'manyReads': ['so much to read! hoo!'],
               'manyAgents': ['a parliament of agents!'], 'lateNight': ['hoo! night owls, us.'], 'bored': ['hoo… nothing to read'], 'dreaming': ['hoo… zzz… mice…']},
        'pt-BR': {'longThink': ['huu… hmm'], 'manyReads': ['quanta leitura! huu!'],
                  'manyAgents': ['um parlamento de agents!'], 'lateNight': ['huu! somos corujas, né?'], 'bored': ['huu… nada pra ler'], 'dreaming': ['huu… zzz… ratinhos…']},
    },
}
write(pack)
