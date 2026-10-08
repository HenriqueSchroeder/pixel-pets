"""Renders the README's gallery: a few pets side by side in a few moods.

    python3 scripts/render-gallery.py screenshots/gallery.gif cat slime dog owl

Needs Pillow (pip install pillow) and npx. Each pack is resolved by
scripts/preview-pet.ts (--json), so a mood a pack leaves out shows what it
borrows, as in the plugin. Each cell plays its mood's own loop.
"""

import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
BG, FG, DIM = (24, 24, 27), (230, 230, 230), (140, 140, 150)

PIXEL = 6
MOODS = ['idle', 'thinking', 'happy', 'sleeping']
TICKS = 32  # 8 s at 4 fps: long enough for every loop to come round
LABEL_W, HEAD_H, PAD = 90, 28, 18


def pack_of(name):
    out = subprocess.run(['npx', '-y', 'tsx', str(ROOT / 'scripts/preview-pet.ts'), name, '--json'],
                         check=True, capture_output=True, text=True, cwd=ROOT)
    return json.loads(out.stdout)


def rgb(color):
    return ((color >> 16) & 255, (color >> 8) & 255, color & 255)


def render(out, names):
    packs = [pack_of(name) for name in names]
    try:
        font, bold = ImageFont.truetype(FONT, 14), ImageFont.truetype(BOLD, 14)
    except OSError:  # no DejaVu (macOS, Windows): Pillow's own font
        font = bold = ImageFont.load_default(size=14)
    cell_w = max(len(p['moods']['sleeping'][0][0]) for p in packs) * PIXEL + PAD
    cell_h = max(len(p['moods']['sleeping'][0]) for p in packs) * PIXEL + PAD
    width, height = LABEL_W + cell_w * len(packs), HEAD_H + cell_h * len(MOODS)

    frames = []
    for tick in range(TICKS):
        img = Image.new('RGB', (width, height), BG)
        d = ImageDraw.Draw(img)
        for col, pack in enumerate(packs):
            d.text((LABEL_W + col * cell_w, 6), pack['name'], font=bold, fill=FG)
            for row, mood in enumerate(MOODS):
                if col == 0:
                    d.text((6, HEAD_H + row * cell_h + cell_h // 2 - 10), mood, font=font, fill=DIM)
                loop = pack['moods'][mood]
                sprite = loop[tick % len(loop)]
                x0, y0 = LABEL_W + col * cell_w, HEAD_H + row * cell_h
                for r, line in enumerate(sprite):
                    for c, letter in enumerate(line):
                        if letter in pack['colors']:
                            d.rectangle([x0 + c * PIXEL, y0 + r * PIXEL, x0 + (c + 1) * PIXEL - 1, y0 + (r + 1) * PIXEL - 1],
                                        fill=rgb(pack['colors'][letter]))
        frames.append(img)

    frames[0].save(out, save_all=True, append_images=frames[1:], duration=250, loop=0, optimize=True)
    print(f'{out}: {len(frames)} frames, {width}x{height}')


if __name__ == '__main__':
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / 'screenshots/gallery.gif')
    names = sys.argv[2:] or ['dog', 'ghost', 'owl', 'clawd']
    out.parent.mkdir(parents=True, exist_ok=True)
    render(out, names)
