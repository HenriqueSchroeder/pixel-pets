# pixel-pets

**English** · [Português](README.pt-BR.md)

A pixel-art pet that lives above your Claude Code prompt and reacts to what Claude is doing: it thinks, types while Claude runs commands, reads while Claude reads files, cheers when a turn ends and gets sad when a tool fails. Every subagent Claude starts gets a small pet of its own, in its own color, showing what that agent is doing right now.

Pets are plain JSON files, so you can draw your own or use one someone else made.

![pixel-pets: the cat above the prompt while three subagents work](screenshots/band.gif)

![pixel-pets: the slime pet in the same scene](screenshots/slime.gif)

## What it shows

| Mood | When | Borrows from |
| --- | --- | --- |
| `sleeping` | no turn is running | (required) |
| `deepSleep` | nothing has happened for 10 minutes | sleeping |
| `idle` | awake with nothing to do, for a while after Claude finishes (see `awakeMinutes`) | thinking |
| `sleepy` | idle at night, from 22h to 6h | idle |
| `tired` | idle after 3 hours of work with no break of an hour | sleepy |
| `walking` | strolling around while idle and alone; a pack without it never walks | idle |
| `watching` | you are typing in the prompt while Claude is idle | reading |
| `waking` | for a moment when a prompt wakes it from a deep sleep | thinking |
| `thinking` | a turn started | sleeping |
| `typing` | any other tool, MCP tools included | thinking |
| `running` | `Bash` | typing |
| `writing` | `Edit`, `Write` | typing |
| `reading` | `Read` | thinking |
| `searching` | `Grep`, `Glob`, `WebFetch`, `WebSearch`, `LSP` | reading |
| `supervising` | Claude is waiting for its agents, or only thinking while they run, or they still run in the background after the turn | thinking |
| `compacting` | the conversation is being compacted | thinking |
| `sweating` | a turn has run for over 2 minutes and Claude is thinking or running a command | thinking |
| `worried` | idle after a few failures in a row | sweating |
| `grumpy` | idle after many failures in a row | sad |
| `proud` | idle after a streak of turns that went well | happy |
| `happy` | for two seconds after the last agent is done, now and then after a turn of work, or after you allow a permission prompt ("thanks!") | sleeping |
| `celebrating` | for four seconds after a turn of 5 minutes or more goes well, and on an anniversary | happy |
| `sad` | for two seconds after a tool fails, a turn errors, or you deny a permission prompt ("okay, I won't") | sleeping |

A pack only has to draw `sleeping`. Any mood it leaves out borrows the frames of its nearest drawn parent, so `running` falls back to `typing`, then `thinking`, then `sleeping`.

The pet walks a stage under Claude's line: it strolls while idle, and when subagents start it stays put and they gather around it, each on the side with more free room: on both sides when it stands in the middle, on one when it is in a corner. Each keeps its side until it leaves. When they do not fit where it stands, it walks aside to make room and they join as it gets there. Only a pack that draws `walking` walks. One that draws `main.teleport` instead gets about by vanishing and turning up elsewhere, as the slime and the ghost do; a pack with neither stays put at the left. Packs draw their pet facing right; pixel-pets mirrors it to face left.

It keeps track of how the session goes. A failed tool or turn worries it and a turn that goes well makes it proud; a failed turn ends a streak of pride. Both fade a point every five minutes, and when it is idle the strongest feeling shows: grumpy, then worried, then tired, then proud, then sleepy at night. Worry and pride last for the session only; tiredness counts your work in every session, as a break is an hour with no prompt in any of them.

It has wants of its own too, for the session. Energy: sleep fills it and work drains it, and a pet low on energy dozes off sooner and rests longer between strolls. Boredom: it builds while nothing happens, and a bored pet gets up from a nap on its own for a while, though never out of a deep sleep. Longing: it builds while you are away, and a pet that misses you strolls near the prompt and greets your first key after half an hour away ("missed you!"), unless a turn is running.

The time of day is your local time. At night it is sleepy and dozes off in half of `awakeMinutes`. It remembers you across sessions. The day's first sight of you opens with one welcome: an anniversary (a week, a month, 100 days, each year together), "missed you!" after two days or more away, or good morning. `/pet` also says how long you have been together. Late at night it says so once, whichever session sees you first. A `claude -p` run does not count as seeing you.

Now and then it says something of its own, in quotes on Claude's line: "hmm…" after 30 seconds of thinking with no tool, a remark on the 20th file read in a turn, on three agents at work at once, on a prompt at night, a sigh when boredom gets it up from a nap, and a word in its sleep now and then. Each at most once a turn, and never two within three minutes.

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

`/pet` hides the pets and brings them back. `/pet <name>` gives the current project a pet of its own, so each of your Claude Code windows can tell which project it is in; it is kept for the project's next sessions too, and `/pet default` goes back to the one in your settings.

## Configure

