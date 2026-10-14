"""Draws the duck and writes pets/duck.json.

    python3 scripts/make-duck.py

pets/duck.json is generated: change the sprites here and run this, rather than
editing the JSON by hand. The duckling stands side on, facing right (the core
mirrors it to face left), with a blank row over its head to hop into and four
blank columns before its beak for the things it plays with. Each frame is one of
the bodies below with a few pixels painted over it, each a (row, column, letter).
"""

from sprites import SCHEMA, paint, write

BLANK = '.' * 16
DUCK = [
    BLANK,
    '......oooo......',
    '.....oyyyyo.....',
    '.....oylyeo.....',
    '.....oyyyykk....',
    'o....oyyyyk.....',
    'oo..oyyyyyo.....',
    'oyoooyyyyyo.....',
    'oyysssyyyyo.....',
    'oysssyyyyyo.....',
    '.oyssyyyyo......',
    '..oooooooo......',
    '....kk..kk......',
]
# the same duckling a row up: a hop, feet off the floor
UP = DUCK[1:] + [BLANK]
# settling, or crouching to spring: the head a row lower, the body a row shorter
LOW = [BLANK] + DUCK[:10] + DUCK[11:]
# tipped forward, tail up and beak to the floor: pecking, or reaching for something
PECK = [
    BLANK,
    BLANK,
    BLANK,
    'o...............',
    'oo..............',
    'oyoo............',
    'oyyyooo.........',
    'oyyyyyyoo.......',
    'oysssyyyyoooo...',
    '.oysssyyyyyyyo..',
    '.oyyssyyyylyeo..',
    '..oooooooyyyyokk',
    '....kk..kk.oooo.',
]
MINI = [
    '....ooo.',
    'o..oyyek',
    'oooyyyyo',
    'oyyoyyyo',
    '.oooooo.',
    '..k..k..',
]

EYE = (3, 9)
LOOK_UP = [(3, 9, 'y'), (2, 9, 'e')]
DOWN = [(3, 9, 'y'), (4, 9, 'e')]
BACK = [(3, 9, 'y'), (3, 8, 'e')]
# the eye shut to a dash, and a ^; both drop the shine beside it
SHUT = [(3, 7, 'y'), (3, 9, 'y'), (4, 8, 'o'), (4, 9, 'o')]
JOY = [(3, 7, 'y'), (3, 9, 'y'), (3, 8, 'o'), (2, 9, 'o')]
HALF = [(2, 8, 'o'), (2, 9, 'o')]
# a brow slanting down to the beak
BROW = [(2, 7, 'o'), (2, 8, 'o'), (3, 8, 'o')]
BLUSH = [(4, 8, 'p')]
# the beak opens: the bottom half drops a row
QUACK = [(5, 10, 'o'), (6, 10, 'k'), (6, 11, 'k')]
# the wing lifted off its side, up over its back, and halfway down again
WING_CLEAR = [(r, c, 'y') for r, c in ((8, 3), (8, 4), (8, 5), (9, 2), (9, 3), (9, 4), (10, 3), (10, 4))]
FLAP = WING_CLEAR + [(3, 1, 'o'), (4, 0, 'o'), (4, 1, 's'), (4, 2, 'o'), (5, 1, 's'), (5, 2, 's'), (5, 3, 'o'),
                     (6, 2, 's'), (6, 3, 's'), (7, 3, 's'), (7, 4, 's')]
FLAP_MID = WING_CLEAR + [(4, 2, 'o'), (4, 3, 'o'), (5, 1, 'o'), (5, 2, 's'), (5, 3, 's'), (5, 4, 'o'),
                         (6, 2, 's'), (6, 3, 's'), (7, 3, 's'), (7, 4, 's')]
# down standing up on its head, chest and back
FLUFF = [(2, 7, 'l'), (6, 7, 'l'), (8, 8, 'l'), (9, 6, 'l')]


def at(rows, pose, dr=0):
    """`pose` painted on `rows`, its face moved `dr` rows to follow the head."""
    return paint(rows, [(r + dr, c, l) for r, c, l in pose])


def d(*parts, props=()):
    """The duck standing, with the face poses in `parts`, and `props` around it."""
    return paint(at(DUCK, [p for part in parts for p in part]), list(props))


def u(*parts, props=()):
    """The duck a row up, mid-hop."""
    return paint(at(UP, [p for part in parts for p in part], -1), list(props))


