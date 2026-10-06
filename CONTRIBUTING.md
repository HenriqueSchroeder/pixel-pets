# Contributing

Pets and translations are the easiest ways to help, and neither needs any code.

## Add a pet

1. Draw it as `pets/<name>.json`, following the [format in the README](README.md#draw-your-own). The file name must match `name`.
2. Check it:

   ```bash
   npx tsx scripts/check-pets.ts
   ```

3. Try it: copy it to `~/.claude/pets/`, set the `pet` option to its name, and run `claude --plugin-dir .`.
4. Open a pull request with a screenshot of the pet in your terminal.

Keep pets original or drawn from work you have the right to share.

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
npx tsc -p .
```

`npx tsc -p .` needs the types Claude Code lays in `.claude-plugin/types/`. They appear the first time you run `claude --plugin-dir .`, and git ignores them.
