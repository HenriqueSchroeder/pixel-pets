"""Draws the fox and writes pets/fox.json.

    python3 scripts/make-fox.py

pets/fox.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. Each frame is the head below with a few pixels painted
over it (eyes, mouth, ears, tail, effects); walking, it turns side on. The top row
is left blank so the fox can leap a row up.
"""

from sprites import SCHEMA, paint, write

# Pointed ears with dark tips (d), white cheeks, muzzle and chest (l), a black nose (e).
HEAD = [
    '..............',
    '..d.....d.....',
    '.odo...odo....',
    '.obbooobbo....',
    '.obbbbbbbo....',
    'obbbbbbbbbo...',
    'obbbbbbbbbo...',
    'ollbbbbbllo...',
    '.olllelllo....',
    '..olllllo.....',
    '.obblllbbo....',
    '.obblllbbo....',
    '.ooooooooo....',
]
BLANK = '.' * 14
MINI = [
    'd......d',
    'dd....dd',
    'obbbbbbo',
    'obebbebo',
    'llbbbbll',
    '.oleelo.',
    '..oooo..',
    '..d..d..',
]

OPEN = [(5, 3, 'e'), (6, 3, 'e'), (5, 7, 'e'), (6, 7, 'e')]
SHUT = [(6, 2, 'o'), (6, 3, 'o'), (6, 7, 'o'), (6, 8, 'o')]
DOWN = [(6, 3, 'e'), (6, 7, 'e')]
UP = [(5, 3, 'e'), (5, 7, 'e')]
# ^ ^, closed in a smile
SMILE = [(5, 3, 'o'), (6, 2, 'o'), (6, 4, 'o'), (5, 7, 'o'), (6, 6, 'o'), (6, 8, 'o')]
HALF = [(5, 2, 'o'), (5, 3, 'o'), (6, 3, 'e'), (5, 7, 'o'), (5, 8, 'o'), (6, 7, 'e')]
# brows slanting down to the middle, over eyes narrowed to a row
BROW = [(4, 2, 'o'), (5, 3, 'o'), (5, 7, 'o'), (4, 8, 'o')]
MOUTH = [(9, 4, 'o'), (9, 6, 'o')]
OMOUTH = [(9, 4, 'o'), (9, 5, 'p'), (9, 6, 'o')]
GRIN = [(9, 3, 'o'), (9, 4, 'p'), (9, 5, 'p'), (9, 6, 'p'), (9, 7, 'o')]
FROWN = [(10, 3, 'o'), (9, 4, 'o'), (9, 5, 'o'), (9, 6, 'o'), (10, 7, 'o')]
FLAT = [(9, 3, 'o'), (9, 4, 'o'), (9, 5, 'o'), (9, 6, 'o'), (9, 7, 'o')]
WAVY = [(9, 3, 'o'), (10, 4, 'o'), (9, 5, 'o'), (10, 6, 'o'), (9, 7, 'o')]
TONGUE = [(10, 5, 'p')]

# ears laid back, out to the sides
EARS_BACK = [(1, 2, '.'), (1, 8, '.'), (2, 2, '.'), (2, 3, '.'), (2, 7, '.'), (2, 8, '.'),
             (2, 1, 'd'), (3, 0, 'd'), (2, 9, 'd'), (3, 10, 'd')]
# the right ear turns out, listening
EAR_FLICK = [(1, 8, '.'), (1, 9, 'd'), (2, 7, '.'), (2, 8, 'o'), (2, 9, 'd'), (2, 10, 'o')]

# the brush curls up at its right, white tip on top, or sweeps out low
TAIL_UP = [(8, 11, 'o'), (8, 12, 'o'),
           (9, 10, 'o'), (9, 11, 'l'), (9, 12, 'l'), (9, 13, 'o'),
           (10, 10, 'o'), (10, 11, 'b'), (10, 12, 'b'), (10, 13, 'o'),
           (11, 10, 'b'), (11, 11, 'b'), (11, 12, 'o'),
           (12, 10, 'o'), (12, 11, 'o')]
