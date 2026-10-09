"""Draws the wizard, a pet made of text, and writes pets/wizard.json.

    python3 scripts/make-wizard.py               # writes the pack
    python3 scripts/make-wizard.py show [name]   # prints frames, to look them over

pets/wizard.json is generated: change the art here and run this, rather than
editing the JSON by hand. A frame is a 40x16 canvas: the wizard with the pose's
hat, eyes, mouth, arm and staff, then the effects around it. In a drawing a
space is see-through and '#' an empty cell that hides what is under it.
"""

import random
import sys

from sprites import SCHEMA, write

W, H = 40, 16
FPS = 6

PALETTE = {
    'm': '#9b7cf0',  # hat
    'M': '#6a50c4',  # brim
    'r': '#7b63d8',  # robe
    'f': '#f5c8aa',  # skin
    'e': '#c0ecff',  # eyes
    'p': '#ff8cab',  # cheeks, hearts
    'w': '#ececf2',  # beard
    'g': '#f0c85a',  # belt, gold
    'b': '#a06a3e',  # staff, boots, wood
    'c': '#7ae2ff',  # crystal, magic
    'C': '#3d7f99',  # crystal, asleep
    'y': '#ffd85c',  # stars
    'k': '#fff6c0',  # sparkles
    'v': '#7dffa0',  # potion
    's': '#9aa0ae',  # smoke, cloud
    'z': '#8ea2d8',  # sleep, water
}
INK = '#d8d4f0'


class Canvas:
    def __init__(self):
        self.art = [[' '] * W for _ in range(H)]
        self.ink = [['.'] * W for _ in range(H)]

    def put(self, r, c, rows, color=None):
        """Draws `rows` with its top left at (r, c); off the canvas is dropped.
        `color` is a palette letter, a function from a character to one, or
        None for the ink."""
        if isinstance(rows, str):
            rows = [rows]
        for dr, row in enumerate(rows):
            for dc, ch in enumerate(row):
                y, x = r + dr, c + dc
                if ch == ' ' or not (0 <= y < H and 0 <= x < W):
                    continue
                self.art[y][x] = ' ' if ch == '#' else ch
                self.ink[y][x] = color(ch) if callable(color) else color or '.'
        return self

    def frame(self):
        art = [''.join(row) for row in self.art]
        ink = [''.join('.' if a == ' ' else i for a, i in zip(ra, ri)) for ra, ri in zip(self.art, self.ink)]
        return {'art': art, 'color': ink}


def starry(ch):
    return 'y' if ch in '✦✧☾★·' else 'm'


HATS = {
    'up': [
        '     ╱╲',
        '    ╱  ╲',
        '   ╱ ✦  ╲',
        '  ╱   ☾  ╲',
        ' ╱  ✧     ╲',
    ],
    # asleep, its tip flops over
    'droop': [
        '',
        '   ╭───╮',
        '   │ ✦ ╰─◦',
        '  ╱   ☾  ╲',
        ' ╱  ✧     ╲',
    ],
}
BRIM = '╶══════════════╴'
BEARD = [
    ' ╭░░░░░░╮',
    ' │░░░░░░│',
    '  ╲░░░░╱',
    '   ╲░░╱',
    '    ╲╱',
]
ROBE = [
    '  ╭──        ──╮',
    ' ╱│            │╲',
    '╱ │            │ ╲',
    '╰─┤            ├',
    '  │            │',
    ' ╱              ╲',
    '╰────────────────╯',
]
ROBE_STARS = [(10, 8, '✦'), (11, 17, '✧'), (13, 9, '·'), (13, 15, '·')]
FEET = {'stand': '    ╰──╯    ╰──╯', 'left': '   ╰──╯     ╰──╯', 'right': '    ╰──╯     ╰──╯'}
# The left arm by what it does: hanging in its sleeve, raised to cast, or held out in front.
LEFT = {
    'down': [],
    'up': [(9, 4, '##'), (10, 4, '#'), (11, 4, '##'), (11, 6, '│', 'r'), (7, 5, '╲', 'r'), (6, 4, '╲', 'r'), (5, 3, '●', 'f')],
    'front': [(9, 4, '##'), (10, 4, '#'), (11, 4, '##'), (11, 6, '│', 'r'), (10, 6, '╲', 'r'), (11, 7, '●', 'f')],
}
STAFF_AT = (2, 26)


