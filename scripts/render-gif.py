"""Renders the README's GIF of the band from a pack's real sprites.

    python3 scripts/render-gif.py cat screenshots/band.gif

Needs Pillow (pip install pillow) and npx. The pack is resolved by
scripts/preview-pet.ts --json, so the moods fall back exactly as in the plugin.
The scene is scripted below; the labels are the English locale's.
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
BG, FG, DIM = (24, 24, 27), (230, 230, 230), (140, 140, 150)
AGENT_COLORS = [0x7CC4F2, 0x9BD57A, 0xC69AF2]  # the first three of hooks/register.tsx

# (seconds, main mood, main label, agents) — an agent is (type, mini mood, label).
EXPLORE, PLAN, GENERAL = 'Explore', 'Plan', 'general-purpose'
SCENE = [
    (2.0, 'sleeping', 'sleeping', []),
    (1.0, 'waking', 'waking up', []),
    (2.0, 'thinking', 'thinking', []),
    (2.0, 'running', 'running npm test', []),
    (1.5, 'thinking', 'waiting for agents', [(EXPLORE, 'working', 'thinking')]),
    (1.5, 'thinking', 'waiting for agents', [(EXPLORE, 'working', 'reading auth.ts'), (PLAN, 'working', 'thinking')]),
    (2.0, 'thinking', 'waiting for agents', [(EXPLORE, 'working', 'searching (Grep)'), (PLAN, 'working', 'reading api.ts'), (GENERAL, 'working', 'running ls src')]),
    (1.5, 'thinking', 'waiting for agents', [(EXPLORE, 'happy', 'done!'), (PLAN, 'working', 'writing plan.md'), (GENERAL, 'working', 'reading db.ts')]),
    (1.5, 'thinking', 'waiting for agents', [(PLAN, 'working', 'writing plan.md'), (GENERAL, 'sad', 'something went wrong')]),
    (1.5, 'thinking', 'waiting for agents', [(PLAN, 'happy', 'done!')]),
    (2.0, 'writing', 'writing pack.ts', []),
    (2.0, 'sad', 'failed: npm test', []),
    (2.0, 'running', 'running npm test', []),
    (2.5, 'happy', 'done!', []),
]


def load_pack(name):
    out = subprocess.run(['npx', '-y', 'tsx', str(ROOT / 'scripts/preview-pet.ts'), name, '--json'],
                         check=True, capture_output=True, text=True, cwd=ROOT)
    return json.loads(out.stdout)


def rgb(color):
    return ((color >> 16) & 255, (color >> 8) & 255, color & 255)


def draw_sprite(draw, frame, colors, x, y):
    px = CELL_W  # square pixels: CELL_H / 2 == CELL_W
    for r, row in enumerate(frame):
        for c, letter in enumerate(row):
            if letter in colors:
                draw.rectangle([x + c * px, y + r * px, x + (c + 1) * px - 1, y + (r + 1) * px - 1], fill=rgb(colors[letter]))


def render(pack, out):
    try:
        font, bold = ImageFont.truetype(FONT, 16), ImageFont.truetype(BOLD, 16)
    except OSError:  # no DejaVu (macOS, Windows): Pillow's own font
        font = bold = ImageFont.load_default(size=16)
    fps = pack['fps']
    main_h = len(pack['moods']['sleeping'][0])
    mini_w, mini_h = len(pack['mini']['working'][0][0]), len(pack['mini']['working'][0])
    agent_w = (mini_w + 1) * CELL_W + 22 * CELL_W

    width = CELL_W * 2 + len(pack['moods']['sleeping'][0][0]) * CELL_W + CELL_W * 2 + 3 * agent_w + CELL_W
    band_h = max(main_h * CELL_W, CELL_H + mini_h * CELL_W + CELL_H // 2)
    height = CELL_H + band_h + CELL_H * 3

    frames, tick = [], 0
    for seconds, mood, label, agents in SCENE:
        for _ in range(round(seconds * fps)):
            img = Image.new('RGB', (width, height), BG)
            d = ImageDraw.Draw(img)
            top = CELL_H

            body = pack['moods'][mood]
            draw_sprite(d, body[tick % len(body)], pack['colors'], CELL_W * 2, top)

            text_x = CELL_W * 2 + len(body[0][0]) * CELL_W + CELL_W * 2
            d.text((text_x, top), 'Claude', font=bold, fill=FG)
            d.text((text_x + 7 * CELL_W, top), f'· {label}', font=font, fill=DIM)

            for i, (kind, mini_mood, mini_label) in enumerate(agents):
                ax = text_x + i * agent_w
                ay = top + CELL_H + CELL_H // 2
                colors = {**pack['colors'], pack['tint']: AGENT_COLORS[[EXPLORE, PLAN, GENERAL].index(kind)]}
                minis = pack['mini'][mini_mood]
                draw_sprite(d, minis[tick % len(minis)], colors, ax, ay)
                d.text((ax + (mini_w + 1) * CELL_W, ay), kind, font=bold, fill=FG)
                d.text((ax + (mini_w + 1) * CELL_W, ay + CELL_H), mini_label, font=font, fill=DIM)

            prompt_y = top + band_h + CELL_H
            d.line([(CELL_W, prompt_y - CELL_H // 2), (width - CELL_W, prompt_y - CELL_H // 2)], fill=(60, 60, 66))
            d.text((CELL_W, prompt_y), '>', font=bold, fill=DIM)
            frames.append(img)
            tick += 1

    frames[0].save(out, save_all=True, append_images=frames[1:], duration=round(1000 / fps), loop=0, optimize=True)
    print(f'{out}: {len(frames)} frames, {width}x{height}')


if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'cat'
    out = Path(sys.argv[2] if len(sys.argv) > 2 else ROOT / 'screenshots/band.gif')
    out.parent.mkdir(parents=True, exist_ok=True)
    render(load_pack(name), out)