TAIL_DOWN = [(10, 10, 'o'), (10, 11, 'o'), (10, 12, 'o'),
             (11, 10, 'b'), (11, 11, 'b'), (11, 12, 'l'), (11, 13, 'o'),
             (12, 10, 'o'), (12, 11, 'o'), (12, 12, 'o')]
# asleep it curls up with its brush over its muzzle
TAIL_WRAP = [(9, 2, 'o')] + [(9, c, 'b') for c in range(3, 8)] + [(9, 8, 'l'), (9, 9, 'l'), (9, 10, 'o')]
ASLEEP = SHUT + TAIL_WRAP


def look(s):
    return [(r, c + s, l) for r, c, l in OPEN]


def scan(s):
    return [(6, 3 + s, 'e'), (6, 7 + s, 'e')]


def paw(c):
    """A front paw (columns c and c+1) lifted off the ground."""
    return [(12, c, '.'), (12, c + 1, '.'), (11, c, 'd'), (11, c + 1, 'd')]


def w(*ps):
    return [(r, c, 'w') for r, c in ps]


def t(r, c):
    return [(r, c, 't')]


def P(pixels, up=False):
    """A frame: the head with `pixels` on it, leapt a row up when `up`."""
    rows = paint(HEAD, pixels)
    return rows[1:] + [BLANK] if up else rows


# Walking it turns side on, nose to the right, brush trailing behind and black socks.
SIDE = [
    '..............',
    '..............',
    '..............',
    '..........d...',
    'oo.......odo..',
    'llo.....obbbo.',
    'lbbo....obbebo',
    'obbbooooobblle',
    '.obbbbbbblllo.',
    '..obbbbbbllo..',
    '..obbbbbbbbo..',
    '...dd....dd...',
    '...dd....dd...',
]
# legs reaching out, front and back, and the brush dipping a row
STRIDE = [(12, 3, '.'), (12, 4, '.'), (12, 2, 'd'), (12, 5, 'd'), (12, 9, '.'), (12, 10, '.'), (12, 8, 'd'), (12, 11, 'd')]
BRUSH_LOW = [(4, 0, '.'), (4, 1, '.'), (5, 0, 'o'), (5, 1, 'o'), (5, 2, '.'), (6, 0, 'l'), (6, 1, 'l'), (6, 2, 'o'),
             (6, 3, '.'), (7, 0, 'l'), (8, 0, 'o')]


def S(pixels):
    return paint(SIDE, pixels)


CONFETTI = [(1, 4, 'p'), (2, 11, 't'), (1, 12, 'w')], [(2, 4, 'w'), (1, 11, 'p'), (1, 3, 't')]
HAPPY = SMILE + GRIN