def staff(cv, lift, glow):
    """The staff in the right hand: `lift` rows up, floating, its crystal in `glow`."""
    r, c = STAFF_AT[0] - lift, STAFF_AT[1]
    cv.put(r, c, ['╭◆╮', '╰┬╯'], lambda ch: glow if ch == '◆' else 'b')
    cv.put(r + 2, c + 1, ['│'] * 10 + ['╵'], 'b')
    cv.put(11, 20, '─' * 7, 'r')
    cv.put(11, c + 1, '●', 'f')


def wizard(eye='◉', mouth='◡◡', hat='up', hat_up=0, left='down', lift=0, glow='c', feet='stand', dy=0, fx=()):
    """A frame: the wizard in a pose, `dy` rows off the ground, then `fx`, each
    (row, column, drawing, color) on the canvas."""
    cv = Canvas()
    body = Canvas()
    body.put(8, 4, ROBE, 'r')
    for r, c, ch in ROBE_STARS:
        body.put(r, c, ch, 'y')
    body.put(12, 7, '═' * 12, 'g')
    body.put(15, 4, FEET[feet], 'b')
    body.put(0 - hat_up, 7, HATS[hat], starry)
    body.put(5, 5, BRIM, 'M')
    body.put(6, 10, eye, 'e')
    body.put(6, 15, eye, 'e')
    body.put(7, 9, '•', 'p')
    body.put(7, 16, '•', 'p')
    body.put(7, 12, mouth, 'f')
    body.put(8, 8, BEARD, 'w')
    for part in LEFT[left]:
        r, c, rows = part[:3]
        body.put(r, c, rows, part[3] if len(part) > 3 else '.')
    staff(body, lift, glow)
    # the whole body, raised `dy` rows
    for y in range(H):
        for x in range(W):
            if 0 <= y - dy < H and body.art[y][x] != ' ':
                cv.art[y - dy][x] = body.art[y][x]
                cv.ink[y - dy][x] = body.ink[y][x]
    for e in fx:
        r, c, rows = e[:3]
        cv.put(r, c, rows, e[3] if len(e) > 3 else '.')
    return cv.frame()


def spot(r, c, text, colors):
    """Effects one character each, `colors` giving each its color."""
    return [(r, c + i, ch, k) for i, (ch, k) in enumerate(zip(text, colors)) if ch != ' ']


# Where things come from, on the canvas.
CRYSTAL = (2, 27)
NOSE = (7, 14)


def glint(t, lift=0):
    """Sparkles turning around the crystal."""
    r, c = CRYSTAL[0] - lift, CRYSTAL[1]
    ring = [(-1, 0), (-1, 2), (0, 3), (1, 2), (1, -2), (0, -3), (-1, -2)]
    out = []
    for k in range(2):
        dr, dc = ring[(t + 3 * k) % len(ring)]
        out.append((r + dr, c + dc, '✦✧·'[(t + k) % 3], 'k'))
    return out


def zs(t, big=False):
    out = []
    for k, (r, c) in enumerate([(4, 21), (3, 23), (2, 22), (0, 24)]):
        if k <= t % 5 and k > t % 5 - 3:
            out.append((r, c, 'Z' if big or k > 1 else 'z', 'z'))
    return out


def bubble(t):
    """A sleeping wizard's bubble, growing at the nose until it pops."""
    shapes = ['', '∘', 'o', 'O', '◯', '*']
    ch = shapes[t % len(shapes)]
    return [(NOSE[0], NOSE[1] + 3, ch, 'c')] if ch else []


def bolt(t):
    """A spell flying off the crystal: a run of stars heading out to the right."""
    out = []
    for k in range(3):
        x = 30 + (t * 2 + k * 3) % 10
        out.append((CRYSTAL[0] + (k - 1), x, '✦✧⋆'[k], 'cyk'[k]))
    return out


RUNES = '∆∑∫Ω∞Ψ√ϟ'