Run `/plugin configure pixel-pets@pixel-pets`, or find **pixel-pets** in `/config`:

| Option | Default | What it does |
| --- | --- | --- |
| `pet` | `cat` | Which pet to show, picked from the shipped ones (see below), or `custom` for your own |
| `customPet` | | Your own pack when `pet` is `custom`: a file in `~/.claude/pets/`, without `.json` |
| `language` | `auto` | `auto` follows Claude Code's `language` setting, then `$LANG`. Or pick `en`, `pt-BR` |
| `awakeMinutes` | `1` | How long the pet stays awake, strolling around, after Claude finishes, before it falls asleep (half as long at night). `0` sends it straight to sleep |

## Use another pet

1. Save the pack as `~/.claude/pets/<name>.json`. The file name must match the pack's `name`.
2. Pick `custom` in the `pet` option and set `customPet` to `<name>`.

A pack in `~/.claude/pets/` wins over a shipped one with the same name. If a pack can't be read, pixel-pets says why in a toast and shows the cat.

Shipped pets:

- [`cat`](pets/cat.json), the default, and [`slime`](pets/slime.json), which bounces in place, melts into a puddle in a deep sleep and never walks: it sinks into the floor and wells up somewhere else. Both are shown at the top.
- [`dog`](pets/dog.json), which wags its tail, pants and tilts its head when it thinks.
- [`ghost`](pets/ghost.json), which floats instead of walking, says boo now and then, fades as it sleeps and turns up elsewhere with a boo.
- [`owl`](pets/owl.json), which blinks slowly and turns its head all the way round.
- [`clawd`](pets/clawd.json), the critter on Claude Code's welcome screen, waving its little arms and cheering with both when a long job is done. Fan art: not made or endorsed by Anthropic.
- [`fox`](pets/fox.json), which sways its brush, pounces on mice under the snow and turns side on to walk.

![The dog, ghost, owl, clawd and fox, idle, thinking, happy and asleep](screenshots/gallery.gif)

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
- Every frame of the main pet has the same size, up to 48×32 pixels. The mini pet goes up to 12×12.
- Two pixel rows fit in one terminal row, so a 12×12 pet takes 12 columns and 6 rows.
- The mini pet needs `working`. Its `happy` and `sad`, shown when an agent ends, fall back to `working`.
- `mini.tint` (default `b`) is the letter recolored for each subagent.
- `"mini": false` draws no mini pets: while agents work, the pet shows them only by its own `supervising`. Handy for a wide pet that leaves little room beside it.
- See every mood of a pack, and what it borrows, in your terminal: `npx tsx scripts/preview-pet.ts <name or path>`.

### Make it feel alive

A loop alone looks like a machine. Three optional keys under `main` make the pet unpredictable:

```json
"variants": {
  "thinking": [[["...frame..."], ["...frame..."]]]
},
"transitions": {
  "*>sleeping": [["...yawn..."], ["...eyes droop..."]],
  "sleeping>*": [["...stretch..."]]
},
"actions": {
  "blink": { "frames": [["...eyes shut..."]], "moods": ["thinking", "reading"], "every": [2, 6] }
}
```

- `variants`: more loops for a mood you draw in `moods`. One of them, or the mood's own loop, is picked at random each time the mood starts.
- `transitions`: frames played once when the mood changes, keyed `from>to`. Either side may be `*`. An exact key wins over `from>*`, which wins over `*>to`.
- `actions`: frames played once at a random moment while the pet is in one of `moods`, `every` [min, max] seconds after the last time. Blinks, ear twitches and yawns live here, so the loops can stay calm.
- An action is a whole frame, so keep its face the same as the moods it plays in. The cat has one blink per expression for that reason.
- A mood holds up to 16 frames; at 4 fps that is 4 seconds.

Give it a voice with `speech`, at the top level: lines by language code and situation, one picked at random. A language or situation you leave out says the default line.

```json
"speech": {
  "en": { "longThink": ["mrrp… hmm"], "manyReads": ["so many files… mrow!"] },
  "pt-BR": { "longThink": ["mrrp… hmm"] }
}
```

The situations are `longThink`, `manyReads`, `manyAgents`, `lateNight`, `bored` and `dreaming`. Up to 8 lines each, one line of up to 40 characters.

A pet that does not walk can teleport: give `main` a `teleport` with `vanish`, played where it stands, and `appear`, played where it lands, frames like any other. It is how it strolls and how it makes room for agents.

Give it a nature with `personality`, at the root of the pack: three traits from 0 to 1, each the usual 0.5 when left out. `energetic` tires slower, `curious` gets bored and up from a nap sooner (0 never does), `affectionate` misses you sooner (0 never does). The dog is `{ "energetic": 0.8, "curious": 0.6, "affectionate": 0.9 }`; the slime, lazy, is `{ "energetic": 0.2, "curious": 0.3, "affectionate": 0.6 }`.

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