def lo(*parts, props=()):
    """The duck crouched a row lower; only its head and back drop."""
    pose = [p for part in parts for p in part]
    return paint(paint(LOW, [(r + 1 if r < 10 else r, c, l) for r, c, l in pose]), list(props))


def feet(*cols):
    """A foot lifted: its column blank on the floor."""
    return [(12, c, '.') for c in cols]


def px(letter, *ps):
    return [(r, c, letter) for r, c in ps]


def z(*ps):
    return px('w', *ps)


def tear(r):
    return [(r, 9, 't')]


ASLEEP = SHUT
# z's float up behind its head, where its back leaves room
Z1, Z2, Z3 = z((3, 3)), z((2, 2)), z((1, 3), (2, 2))
CONFETTI = [px('p', (0, 2), (2, 13)) + px('t', (1, 12)) + px('w', (0, 14)),
            px('t', (1, 2), (0, 13)) + px('p', (2, 14)) + px('w', (1, 12))]
F = {
    # 4 fps: a frame repeated is a pose held for another quarter second
    'sleeping': [lo(ASLEEP)] * 4 + [lo(ASLEEP, props=Z1)] * 2 + [lo(ASLEEP, props=Z1 + Z2)] * 2,
    # tucked in a fluffy ball
    'deepSleep': [lo(ASLEEP, FLUFF)] * 4 + [lo(ASLEEP, FLUFF, props=Z1)] * 2 + [lo(ASLEEP, FLUFF, props=Z3)] * 2,
    'waking': [d(QUACK, FLAP)] * 3 + [d(SHUT)],
    'idle': [d()] * 6 + [lo()] * 2,
    'sleepy': [d(HALF)] * 5 + [d(SHUT)] * 3,
    'tired': [d(HALF)] * 4 + [lo(HALF, QUACK)] * 2 + [lo(SHUT, QUACK)] * 2,
    # a waddle, drawn facing right: one foot up, both down, the other up, both down
    'walking': [d(feet(8, 9)), d(), d(feet(4, 5)), d()],
    'watching': [d(DOWN)] * 6 + [d(DOWN, BACK)] * 2,
    'thinking': [d(BACK)] * 4 + [d(LOOK_UP)] * 4,
    # pattering its feet as if at the keys
    'typing': [d(DOWN, feet(4, 5))] * 2 + [d(DOWN, feet(8, 9))] * 2,
    # off at full tilt, wings out, dust behind it
    'running': [u(FLAP, props=px('w', (12, 1))), d(FLAP_MID, feet(4, 5), props=px('w', (11, 0))),
                u(FLAP, props=px('w', (12, 2))), d(FLAP_MID, feet(8, 9), props=px('w', (11, 1)))],
    'writing': [d(DOWN, FLUFF, feet(4, 5))] * 2 + [d(DOWN, feet(8, 9))] * 2,
    'reading': [d(DOWN)] * 6 + [lo(DOWN)] * 2,
    'searching': [d(BACK)] * 2 + [d()] * 2 + [d(DOWN)] * 2 + [d()] * 2,
    # drawn with its agents on the right; the core mirrors it when they are on the left
    'supervising': [d()] * 6 + [d(QUACK)] * 2,
    'compacting': [lo(DOWN, FLUFF)] * 2 + [d(DOWN, FLAP)] * 2,
    'sweating': [d(FLUFF, props=px('t', (r, 12))) for r in (1, 1, 2, 2, 3, 3)],
    'worried': [d(BACK)] * 3 + [d()] + [d(props=px('t', (1, 12)))] * 3 + [d(FLUFF)],
    'grumpy': [d(BROW)] * 4 + [lo(BROW)] * 2 + [d(BROW, FLUFF)] * 2,
    # chest out, beaming, a sparkle over its head
    'proud': [d(JOY, BLUSH)] * 4 + [d(JOY, BLUSH, props=px('w', (0, 7)))] * 2 + [d(JOY, BLUSH, props=px('y', (0, 6)))] * 2,
    'happy': [d(JOY, BLUSH)] * 2 + [u(JOY, BLUSH, FLAP)] * 2,
    # a long job done: quacking and hopping in falling confetti
    'celebrating': [u(JOY, BLUSH, QUACK, FLAP, props=CONFETTI[0]), d(JOY, BLUSH, FLAP_MID, props=CONFETTI[1])] * 4,
    # crouched, its eye a row lower: the tear starts under it
    'sad': [lo(DOWN, props=tear(r)) for r in (6, 6, 7, 7, 8, 8)],
}
V = {
    'thinking': [[d(LOOK_UP)] * 8],
    'idle': [[d(HALF)] * 6 + [lo(HALF)] * 2],
    # a nibble at nothing on the floor
    'searching': [[d(DOWN)] * 2 + [PECK] * 2 + [d(DOWN)] * 2 + [d()] * 2],
}
T = {
    '*>sleeping': [d(), d(HALF), lo(HALF), lo(SHUT)],
    'happy>sleeping': [d(JOY, BLUSH), d(JOY), d(), d(HALF), lo(SHUT)],
    'sleeping>*': [lo(SHUT), d(HALF), d(FLUFF), d()],
    'deepSleep>*': [lo(SHUT, FLUFF), d(HALF), d(QUACK, FLAP), d()],
    'deepSleep>waking': [d(QUACK)],
    'sleeping>deepSleep': [lo(ASLEEP)],
    # a crouch before it springs for joy
    '*>happy': [lo(), u(JOY, BLUSH, FLAP)],
    '*>celebrating': [lo(QUACK), u(JOY, BLUSH, QUACK, FLAP)],
    'happy>*': [d(JOY), d()],
    'sad>*': [d(DOWN), d()],
    '*>thinking': [d(LOOK_UP), d(LOOK_UP)],
    '*>sweating': [u(QUACK, FLUFF)],
}
T['celebrating>sleeping'] = T['happy>sleeping']