def runes(t, r=1, c=0, n=8, color='c'):
    """Glyphs written into the air, one more each frame."""
    text = ''.join(RUNES[(k * 3) % len(RUNES)] for k in range(min(t + 1, n)))
    return [(r, c + 2 * k, ch, color if k == len(text) - 1 else 'm') for k, ch in enumerate(text)]


BOOK = ['╭─────┬─────╮', '│≡≡≡≡#│#≡≡≡≡│', '╰─────┴─────╯']


def book(r=9, c=6, page=0):
    rows = [BOOK[0], BOOK[1] if page % 2 == 0 else '│≡≡≡##│≡≡≡≡#│', BOOK[2]]
    return [(r + k, c, row, 'b' if k != 1 else 'k') for k, row in enumerate(rows)]


def orb(t):
    """A crystal ball held in front, its mist swirling."""
    mist = '◌◍●◍'[t % 4]
    return [(12, 7, '#╭──╮#', 'c'), (13, 7, '(####)', 'c'), *spot(13, 9, mist + '◌◍'[t % 2], 'kc'), (14, 7, '#╰┬┬╯#', 'b')]


def drop(r, c):
    return [(r, c, '°', 'z')]


def cloud(t, c=0, drops="'"):
    """A little cloud over its head, raining `drops`."""
    rain = [f' {drops} {drops} {drops}', f'{drops} {drops} {drops} ']
    return [(0, c + 1, '#.--.#', 's'), (1, c, '(####)_', 's'), (2, c + 1, "`-----'", 's'), (3, c + 1, rain[t % 2], 'z')]


def burst(r, c, color, size):
    shapes = {
        0: [(0, 0, '·')],
        1: [(-1, 0, '|'), (0, -1, '-✺-'), (1, 0, '|')],
        2: [(-1, -1, '\\|/'), (0, -2, '-- --'), (1, -1, '/|\\')],
        3: [(-1, -2, '·   ·'), (1, -2, '·   ·')],
    }
    return [(r + dr, c + dc, text, color) for dr, dc, text in shapes[size]]


FIREWORK_SPOTS = [(2, 33, 'p'), (1, 2, 'y'), (4, 36, 'c'), (3, 2, 'v'), (0, 37, 'k')]


def fireworks(t):
    out = []
    for k, (r, c, color) in enumerate(FIREWORK_SPOTS):
        size = (t - k) % 6
        if size < 4:
            out += burst(r, c, color, size)
    return out


def confetti(t):
    rnd = random.Random(t)
    spots = [(r, c) for r in range(5) for c in [*range(0, 4), *range(30, W)]]
    return [(r, c, rnd.choice('·*•'), rnd.choice('pycvk')) for r, c in rnd.sample(spots, 6)]


def heart(t, start):
    if not 0 <= t < 5:
        return []
    return [(start[0] - t, start[1] + (t % 2), '♥' if t < 4 else '·', 'p')]


def dissolve(frame, gone, seed):
    """`frame` with a share `gone` of its cells turned to sparkles or nothing."""
    rnd = random.Random(seed)
    art, ink = [list(row) for row in frame['art']], [list(row) for row in frame['color']]
    for y in range(H):
        for x in range(W):
            if art[y][x] != ' ' and rnd.random() < gone:
                if rnd.random() < 0.15:
                    art[y][x], ink[y][x] = rnd.choice('✦✧·*'), rnd.choice('kcy')
                else:
                    art[y][x], ink[y][x] = ' ', '.'
    return {'art': [''.join(r) for r in art], 'color': [''.join(r) for r in ink]}


def swirl(t):
    """Sparkles spiralling around the body, as it vanishes or turns up."""
    ring = [(2, 13), (5, 22), (9, 23), (13, 20), (14, 10), (11, 2), (6, 3), (3, 7)]
    return [(r, c, '✦✧·*'[(t + k) % 4], 'kcy'[(t + k) % 3]) for k, (r, c) in enumerate(ring) if (t + k) % 3 != 0]


def wizard_none(t):
    """Nobody there, only the swirl."""
    cv = Canvas()
    for e in swirl(t):
        cv.put(*e)
    return cv.frame()


