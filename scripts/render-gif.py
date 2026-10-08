"""Renders the README's GIF of the band from a pack's real sprites.

    python3 scripts/render-gif.py clawd screenshots/clawd.gif

Needs Pillow (pip install pillow) and npx. The pack is resolved and played by
scripts/preview-pet.ts (--json, --play), so the pet moves, walks and has its
agents placed exactly as in the plugin. The scene is scripted below; the labels are the English locale's.
"""

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'

# One terminal cell. The plugin fits two pixel rows in a cell with '▀', so a
# sprite pixel is CELL_W wide and CELL_H / 2 tall: square at these sizes.
CELL_W, CELL_H = 10, 20
STAGE_COLUMNS = 100  # the band's width, as a 100-column terminal gives it
AGENT_SLOT = 20  # as hooks/register.tsx
BG, FG, DIM = (24, 24, 27), (230, 230, 230), (140, 140, 150)
AGENT_COLORS = [0x7CC4F2, 0x9BD57A, 0xC69AF2]  # the first three of hooks/register.tsx

# (seconds, main mood, label, agents). An agent is (type, mini mood, label).
# A label that is a Said is a line the pet says: the pack's own English one, or the locale's.
# The plan follows the plugin: wander while idle and alone; the agents gather beside it.
EXPLORE, PLAN, GENERAL = 'Explore', 'Plan', 'general-purpose'
Said = tuple  # (situation, the locale's line)
SCENE = [
    (5.0, 'idle', 'hanging around', []),
    (2.5, 'watching', 'watching you type', []),
    (1.5, 'thinking', 'thinking', []),
    (1.5, 'reading', 'reading pack.ts', []),
    # The 20th read in a turn: a remark of its own.
    (2.5, 'reading', Said(('manyReads', 'so many files!')), []),
    (2.0, 'writing', 'writing pack.ts', []),
    (1.5, 'sad', 'failed: npm test', []),
    (1.5, 'running', 'running npm test', []),
    # A long turn that went well: a bigger celebration.
    (2.5, 'celebrating', 'phew, done!', []),
    # A streak of turns that went well: proud when idle.
    (8.0, 'proud', 'proud of us', []),
    # Background agents outlive the turn: it keeps an eye on them, and they gather on both sides.
    (1.5, 'supervising', 'waiting for agents', [(EXPLORE, 'working', 'thinking')]),
    (1.5, 'supervising', 'waiting for agents', [(EXPLORE, 'working', 'reading auth.ts'), (PLAN, 'working', 'thinking')]),
    (2.5, 'supervising', 'waiting for agents', [(EXPLORE, 'working', 'searching (Grep)'), (PLAN, 'working', 'reading api.ts'), (GENERAL, 'working', 'running ls src')]),
    (1.5, 'supervising', 'waiting for agents', [(EXPLORE, 'happy', 'done!'), (PLAN, 'working', 'writing plan.md'), (GENERAL, 'working', 'reading db.ts')]),
    (1.5, 'supervising', 'waiting for agents', [(PLAN, 'working', 'writing plan.md'), (GENERAL, 'sad', 'something went wrong')]),
    (1.5, 'supervising', 'waiting for agents', [(PLAN, 'happy', 'done!')]),
    (3.0, 'idle', 'hanging around', []),
    (3.0, 'sleeping', 'sleeping', []),
]


def preview(name, flag, stdin=None):
    out = subprocess.run(['npx', '-y', 'tsx', str(ROOT / 'scripts/preview-pet.ts'), name, flag],
                         check=True, capture_output=True, text=True, cwd=ROOT, input=stdin)
    return json.loads(out.stdout)


def rgb(color):
    return ((color >> 16) & 255, (color >> 8) & 255, color & 255)


def draw_sprite(draw, frame, colors, x, y):
    px = CELL_W  # square pixels: CELL_H / 2 == CELL_W
    for r, row in enumerate(frame):
        for c, letter in enumerate(row):
            if letter in colors:
                draw.rectangle([x + c * px, y + r * px, x + (c + 1) * px - 1, y + (r + 1) * px - 1], fill=rgb(colors[letter]))