F = {
    # 4 fps: a frame repeated is a pose held for another quarter second
    'sleeping': [P(ASLEEP)] * 4 + [P(ASLEEP + w((2, 11)))] * 2 + [P(ASLEEP + w((1, 12)))] * 2,
    'deepSleep': [P(ASLEEP + EARS_BACK)] * 2 + [P(ASLEEP + EARS_BACK + w((2, 11)))] * 2
                 + [P(ASLEEP + EARS_BACK + w((2, 11), (1, 12)))] * 2 + [P(ASLEEP + EARS_BACK + w((1, 12), (0, 13)))] * 2,
    'waking': [P(OPEN + OMOUTH + EAR_FLICK + TAIL_UP)] * 3 + [P(SHUT + OMOUTH + TAIL_UP)],
    # sitting; the brush sways in the swish action, so blinks never jump it
    'idle': [P(OPEN + MOUTH + TAIL_UP)] * 4,
    'sleepy': [P(HALF + MOUTH + TAIL_DOWN)] * 5 + [P(SHUT + MOUTH + TAIL_DOWN)] * 3,
    'tired': [P(HALF + FLAT + TAIL_DOWN + EARS_BACK)] * 4 + [P(HALF + OMOUTH + TAIL_DOWN + EARS_BACK)] * 2
             + [P(SHUT + OMOUTH + TAIL_DOWN + EARS_BACK)] * 2,
    # side on, facing right; the core mirrors it to walk left
    'walking': [S(STRIDE), S([]), S(STRIDE), S(BRUSH_LOW)],
    'watching': [P(DOWN + MOUTH + TAIL_UP)] * 6 + [P([(6, 4, 'e'), (6, 8, 'e')] + MOUTH + TAIL_UP)] * 2,
    # one ear turned out, listening
    'thinking': [P(look(-1) + MOUTH + EAR_FLICK + TAIL_UP)] * 4 + [P(look(1) + MOUTH + EAR_FLICK + TAIL_UP)] * 4,
    # paws tapping; the brush holds still so a blink never jumps it
    'typing': [P(OPEN + GRIN + paw(2) + TAIL_UP)] * 2 + [P(OPEN + GRIN + paw(7) + TAIL_UP)] * 2,
    'running': [P(look(1) + GRIN + paw(2) + TAIL_UP), P(look(1) + GRIN + paw(7) + TAIL_DOWN)] * 3,
    'writing': [P(DOWN + GRIN + paw(2) + TAIL_UP)] * 2 + [P(DOWN + GRIN + paw(7) + TAIL_UP)] * 2,
    'reading': [P(DOWN + MOUTH + TAIL_UP)],
    'searching': [P(scan(s) + MOUTH + EAR_FLICK + TAIL_UP) for s in (-1, -1, 0, 0, 1, 1, 0, 0)],
    # eyes on the agents beside it (drawn on its right)
    'supervising': [P(look(1) + MOUTH + TAIL_UP)] * 6 + [P(OPEN + MOUTH + TAIL_UP)] * 2,
    'compacting': [P(DOWN + MOUTH + TAIL_UP + w((0, 3), (1, 11)))] * 2 + [P(DOWN + MOUTH + TAIL_UP + w((1, 3), (0, 11)))] * 2,
    'sweating': [P(OPEN + FROWN + TAIL_DOWN + t(r, 10)) for r in (2, 2, 3, 3, 4, 4)],
    'worried': [P(look(-1) + WAVY + EARS_BACK + TAIL_DOWN)] * 3 + [P(OPEN + WAVY + EARS_BACK + TAIL_DOWN)]
               + [P(look(1) + WAVY + EARS_BACK + TAIL_DOWN + t(4, 10))] * 3 + [P(OPEN + WAVY + EARS_BACK + TAIL_DOWN)],
    'grumpy': [P(DOWN + BROW + FLAT + EARS_BACK + TAIL_DOWN)] * 4 + [P(DOWN + BROW + FLAT + EARS_BACK + TAIL_DOWN + w((2, 11)))] * 2
              + [P(DOWN + BROW + FLAT + EARS_BACK + TAIL_DOWN + w((1, 12)))] * 2,
    'proud': [P(HAPPY + TAIL_UP)] * 4 + [P(HAPPY + TAIL_UP + w((2, 11)))] * 2 + [P(HAPPY + TAIL_UP + w((1, 12)))] * 2,
    # a hop, brush wagging
    'happy': [P(HAPPY + TAIL_UP), P(HAPPY + TAIL_DOWN), P(HAPPY + TAIL_UP, up=True), P(HAPPY + TAIL_DOWN)],
    # a long job done: leaping in confetti
    'celebrating': [P(HAPPY + TAIL_UP + CONFETTI[0], up=True), P(HAPPY + TAIL_DOWN + CONFETTI[1])] * 4,
    'sad': [P(OPEN + FROWN + EARS_BACK + TAIL_DOWN + t(r, 3)) for r in (7, 7, 8, 8, 9, 9)],
}
V = {
    'thinking': [[P(UP + MOUTH + EAR_FLICK + TAIL_UP)] * 8],
    'reading': [[P(scan(-1) + MOUTH + TAIL_UP)] * 3 + [P(scan(0) + MOUTH + TAIL_UP)] * 3 + [P(scan(1) + MOUTH + TAIL_UP)] * 2],
}
T = {
    '*>sleeping': [P(OPEN + MOUTH + TAIL_UP), P(OPEN + OMOUTH + TAIL_DOWN), P(DOWN + OMOUTH + TAIL_DOWN),
                   P(SHUT + OMOUTH + TAIL_DOWN), P(ASLEEP)],
    'happy>sleeping': [P(HAPPY + TAIL_UP), P(SMILE + MOUTH + TAIL_UP), P(OPEN + MOUTH + TAIL_DOWN),
                       P(DOWN + OMOUTH + TAIL_DOWN), P(SHUT + OMOUTH + TAIL_DOWN), P(ASLEEP)],
    'sleeping>*': [P(ASLEEP), P(SHUT + MOUTH + TAIL_DOWN), P(DOWN + MOUTH + TAIL_DOWN),
                   P(OPEN + OMOUTH + EAR_FLICK + TAIL_UP), P(OPEN + MOUTH + TAIL_UP)],
    'deepSleep>*': [P(ASLEEP + EARS_BACK), P(ASLEEP), P(SHUT + MOUTH + TAIL_DOWN),
                    P(OPEN + OMOUTH + EAR_FLICK + TAIL_UP), P(OPEN + MOUTH + TAIL_UP)],
    'deepSleep>waking': [P(OPEN + OMOUTH + EARS_BACK + TAIL_DOWN)],
    'sleeping>deepSleep': [P(ASLEEP + EARS_BACK)],
}
# celebrating winds down to sleep the way happy does
T['celebrating>sleeping'] = T['happy>sleeping']