# not running or compacting: a blink would drop its wings and land it mid-hop
OPEN_EYED = ['idle', 'thinking', 'supervising', 'searching', 'reading', 'watching', 'typing', 'writing']
A = {
    'blink': {'frames': [d(SHUT)], 'moods': OPEN_EYED, 'every': [3, 8]},
    'blinkWorried': {'frames': [d(SHUT)], 'moods': ['worried', 'sweating'], 'every': [2, 5]},
    'blinkGrumpy': {'frames': [d(SHUT, BROW)], 'moods': ['grumpy'], 'every': [3, 7]},
    'quack': {'frames': [d(QUACK), d(), d(QUACK)], 'moods': ['idle'], 'every': [15, 40]},
    # a flap of its little wings, and a shake that fluffs it up
    'flap': {'frames': [d(FLAP), d(FLAP_MID), d(FLAP), d(FLAP_MID), d(FLUFF), d()], 'moods': ['idle', 'watching'], 'every': [12, 30]},
    'peck': {'frames': [d(DOWN), PECK, d(DOWN), PECK, d()], 'moods': ['idle', 'searching'], 'every': [10, 25]},
    'sleepyYawn': {'frames': [d(HALF, QUACK), d(SHUT, QUACK), d(SHUT, QUACK), d(HALF)], 'moods': ['sleepy'], 'every': [15, 35]},
    'nod': {'frames': [lo(SHUT)] * 3 + [d(HALF)], 'moods': ['sleepy', 'tired'], 'every': [8, 20]},
    'dreamFluff': {'frames': [lo(ASLEEP, FLUFF), lo(ASLEEP), lo(ASLEEP, FLUFF)], 'moods': ['sleeping'], 'every': [8, 25]},
    'proudFlap': {'frames': [d(JOY, BLUSH, FLAP)] * 2 + [u(JOY, BLUSH, FLAP, QUACK), d(JOY, BLUSH)], 'moods': ['proud'], 'every': [8, 18]},
}

# Activities: longer plays in idle, a loop held for `seconds` between a start and an end.

# a puddle round its feet, and the water it splashes up either side
PUDDLE_SMALL = px('a', *((12, c) for c in range(3, 11)))
PUDDLE = px('a', *((12, c) for c in range(0, 14)))
SPLASH = (px('a', (11, 0), (11, 13)) + px('w', (10, 0), (10, 14)),
          px('a', (10, 0), (10, 14)) + px('w', (9, 14), (8, 15)))


def wet(frame, water=PUDDLE):
    """`water` under the duck: only where the frame is blank, so its feet stand in it."""
    return paint(frame, [(r, c, l) for r, c, l in water if frame[r][c] == '.'])


