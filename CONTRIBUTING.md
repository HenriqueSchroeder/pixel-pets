# Contributing

Pets and translations are the easiest ways to help, and neither needs any code.

## Add a pet

1. Draw it as `pets/<name>.json`, following the [format in the README](README.md#draw-your-own). The file name must match `name`.
2. Add its name to the `pet` option's `options` in `.claude-plugin/plugin.json`, so it shows in the picker.
3. Check it. This also fails while a pet in `pets/` is missing from the picker:

   ```bash
   npx tsx scripts/check-pets.ts
   ```

4. Try it: pick it in the `pet` option and run `claude --plugin-dir .`.
5. Open a pull request with a GIF of your pet. This renders one from your pack, with the same scene as the README:

   ```bash
   python3 scripts/render-gif.py <name> screenshots/<name>.gif   # needs Pillow
   ```

Keep pets original or drawn from work you have the right to share.

The shipped pets are generated, one script each: `scripts/make-<name>.py` writes `pets/<name>.json`, with the helpers they share in `scripts/sprites.py`. To change one, edit its script and run it (`python3 scripts/make-cat.py`) rather than the JSON. The README's gallery comes from `python3 scripts/render-gallery.py`.

## Add a language

1. Copy `locales/pt-BR.ts` to `locales/<code>.ts` (for example `locales/es.ts`) and translate every string.
   - Keep `{detail}` wherever the English text has it. It is replaced at run time.
   - In `names`, list the ways Claude Code's `language` setting or `$LANG` may spell your language, in lower case (`es`, `spanish`, `español`).
2. Add your locale to `LOCALES` in `hooks/i18n.ts`, and its code to the `language` options in `.claude-plugin/plugin.json`.
3. Run the tests. One of them checks that every locale gives every string:

   ```bash
   claude plugin test .
   ```

## Change the code

Run everything before you open a pull request:

```bash
claude plugin validate .
claude plugin test .
npx tsx scripts/check-pets.ts
npx -p typescript tsc -p .
```

`tsc` needs the types Claude Code lays in `.claude-plugin/types/`. They appear the first time you run `claude --plugin-dir .`, and git ignores them.