MOUTH_FACES = ['idle', 'supervising', 'reading', 'compacting', 'watching']
A = {
    'blink': {'frames': [P(SHUT + MOUTH + TAIL_UP)], 'moods': MOUTH_FACES, 'every': [2, 6]},
    'blinkTilt': {'frames': [P(SHUT + MOUTH + EAR_FLICK + TAIL_UP)], 'moods': ['thinking', 'searching'], 'every': [2, 6]},
    'blinkGrin': {'frames': [P(SHUT + GRIN + TAIL_UP)], 'moods': ['typing', 'writing'], 'every': [2, 6]},
    'blinkFrown': {'frames': [P(SHUT + FROWN + TAIL_DOWN)], 'moods': ['sweating'], 'every': [2, 5]},
    'blinkWorried': {'frames': [P(SHUT + WAVY + EARS_BACK + TAIL_DOWN)], 'moods': ['worried'], 'every': [2, 5]},
    'blinkGrumpy': {'frames': [P(SHUT + BROW + FLAT + EARS_BACK + TAIL_DOWN)], 'moods': ['grumpy'], 'every': [3, 7]},
    'earTwitch': {'frames': [P(OPEN + MOUTH + EAR_FLICK + TAIL_UP), P(OPEN + MOUTH + TAIL_UP)] * 2, 'moods': ['idle'], 'every': [6, 15]},
    'earTwitchReading': {'frames': [P(DOWN + MOUTH + EAR_FLICK + TAIL_UP), P(DOWN + MOUTH + TAIL_UP)] * 2,
                         'moods': ['reading'], 'every': [6, 15]},
    'swish': {'frames': [P(OPEN + MOUTH + TAIL_DOWN)] * 2 + [P(OPEN + MOUTH + TAIL_UP)] * 2 + [P(OPEN + MOUTH + TAIL_DOWN)] * 2,
              'moods': ['idle'], 'every': [6, 15]},
    # it hears a mouse under the snow: ear out, a leap, and a dive nose first
    'pounce': {'frames': [P(DOWN + MOUTH + EAR_FLICK + TAIL_UP)] * 2 + [P(HAPPY + TAIL_UP, up=True)] * 2
               + [P(DOWN + OMOUTH + TAIL_DOWN), P(HAPPY + TAIL_UP)],
               'moods': ['idle'], 'every': [20, 45]},
    'bleh': {'frames': [P(SMILE + MOUTH + TONGUE + TAIL_UP)] * 3, 'moods': ['idle', 'proud'], 'every': [15, 35]},
    'idleYawn': {'frames': [P(OPEN + OMOUTH + TAIL_UP), P(SHUT + OMOUTH + TAIL_UP), P(SHUT + OMOUTH + TAIL_UP), P(OPEN + MOUTH + TAIL_UP)],
                 'moods': ['idle'], 'every': [20, 45]},
    'sleepyYawn': {'frames': [P(HALF + OMOUTH + TAIL_DOWN), P(SHUT + OMOUTH + TAIL_DOWN), P(SHUT + OMOUTH + TAIL_DOWN), P(HALF + MOUTH + TAIL_DOWN)],
                   'moods': ['sleepy'], 'every': [15, 35]},
    'nod': {'frames': [P(SHUT + MOUTH + TAIL_DOWN)] * 3 + [P(HALF + MOUTH + TAIL_DOWN)], 'moods': ['sleepy'], 'every': [8, 20]},
    'nodTired': {'frames': [P(SHUT + FLAT + TAIL_DOWN + EARS_BACK)] * 3 + [P(HALF + FLAT + TAIL_DOWN + EARS_BACK)],
                 'moods': ['tired'], 'every': [8, 20]},
    # an ear twitches in its dream; in a deep sleep the ears lie still
    'dreamTwitch': {'frames': [P(ASLEEP + EAR_FLICK), P(ASLEEP), P(ASLEEP + EAR_FLICK)], 'moods': ['sleeping'], 'every': [8, 25]},
}

