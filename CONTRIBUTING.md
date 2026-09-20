# Contributing

Thanks for looking. This is a small, dependency-light project and PRs are welcome.

## Getting set up

```bash
npm install     # jsdom, for the smoke test — nothing else
npm test        # builds the bundle, then runs everything
npm run dev     # serves src/ at http://localhost:8080 with live ES modules
npm run build   # writes dist/index.html
```

`src/` runs directly in the browser as ES modules, so during development you
edit a file and reload. `dist/index.html` is the bundled single file; it is
built by `scripts/build.js`, which strips `import`/`export` and concatenates in
a fixed order. If you add a module, add it to `ORDER` in that script.

## Where things live

| Path | What it is |
|---|---|
| `src/lib/color.js` | sRGB ↔ OKLCH, mixing, WCAG contrast. Pure. |
| `src/lib/derive.js` | Five seeds → the token table. The heart of it. |
| `src/lib/emit-*.js` | Token table → `.theme.json`, scheme XML, `plugin.xml`. |
| `src/lib/zip.js` | Stored-only ZIP writer, no dependencies. |
| `src/lib/png.js` | PNG encoder for the generated wallpaper. |
| `src/lib/options.js` | Density, radius, underline, fonts and the rest — applied as a post-pass over the finished `ui` object, so the emitter stays a straight mapping. |
| `src/lib/package.js` | Assembles a full installable plugin. Shared by CLI and UI. |
| `src/ui/` | Browser only. No generator logic belongs here. |
| `bin/theme-forge.js` | CLI wrapper around `package.js`. |
| `docs/SPEC.md` | The reference the emitters implement. |

Keep `src/lib` free of DOM references — the CLI and the tests import it in Node.

## Tests

`npm test` runs four groups:

- **colour** — round-trips, the no-hue-detour property, WCAG vectors
- **derive** — every contrast floor, for five palettes × six variants
- **emit** — schema shape, dangling token references, the PhpStorm traps
- **zip** — round-trip through an independent reader, CRC check vector
- **options** — each option reaches every key it should, fonts stay opt-in
- **png** — the zlib stream is inflated with `node:zlib` and the pixels compared
- **ui smoke** — boots `dist/index.html` in jsdom and drives the real UI

Please add a test with a behaviour change. The smoke test exists because a
syntax check is not enough: early versions shipped with a truncated
`</script>` and a view that threw on render, and both parsed fine.

## Things worth knowing before you change the derivation

- Mix in **rectangular** OKLab, never polar. Polar hue interpolation sends a
  warm accent blended into a cool background through magenta — that is how you
  get a purple "deleted line" gutter.
- Contrast floors are not decoration. If a change makes `synComment` drop below
  4.5:1 the tests will say so, and the fix is the repair loop, not the floor.
- `scripts/build.js` flattens every module into one scope, so two files may
  not declare the same top-level name. The build fails loudly if they do —
  `crc32` was defined in both `zip.js` and `png.js` once, which is perfectly
  legal as modules and a `SyntaxError` as a bundle.
- Key names in the emitters were verified against the IntelliJ platform
  metadata and real `.icls` exports. Unknown keys are ignored **silently** by
  the IDE, so a typo produces no error, just an unstyled element. If you add a
  key, cite where you verified it.

## Reporting a theme that looks wrong

Include the five seed colours, the variant, and a screenshot. The palette is
all that is needed to reproduce — everything else is derived.
