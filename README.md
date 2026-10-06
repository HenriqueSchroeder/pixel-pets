# pixel-pets

**English** · [Português](README.pt-BR.md)

A pixel-art pet that lives above your Claude Code prompt and reacts to what Claude is doing: it thinks, types while Claude runs commands, reads while Claude reads files, cheers when a turn ends and gets sad when a tool fails. Every subagent Claude starts gets a small pet of its own, in its own color, showing what that agent is doing right now.

Pets are plain JSON files, so you can draw your own or use one someone else made.

```
 ▄▀▀▀▀▄       Claude · running npm test
 █ ▀▀ █       ▄▀▀▄ Explore            ▄▀▀▄ Plan
 ▀▄▄▄▄▀       ▀▄▄▀ reading auth.ts    ▀▄▄▀ thinking
```

> A recording is coming. The sketch above stands in for the real pixel art.

## What it shows

| Mood | When | Borrows from |
| --- | --- | --- |
| `sleeping` | no turn is running | (required) |
| `deepSleep` | nothing has happened for 10 minutes | sleeping |
| `waking` | for a moment when a prompt wakes it from a deep sleep | thinking |
| `thinking` | a turn started, or Claude is waiting for its agents | sleeping |
| `typing` | any other tool, MCP tools included | thinking |
| `running` | `Bash` | typing |
| `writing` | `Edit`, `Write` | typing |
| `reading` | `Read` | thinking |
| `searching` | `Grep`, `Glob`, `WebFetch`, `WebSearch`, `LSP` | reading |
| `waiting` | Claude is waiting for you to answer a permission prompt | thinking |
| `compacting` | the conversation is being compacted | thinking |
| `sweating` | a turn has run for over 2 minutes and Claude is thinking or running a command | thinking |
| `happy` | for two seconds after a turn ends | sleeping |
| `sad` | for two seconds after a tool fails or a turn errors | sleeping |

A pack only has to draw `sleeping`. Any mood it leaves out borrows the frames of its nearest drawn parent, so `running` falls back to `typing`, then `thinking`, then `sleeping`.

Each subagent gets a mini pet with its type (`Explore`, `Plan`, ...) and its current action. When the agent ends, its pet is happy (or sad, if it failed) for a moment and then leaves.

## Requirements

- Claude Code **2.1.287 or later**, where mods load by default. Built and tested on 2.1.291.
- A terminal for the pixel art. The Desktop app's Code tab shows a line of text instead, and the VS Code chat panel and `claude -p` draw nothing.

## Install

In a Claude Code session:

```
/plugin marketplace add HenriqueSchroeder/pixel-pets
/plugin install pixel-pets@pixel-pets
```

Or from your shell, then `/reload-plugins` in any open session:

```bash
claude plugin marketplace add HenriqueSchroeder/pixel-pets
claude plugin install pixel-pets@pixel-pets
```

`/pet` hides the pets and brings them back.

## Configure

Run `/plugin configure pixel-pets@pixel-pets`, or find **pixel-pets** in `/config`:

| Option | Default | What it does |
| --- | --- | --- |
| `pet` | `cat` | Which pet to show: a pack in `~/.claude/pets/` or one shipped in [`pets/`](pets/) |
| `language` | `auto` | `auto` follows Claude Code's `language` setting, then `$LANG`. Or pick `en`, `pt-BR` |

## Use another pet

1. Save the pack as `~/.claude/pets/<name>.json`. The file name must match the pack's `name`.
2. Set the `pet` option to `<name>`.

A pack in `~/.claude/pets/` wins over a shipped one with the same name. If a pack can't be read, pixel-pets says why in a toast and shows the cat.

Shipped pets: [`cat`](pets/cat.json), [`slime`](pets/slime.json).

## Draw your own

A pack is a palette and some frames. Each frame is rows of palette letters, and `.` is see-through:

```json
{
  "$schema": "https://raw.githubusercontent.com/HenriqueSchroeder/pixel-pets/main/schema/pet.schema.json",
  "name": "blob",
  "palette": { "o": "#1a1a1a", "b": "#7cc4f2", "e": "#ffffff" },
  "main": {
    "moods": {
      "sleeping": [
        ["..oooo..", ".obbbbo.", "obbbbbbo", "obobbobo", "obbbbbbo", ".oooooo."]
      ]
    }
  },
  "mini": { "moods": { "working": [[".oo.", "obbo", ".oo."]] } }
}
```

- Only `sleeping` is required. A mood you leave out borrows from its parent, as the table in [What it shows](#what-it-shows) lists.
- Give a mood several frames and they play in a loop at `fps` frames per second (1–12, default 4). Repeat a frame to hold a pose: at 4 fps, the same frame four times in a row holds it for a second.
- Every frame of the main pet has the same size, up to 24×24 pixels. The mini pet goes up to 12×12.
- Two pixel rows fit in one terminal row, so a 12×12 pet takes 12 columns and 6 rows.
- The mini pet needs `working`. Its `happy` and `sad`, shown when an agent ends, fall back to `working`.
- `mini.tint` (default `b`) is the letter recolored for each subagent.
- See every mood of a pack, and what it borrows, in your terminal: `npx tsx scripts/preview-pet.ts <name or path>`.

The [schema](schema/pet.schema.json) gives your editor completion and checks. To share a pet, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Check what it does before you install

A mod runs with your permissions. Clone this repository and list every event it hooks and every call it makes:

```bash
claude plugin validate ./pixel-pets
```

pixel-pets reads your pet packs, Claude Code's `language` setting and the `HOME` and `LANG` variables, and draws above the prompt. It never writes files, runs commands, or uses the network.

## Limitations

- The pixel art needs a terminal. Other surfaces get a line of text.
- A pet pack is read when the plugin loads. After editing one, run `/reload-plugins`.
- The mods API is in early access and can change between Claude Code releases.

## Development

```bash
claude --plugin-dir .            # try it in a session
claude plugin validate .         # manifest, hooks and calls
claude plugin test .             # tests/
npx tsx scripts/check-pets.ts    # every pack in pets/
npx tsc -p .                     # types (after one --plugin-dir run lays them)
```

## License

[MIT](LICENSE)