MINI_STEP = [(7, 2, '.')], [(7, 5, '.')]
MINI_HAPPY = [(3, 2, 'o'), (3, 5, 'o')]
MINI_SAD = [(4, 2, 't')], [(5, 1, 't')]

pack = {
    '$schema': SCHEMA,
    'name': 'fox', 'author': 'Henrique Schroeder',
    'description': 'A red fox that sways its brush and pounces on mice under the snow.',
    'palette': {'o': '#3a1f12', 'b': '#e8742a', 'd': '#2a1a12', 'l': '#fbf3e6', 'e': '#1a1a1a',
                'p': '#f2788f', 'w': '#ffffff', 't': '#5ab4ff'},
    'fps': 4,
    'main': {'moods': F, 'variants': V, 'transitions': T, 'actions': A},
    'mini': {'tint': 'b', 'moods': {
        'working': [paint(MINI, MINI_STEP[0])] * 2 + [paint(MINI, MINI_STEP[1])] * 2,
        'happy': [paint(MINI, MINI_HAPPY)] * 2 + [paint(MINI, MINI_HAPPY + MINI_STEP[0] + MINI_STEP[1])] * 2,
        'sad': [paint(MINI, MINI_SAD[0])] * 2 + [paint(MINI, MINI_SAD[1])] * 2,
    }},
    # curious above all, quick on its feet, and a little aloof
    'personality': {'energetic': 0.7, 'curious': 0.9, 'affectionate': 0.4},
    'speech': {
        'en': {'longThink': ['hmm… *ears up*', '*tilts head* hmm…'], 'manyReads': ['so many files! any mice?'],
               'manyAgents': ['a whole skulk of agents!'], 'lateNight': ['foxes like the night… you too?'],
               'bored': ['*sniffs around* anything to dig?', '*paws at the ground* so bored…'], 'dreaming': ['zzz… mice… under the snow…', 'zzz… *ear twitches*']},
        'pt-BR': {'longThink': ['hmm… *orelhas em pé*', '*inclina a cabeça* hmm…'], 'manyReads': ['quanto arquivo! cadê o rato?'],
                  'manyAgents': ['um bando de agents!'], 'lateNight': ['raposa gosta da noite… você também?'],
                  'bored': ['*fareja em volta* algo pra cavar?', '*cava o chão* que tédio…'], 'dreaming': ['zzz… ratos… sob a neve…', 'zzz… *orelha mexe*']},
    },
}

write(pack)
