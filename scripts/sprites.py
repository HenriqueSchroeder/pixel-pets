"""Shared by the pet generators (scripts/make-*.py).

A pose is a base sprite with a few pixels painted over it, each a (row, column,
letter); a pack is written as pets/<name>.json.
"""

import json
from pathlib import Path

SCHEMA = 'https://raw.githubusercontent.com/HenriqueSchroeder/pixel-pets/main/schema/pet.schema.json'


def paint(base, pixels):
    """`base` with `pixels` set on it; a pixel off the sprite is dropped."""
    grid = [list(row) for row in base]
    for r, c, letter in pixels:
        if 0 <= r < len(grid) and 0 <= c < len(grid[r]):
            grid[r][c] = letter
    return [''.join(row) for row in grid]


def write(pack):
    # The format takes 16 frames a mood, but a loop past 2 s at 4 fps drags.
    for mood, frames in pack['main']['moods'].items():
        assert len(frames) <= 8, (mood, len(frames))
    out = Path(__file__).resolve().parent.parent / 'pets' / f"{pack['name']}.json"
    out.write_text(json.dumps(pack, indent=2) + '\n')
    print(f'{out}: written')