def render(name, out):
    pack = preview(name, '--json')
    try:
        font, bold = ImageFont.truetype(FONT, 16), ImageFont.truetype(BOLD, 16)
    except OSError:  # no DejaVu (macOS, Windows): Pillow's own font
        font = bold = ImageFont.load_default(size=16)
    fps = pack['fps']
    pet_w = len(pack['moods']['sleeping'][0][0])
    main_h = len(pack['moods']['sleeping'][0])
    # As hooks/register.tsx: a pack with no mini pets shows no agents on the stage.
    mini = pack['mini']
    mini_h = len(mini['working'][0]) if mini else 0
    scene = SCENE if mini else [(seconds, mood, label, []) for seconds, mood, label, _ in SCENE]
    stage_h = max(main_h * CELL_W, mini_h * CELL_W + CELL_H * 2)

    ticks = []
    for seconds, mood, label, agents in scene:
        plan = 'wander' if mood in ('idle', 'proud') and not agents else 'stay'
        tick = {'mood': mood, 'plan': plan, 'room': STAGE_COLUMNS - pet_w - 2,
                'agents': [kind for kind, _, _ in agents], 'width': AGENT_SLOT + 1,
                'leaving': [kind for kind, mini_mood, _ in agents if mini_mood != 'working']}
        ticks += [tick] * round(seconds * fps)
    played = preview(name, '--play', json.dumps(ticks))

    left = CELL_W
    width = left * 2 + STAGE_COLUMNS * CELL_W
    height = CELL_H * 2 + stage_h + CELL_H * 2
    frames, tick = [], 0
    for seconds, mood, label, agents in scene:
        for step in range(round(seconds * fps)):
            img = Image.new('RGB', (width, height), BG)
            d = ImageDraw.Draw(img)
            pet = played[tick]
            if isinstance(label, Said):
                situation, fallback = label
                label = '“' + pack['speech'].get('en', {}).get(situation, [fallback])[0] + '”'
            shown = 'strolling around' if pet['moving'] and mood in ('idle', 'proud') else label

            d.text((left, CELL_H // 2), 'Claude', font=bold, fill=FG)
            d.text((left + 7 * CELL_W, CELL_H // 2), f'· {shown}', font=font, fill=DIM)

            stage_y = CELL_H * 2
            draw_sprite(d, pet['frame'], pack['colors'], left + pet['x'] * CELL_W, stage_y)

            # As hooks/register.tsx: each side's list runs from nearest the pet to farthest.
            columns = {i: pet['x'] + pet_w + 1 + n * (AGENT_SLOT + 1) for n, i in enumerate(pet['right'])}
            columns |= {i: pet['x'] - (n + 1) * (AGENT_SLOT + 1) for n, i in enumerate(pet['left'])}
            for i, (kind, mini_mood, mini_label) in enumerate(agents):
                # One the pet is still making room for joins once it gets there.
                if i not in columns:
                    continue
                slot_x = left + columns[i] * CELL_W
                colors = {**pack['colors'], pack['tint']: AGENT_COLORS[[EXPLORE, PLAN, GENERAL].index(kind)]}
                minis = mini[mini_mood]
                mini_w = len(minis[0][0])
                # On the pet's left a slot leans right, toward the pet.
                lean = (lambda width: slot_x + AGENT_SLOT * CELL_W - width) if i in pet['left'] else (lambda width: slot_x)
                draw_sprite(d, minis[tick % len(minis)], colors, lean(mini_w * CELL_W), stage_y)
                text_y = stage_y + mini_h * CELL_W
                d.text((lean(d.textlength(kind, font=bold)), text_y), kind, font=bold, fill=FG)
                d.text((lean(d.textlength(mini_label, font=font)), text_y + CELL_H), mini_label, font=font, fill=DIM)

            prompt_y = stage_y + stage_h + CELL_H // 2
            d.line([(left, prompt_y), (width - left, prompt_y)], fill=(60, 60, 66))
            d.text((left, prompt_y + CELL_H // 4), '>', font=bold, fill=DIM)
            if mood == 'watching':
                typed = 'add a pet that waves'[: 2 + step * 2]
                d.text((left + 2 * CELL_W, prompt_y + CELL_H // 4), typed, font=font, fill=FG)
            frames.append(img)
            tick += 1

    frames[0].save(out, save_all=True, append_images=frames[1:], duration=round(1000 / fps), loop=0, optimize=True)
    print(f'{out}: {len(frames)} frames, {width}x{height}')


if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'cat'
    out = Path(sys.argv[2] if len(sys.argv) > 2 else ROOT / f'screenshots/{name}.gif')
    out.parent.mkdir(parents=True, exist_ok=True)
    render(name, out)