IDLE = wizard()
MOODS = {
    'sleeping': [wizard(eye='-', mouth='──', hat='droop', glow='C', fx=zs(t)) for t in range(10)],
    'deepSleep': [wizard(eye='-', mouth='──', hat='droop', glow='C', fx=zs(t // 2, big=True) + bubble(t // 2)) for t in range(12)],
    'waking': [wizard(eye='-', mouth='o ', hat='droop', glow='C'), wizard(eye='◡', mouth='o ', glow='C'), wizard(eye='◉', mouth='o ', hat_up=1, fx=[(0, 18, '!', 'y')]), wizard(fx=[(0, 18, '!', 'y')]), IDLE, IDLE],
    'idle': [wizard(fx=glint(t)) for t in range(8)],
    'sleepy': [wizard(eye='◡', mouth='──', hat='droop' if t >= 3 else 'up', glow='C', fx=[(3, 21, 'z', 'z')] if t >= 4 else []) for t in range(6)],
    'tired': [wizard(eye='=', mouth='──', glow='C', fx=drop(5, 21) if t % 4 < 2 else []) for t in range(8)],
    'watching': [wizard(eye='◕')] * 5 + [wizard(eye='◕', fx=glint(1))],
    'thinking': [wizard(eye='◔', mouth='──', left='front', fx=[e for k, e in enumerate([(4, 21, '·', 's'), (3, 22, '∘', 's'), (2, 23, '○', 's'), (0, 24, '?', 'c')]) if k <= t % 6]) for t in range(8)],
    'typing': [wizard(eye='◕', left='up', fx=runes(t % 8, r=1, c=0, n=4) + glint(t)) for t in range(8)],
    'running': [wizard(eye='◕', mouth='──', glow='k', fx=bolt(t) + glint(t)) for t in range(6)],
    'writing': [wizard(eye='◕', left='front', fx=[(13, 0, '╭────╮', 'k'), (14, 0, '│' + ''.join(RUNES[k] for k in range(min(t, 4))).ljust(4) + '│', 'k'), (15, 0, '╰────╯', 'k'), (12, 1 + min(t, 4), '✎', 'y')]) for t in range(8)],
    'reading': [wizard(eye='◕', left='front', mouth='──', fx=book(page=t // 3)) for t in range(6)],
    'searching': [wizard(eye='◕', left='front', fx=orb(t) + ([(11, 14, '?', 'c')] if t in (2, 3) else [])) for t in range(6)],
    'supervising': [wizard(lift=1, fx=glint(t, lift=1)) for t in range(6)],
    'compacting': [wizard(eye='>', mouth='──', left='front', fx=[(10, 11, '#' + ch + '#', 'c'), (9, 10 + k % 4, '✧', 'k'), (11, 14 - k % 4, '·', 'k')]) for k, ch in enumerate('◯○◦·◦○')],
    'sweating': [wizard(eye='O', mouth='o ', fx=drop(4 + t % 2, 4 - t % 2) + drop(4 + (t + 1) % 2, 21 + t % 2)) for t in range(4)],
    'worried': [wizard(eye='ʘ', mouth='⌒⌒', fx=drop(*[(6, 8), (7, 7), (8, 6), (9, 5)][t])) for t in range(4)],
    'grumpy': [wizard(eye='¬', mouth='──', glow='C', fx=cloud(t, drops='·') + ([(3, 4, 'ϟ', 'y')] if t % 3 == 1 else [])) for t in range(6)],
    'proud': [wizard(eye='^', lift=2, glow='k', fx=glint(t, lift=2) + [(CRYSTAL[0] - 2, CRYSTAL[1] - 4, '─', 'k'), (CRYSTAL[0] - 2, CRYSTAL[1] + 4, '─', 'k')] * (t % 2)) for t in range(6)],
    'happy': [wizard(eye='^', fx=heart(t % 6, (5, 30)) + heart((t + 3) % 6, (4, 24)) + glint(t)) for t in range(6)],
    'celebrating': [wizard(eye='^', mouth='▽ ', left='up', lift=1, glow='k', dy=t % 2, fx=fireworks(t) + confetti(t)) for t in range(8)],
    'sad': [wizard(eye='╥', mouth='⌒⌒', hat='droop', glow='C', fx=cloud(t) + drop(7 + t % 2, 10)) for t in range(6)],
}

VARIANTS = {
    'idle': [[wizard(fx=glint(t) + ([(13 - t // 2, 28, '·', 'c')] if t < 8 else [])) for t in range(8)]],
    'thinking': [[wizard(eye='◔', mouth='──', left='front', fx=[(1, 21, '.' * (t % 4), 'c')]) for t in range(8)]],
}

TRANSITIONS = {
    'sleeping>*': [wizard(eye='-', mouth='o ', hat='droop', glow='C'), wizard(eye='◡', mouth='o ', glow='C')],
    'deepSleep>*': [wizard(eye='-', hat='droop', glow='C', fx=[(NOSE[0], NOSE[1] + 3, '*', 'c')]), wizard(eye='O', mouth='o ', hat_up=1, glow='C')],
    '*>sleeping': [wizard(eye='◡', mouth='o '), wizard(eye='◡', mouth='──', hat='droop', glow='C')],
    '*>celebrating': [wizard(eye='^', left='up', lift=1, glow='k', fx=glint(0, lift=1)), wizard(eye='^', left='up', lift=2, glow='k', fx=burst(2, 33, 'y', 1))],
    '*>happy': [wizard(eye='^', fx=[(4, 24, '♥', 'p')])],
    'sad>*': [wizard(eye='◡', hat='droop'), wizard()],
}

ZAP = [wizard(lift=1, glow='k'), wizard(left='up', lift=2, glow='k', fx=glint(0, 2)), wizard(left='up', lift=2, glow='k', fx=[(0, 26, '\\|/', 'k'), (1, 27, 'ϟ', 'y')]), wizard(left='up', lift=2, glow='k', fx=burst(1, 33, 'c', 2) + [(0, 26, '\\|/', 'k')]), wizard(lift=1, glow='c', fx=burst(1, 33, 'c', 3)), IDLE]
ACTIONS = {
    'blink': {'frames': [wizard(eye='-', fx=glint(0))], 'moods': ['idle'], 'every': [3, 7]},
    'blinkDown': {'frames': [wizard(eye='-')], 'moods': ['watching'], 'every': [3, 8]},
    'blinkUp': {'frames': [wizard(eye='-', lift=1)], 'moods': ['supervising'], 'every': [3, 8]},
    'zap': {'frames': ZAP, 'moods': ['idle'], 'every': [40, 90], 'startles': 2},
    'hatHop': {'frames': [wizard(hat_up=1), wizard(hat_up=2, fx=[(1, 9, '·', 'k')]), wizard(hat_up=1), IDLE], 'moods': ['idle'], 'every': [15, 40]},
    'hatHopHappy': {'frames': [wizard(eye='^', hat_up=1), wizard(eye='^', hat_up=2, fx=[(1, 9, '♥', 'p')]), wizard(eye='^', hat_up=1), wizard(eye='^')], 'moods': ['happy'], 'every': [8, 20]},
    'beardStroke': {'frames': [wizard(eye='◔', mouth='──', left='front'), wizard(eye='◔', mouth='──', left='front', fx=[(12, 10, '●', 'f')]), wizard(eye='◔', mouth='──', left='front')], 'moods': ['thinking'], 'every': [6, 15]},
    'snort': {'frames': [wizard(eye='-', mouth='──', hat='droop', glow='C', fx=[(NOSE[0], NOSE[1] + 3, '*', 'c'), (3, 20, 'Z', 'z')]), wizard(eye='-', mouth='o ', hat='droop', glow='C', fx=[(2, 22, 'Z', 'z')])], 'moods': ['sleeping', 'deepSleep'], 'every': [12, 30]},
    'sneeze': {'frames': [wizard(eye='◡', mouth='o ', fx=[(4, 20, '°', 'k')]), wizard(eye='◡', mouth='o ', fx=[(4, 20, '° °', 'k')]), wizard(eye='-', mouth='▽ ', hat_up=2, fx=swirl(1)), wizard(hat_up=1, fx=swirl(2)), IDLE], 'moods': ['idle'], 'every': [90, 200]},
}

CAULDRON = ['  ╭───────╮', '  │≈≈≈≈≈≈≈│', '  ╰─┬───┬─╯', '   ^^^^^^^']


def cauldron(t, potion='v'):
    out = [(12, 28, CAULDRON[0], 'b'), *spot(13, 30, '│' + '≈≈≈≈≈≈≈' + '│', 'b' + potion * 7 + 'b'), (14, 28, CAULDRON[2], 'b'), *spot(15, 31, '^' * 7, ''.join('gy'[(t + k) % 2] for k in range(7)))]
    for k in range(3):
        y = 11 - (t + 2 * k) % 4
        out.append((y, 31 + 2 * k, 'o°∘'[k], potion))
    return out


def familiar(t):
    """A little bat flapping around the hat."""
    path = [(1, 22), (0, 25), (1, 29), (3, 31), (4, 28), (3, 24)]
    r, c = path[t % len(path)]
    return [(r, c, '╲^◡^╱' if t % 2 else '─^◡^─', 's')]


def orbs(t):
    """Three orbs juggled in a loop over the left hand."""
    loop = [(4, 1), (2, 2), (1, 4), (2, 6), (4, 7), (6, 5), (7, 3), (6, 1)]
    return [(loop[(t + 3 * k) % len(loop)][0], loop[(t + 3 * k) % len(loop)][1], '●', 'pcv'[k]) for k in range(3)]


ACTIVITIES = {
    'potion': {
        'start': [IDLE, wizard(eye='◕', fx=cauldron(0))],
        'loop': [wizard(eye='◕', lift=t % 2, glow='v', fx=cauldron(t, 'v' if t < 4 else 'p') + ([(9, 30, '✧', 'k')] if t % 3 == 0 else [])) for t in range(6)],
        'end': [wizard(eye='^', fx=cauldron(0, 'p') + [(8, 30, ' .--. ', 's'), (9, 29, '(≈✺≈≈)', 's')]), IDLE],
        'seconds': [15, 35], 'every': [60, 150], 'label': {'en': 'brewing a potion', 'pt-BR': 'preparando uma poção'},
    },
    'juggle': {
        'start': [IDLE, wizard(left='up', fx=orbs(0))],
        'loop': [wizard(eye='◔', left='up', fx=orbs(t)) for t in range(8)],
        'end': [wizard(eye='^', left='up', fx=[(5, 2, '●', 'p')]), IDLE],
        'seconds': [10, 25], 'every': [45, 120], 'label': {'en': 'juggling magic orbs', 'pt-BR': 'fazendo malabares com orbes'},
    },
    'familiar': {
        'start': [IDLE, wizard(lift=1, glow='k', fx=burst(2, 30, 'k', 1))],
        'loop': [wizard(eye='◔', fx=familiar(t)) for t in range(6)],
        'end': [wizard(eye='^', fx=[(1, 30, '─^◡^─', 's'), (0, 31, '♥', 'p')]), IDLE],
        'seconds': [12, 30], 'every': [60, 150], 'label': {'en': 'playing with its bat', 'pt-BR': 'brincando com o morcego'},
    },
    'levitate': {
        'start': [IDLE, wizard(left='up', fx=book(r=12, c=27))],
        'loop': [wizard(eye='◔', left='up', fx=book(r=9 - abs(t - 3), c=27, page=t) + [(12 - abs(t - 3), 29 + t % 3, '·', 'k')]) for t in range(6)],
        'end': [wizard(left='up', fx=book(r=12, c=27)), IDLE],
        'seconds': [10, 25], 'every': [60, 150], 'label': {'en': 'levitating a book', 'pt-BR': 'levitando um livro'},
    },
}
# Anything can cut an activity short, so it starts and ends with idle's face.
for name, a in ACTIVITIES.items():
    assert a['start'][0] == IDLE and a['end'][-1] == IDLE, name

# It gets about by vanishing in a swirl of sparkles and turning up elsewhere.
TELEPORT = {
    'vanish': [wizard(lift=1, glow='k', fx=swirl(0)), dissolve(wizard(lift=1, glow='k', fx=swirl(1)), 0.35, 1), dissolve(wizard(fx=swirl(2)), 0.7, 2), dissolve(wizard(fx=swirl(3)), 0.95, 3), wizard_none(4)],
    'appear': [wizard_none(5), dissolve(wizard(fx=swirl(6)), 0.95, 6), dissolve(wizard(fx=swirl(7)), 0.7, 7), dissolve(wizard(fx=swirl(0)), 0.35, 8), wizard(fx=glint(0))],
}

# The agents are apprentices: a little hat in their agent's color, and eyes under it.
APPRENTICE = ['   ╱╲', '  ╱ ✦╲', ' ╶════╴']


def apprentice(eye='•', mouth='‿', up=0, droop=False, fx=()):
    cv = Canvas()
    hat = ['', '  ╭─╮', '  ╱✦╰◦'] if droop else APPRENTICE[:2]
    cv.put(1 - up, 1, hat, lambda ch: 'y' if ch == '✦' else '.')
    cv.put(3 - up, 1, APPRENTICE[2])
    cv.put(4, 2, f'{eye} {mouth} {eye}', lambda ch: 'f' if ch in '‿o⌒' else 'e')
    for e in fx:
        cv.put(*e)
    f = cv.frame()
    return {'art': [row[:9] for row in f['art'][:6]], 'color': [row[:9] for row in f['color'][:6]]}


MINI_MOODS = {
    'working': [apprentice(), apprentice(), apprentice(fx=[(0, 7, '·', 'k')]), apprentice(), apprentice(eye='-'), apprentice()],
    'happy': [apprentice(eye='^', fx=[(0, 7, '♥', 'p')]), apprentice(eye='^', fx=[(2, 8, '♥', 'p')])],
    'sad': [apprentice(eye='╥', mouth='⌒', droop=True), apprentice(eye='╥', mouth='⌒', droop=True, fx=[(5, 3, '°', 'z')])],
    'startled': [apprentice(eye='O', mouth='o', up=1, fx=[(0, 7, '!', 'y')]), apprentice(eye='O', mouth='o', up=1), apprentice(eye='O', mouth='o')],
}

pack = {
    '$schema': SCHEMA,
    'name': 'wizard',
    'author': 'Henrique Schroeder',
    'description': 'A wizard drawn in text who brews potions, juggles orbs and vanishes in a swirl of sparkles to turn up elsewhere.',
    'style': 'ascii',
    'ink': INK,
    'palette': PALETTE,
    'fps': FPS,
    'main': {
        'moods': MOODS,
        'variants': VARIANTS,
        'transitions': TRANSITIONS,
        'actions': ACTIONS,
        'activities': {k: {**a, 'moods': ['idle']} for k, a in ACTIVITIES.items()},
        'teleport': TELEPORT,
    },
    'mini': {'moods': MINI_MOODS},
    'personality': {'energetic': 0.5, 'curious': 0.8, 'affectionate': 0.6},
    'speech': {
        'en': {
            'longThink': ['*strokes beard* hmm…', 'consulting the stars…'],
            'manyReads': ['so many tomes!', 'the library grows'],
            'manyAgents': ['a whole class of apprentices!'],
            'lateNight': ['the stars are out… so late'],
            'bored': ['*twirls the staff*', 'no spells to cast…'],
            'dreaming': ['zzz… abraca… zzz', 'mm… dragons…'],
        },
        'pt-BR': {
            'longThink': ['*alisa a barba* hmm…', 'consultando as estrelas…'],
            'manyReads': ['quanto grimório!', 'a biblioteca cresce'],
            'manyAgents': ['uma turma inteira de aprendizes!'],
            'lateNight': ['já tem estrela no céu… tarde'],
            'bored': ['*gira o cajado*', 'nenhum feitiço pra lançar…'],
            'dreaming': ['zzz… abraca… zzz', 'mm… dragões…'],
        },
    },
}


def show(frame):
    for row in frame['art']:
        print('|' + row + '|')
    print()


if __name__ == '__main__':
    if sys.argv[1:2] == ['show']:
        for name in sys.argv[2:] or list(MOODS):
            frames = MOODS.get(name) or ACTIONS.get(name, {}).get('frames') or MINI_MOODS.get(name) or TELEPORT.get(name) or ACTIVITIES[name]['loop']
            print(f'== {name} ({len(frames)})')
            for f in frames:
                show(f)
    else:
        write(pack)