# crumbs of bread before it, one fewer each time it pecks
CRUMBS = [px('c', (12, 12), (12, 14), (12, 15)), px('c', (12, 14), (12, 15)), px('c', (12, 15)), []]
# a rubber duck before it, looking back at it; it squeaks
RUBBER = px('y', (9, 13), (9, 14), (11, 13), (11, 14), (11, 15), (12, 13), (12, 14), (10, 14)) + px('k', (10, 12)) + px('e', (10, 13))
SQUEAK = px('w', (7, 14), (8, 15))
NOTE = px('w', (0, 12), (1, 12), (0, 13))
# a butterfly, wings open or shut, where it flits
def fly(r, c, open_):
    if open_:
        return px('v', (r - 1, c - 1), (r - 1, c + 1)) + px('p', (r, c - 1), (r, c + 1)) + px('e', (r - 1, c), (r, c))
    return px('v', (r - 1, c)) + px('p', (r, c))


# dizzy stars round its head after a tumble
STARS = (px('y', (0, 5), (1, 11)), px('y', (0, 10), (1, 4)))
DUST = (px('w', (12, 0)), px('w', (11, 1), (12, 2)))
ACT = {
    # a puddle wells up at its feet: it stamps, hops and splashes, quacking
    'puddle': {'start': [d(), wet(d(DOWN), PUDDLE_SMALL), wet(d(DOWN))],
               'loop': [wet(u(JOY, FLAP)), wet(d(JOY, QUACK), PUDDLE + SPLASH[0]), wet(d(JOY), PUDDLE + SPLASH[1]),
                        wet(d(DOWN)), wet(d(DOWN, feet(4, 5))), wet(d(DOWN), PUDDLE + SPLASH[0]),
                        wet(d(DOWN, feet(8, 9))), wet(d(JOY), PUDDLE + SPLASH[0]), wet(d(JOY, BLUSH))],
               'end': [wet(d(FLUFF), PUDDLE_SMALL), d(FLAP), d()],
               'seconds': [12, 30], 'every': [60, 150], 'label': {'en': 'splashing in a puddle', 'pt-BR': 'chapinhando numa poça'}},
    # bread crumbs before it: it pecks them up one by one, and looks round for more
    'crumbs': {'start': [d(props=CRUMBS[0]), d(DOWN, props=CRUMBS[0])],
               'loop': [PECK, d(DOWN, props=CRUMBS[1]), d(JOY, props=CRUMBS[1]), paint(PECK, CRUMBS[2]), d(DOWN, props=CRUMBS[2]),
                        paint(PECK, CRUMBS[3]), d(JOY, BLUSH), d(BACK), d(), d(DOWN, props=CRUMBS[0])],
               'end': [d(JOY, BLUSH), d()],
               'seconds': [10, 25], 'every': [45, 120], 'label': {'en': 'pecking at crumbs', 'pt-BR': 'bicando migalhas'}},
    # a rubber duck: it quacks at it, it squeaks back, it hops, and they get on fine
    'rubberDuck': {'start': [d(props=RUBBER), d(DOWN, props=RUBBER)],
                   'loop': [d(props=RUBBER), d(QUACK, props=RUBBER), d(props=RUBBER), d(props=RUBBER),
                            d(props=RUBBER + SQUEAK), u(QUACK, FLUFF, props=RUBBER), d(BACK, props=RUBBER),
                            d(JOY, BLUSH, props=RUBBER), d(JOY, BLUSH, QUACK, props=RUBBER + NOTE), d(JOY, BLUSH, props=RUBBER)],
                   'end': [d(DOWN, props=RUBBER), d()],
                   'seconds': [15, 35], 'every': [60, 150], 'label': {'en': 'talking to a rubber duck', 'pt-BR': 'conversando com um patinho de borracha'}},
    # it preens: beak in its feathers, a shake, and a puff of down drifting off
    'preen': {'start': [d(), d(BACK)],
              'loop': [d(SHUT, FLUFF), lo(SHUT, FLUFF), d(BACK, FLAP), d(SHUT, FLUFF), d(FLAP, FLUFF),
                       d(HALF, props=px('l', (3, 2))), d(HALF, props=px('l', (2, 1)))],
              'end': [d(HALF, props=px('l', (1, 0))), d()],
              'seconds': [10, 25], 'every': [45, 120], 'label': {'en': 'preening its down', 'pt-BR': 'ajeitando as penugens'}},
    # a butterfly flits by: it follows it, snaps, misses, and watches it go
    'butterfly': {'start': [d(props=fly(4, 14, True)), d(props=fly(3, 13, False))],
                  'loop': [d(LOOK_UP, props=fly(2, 13, True)), d(LOOK_UP, props=fly(1, 12, False)), d(props=fly(3, 14, True)),
                           d(props=fly(4, 13, False)), d(DOWN, props=fly(5, 14, True)), u(QUACK, FLAP, props=fly(2, 14, True)),
                           d(LOOK_UP, props=fly(1, 13, False)), d(LOOK_UP, props=fly(2, 12, True)), d(LOOK_UP, props=fly(3, 14, False))],
                  'end': [d(LOOK_UP, props=fly(2, 15, True)), d()],
                  'seconds': [12, 30], 'every': [60, 150], 'label': {'en': 'chasing a butterfly', 'pt-BR': 'correndo atrás de uma borboleta'}},
    # it runs off at full tilt, trips over its own feet, sits dazed and gets up again
    'trip': {'start': [d(), lo()],
             'loop': [u(FLAP, props=DUST[0]), d(FLAP_MID, feet(4, 5), props=DUST[1]), u(FLAP, props=DUST[0]), d(FLAP_MID, feet(8, 9), props=DUST[1]),
                      u(QUACK, FLUFF), lo(SHUT, FLUFF, props=STARS[0]), lo(SHUT, props=STARS[1]),
                      lo(HALF, props=STARS[0]), d(FLAP), d(FLUFF)],
             'end': [d(JOY, BLUSH), d()],
             'seconds': [8, 20], 'every': [60, 180], 'label': {'en': 'tripping over its own feet', 'pt-BR': 'tropeçando nos próprios pés'}},
}
# Anything can cut an activity short, so it starts and ends with idle's face: no jump in the eye.
r, c = EYE
for name, a in ACT.items():
    for frame in (a['start'][0], a['end'][-1]):
        assert frame[r][c] == 'e' and frame[r][c + 1] == 'o', name

MINI_STEP = [(5, 2, '.')], [(5, 5, '.')]
MINI_HAPPY = [(1, 6, 'o')]
MINI_SAD = [(2, 6, 't')], [(3, 6, 't')]

pack = {
    '$schema': SCHEMA,
    'name': 'duck', 'author': 'Henrique Schroeder',
    'description': 'A yellow duckling that waddles, quacks and splashes in puddles.',
    'palette': {'o': '#6b4410', 'y': '#ffd83a', 'l': '#fff2a0', 's': '#e9ad1c', 'k': '#f5871f', 'e': '#1a1a1a',
                'w': '#ffffff', 'p': '#f7a0a0', 't': '#7cc4f2', 'a': '#5aa8e6', 'c': '#b07a3a', 'v': '#c08af2'},
    'fps': 4,
    'main': {
        'moods': F,
        'variants': V,
        'transitions': T,
        'actions': A,
        'activities': {k: {'start': a['start'], 'loop': a['loop'], 'end': a['end'], 'seconds': a['seconds'],
                           'moods': ['idle'], 'every': a['every'], 'label': a['label']} for k, a in ACT.items()},
    },
    'mini': {'tint': 'y', 'moods': {
        'working': [paint(MINI, MINI_STEP[0])] * 2 + [paint(MINI, MINI_STEP[1])] * 2,
        'happy': [paint(MINI, MINI_HAPPY)] * 2 + [paint(MINI, MINI_HAPPY + MINI_STEP[0] + MINI_STEP[1])] * 2,
        'sad': [paint(MINI, MINI_SAD[0])] * 2 + [paint(MINI, MINI_SAD[1])] * 2,
    }},
    'personality': {'energetic': 0.7, 'curious': 0.7, 'affectionate': 0.6},
    'speech': {
        'en': {'longThink': ['quack… hmm'], 'manyReads': ['so many crumbs of code!'],
               'manyAgents': ['a whole flock!'], 'lateNight': ['quack… past my bedtime'], 'bored': ['quack? anyone?'], 'dreaming': ['zzz… bread…']},
        'pt-BR': {'longThink': ['quá… hmm'], 'manyReads': ['quanta migalha de código!'],
                  'manyAgents': ['virou um bando!'], 'lateNight': ['quá… passou da minha hora'], 'bored': ['quá? alguém aí?'], 'dreaming': ['zzz… pãozinho…']},
    },
}
write(pack)
