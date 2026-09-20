# PhpStorm / IntelliJ Platform Theme Generation Spec

**Purpose.** This document is a complete, self-contained instruction set for an LLM that receives a palette of **5 colours** and must emit one or more installable PhpStorm themes — editor colour scheme, full IDE chrome (sidebar, tabs, popups, menus, status bar), console, terminal, diff/VCS, icons, and the plugin wrapper that makes it installable.

**Verified against** the IntelliJ Platform as of 2025.3 / 253.x. Key lists were taken from `IntelliJPlatform.themeMetadata.json` and `JDK.themeMetadata.json` in `JetBrains/intellij-community`, from the platform's own bundled themes (Darcula, HighContrast, ReSharper Dark), and from ~12 real PhpStorm `.icls` exports. Anything I could not verify from a primary source is marked `[UNVERIFIED]`.

**Terminology.** "IntelliJ Platform" = the shared core of IDEA, PhpStorm, WebStorm, Rider, etc. A PhpStorm theme is an IntelliJ Platform theme; nothing in this document is PhpStorm-only except the PHP/Blade/Twig syntax keys in §11.

---

## 0. The contract

### 0.1 Input

```jsonc
{
  "name": "Acme",                  // theme family name
  "palette": [
    "#1B1D23",   // C1  anchor / background seed
    "#D4D7DE",   // C2  ink / foreground seed
    "#4C8DF6",   // C3  primary accent
    "#E5A33C",   // C4  secondary accent
    "#5CC98A"    // C5  tertiary accent
  ],
  "variants": ["dark", "darker", "light", "contrast"],  // optional, default ["dark"]
  "author": "…",
  "id": "nl.pendo.acme"
}
```

Interpretation of the five slots is **fixed** — do not guess roles from the colours:

| Slot | Role | Used for |
|---|---|---|
| `C1` | **Anchor** | Editor + IDE background. Darkest colour in a dark theme, lightest in a light theme. |
| `C2` | **Ink** | Default text foreground. |
| `C3` | **Primary accent** | Selection, tab underline, caret, links, focus rings, keywords. |
| `C4` | **Secondary accent** | Types/classes, warnings, modified-state, `Actions.Yellow`. |
| `C5` | **Tertiary accent** | Strings, success/added state, `Actions.Green`. |

If the caller supplies five colours with no roles, assume this order. If the caller supplies a palette that is clearly all-accents (five saturated hues, no near-black/near-white), synthesise `C1` and `C2` from `C3`'s hue: `C1 = oklch(0.16, 0.02, h(C3))` for dark / `oklch(0.98, 0.01, h(C3))` for light, and `C2 = oklch(0.88, 0.02, h(C3))` / `oklch(0.24, 0.02, h(C3))`; then treat the five supplied colours as `C3..C7` accents. Say so in the output.

### 0.2 Output

A plugin directory that builds to an installable `.zip`:

```
acme-theme/
├── build.gradle.kts
├── gradle.properties
├── settings.gradle.kts
└── src/main/resources/
    ├── META-INF/
    │   ├── plugin.xml
    │   └── pluginIcon.svg
    └── themes/
        ├── acme-dark.theme.json
        ├── acme-dark.xml            ← editor colour scheme
        ├── acme-darker.theme.json
        ├── acme-darker.xml
        ├── acme-light.theme.json
        └── acme-light.xml
```

One `.theme.json` + one `.xml` **per variant**, all registered in a single `plugin.xml`.

### 0.3 Non-negotiable rules

1. **Never write a raw hex into a `ui` key.** Every colour goes into the `colors` block as a named token, and every `ui` key references a token by name. This is what makes a variant a 20-line diff instead of a rewrite.
2. **The editor scheme XML cannot use named tokens.** It has no `colors` block of its own — every value there is a literal hex. Generate it from the same token table.
3. **Hex in `.theme.json` carries `#`. Hex in the editor scheme XML does not.** `"#1B1D23"` vs `value="1b1d23"`. Getting this backwards silently produces black.
4. **Unknown keys are silently ignored** in both file formats. A typo produces no error, just an unstyled element. Validate against the key lists in this document.
5. Set `"dark": true` for any theme whose background is darker than its foreground. It selects the base LaF (Darcula vs IntelliJ) that your keys override, and it switches icon-palette resolution to the `.Dark` keys (§7.2).

---

## 1. Colour derivation

The whole theme is generated from a **token table** of ~60 derived colours. The 5 input colours are seeds; the tokens are what the theme actually references. Build the token table first, then every subsequent section is a mechanical key → token mapping.

### 1.1 Work in OKLCH

Do all mixing, lightening and hue work in OKLCH, not sRGB or HSL. sRGB mixing produces muddy mid-tones; HSL lightness is perceptually wrong (HSL "50% lightness" yellow and blue differ by a factor of three in perceived brightness). OKLCH `L` is perceptually uniform, which is what makes the contrast guarantees in §1.5 hold.

Notation used below: `oklch(L, C, h)` with `L ∈ [0,1]`, `C ∈ [0, ~0.37]`, `h ∈ [0,360)`.

Helpers assumed available:

```
L(c), C(c), H(c)          → components of colour c
oklch(l, c, h)            → construct, gamut-mapped into sRGB
mix(a, b, t)              → OKLab interpolation in RECTANGULAR (L, a, b)
                            coordinates, t=0 → a, t=1 → b. Never interpolate
                            hue polarly: mixing a warm accent into a cool
                            background along the hue circle detours through
                            magenta, which is how generated themes end up
                            with purple "deleted line" gutters.
lighten(c, dL)            → oklch(clamp(L(c)+dL,0,1), C(c), H(c))
desat(c, f)               → oklch(L(c), C(c)*f, H(c))
alpha(c, a)               → 8-digit hex RRGGBBAA
contrast(a, b)            → WCAG 2.1 contrast ratio (see §1.5)
```

A reference implementation in PHP is in §14.

### 1.2 Determine polarity

```
isDark = L(C1) < L(C2)
sign   = isDark ? +1 : -1        // direction in which "elevation" moves
```

Every formula below uses `sign`, so the same generator produces both light and dark themes.

### 1.3 The surface ramp

IntelliJ's chrome has three real elevations, plus the editor. Do not use more — the IDE looks busy.

```
bg.editor   = C1
bg.base     = lighten(C1, sign * 0.020)   // tool windows, panels, sidebar
bg.raised   = lighten(C1, sign * 0.042)   // popups, tooltips, completion, menus
bg.sunken   = lighten(C1, sign * -0.012)  // toolbar, status bar, tab strip gutter
bg.overlay  = lighten(C1, sign * 0.060)   // dialogs, floating toolbars
bg.hover    = lighten(C1, sign * 0.055)   // hovered rows in trees/lists/tables
bg.press    = lighten(C1, sign * 0.075)
```

Two rules that matter more than the numbers:

- **`bg.editor` must be the extreme end of the ramp.** The editor is where the eye lives; if a tool window is darker than the editor the layout inverts and reads as broken.
- **Keep the whole ramp within ΔL ≈ 0.09.** Wider and the IDE looks like separate applications stitched together. IntelliJ's own Darcula spans about 0.06.

Tint the ramp toward the primary accent for cohesion — this is what makes a theme feel designed rather than generated:

```
tint(c) = oklch(L(c), max(C(c), 0.008), H(C3))
bg.*    = tint(bg.*)
```

Cap chroma at 0.012 for backgrounds. Above that the IDE looks stained.

### 1.4 The ink ramp

```
fg.default  = C2
fg.muted    = mix(C2, bg.base, 0.28)     // secondary labels, inactive tabs
fg.subtle   = mix(C2, bg.base, 0.45)     // info text, breadcrumbs, line numbers
fg.disabled = mix(C2, bg.base, 0.62)
fg.inverse  = isDark ? oklch(0.15,0.01,H(C3)) : oklch(0.98,0.01,H(C3))
```

`fg.inverse` is for text on a filled accent — default-button labels, selected main-menu items.

### 1.5 Contrast floors (hard requirements)

Compute WCAG 2.1 ratios and **repair by moving `L` of the foreground token**, never the background:

| Pair | Minimum |
|---|---|
| `fg.default` on `bg.editor` | **7.0** |
| `fg.muted` on `bg.base` | 4.5 |
| `fg.subtle` on `bg.base` | 3.5 |
| `fg.disabled` on `bg.base` | 2.2 (floor, deliberately low) |
| any syntax token on `bg.editor` | **4.5** |
| `fg.inverse` on `accent.primary` | 4.5 |
| `bg.selection` vs `bg.editor` | ≥ 1.25 (visible), ≤ 2.2 (not shouting) |
| border colours vs their backdrop | ≥ 1.35 |

Repair loop:

```
while contrast(fg, bg) < target and iterations < 60:
    fg = oklch(L(fg) + sign*0.01, C(fg), H(fg))
```

If `L` saturates at 0 or 1 and the target is still unmet, reduce `C(fg)` by 10% and retry. Comment failures in the output rather than shipping unreadable text.

### 1.6 Accent tokens

```
accent.primary        = C3
accent.primary.hover  = lighten(C3, sign * 0.05)
accent.primary.muted  = desat(C3, 0.55)
accent.secondary      = C4
accent.tertiary       = C5
```

Selection is the single most-used accent surface and is the most common place generated themes fail — a saturated accent behind text destroys legibility.

```
bg.selection          = mix(C3, bg.editor, 0.74)    // 26% accent
bg.selection.inactive = mix(C3, bg.editor, 0.86)
bg.selection.ui       = mix(C3, bg.base,   0.62)    // trees/lists: stronger, text is short
fg.selection          = fg.default                  // do NOT recolour selected text
```

Verify `contrast(fg.default, bg.selection) ≥ 4.5`. If it fails, raise the mix `t` toward 1 (less accent) rather than changing `fg.selection` — recoloured selected text breaks syntax highlighting inside the selection.

### 1.7 Semantic colours

Derive these from the accents by pinning hue and inheriting chroma/lightness, so they belong to the palette instead of looking bolted on:

```
Lsem = clamp(L(C3), isDark ? 0.62 : 0.48, isDark ? 0.78 : 0.58)
Csem = clamp(max(C(C3), C(C4), C(C5)) * 0.85, 0.08, 0.16)

sem.error   = oklch(Lsem, Csem,        27)   // red
sem.warning = oklch(Lsem, Csem,        75)   // amber
sem.success = oklch(Lsem, Csem,       148)   // green
sem.info    = oklch(Lsem, Csem * 0.9, 240)   // blue
sem.modify  = oklch(Lsem, Csem * 0.9, 255)   // VCS "modified"
```

**Exception:** if one of `C3..C5` already sits within 25° of a semantic hue, use that input colour directly instead of the synthesised one. A palette whose accent *is* the green should use its own green for `success`.

### 1.8 Structure tokens

```
border.default  = mix(fg.default, bg.base, 0.80)   // 20% ink
border.strong   = mix(fg.default, bg.base, 0.68)
border.focus    = accent.primary
separator       = mix(fg.default, bg.base, 0.86)
shadow          = alpha(oklch(0.05, 0.01, H(C3)), isDark ? 0.55 : 0.18)
caret           = accent.primary
guide.indent    = mix(fg.default, bg.editor, 0.88)
guide.indent.on = mix(fg.default, bg.editor, 0.70)  // guide for the active block
```

### 1.9 The ANSI 16

Console and terminal need a full 16-colour ANSI set. Generate it from the semantic hues, with brights lifted in `L` and dropped slightly in `C`:

```
Lnorm  = isDark ? 0.66 : 0.50
Lbright= isDark ? 0.80 : 0.62
Cansi  = clamp(Csem, 0.09, 0.15)

ansi.black          = isDark ? lighten(bg.editor, 0.10) : mix(fg.default, bg.editor, 0.20)
ansi.red            = oklch(Lnorm,  Cansi,        27)
ansi.green          = oklch(Lnorm,  Cansi,       148)
ansi.yellow         = oklch(Lnorm,  Cansi,        85)
ansi.blue           = oklch(Lnorm,  Cansi,       255)
ansi.magenta        = oklch(Lnorm,  Cansi,       328)
ansi.cyan           = oklch(Lnorm,  Cansi,       205)
ansi.white          = fg.muted
ansi.brightBlack    = fg.disabled
ansi.brightRed      = oklch(Lbright, Cansi*0.92,  27)
ansi.brightGreen    = oklch(Lbright, Cansi*0.92, 148)
ansi.brightYellow   = oklch(Lbright, Cansi*0.92,  85)
ansi.brightBlue     = oklch(Lbright, Cansi*0.92, 255)
ansi.brightMagenta  = oklch(Lbright, Cansi*0.92, 328)
ansi.brightCyan     = oklch(Lbright, Cansi*0.92, 205)
ansi.brightWhite    = fg.default
```

Override `ansi.blue`, `ansi.yellow`, `ansi.green` with `C3`, `C4`, `C5` when their hues are within 25°, same rule as §1.7. This makes `composer`, `artisan`, `phpunit` and `git` output use the actual palette.

### 1.10 Syntax tokens

Seven roles carry ~90% of the visual identity of a code editor. Everything else inherits.

```
syn.keyword   = accent.primary                         // fn, class, return, public
syn.string    = accent.tertiary                        // 'text'
syn.number    = oklch(L(C4), C(C4)*1.05, H(C4))        // 42
syn.comment   = mix(fg.default, bg.editor, 0.55)       // must pass 4.5:1
syn.type      = accent.secondary                       // class names, type hints
syn.function  = mix(accent.primary, accent.tertiary, 0.5)
syn.variable  = fg.default
syn.constant  = oklch(L(C4), C(C4), (H(C4)+300)%360)   // rotate for separation
syn.operator  = fg.muted
syn.punct     = fg.subtle
syn.metadata  = desat(accent.secondary, 0.8)           // #[Attribute], annotations
syn.invalid   = sem.error
```

Assignment strategy, in priority order:

1. **Comments must be legible.** The single most common failure in generated themes is a comment at 2.5:1. Enforce 4.5:1 against `bg.editor`.
2. **Keyword and string must be distinguishable at a glance** — require ΔH ≥ 45° or ΔL ≥ 0.15 between `syn.keyword` and `syn.string`. If the palette can't deliver it, rotate `syn.string` hue by ±40°.
3. **`syn.variable` stays neutral.** PHP is dense with `$vars`; colouring them makes the file strobe.
4. **Use `FONT_TYPE` sparingly.** Italic on comments and doc comments is conventional and fine. Bold on keywords is a per-theme choice; never bold more than one role.

### 1.11 Generating multiple variants from one palette

This is the point of the exercise: one palette, several themes. Each variant is a transformation applied **before** §1.3, then the whole pipeline re-runs unchanged.

| Variant | Transformation |
|---|---|
| `dark` | Identity (assuming `C1` is the dark anchor). |
| `darker` | `C1 ← oklch(L(C1) - 0.045, C(C1)*0.9, H(C1))`; widen the surface ramp deltas ×1.25; `bg.editor ← oklch(L(C1)-0.015, …)` so the editor is near-black and chrome lifts off it. |
| `light` | Swap: `C1' = C2`, `C2' = C1`; then `L(C1') ← max(L(C1'), 0.965)`, `L(C2') ← min(L(C2'), 0.26)`; drop all accent `L` by 0.14 and raise `C` by 1.15× (accents that read well on dark are washed out on light); re-run. |
| `contrast` | `fg.default ← oklch(isDark ? 0.99 : 0.06, …)`; raise every contrast floor in §1.5 by 1.5×; `border.default ← border.strong`; set `Borders.ContrastBorderColor` (§4.6). |
| `muted` / `soft` | `C(accent.*) ×= 0.72`, `C(syn.*) ×= 0.75`, narrow surface ramp ×0.8. |
| `vivid` | `C(accent.*) ×= 1.25` (gamut-clamped), `bg.*` chroma ×0.6 so backgrounds stay neutral against louder accents. |

Each variant gets its own `themeProvider` id in `plugin.xml` (§12.2). **Ids must never change between releases** — the id is the persisted identity of the LaF, and changing it resets the theme for every user.

### 1.12 The complete token table

Emit this as a comment block at the top of the generated `.theme.json` (`"commentary"` key), and use it verbatim as the `colors` block. Token names below are used throughout the rest of this document.

```
bg.editor  bg.base  bg.raised  bg.sunken  bg.overlay  bg.hover  bg.press
bg.selection  bg.selection.inactive  bg.selection.ui
fg.default  fg.muted  fg.subtle  fg.disabled  fg.inverse  fg.selection
accent.primary  accent.primary.hover  accent.primary.muted
accent.secondary  accent.tertiary
sem.error  sem.warning  sem.success  sem.info  sem.modify
border.default  border.strong  border.focus  separator  shadow
caret  guide.indent  guide.indent.on
ansi.black … ansi.brightWhite                         (16)
syn.keyword syn.string syn.number syn.comment syn.type syn.function
syn.variable syn.constant syn.operator syn.punct syn.metadata syn.invalid
```

JSON token names cannot contain dots when used as `colors` keys in a way that reads cleanly — the platform allows any string, but use **camelCase without dots** in the actual file to avoid confusion with UI key syntax:

```jsonc
"colors": {
  "bgEditor": "#1B1D23",
  "bgBase": "#20232A",
  "bgRaised": "#262A33",
  "accentPrimary": "#4C8DF6",
  …
}
```

Referenced from `ui` as a bare string: `"Panel.background": "bgBase"`. JetBrains' own themes also accept a `$` prefix (`"$bgBase"`) — both work, and the `$` form is better style because a bare string that is *not* a defined token fails silently as an invalid colour.

---

## 2. `.theme.json` — file format

### 2.1 Top-level keys (complete)

| Key | Type | Notes |
|---|---|---|
| `name` | string | **Required.** Shown in Settings → Appearance → Theme. Conventionally matches the filename stem. |
| `dark` | boolean | **Required.** Selects the base LaF being overridden (Darcula vs IntelliJ) and switches icon-palette `.Dark` resolution. |
| `author` | string | Free text. |
| `editorScheme` | string | **Required in practice.** Either a resource path (`"/themes/acme-dark.xml"`, leading slash, relative to the resources root) or the *name* of an already-registered scheme (`"ReSharper Dark"`). Use the path form. |
| `parentTheme` | string | Inherit from another theme instead of the bare LaF. Values seen in the wild: `"Darcula"`, `"IntelliJ"`. Optional; omit unless you're shipping a delta of a bundled theme. |
| `colors` | object | Named colour tokens. See §2.2. |
| `ui` | object | The UI key overrides. See §2.3. |
| `icons` | object | Icon path replacements + `ColorPalette`. See §7. |
| `iconColorsOnSelection` | object | hex → hex map applied to icons drawn on a selected row. See §7.5. |
| `background` | object | Editor-area wallpaper. See §2.6. |
| `emptyFrameBackground` | object | Wallpaper for the "no project open" frame. |
| `nameKey` | string | i18n bundle key for the display name. Bundled-theme use only; ignore. |
| `commentary` | string | Non-functional free text. JetBrains uses it for a generator banner. Good place for the token table. |

Key order is irrelevant.

### 2.2 The `colors` block

```jsonc
{
  "colors": {
    "bgEditor": "#1B1D23",
    "accentPrimary": "#4C8DF6",
    "borderDefault": "#333842",
    "shadow": "#05080D8C"            // 8-digit = RRGGBBAA
  },
  "ui": {
    "Panel.background": "bgEditor",
    "Component.focusedBorderColor": "$accentPrimary"
  }
}
```

- Values are `#RRGGBB` or `#RRGGBBAA`. The `#` is **required** here.
- References are the bare token name, optionally `$`-prefixed. Both resolve identically.
- A token may not reference another token — the block is flat literals only.
- An undefined reference is not an error; the key is simply skipped. This is the #1 silent failure mode. Validate that every string value in `ui` either starts with `#`, is numeric, matches the border syntax (§2.5), or exists in `colors`.

### 2.3 The `ui` block — two equivalent syntaxes

Flat dotted keys and nested objects are interchangeable and may be mixed in one file:

```jsonc
"ui": {
  "ToolWindow.Header.background": "bgSunken",

  "ToolWindow": {
    "Header": { "background": "bgSunken" }
  }
}
```

Prefer **nested** for large namespaces (`ToolWindow`, `EditorTabs`, `Plugins`, `VersionControl`), **flat** for one-off keys. Nested is easier for a generator to emit and for a human to diff.

### 2.4 The `*` wildcard

```jsonc
"ui": {
  "*": {
    "background": "bgBase",
    "foreground": "fgDefault"
  }
}
```

Mechanics, verified against `UITheme.java`:

```java
if (key.startsWith("*.")) {
  String tail = key.substring(1);              // ".background"
  addPattern(key, value, defaults);
  for (Object k : defaults.keySet().toArray()) {
    if (k instanceof String && ((String)k).endsWith(tail)) defaults.put(k, value);
  }
}
```

- It is **plain suffix matching on `"." + property`**. There is no allow-list of properties — `*.background`, `*.selectionInactiveForeground`, `*.acceleratorForeground` all work.
- It matches the **full trailing segment**: `*.background` hits `Label.background` and `ToolWindow.Header.background`, but **not** `Popup.Header.activeBackground`.
- It only rewrites keys already present in `UIDefaults` at apply time; it is additionally stored as a pattern so components registering defaults later can consult it.
- An explicit key in the same theme **wins** over the wildcard.

**Use the wildcard for exactly these, and then stop:**

```jsonc
"*": {
  "background":                  "bgBase",
  "foreground":                  "fgDefault",
  "textForeground":              "fgDefault",
  "caretForeground":             "fgDefault",
  "infoForeground":              "fgSubtle",
  "disabledForeground":          "fgDisabled",
  "disabledText":                "fgDisabled",
  "inactiveForeground":          "fgMuted",
  "selectionBackground":         "bgSelectionUi",
  "selectionForeground":         "fgSelection",
  "selectionInactiveBackground": "bgSelectionInactive",
  "selectionBackgroundInactive": "bgSelectionInactive",
  "selectionInactiveForeground": "fgSelection",
  "selectionForegroundInactive": "fgSelection",
  "inactiveBackground":          "bgBase",
  "disabledBackground":          "bgBase",
  "borderColor":                 "borderDefault",
  "separatorColor":              "separator",
  "acceleratorForeground":       "fgSubtle",
  "acceleratorSelectionForeground": "fgSelection"
}
```

Note the deliberate duplication of `selectionInactiveForeground` / `selectionForegroundInactive` and the two `selectionBackground…Inactive` spellings. Different components read different keys; Dracula and ReSharper Dark both set every spelling. Do the same.

The wildcard is a **floor, not a finish**. It gets ~60% of the IDE to a plausible state in 20 lines; the sections below are what makes it look intentional.

### 2.5 Non-colour value types

Not every UI key takes a colour. Emitting a hex where an integer is expected is silently ignored.

| Shape | Example | Meaning |
|---|---|---|
| Integer | `"EditorTabs.underlineHeight": 2` | pixels. JSON number, not string. |
| Float | `"Islands.inactiveAlpha": 0.6` | 0–1 alpha. |
| Border | `"Window.border": "4,4,4,4,E6E6E6"` | `top,left,bottom,right,hexWithoutHash`. The colour part is optional. |
| Insets | `"Popup.Header.insets": "8,10,8,10"` | `top,left,bottom,right` in px. |
| Size | `"MainToolbar.Button.size": 34` | px. |
| Boolean | `"Tree.paintLines": false` | |
| Icon ref | `"Tree.collapsedIcon": "AllIcons.General.ChevronRight"` | |

Keys ending in `Insets`, `insets`, `padding`, `Size`, `size`, `Height`, `height`, `Width`, `width`, `arc`, `Arc`, `Gap`, `gap`, `Offset`, `offset`, `Alpha`, `alpha`, `Opacity`, `opacity`, `Radius`, `Length`, `Indent`, `rowHeight`, `borderWidth`, `fontSizeOffset` are **not colours**. A generator must skip them unless it has an explicit value to emit.

### 2.6 Background image

```jsonc
"background": {
  "image": "/bg.png",
  "transparency": 10,          // 1–100; 100 = opaque
  "fill": "scale",             // scale | tile | plain
  "anchor": "center"           // center | top_left | top_right | bottom_left | bottom_right | ...
},
"emptyFrameBackground": { "image": "/bg.png", "transparency": 20, "fill": "scale", "anchor": "center" }
```

Omit both unless asked. Generated wallpapers age badly.

---

## 3. UI key map — how to read §4–§6

Every key below is given with the token it should receive. Format:

```
Key.name                              ← tokenName
```

Keys marked `(dep)` are deprecated in the platform metadata; set them only if you need to support IDEs older than ~2023.1, and never as the *only* place a colour is defined.

Keys marked `[JDK]` come from `JDK.themeMetadata.json` (plain Swing). They are the ones the `*` wildcard actually reaches, because Swing registers them in `UIDefaults` eagerly. Keys from `IntelliJPlatform.themeMetadata.json` are registered lazily by the component that owns them, so the wildcard is less reliable there — **set platform keys explicitly.**

A generator should emit every key in §4 and §5. §6 is optional polish; emit it when producing a "complete" theme.

---

## 4. Core UI surfaces (always emit)

### 4.1 Global / base Swing `[JDK]`

```
Panel.background                      ← bgBase
Panel.foreground                      ← fgDefault
Viewport.background                   ← bgBase
Viewport.foreground                   ← fgDefault
ScrollPane.background                 ← bgBase
ScrollPane.foreground                 ← fgDefault
Label.foreground                      ← fgDefault
Label.background                      ← bgBase
Label.disabledForeground              ← fgDisabled
Label.disabledText                    ← fgDisabled
Label.selectedForeground              ← fgSelection
Label.infoForeground                  ← fgSubtle
Label.errorForeground                 ← semError
Label.warningForeground               ← semWarning
Label.successForeground               ← semSuccess
OptionPane.background                 ← bgOverlay
OptionPane.foreground                 ← fgDefault
OptionPane.messageForeground          ← fgDefault
AlertDialog.background                ← bgOverlay
SplitPane.background                  ← bgBase
SplitPaneDivider.draggingColor        ← accentPrimary
OnePixelDivider.background            ← separator
Separator.separatorColor              ← separator
Group.separatorColor                  ← separator
Group.disabledSeparatorColor          ← separator
Borders.color                         ← borderDefault
Borders.ContrastBorderColor           ← borderStrong
TitledBorder.titleColor               ← fgMuted
Window.border                         ← "1,1,1,1,<borderDefault without #>"
Window.undecorated.border             ← "1,1,1,1,<borderDefault without #>"
textText                              ← fgDefault
window                                ← bgBase
windowBorder                          ← borderDefault
windowText                            ← fgDefault
```

`Window.border` takes the insets+hex string form (§2.5). Emit the hex **without** `#`, and note it cannot reference a `colors` token — it must be a literal.

### 4.2 Component chrome — the focus/border system `[JDK]`

This namespace governs every text field, combo box, spinner and button outline. Getting it right is most of what "looks like a real theme" means.

```
Component.borderColor                 ← borderDefault
Component.disabledBorderColor         ← mix(borderDefault, bgBase, 0.5)
Component.focusedBorderColor          ← accentPrimary
Component.focusColor                  ← alpha(accentPrimary, 0.55)
Component.errorFocusColor             ← alpha(semError, 0.55)
Component.inactiveErrorFocusColor     ← alpha(semError, 0.28)
Component.warningFocusColor           ← alpha(semWarning, 0.55)
Component.inactiveWarningFocusColor   ← alpha(semWarning, 0.28)
Component.iconColor                   ← fgSubtle
Component.hoverIconColor              ← fgDefault
Component.infoForeground              ← fgSubtle
Component.arc                         ← 6            (integer, px; optional)
Component.focusWidth                  ← 2            (integer, px; optional)
```

### 4.3 Text inputs `[JDK]`

```
TextField.background                  ← bgEditor
TextField.foreground                  ← fgDefault
TextField.caretForeground             ← caret
TextField.inactiveForeground          ← fgDisabled
TextField.selectionBackground         ← bgSelection
TextField.selectionForeground         ← fgSelection
TextArea.background                   ← bgEditor
TextArea.foreground                   ← fgDefault
TextArea.caretForeground              ← caret
TextArea.inactiveForeground           ← fgDisabled
TextArea.selectionBackground          ← bgSelection
TextArea.selectionForeground          ← fgSelection
TextPane.background                   ← bgEditor
TextPane.foreground                   ← fgDefault
TextPane.caretForeground              ← caret
TextPane.inactiveForeground           ← fgDisabled
TextPane.selectionBackground          ← bgSelection
TextPane.selectionForeground          ← fgSelection
EditorPane.background                 ← bgEditor
EditorPane.foreground                 ← fgDefault
EditorPane.caretForeground            ← caret
EditorPane.inactiveForeground         ← fgDisabled
EditorPane.selectionBackground        ← bgSelection
EditorPane.selectionForeground        ← fgSelection
FormattedTextField.background         ← bgEditor
FormattedTextField.foreground         ← fgDefault
FormattedTextField.caretForeground    ← caret
FormattedTextField.inactiveForeground ← fgDisabled
FormattedTextField.selectionBackground← bgSelection
FormattedTextField.selectionForeground← fgSelection
PasswordField.background              ← bgEditor
PasswordField.foreground              ← fgDefault
PasswordField.caretForeground         ← caret
PasswordField.capsLockIconColor       ← semWarning
PasswordField.inactiveForeground      ← fgDisabled
PasswordField.selectionBackground     ← bgSelection
PasswordField.selectionForeground     ← fgSelection
TextComponent.selectionBackgroundInactive ← bgSelectionInactive
SearchField.errorBackground           ← mix(semError, bgEditor, 0.85)
SearchField.errorForeground           ← semError
```

### 4.4 Buttons `[JDK]`

IntelliJ buttons are gradient-filled: `startBackground` → `endBackground`. Set both to the same token for a flat look, or offset by ΔL 0.02 for a subtle gradient.

```
Button.background                     ← bgRaised
Button.foreground                     ← fgDefault
Button.startBackground                ← bgRaised
Button.endBackground                  ← bgRaised
Button.startBorderColor               ← borderDefault
Button.endBorderColor                 ← borderDefault
Button.focusedBorderColor             ← accentPrimary
Button.disabledBorderColor            ← mix(borderDefault, bgBase, 0.5)
Button.disabledText                   ← fgDisabled
Button.shadowColor                    ← "#00000000"       (kill the default shadow)
Button.shadowWidth                    ← 0
Button.arc                            ← 6
Button.loadingForeground              ← fgSubtle

Button.default.foreground             ← fgInverse
Button.default.startBackground        ← accentPrimary
Button.default.endBackground          ← accentPrimary
Button.default.startBorderColor       ← accentPrimary
Button.default.endBorderColor         ← accentPrimary
Button.default.focusColor             ← alpha(accentPrimary, 0.55)
Button.default.focusedBorderColor     ← accentPrimaryHover
Button.default.shadowColor            ← "#00000000"
Button.default.loadingForeground      ← fgInverse
Button.Split.default.separatorColor   ← alpha(fgInverse, 0.35)
Button.Split.default.iconColor        ← fgInverse
OptionButton.separatorColor           ← borderDefault
OptionButton.default.separatorColor   ← alpha(fgInverse, 0.35)

ToggleButton.background               ← bgRaised
ToggleButton.foreground               ← fgDefault
ToggleButton.disabledText             ← fgDisabled
ToggleButton.onBackground             ← semSuccess
ToggleButton.onForeground             ← fgInverse
ToggleButton.offBackground            ← mix(fgDefault, bgBase, 0.65)
ToggleButton.offForeground            ← fgMuted
ToggleButton.buttonColor              ← bgRaised
ToggleButton.borderColor              ← borderDefault

ActionButton.hoverBackground          ← bgHover
ActionButton.hoverBorderColor         ← "#00000000"
ActionButton.pressedBackground        ← bgPress
ActionButton.pressedBorderColor       ← "#00000000"
ActionButton.focusedBorderColor       ← accentPrimary
ActionButton.separatorColor           ← separator
ActionButton.hoverSeparatorColor      ← borderDefault

SegmentedButton.selectedButtonColor        ← bgRaised
SegmentedButton.focusedSelectedButtonColor ← bgHover
SegmentedButton.selectedStartBorderColor   ← borderDefault
SegmentedButton.selectedEndBorderColor     ← borderDefault

DisclosureButton.defaultBackground    ← bgRaised
DisclosureButton.hoverOverlay         ← alpha(fgDefault, 0.06)
DisclosureButton.pressedOverlay       ← alpha(fgDefault, 0.10)
```

### 4.5 Checkboxes, radios, combo boxes, spinners `[JDK]`

Checkbox and radio **glyphs are SVG icons, not LaF colours** — recolour them via `icons.ColorPalette` (§7.4). These keys only cover the label and container.

```
CheckBox.background                   ← bgBase
CheckBox.foreground                   ← fgDefault
CheckBox.disabledText                 ← fgDisabled
CheckBox.select                       ← accentPrimary
RadioButton.background                ← bgBase
RadioButton.foreground                ← fgDefault
RadioButton.disabledText              ← fgDisabled

ComboBox.background                   ← bgRaised
ComboBox.foreground                   ← fgDefault
ComboBox.nonEditableBackground        ← bgRaised
ComboBox.disabledForeground           ← fgDisabled
ComboBox.modifiedItemForeground       ← accentSecondary
ComboBox.selectionBackground          ← bgSelectionUi
ComboBox.selectionForeground          ← fgSelection
ComboBox.ArrowButton.background           ← bgRaised
ComboBox.ArrowButton.nonEditableBackground← bgRaised
ComboBox.ArrowButton.iconColor            ← fgSubtle
ComboBox.ArrowButton.disabledIconColor    ← fgDisabled
ComboBoxButton.background             ← bgRaised

Spinner.background                    ← bgRaised
Slider.background                     ← bgBase
Slider.foreground                     ← fgDefault
Slider.buttonColor                    ← accentPrimary
Slider.buttonBorderColor              ← accentPrimary
Slider.trackColor                     ← mix(fgDefault, bgBase, 0.78)
Slider.tickColor                      ← fgSubtle
Slider.focus                          ← alpha(accentPrimary, 0.55)
```

### 4.6 Trees, lists, tables — the sidebar/Project view

This is the "sidebar" surface. `Tree.*` drives the Project tool window, Structure, Settings tree, File chooser, Commit view.

```
Tree.background                       ← bgBase
Tree.foreground                       ← fgDefault
Tree.selectionBackground              ← bgSelectionUi
Tree.selectionForeground              ← fgSelection
Tree.selectionInactiveBackground      ← bgSelectionInactive
Tree.hoverBackground                  ← bgHover
Tree.hoverInactiveBackground          ← bgHover
Tree.modifiedItemForeground           ← accentSecondary
Tree.errorForeground                  ← semError
Tree.hash                             ← guideIndent          (the indent guide lines)
Tree.paintLines                       ← false                (boolean; modern look)
Tree.rowHeight                        ← 24                   (integer; optional)
Tree.Selection.arc                    ← 6                    (integer; rounded rows)
Tree.forceFocusedSelectionForeground  ← fgSelection

List.background                       ← bgBase
List.foreground                       ← fgDefault
List.selectionBackground              ← bgSelectionUi
List.selectionForeground              ← fgSelection
List.selectionInactiveBackground      ← bgSelectionInactive
List.selectionInactiveForeground      ← fgSelection
List.hoverBackground                  ← bgHover
List.hoverInactiveBackground          ← bgHover
List.dropLineColor                    ← accentPrimary
List.rowHeight                        ← 22                   (integer; optional)
List.Button.hoverBackground           ← bgHover
List.Button.separatorColor            ← separator
List.Line.hoverBackground             ← bgHover
List.Tag.background                   ← mix(accentPrimary, bgBase, 0.78)
List.Tag.foreground                   ← accentPrimary

Table.background                      ← bgBase
Table.foreground                      ← fgDefault
Table.gridColor                       ← separator
Table.selectionBackground             ← bgSelectionUi
Table.selectionForeground             ← fgSelection
Table.selectionInactiveBackground     ← bgSelectionInactive
Table.selectionInactiveForeground     ← fgSelection
Table.hoverBackground                 ← bgHover
Table.hoverInactiveBackground         ← bgHover
Table.focusCellBackground             ← bgSelectionUi
Table.focusCellForeground             ← fgSelection
Table.lightSelectionBackground        ← mix(accentPrimary, bgBase, 0.85)
Table.lightSelectionForeground        ← fgDefault
Table.lightSelectionInactiveBackground← mix(accentPrimary, bgBase, 0.92)
Table.lightSelectionInactiveForeground← fgMuted
Table.alternativeRowBackground        ← mix(fgDefault, bgBase, 0.965)
Table.stripeColor                     ← mix(fgDefault, bgBase, 0.965)
Table.dropLineColor                   ← accentPrimary
Table.dropLineShortColor              ← accentPrimary
Table.sortIconColor                   ← fgSubtle

TableHeader.background                ← bgSunken
TableHeader.foreground                ← fgMuted
TableHeader.separatorColor            ← separator
TableHeader.bottomSeparatorColor      ← separator
TableHeader.focusCellBackground       ← bgHover

SettingsTree.rowHeight                ← 24                   (integer)
DragAndDrop.areaBackground            ← mix(accentPrimary, bgBase, 0.85)
DragAndDrop.areaForeground            ← accentPrimary
DragAndDrop.borderColor               ← accentPrimary
DragAndDrop.rowBackground             ← mix(accentPrimary, bgBase, 0.80)
SidePanel.background                  ← bgSunken
```

### 4.7 Tool windows — the actual "sidebar" chrome

```
ToolWindow.background                        ← bgBase
ToolWindow.borderColor                       ← borderDefault

ToolWindow.Header.background                 ← bgSunken
ToolWindow.Header.inactiveBackground         ← bgSunken
ToolWindow.Header.borderColor                ← borderDefault
ToolWindow.Header.height                     ← 30            (integer)
ToolWindow.HeaderCloseButton.background      ← bgHover

ToolWindow.HeaderTab.underlineColor          ← accentPrimary
ToolWindow.HeaderTab.inactiveUnderlineColor  ← accentPrimaryMuted
ToolWindow.HeaderTab.underlineHeight         ← 2             (integer)
ToolWindow.HeaderTab.underlinedTabBackground ← bgHover
ToolWindow.HeaderTab.underlinedTabInactiveBackground ← bgBase
ToolWindow.HeaderTab.hoverBackground         ← bgHover
ToolWindow.HeaderTab.hoverInactiveBackground ← bgHover
ToolWindow.HeaderTab.selectedInactiveBackground ← bgBase

ToolWindow.Button.foreground                 ← fgMuted
ToolWindow.Button.hoverBackground            ← bgHover
ToolWindow.Button.selectedBackground         ← bgSelectionUi
ToolWindow.Button.selectedForeground         ← fgSelection
ToolWindow.Button.DragAndDrop.buttonDropBackground   ← mix(accentPrimary, bgBase, 0.8)
ToolWindow.Button.DragAndDrop.buttonDropBorderColor  ← accentPrimary
ToolWindow.Button.DragAndDrop.buttonFloatingBackground ← bgRaised
ToolWindow.DragAndDrop.areaBackground        ← mix(accentPrimary, bgBase, 0.85)

ToolWindow.Stripe.background                 ← bgSunken
ToolWindow.Stripe.borderColor                ← borderDefault
ToolWindow.Stripe.separatorColor             ← separator
ToolWindow.Stripe.DragAndDrop.separatorColor ← accentPrimary

StripeToolbar.Button.size                    ← 30            (integer; new UI)
StripeToolbar.Button.iconSize                ← 20            (integer)
```

### 4.8 Editor tabs

```
EditorTabs.background                        ← bgSunken
EditorTabs.borderColor                       ← borderDefault
EditorTabs.underTabsBorderColor              ← borderDefault
EditorTabs.underlinedBorderColor             ← accentPrimary
EditorTabs.underlineColor                    ← accentPrimary
EditorTabs.inactiveUnderlineColor            ← accentPrimaryMuted
EditorTabs.underlineHeight                   ← 2             (integer)
EditorTabs.underlineArc                      ← 2             (integer; optional)
EditorTabs.underlinedTabBackground           ← bgEditor
EditorTabs.underlinedTabForeground           ← fgDefault
EditorTabs.inactiveUnderlinedTabBackground   ← bgBase
EditorTabs.inactiveUnderlinedTabBorderColor  ← borderDefault
EditorTabs.hoverBackground                   ← bgHover
EditorTabs.hoverInactiveBackground           ← bgHover
EditorTabs.hoverSelectedBackground           ← bgHover
EditorTabs.hoverSelectedInactiveBackground   ← bgHover
EditorTabs.inactiveColoredFileBackground     ← alpha(bgBase, 0.6)
EditorTabs.unselectedAlpha                   ← 0.75          (float)
EditorTabs.unselectedBlend                   ← 0.75          (float)

DefaultTabs.background                       ← bgSunken
DefaultTabs.borderColor                      ← borderDefault
DefaultTabs.hoverBackground                  ← bgHover
DefaultTabs.underlineColor                   ← accentPrimary
DefaultTabs.inactiveUnderlineColor           ← accentPrimaryMuted
DefaultTabs.underlineHeight                  ← 2             (integer)
DefaultTabs.underlinedTabBackground          ← bgBase
DefaultTabs.underlinedTabForeground          ← fgDefault

DebuggerTabs.underlinedTabBackground         ← bgBase
DebuggerTabs.underlineHeight                 ← 2             (integer)

TabbedPane.background                        ← bgBase
TabbedPane.foreground                        ← fgDefault
TabbedPane.contentAreaColor                  ← borderDefault
TabbedPane.disabledForeground                ← fgDisabled
TabbedPane.disabledUnderlineColor            ← fgDisabled
TabbedPane.focusColor                        ← bgHover
TabbedPane.hoverColor                        ← bgHover
TabbedPane.underlineColor                    ← accentPrimary
TabbedPane.tabSelectionHeight                ← 2             (integer)

MainWindow.Tab.background                    ← bgSunken
MainWindow.Tab.foreground                    ← fgMuted
MainWindow.Tab.selectedBackground            ← bgEditor
MainWindow.Tab.selectedForeground            ← fgDefault
MainWindow.Tab.selectedInactiveBackground    ← bgBase
MainWindow.Tab.hoverBackground               ← bgHover
MainWindow.Tab.hoverForeground               ← fgDefault
MainWindow.Tab.separatorColor                ← separator
MainWindow.Tab.borderColor                   ← borderDefault

FileColor.Blue    ← alpha(semInfo,    0.14)
FileColor.Green   ← alpha(semSuccess, 0.14)
FileColor.Orange  ← alpha(semWarning, 0.14)
FileColor.Rose    ← alpha(semError,   0.14)
FileColor.Violet  ← alpha(synConstant,0.14)
FileColor.Yellow  ← alpha(accentSecondary, 0.14)
FileColor.Gray    ← alpha(fgSubtle,   0.14)
```

`FileColor.*` values **must** carry alpha — they are composited over the tree/tab background.

### 4.9 Menus and the main menu bar

```
MenuBar.borderColor                   ← borderDefault
MenuBar.foreground                    ← fgDefault
MenuBar.disabledForeground            ← fgDisabled
MenuBar.disabledBackground            ← bgSunken
MenuBar.selectionBackground           ← bgSelectionUi
MenuBar.selectionForeground           ← fgSelection
MenuBar.highlight                     ← borderDefault
MenuBar.shadow                        ← borderDefault

Menu.background                       ← bgRaised
Menu.foreground                       ← fgDefault
Menu.borderColor                      ← borderDefault
Menu.separatorColor                   ← separator
Menu.disabledBackground               ← bgRaised
Menu.disabledForeground               ← fgDisabled
Menu.selectionBackground              ← bgSelectionUi
Menu.selectionForeground              ← fgSelection
Menu.acceleratorForeground            ← fgSubtle
Menu.acceleratorSelectionForeground   ← fgSelection
Menu.Selection.arc                    ← 6             (integer)

MenuItem.background                   ← bgRaised
MenuItem.foreground                   ← fgDefault
MenuItem.disabledBackground           ← bgRaised
MenuItem.disabledForeground           ← fgDisabled
MenuItem.selectionBackground          ← bgSelectionUi
MenuItem.selectionForeground          ← fgSelection
MenuItem.acceleratorForeground        ← fgSubtle

CheckBoxMenuItem.background           ← bgRaised
CheckBoxMenuItem.foreground           ← fgDefault
CheckBoxMenuItem.disabledBackground   ← bgRaised
CheckBoxMenuItem.disabledForeground   ← fgDisabled
CheckBoxMenuItem.selectionBackground  ← bgSelectionUi
CheckBoxMenuItem.selectionForeground  ← fgSelection
CheckBoxMenuItem.acceleratorForeground          ← fgSubtle
CheckBoxMenuItem.acceleratorSelectionForeground ← fgSelection

RadioButtonMenuItem.background        ← bgRaised
RadioButtonMenuItem.foreground        ← fgDefault
RadioButtonMenuItem.disabledBackground← bgRaised
RadioButtonMenuItem.disabledForeground← fgDisabled
RadioButtonMenuItem.selectionBackground ← bgSelectionUi
RadioButtonMenuItem.selectionForeground ← fgSelection
RadioButtonMenuItem.acceleratorForeground          ← fgSubtle
RadioButtonMenuItem.acceleratorSelectionForeground ← fgSelection

PopupMenu.background                  ← bgRaised
PopupMenu.foreground                  ← fgDefault
PopupMenu.selectionBackground         ← bgSelectionUi
PopupMenu.selectionForeground         ← fgSelection
PopupMenu.translucentBackground       ← alpha(bgRaised, 0.96)
PopupMenu.borderWidth                 ← 1             (integer)
PopupMenuSeparator.height             ← 9             (integer)
PopupMenuSeparator.stripeWidth        ← 1             (integer)
PopupMenuSeparator.stripeIndent       ← 4             (integer)

MainMenu.selectionBackground              ← bgSelectionUi
MainMenu.selectionForeground              ← fgSelection
MainMenu.transparentSelectionBackground   ← alpha(fgDefault, 0.10)
MainMenu.Selection.fullScreenArc          ← 6          (integer)
```

### 4.10 Popups, tooltips, completion

The completion popup is the single most-looked-at popup in the IDE. Get `CompletionPopup.matchForeground` right — it is the prefix-match highlight.

```
Popup.background                      ← bgRaised
Popup.borderColor                     ← borderDefault
Popup.inactiveBorderColor             ← borderDefault
Popup.innerBorderColor                ← borderDefault
Popup.borderWidth                     ← 1             (integer)
Popup.paintBorder                     ← true          (boolean)
Popup.separatorColor                  ← separator
Popup.separatorForeground             ← fgSubtle
Popup.Header.activeBackground         ← bgSunken
Popup.Header.inactiveBackground       ← bgSunken
Popup.Header.activeForeground         ← fgDefault
Popup.Header.inactiveForeground       ← fgMuted
Popup.Toolbar.background              ← bgRaised
Popup.Toolbar.borderColor             ← borderDefault
Popup.Advertiser.background           ← bgSunken
Popup.Advertiser.foreground           ← fgSubtle
Popup.Advertiser.borderColor          ← borderDefault
Popup.Selection.arc                   ← 6             (integer)

CompletionPopup.foreground            ← fgDefault
CompletionPopup.selectionBackground   ← bgSelectionUi
CompletionPopup.selectionInactiveBackground ← bgSelectionInactive
CompletionPopup.matchForeground       ← accentPrimary
CompletionPopup.nonFocusedMask        ← alpha(bgBase, 0.35)
CompletionPopup.Advertiser.background ← bgSunken
CompletionPopup.Advertiser.foreground ← fgSubtle

ComplexPopup.Header.background        ← bgSunken
ComboPopup.border                     ← "1,1,1,1,<borderDefault without #>"

ToolTip.background                    ← bgRaised
ToolTip.foreground                    ← fgDefault
ToolTip.borderColor                   ← borderDefault
ToolTip.infoForeground                ← fgSubtle
ToolTip.linkForeground                ← accentPrimary
ToolTip.shortcutForeground            ← fgSubtle
ToolTip.paintBorder                   ← true          (boolean)
ToolTip.Actions.background            ← bgSunken
ToolTip.Actions.infoForeground        ← fgSubtle
Tooltip.separatorColor                ← separator

HelpTooltip.borderColor               ← borderDefault
InformationHint.borderColor           ← borderDefault
DebuggerPopup.borderColor             ← borderDefault
InplaceRefactoringPopup.borderColor   ← accentPrimary
GutterTooltip.infoForeground          ← fgSubtle
GutterTooltip.lineSeparatorColor      ← separator

ValidationTooltip.errorBackground     ← mix(semError, bgRaised, 0.85)
ValidationTooltip.errorForeground     ← semError
ValidationTooltip.errorBorderColor    ← semError
ValidationTooltip.warningBackground   ← mix(semWarning, bgRaised, 0.85)
ValidationTooltip.warningForeground   ← semWarning
ValidationTooltip.warningBorderColor  ← semWarning

ParameterInfo.background              ← bgRaised
ParameterInfo.foreground              ← fgDefault
ParameterInfo.borderColor             ← borderDefault
ParameterInfo.infoForeground          ← fgSubtle
ParameterInfo.disabledForeground      ← fgDisabled
ParameterInfo.currentParameterForeground ← accentPrimary
ParameterInfo.currentOverloadBackground  ← bgHover
ParameterInfo.lineSeparatorColor      ← separator

SpeedSearch.background                ← bgRaised
SpeedSearch.foreground                ← fgDefault
SpeedSearch.borderColor               ← borderDefault
SpeedSearch.errorForeground           ← semError

Ide.Shadow.*                          ← shadow        (17 keys; see §6.5)
Notification.Shadow.*                 ← shadow        (17 keys)
```

### 4.11 Scrollbars

Scrollbars are the one surface where you must emit **all four platform families** — the IDE picks by OS and by transparent-scrollbar setting, and a missing family shows the base theme's scrollbar through your chrome.

Define once:

```
sbThumb        = alpha(fgDefault, 0.20)
sbThumbHover   = alpha(fgDefault, 0.32)
sbTrack        = "#00000000"
sbTrackHover   = alpha(fgDefault, 0.06)
```

Then emit for each prefix in
`ScrollBar.` , `ScrollBar.Transparent.` , `ScrollBar.Mac.` , `ScrollBar.Mac.Transparent.`:

```
<prefix>thumbColor                    ← sbThumb
<prefix>thumbBorderColor              ← sbThumb
<prefix>hoverThumbColor               ← sbThumbHover
<prefix>hoverThumbBorderColor         ← sbThumbHover
<prefix>trackColor                    ← sbTrack
<prefix>hoverTrackColor               ← sbTrackHover
```

Plus, once:

```
ScrollBar.background                  ← bgBase
Scrollbar.Tabs.ThumbColor             ← sbThumb        (note lowercase 'b' — copy exactly)
Scrollbar.Tabs.HoveredThumbColor      ← sbThumbHover
Scrollbar.Tabs.TransparentThumbColor  ← sbThumb
```

The same `ScrollBar.*` names **also** appear in the editor colour scheme's `<colors>` block, where they style the editor's own scrollbar (§8.4). Set them in both places with the same values.

### 4.12 Status bar, toolbars, navigation bar

```
StatusBar.background                        ← bgSunken
StatusBar.borderColor                       ← borderDefault
StatusBar.Widget.foreground                 ← fgMuted
StatusBar.Widget.hoverBackground            ← bgHover
StatusBar.Widget.hoverForeground            ← fgDefault
StatusBar.Widget.pressedBackground          ← bgPress
StatusBar.Breadcrumbs.foreground            ← fgMuted
StatusBar.Breadcrumbs.hoverForeground       ← fgDefault
StatusBar.Breadcrumbs.hoverBackground       ← bgHover
StatusBar.Breadcrumbs.pressedBackground     ← bgPress
StatusBar.Breadcrumbs.selectionBackground   ← bgSelectionUi
StatusBar.Breadcrumbs.selectionInactiveBackground ← bgSelectionInactive

ToolBar.background                    ← bgSunken
ToolBar.foreground                    ← fgDefault
ToolBar.separatorColor                ← separator
ToolBar.borderHandleColor             ← borderDefault
Toolbar.Floating.background           ← bgRaised
Toolbar.Floating.borderColor          ← borderDefault

MainToolbar.background                ← bgSunken
MainToolbar.separatorColor            ← separator
MainToolbar.Button.size               ← 34            (integer)
MainToolbar.Button.iconSize           ← 20            (integer)

NavBar.borderColor                    ← borderDefault
NavBar.borderWidth                    ← 1             (integer)

TitlePane.background                  ← bgSunken
TitlePane.inactiveBackground          ← bgSunken
TitlePane.infoForeground              ← fgMuted
TitlePane.inactiveInfoForeground      ← fgDisabled
TitlePane.Button.hoverBackground      ← bgHover

MemoryIndicator.usedBackground        ← accentPrimaryMuted
MemoryIndicator.allocatedBackground   ← mix(fgDefault, bgSunken, 0.88)

RunWidget.foreground                  ← fgInverse
RunWidget.iconColor                   ← fgInverse
RunWidget.runIconColor                ← fgInverse
RunWidget.background                  ← semSuccess    [UNVERIFIED key name; RunWidget.runningBackground is verified]
RunWidget.runningBackground           ← semSuccess
RunWidget.runningIconColor            ← fgInverse
RunWidget.stopBackground              ← semError
RunWidget.hoverBackground             ← alpha(fgInverse, 0.12)
RunWidget.pressedBackground           ← alpha(fgInverse, 0.20)
RunToolbar.Run.activeBackground       ← mix(semSuccess, bgSunken, 0.75)
RunToolbar.Debug.activeBackground     ← mix(semInfo,    bgSunken, 0.75)
RunToolbar.Profile.activeBackground   ← mix(accentSecondary, bgSunken, 0.75)
```

### 4.13 Progress, links, counters, badges

```
ProgressBar.background                ← mix(fgDefault, bgBase, 0.86)
ProgressBar.foreground                ← accentPrimary
ProgressBar.progressColor             ← accentPrimary
ProgressBar.trackColor                ← mix(fgDefault, bgBase, 0.86)
ProgressBar.indeterminateStartColor   ← accentPrimaryMuted
ProgressBar.indeterminateEndColor     ← accentPrimary
ProgressBar.selectionBackground       ← fgDefault
ProgressBar.selectionForeground       ← fgInverse
ProgressBar.failedColor               ← semError
ProgressBar.failedEndColor            ← mix(semError, bgBase, 0.4)
ProgressBar.passedColor               ← semSuccess
ProgressBar.passedEndColor            ← mix(semSuccess, bgBase, 0.4)
ProgressBar.warningColor              ← semWarning
ProgressBar.warningEndColor           ← mix(semWarning, bgBase, 0.4)
ProgressIcon.color                    ← accentPrimary

Link.activeForeground                 ← accentPrimary
Link.hoverForeground                  ← accentPrimaryHover
Link.pressedForeground                ← accentPrimaryHover
Link.visitedForeground                ← accentPrimaryMuted
Link.secondaryForeground              ← fgSubtle
Link.focusedBorderColor               ← accentPrimary

Counter.background                    ← accentPrimary
Counter.foreground                    ← fgInverse
Tag.background                        ← mix(accentPrimary, bgBase, 0.80)
Tag.foreground                        ← accentPrimary
Abbreviation.background               ← mix(accentPrimary, bgBase, 0.80)
Abbreviation.foreground               ← accentPrimary
Abbreviation.borderColor              ← borderDefault

IconBadge.errorBackground             ← semError
IconBadge.warningBackground           ← semWarning
IconBadge.infoBackground              ← semInfo
IconBadge.successBackground           ← semSuccess

Badge.blueBackground                  ← semInfo
Badge.blueForeground                  ← fgInverse
Badge.greenBackground                 ← semSuccess
Badge.greenForeground                 ← fgInverse
Badge.greenOutlineBorderColor         ← semSuccess
Badge.greenOutlineForeground          ← semSuccess
Badge.disabledBackground              ← mix(fgDefault, bgBase, 0.82)
Badge.disabledForeground              ← fgDisabled
Badge.blueSecondaryBackground         ← mix(semInfo, bgBase, 0.80)
Badge.blueSecondaryForeground         ← semInfo
Badge.greenSecondaryBackground        ← mix(semSuccess, bgBase, 0.80)
Badge.greenSecondaryForeground        ← semSuccess
Badge.graySecondaryBackground         ← mix(fgDefault, bgBase, 0.86)
Badge.graySecondaryForeground         ← fgMuted
Badge.purpleSecondaryBackground       ← mix(synConstant, bgBase, 0.80)
Badge.purpleSecondaryForeground       ← synConstant
```

### 4.14 Notifications and banners

```
Notification.background               ← bgRaised
Notification.foreground               ← fgDefault
Notification.borderColor              ← borderDefault
Notification.linkForeground           ← accentPrimary
Notification.errorBackground          ← mix(semError, bgRaised, 0.86)
Notification.errorBorderColor         ← semError
Notification.errorForeground          ← fgDefault
Notification.iconHoverBackground      ← bgHover
Notification.arc                      ← 8             (integer)
Notification.MoreButton.background    ← bgSunken
Notification.MoreButton.foreground    ← fgMuted
Notification.MoreButton.innerBorderColor ← borderDefault
Notification.Button.background        ← bgRaised
Notification.Button.foreground        ← fgDefault
Notification.Button.borderColor       ← borderDefault
Notification.ToolWindow.errorBackground       ← mix(semError, bgBase, 0.88)
Notification.ToolWindow.errorBorderColor      ← semError
Notification.ToolWindow.errorForeground       ← fgDefault
Notification.ToolWindow.warningBackground     ← mix(semWarning, bgBase, 0.88)
Notification.ToolWindow.warningBorderColor    ← semWarning
Notification.ToolWindow.warningForeground     ← fgDefault
Notification.ToolWindow.informativeBackground ← mix(semInfo, bgBase, 0.88)
Notification.ToolWindow.informativeBorderColor← semInfo
Notification.ToolWindow.informativeForeground ← fgDefault
NotificationsToolwindow.newNotification.background      ← mix(accentPrimary, bgBase, 0.90)
NotificationsToolwindow.newNotification.hoverBackground ← bgHover
NotificationsToolwindow.Notification.hoverBackground    ← bgHover

Banner.infoBackground      ← mix(semInfo,    bgBase, 0.88)
Banner.infoBorderColor     ← semInfo
Banner.successBackground   ← mix(semSuccess, bgBase, 0.88)
Banner.successBorderColor  ← semSuccess
Banner.warningBackground   ← mix(semWarning, bgBase, 0.88)
Banner.warningBorderColor  ← semWarning
Banner.errorBackground     ← mix(semError,   bgBase, 0.88)
Banner.errorBorderColor    ← semError
Banner.aiBackground        ← mix(synConstant,bgBase, 0.88)
Banner.aiBorderColor       ← synConstant
```

### 4.15 Search and Search Everywhere

```
SearchEverywhere.SearchField.background      ← bgRaised
SearchEverywhere.SearchField.borderColor     ← borderDefault
SearchEverywhere.SearchField.infoForeground  ← fgSubtle
SearchEverywhere.Header.background           ← bgRaised
SearchEverywhere.Tab.selectedBackground      ← bgSelectionUi
SearchEverywhere.Tab.selectedForeground      ← fgSelection
SearchEverywhere.List.separatorColor         ← separator
SearchEverywhere.List.separatorForeground    ← fgSubtle
SearchEverywhere.List.settingsBackground     ← bgSunken
SearchEverywhere.Advertiser.background       ← bgSunken
SearchEverywhere.Advertiser.foreground       ← fgSubtle

SearchMatch.startBackground           ← mix(accentSecondary, bgBase, 0.55)
SearchMatch.endBackground             ← mix(accentSecondary, bgBase, 0.55)
SearchOption.selectedBackground       ← bgSelectionUi
SearchOption.selectedHoveredBackground← bgHover
SearchOption.selectedPressedBackground← bgPress
NewClass.SearchField.background       ← bgRaised
Plugins.SearchField.background        ← bgRaised
Editor.SearchField.background         ← bgRaised
Editor.SearchField.borderColor        ← borderDefault
Editor.Toolbar.borderColor            ← borderDefault
```

`SearchMatch.startBackground` and `endBackground` form a horizontal gradient. Set them equal for a flat highlight, or offset ΔL 0.03 for the JetBrains look.

---

## 5. VCS, debugger, editor chrome (emit for a complete theme)

### 5.1 Version control

```
VersionControl.Log.Commit.currentBranchBackground     ← mix(accentPrimary, bgBase, 0.90)
VersionControl.Log.Commit.hoveredBackground           ← bgHover
VersionControl.Log.Commit.selectionBackground         ← bgSelectionUi
VersionControl.Log.Commit.selectionForeground         ← fgSelection
VersionControl.Log.Commit.selectionInactiveBackground ← bgSelectionInactive
VersionControl.Log.Commit.selectionInactiveForeground ← fgSelection
VersionControl.Log.Commit.unmatchedForeground         ← fgDisabled
VersionControl.Log.Commit.Reference.foreground        ← fgSubtle
VersionControl.Log.Commit.rowHeight                   ← 24     (integer)
VersionControl.Log.Graph.saturation                   ← 0.6    (float)
VersionControl.Log.Graph.brightness                   ← 0.8    (float)
VersionControl.GitLog.headIconColor                   ← accentSecondary
VersionControl.GitLog.localBranchIconColor            ← semSuccess
VersionControl.GitLog.remoteBranchIconColor           ← semInfo
VersionControl.GitLog.tagIconColor                    ← accentSecondary
VersionControl.GitLog.otherIconColor                  ← fgSubtle
VersionControl.RefLabel.foreground                    ← fgDefault
VersionControl.RefLabel.backgroundBase                ← bgRaised
VersionControl.RefLabel.backgroundBrightness          ← 0.6    (float)
VersionControl.FileHistory.Commit.selectedBranchBackground ← mix(accentPrimary, bgBase, 0.90)
VersionControl.MarkerPopup.borderColor                ← borderDefault
VersionControl.MarkerPopup.Toolbar.background         ← bgRaised
VersionControl.Merge.Status.NoConflicts.foreground    ← semSuccess
CombinedDiff.BlockBorder.selectedActiveColor          ← accentPrimary
CombinedDiff.BlockBorder.selectedInactiveColor        ← borderDefault
```

`VersionControl.Log.Graph.saturation` / `brightness` are floats that drive the generated branch-line colours in the Git log. Lower saturation for muted themes.

### 5.2 Debugger

```
Debugger.Variables.valueForeground              ← fgDefault
Debugger.Variables.typeForeground               ← synType
Debugger.Variables.changedValueForeground       ← accentSecondary
Debugger.Variables.modifyingValueForeground     ← accentSecondary
Debugger.Variables.collectingDataForeground     ← fgSubtle
Debugger.Variables.evaluatingExpressionForeground ← fgSubtle
Debugger.Variables.exceptionForeground          ← semError
Debugger.Variables.errorMessageForeground       ← semError
Debugger.EvaluateExpression.background          ← bgEditor
Breakpoint.iconHoverAlpha                       ← 0.7    (float)
```

### 5.3 Editor chrome keys that live in `.theme.json` (not the XML)

A handful of editor-adjacent surfaces are LaF keys, not scheme keys. Easy to miss.

```
Editor.background                     ← bgEditor
Editor.foreground                     ← fgDefault
Editor.shortcutForeground             ← accentPrimary
Editor.Toolbar.borderColor            ← borderDefault
Editor.ToolTip.background             ← bgRaised
Editor.ToolTip.errorBackground        ← mix(semError,   bgRaised, 0.86)
Editor.ToolTip.errorBorder            ← semError
Editor.ToolTip.warningBackground      ← mix(semWarning, bgRaised, 0.86)
Editor.ToolTip.warningBorder          ← semWarning
Editor.ToolTip.successBackground      ← mix(semSuccess, bgRaised, 0.86)
Editor.ToolTip.successBorder          ← semSuccess
Editor.ToolTip.selectionBackground    ← bgSelectionUi
Editor.ToolTip.iconHoverBackground    ← bgHover
```

### 5.4 Welcome screen

```
WelcomeScreen.background                        ← bgBase
WelcomeScreen.borderColor                       ← borderDefault
WelcomeScreen.separatorColor                    ← separator
WelcomeScreen.captionBackground                 ← bgSunken
WelcomeScreen.captionForeground                 ← fgDefault
WelcomeScreen.headerBackground                  ← bgSunken
WelcomeScreen.headerForeground                  ← fgDefault
WelcomeScreen.footerBackground                  ← bgSunken
WelcomeScreen.footerForeground                  ← fgMuted
WelcomeScreen.groupIconBorderColor              ← borderDefault
WelcomeScreen.Details.background                ← bgBase
WelcomeScreen.SidePanel.background              ← bgSunken
WelcomeScreen.Banner.background                 ← bgSunken
WelcomeScreen.Projects.background               ← bgBase
WelcomeScreen.Projects.selectionBackground      ← bgSelectionUi
WelcomeScreen.Projects.selectionInactiveBackground ← bgSelectionInactive
WelcomeScreen.Projects.actions.background       ← bgBase
WelcomeScreen.Projects.actions.selectionBackground  ← bgSelectionUi
WelcomeScreen.Projects.actions.selectionBorderColor ← accentPrimary
WelcomeScreen.LearnTab.CourseCard.hover         ← bgHover
```

### 5.5 Plugins page

```
Plugins.background                    ← bgBase
Plugins.borderColor                   ← borderDefault
Plugins.hoverBackground               ← bgHover
Plugins.lightSelectionBackground      ← mix(accentPrimary, bgBase, 0.88)
Plugins.disabledForeground            ← fgDisabled
Plugins.SectionHeader.background      ← bgSunken
Plugins.SectionHeader.foreground      ← fgMuted
Plugins.Tab.hoverBackground           ← bgHover
Plugins.Tab.selectedBackground        ← bgSelectionUi
Plugins.Tab.selectedForeground        ← fgSelection
Plugins.tagBackground                 ← mix(fgDefault, bgBase, 0.86)
Plugins.tagForeground                 ← fgMuted
Plugins.eapTagBackground              ← mix(semWarning, bgBase, 0.80)
Plugins.paidTagBackground             ← mix(semSuccess, bgBase, 0.80)
Plugins.trialTagBackground            ← mix(semInfo,    bgBase, 0.80)
Plugins.suggestedLabelBackground      ← mix(accentPrimary, bgBase, 0.80)
Plugins.Button.installBackground      ← bgRaised
Plugins.Button.installBorderColor     ← semSuccess
Plugins.Button.installForeground      ← semSuccess
Plugins.Button.installFillBackground  ← semSuccess
Plugins.Button.installFillForeground  ← fgInverse
Plugins.Button.installFocusedBackground ← mix(semSuccess, bgRaised, 0.75)
Plugins.Button.updateBackground       ← accentPrimary
Plugins.Button.updateBorderColor      ← accentPrimary
Plugins.Button.updateForeground       ← fgInverse
```

---

## 6. Optional polish

### 6.1 Got-it tooltips / onboarding

```
GotItTooltip.background               ← bgRaised
GotItTooltip.foreground               ← fgDefault
GotItTooltip.borderColor              ← borderDefault
GotItTooltip.linkForeground           ← accentPrimary
GotItTooltip.shortcutForeground       ← fgSubtle
GotItTooltip.shortcutBackground       ← bgSunken
GotItTooltip.codeForeground           ← synString
GotItTooltip.codeBackground           ← bgSunken
GotItTooltip.codeBorderColor          ← borderDefault
GotItTooltip.Header.foreground        ← fgDefault
GotItTooltip.stepForeground           ← fgSubtle
GotItTooltip.secondaryActionForeground← fgMuted
GotItTooltip.iconFillColor            ← accentPrimary
GotItTooltip.iconBorderColor          ← accentPrimary
GotItTooltip.imageBorderColor         ← borderDefault
GotItTooltip.animationBackground      ← bgSunken
GotItTooltip.Button.foreground        ← fgInverse
GotItTooltip.Button.startBackground   ← accentPrimary
GotItTooltip.Button.endBackground     ← accentPrimary
GotItTooltip.Button.startBorderColor  ← accentPrimary
GotItTooltip.Button.endBorderColor    ← accentPrimary
GotItTooltip.Button.contrastBackground← bgRaised
GotItTooltip.arc                      ← 8   (integer)
```

### 6.2 Inline code chips and shortcut chips

```
Code.Inline.backgroundColor           ← bgSunken
Code.Inline.foregroundColor           ← synString
Code.Inline.borderColor               ← borderDefault
Code.Inline.borderRadius              ← 4   (integer)
Code.Block.backgroundColor            ← bgSunken
Code.Block.foregroundColor            ← fgDefault
Code.Block.borderColor                ← borderDefault
Code.Block.borderRadius               ← 6   (integer)
Code.Block.EditorPane.backgroundColor ← bgEditor
Code.Block.EditorPane.borderColor     ← borderDefault
Shortcut.background                   ← bgSunken
Shortcut.foreground                   ← fgMuted
Shortcut.borderColor                  ← borderDefault
Shortcut.borderRadius                 ← 4   (integer)
```

### 6.3 Bookmarks

```
Bookmark.iconBackground                     ← accentSecondary
Bookmark.Mnemonic.iconForeground            ← fgInverse
Bookmark.MnemonicAvailable.foreground       ← fgMuted
Bookmark.MnemonicAvailable.background       ← bgRaised
Bookmark.MnemonicAvailable.borderColor      ← borderDefault
Bookmark.MnemonicAssigned.foreground        ← fgInverse
Bookmark.MnemonicAssigned.background        ← accentSecondary
Bookmark.MnemonicCurrent.foreground         ← fgInverse
Bookmark.MnemonicCurrent.background         ← accentPrimary
```

### 6.4 Islands UI (2025.2+)

The "Islands" look renders tool windows as detached rounded panels. Only set these if targeting 2025.2+; harmless otherwise.

```
Island.borderColor                    ← borderDefault
Island.arc                            ← 12    (integer)
Island.borderWidth                    ← 1     (integer)
Island.inactiveAlpha                  ← 0.7   (float)
Islands.borderColor                   ← borderDefault
Islands.inactiveAlpha                 ← 0.7   (float)
```

A separate `.theme.json` registered with `targetUi="islands"` (§12.2) is how JetBrains' own Catppuccin port ships an Islands variant. `[UNVERIFIED: which build introduced targetUi.]`

### 6.5 Shadows

`Ide.Shadow.*` and `Notification.Shadow.*` each take the same 16 directional keys plus `borderInsets`:

```
{bottom,top,left,right,bottomLeft,bottomRight,topLeft,topRight}{0,1}Color
```

Emit all 16 per namespace with a two-stop ramp:

```
…0Color  ← alpha(shadowBase, isDark ? 0.42 : 0.12)
…1Color  ← alpha(shadowBase, isDark ? 0.16 : 0.05)
```

where `shadowBase = oklch(0.05, 0.01, H(C3))`. Corner keys (`topLeft`, `bottomRight`, …) get the `0Color` value at 0.6× alpha.

### 6.6 Namespaces that do NOT exist

Do not emit these — they appear in blog posts and old themes but are absent from both metadata files: `Canvas.*`, `DialogWrapper.*`, `GroupHeaderSeparator.*`, `Git.*`, `NewPSD.*`, `Outline.*`, `SearchResults.*`, `Notification.Error.*`. Error styling for notifications is `Notification.error*` and `Notification.ToolWindow.error*`.

Also avoid the deprecated legacy Swing globals (`control`, `controlText`, `info`, `infoText`, `menu`, `menuText`, `text`, `textHighlight`, `activeCaption`, and the whole `darcula.*` family). They still resolve but are dead ends.

---

## 7. Icons

Icons are SVG files shipped with the platform. Themes recolour them by patching hex values at load time. There are three independent mechanisms.

### 7.1 Path replacement

```jsonc
"icons": {
  "/actions/compile.svg": "/icons/myCompile.svg",
  "/actions/execute.svg": "/icons/myRun.svg"
}
```

- Key = the platform icon's resource path, derived from its `AllIcons.Group.IconName` reference → `/group/iconName.svg`. Find it with the UI Inspector (§13.3).
- Value = a path into **your** plugin's resources.
- `_dark` suffixed paths are separate entries: `/welcome/project/remove_dark.svg` must be mapped independently from `/welcome/project/remove.svg`.
- A replaced icon is served verbatim — `ColorPalette` does **not** recolour it.

A generated theme should normally emit **nothing** here. Shipping custom SVGs is a hand-design job.

### 7.2 `ColorPalette` — semantic keys

This is the mechanism to use. The platform holds a map of palette-key → default hex; you override the key, and every icon drawn with that default hex is repainted.

The complete map, verbatim from `UITheme.java` (47 entries):

| Key | Default | `.Dark` variant | Default |
|---|---|---|---|
| `Actions.Red` | `#DB5860` | `Actions.Red.Dark` | `#C75450` |
| `Actions.Yellow` | `#EDA200` | `Actions.Yellow.Dark` | `#F0A732` |
| `Actions.Green` | `#59A869` | `Actions.Green.Dark` | `#499C54` |
| `Actions.Blue` | `#389FD6` | `Actions.Blue.Dark` | `#3592C4` |
| `Actions.Grey` | `#6E6E6E` | `Actions.Grey.Dark` | `#AFB1B3` |
| `Actions.GreyInline` | `#7F8B91` | `Actions.GreyInline.Dark` | `#7F8B91` |
| `Objects.Grey` | `#9AA7B0` | — | |
| `Objects.Blue` | `#40B6E0` | — | |
| `Objects.Green` | `#62B543` | — | |
| `Objects.Yellow` | `#F4AF3D` | — | |
| `Objects.YellowDark` | `#D9A343` | — | |
| `Objects.Purple` | `#B99BF8` | — | |
| `Objects.Pink` | `#F98B9E` | — | |
| `Objects.Red` | `#F26522` | — | |
| `Objects.RedStatus` | `#E05555` | — | |
| `Objects.GreenAndroid` | `#3DDC84` | — | |
| `Objects.BlackText` | `#231F20` | — | |
| `Checkbox.Background.Default` | `#FFFFFF` | `.Dark` | `#43494A` |
| `Checkbox.Background.Disabled` | `#F2F2F2` | `.Dark` | `#3C3F41` |
| `Checkbox.Background.Selected` | `#4F9EE3` | `.Dark` | `#43494A` |
| `Checkbox.Border.Default` | `#b0b0b0` | `.Dark` | `#6B6B6B` |
| `Checkbox.Border.Disabled` | `#BDBDBD` | `.Dark` | `#545556` |
| `Checkbox.Border.Selected` | `#4B97D9` | `.Dark` | `#6B6B6B` |
| `Checkbox.Foreground.Disabled` | `#ABABAB` | `.Dark` | `#606060` |
| `Checkbox.Foreground.Selected` | `#FEFEFE` | `.Dark` | `#A7A7A7` |
| `Checkbox.Focus.Thin.Default` | `#7B9FC7` | `.Dark` | `#466D94` |
| `Checkbox.Focus.Thin.Selected` | `#ACCFF7` | `.Dark` | `#466D94` |
| `Checkbox.Focus.Wide` | `#97C3F3` | `.Dark` | `#3D6185` |
| `Tree.iconColor` | `#808080` | `.Dark` | `#AFB1B3` |

**The `.Dark` asymmetry is the most common mistake.** `Actions.*`, `Checkbox.*` and `Tree.iconColor` each have a `.Dark` twin. **No `Objects.*` key does** — `Objects.YellowDark` is a *distinct darker yellow used inside icons*, not the dark-theme variant of `Objects.Yellow`.

Resolution logic:

```java
if (darkTheme && colorPalette.get(key + ".Dark") != null) key += ".Dark";
```

So in a theme with `"dark": true`, write the `.Dark` keys for `Actions.*`, `Checkbox.*` and `Tree.iconColor`, and the unsuffixed keys for `Objects.*`. The robust belt-and-braces approach, which Dracula uses, is to write both spellings with the same value for every `Actions.*` key.

### 7.3 `ColorPalette` — raw hex substitution

An entry whose **key parses as a hex colour** is a global substitution instead:

```jsonc
"ColorPalette": { "#59A869": "#00C5C0FF" }
```

This replaces that literal hex anywhere it appears in any patched SVG, including third-party plugin icons that never used the semantic palette. Broader and blunter. Values accept 8-digit hex with alpha.

Use it sparingly — one or two entries to catch a plugin whose icons clash. Named keys take precedence for the colours they own.

### 7.4 What a generator should emit

```jsonc
"icons": {
  "ColorPalette": {
    "Actions.Red":               "semError",
    "Actions.Red.Dark":          "semError",
    "Actions.Yellow":            "semWarning",
    "Actions.Yellow.Dark":       "semWarning",
    "Actions.Green":             "semSuccess",
    "Actions.Green.Dark":        "semSuccess",
    "Actions.Blue":              "accentPrimary",
    "Actions.Blue.Dark":         "accentPrimary",
    "Actions.Grey":              "fgSubtle",
    "Actions.Grey.Dark":         "fgSubtle",
    "Actions.GreyInline":        "fgSubtle",
    "Actions.GreyInline.Dark":   "fgSubtle",

    "Objects.Grey":              "fgSubtle",
    "Objects.Blue":              "accentPrimary",
    "Objects.Green":             "semSuccess",
    "Objects.GreenAndroid":      "semSuccess",
    "Objects.Yellow":            "accentSecondary",
    "Objects.YellowDark":        "<accentSecondary darkened by ΔL 0.06>",
    "Objects.Purple":            "synConstant",
    "Objects.Pink":              "<synConstant hue +25°>",
    "Objects.Red":               "semError",
    "Objects.RedStatus":         "semError",
    "Objects.BlackText":         "bgEditor",

    "Checkbox.Background.Default.Dark":   "bgRaised",
    "Checkbox.Background.Disabled.Dark":  "bgBase",
    "Checkbox.Background.Selected.Dark":  "accentPrimary",
    "Checkbox.Border.Default.Dark":       "borderStrong",
    "Checkbox.Border.Disabled.Dark":      "borderDefault",
    "Checkbox.Border.Selected.Dark":      "accentPrimary",
    "Checkbox.Foreground.Selected.Dark":  "fgInverse",
    "Checkbox.Foreground.Disabled.Dark":  "fgDisabled",
    "Checkbox.Focus.Wide.Dark":           "<alpha(accentPrimary, 0.45)>",
    "Checkbox.Focus.Thin.Default.Dark":   "accentPrimary",
    "Checkbox.Focus.Thin.Selected.Dark":  "accentPrimary",

    "Tree.iconColor.Dark":       "fgMuted"
  }
}
```

For a **light** theme, drop every `.Dark` suffix from the `Actions.*`, `Checkbox.*` and `Tree.iconColor` entries; leave `Objects.*` unchanged.

**Important:** `ColorPalette` values are resolved through the theme's `colors` block just like `ui` values, so token names work here too. If your generator is unsure, emit literal hex here — it always works.

`Objects.BlackText` is the text baked into some object icons (e.g. the letter in a file-type badge). Set it to the editor background so it reads on a light icon body; setting it to your foreground makes those icons illegible.

### 7.5 `iconColorsOnSelection`

A hex → hex map applied only to icons drawn on a selected tree/list row. Worth emitting when `bgSelectionUi` is strongly tinted, otherwise icons "disappear" into the selection.

```jsonc
"iconColorsOnSelection": {
  "<Actions.Grey value>":  "<fgSelection>",
  "<Objects.Grey value>":  "<fgSelection>"
}
```

Keys are literal hex (the *output* colours from your `ColorPalette`, not the platform defaults). Keep it to 4–8 entries.

---

## 8. The editor colour scheme XML

This is a separate file from `.theme.json`, referenced by the `editorScheme` key. It has **no token indirection** — every value is a literal hex.

### 8.1 Skeleton

```xml
<?xml version="1.0" encoding="UTF-8"?>
<scheme name="Acme Dark" version="142" parent_scheme="Darcula">
  <metaInfo>
    <property name="created">2026-09-19T10:00:00</property>
    <property name="ide">PhpStorm</property>
    <property name="originalScheme">Acme Dark</property>
  </metaInfo>

  <option name="LINE_SPACING" value="1.2" />
  <option name="EDITOR_FONT_SIZE" value="14" />
  <option name="EDITOR_FONT_NAME" value="JetBrains Mono" />
  <option name="EDITOR_LIGATURES" value="true" />
  <option name="CONSOLE_FONT_NAME" value="JetBrains Mono" />
  <option name="CONSOLE_FONT_SIZE" value="13" />
  <option name="CONSOLE_LINE_SPACING" value="1.2" />

  <colors>
    <option name="CARET_COLOR" value="4c8df6" />
    …
  </colors>

  <attributes>
    <option name="DEFAULT_KEYWORD">
      <value>
        <option name="FOREGROUND" value="4c8df6" />
        <option name="FONT_TYPE" value="1" />
      </value>
    </option>
    <option name="PHP_VAR" baseAttributes="DEFAULT_LOCAL_VARIABLE" />
    …
  </attributes>
</scheme>
```

`<scheme>` attributes:

| Attribute | Value |
|---|---|
| `name` | Display name in Settings → Editor → Color Scheme. Make it match the theme name. |
| `version` | `"142"` — what modern IDEs write. Use this. |
| `parent_scheme` | `"Darcula"` for dark, `"Default"` for light. Everything you don't specify is inherited from it. |

**A generator should always set `parent_scheme`.** It's the difference between a theme that mostly works and one where every unlisted language is unstyled.

Omit the font options unless the caller asked for a specific font — they override the user's own font choice, which is rude.

### 8.2 Value syntax

- Colour values are `RRGGBB` or `RRGGBBAA`, **no leading `#`**.
- Leading zeros may be dropped: `value="0"` is black, `value="80"` is `000080`. Always emit the full 6 or 8 digits.
- `value=""` or an omitted `value` attribute clears an inherited colour.
- Optional colour-blind variants may sit alongside: `<option name="ADDED_LINES_COLOR" value="c9dec1" deuteranopia="99ca90" protanopia="99ca90"/>`. A generator can skip these.

### 8.3 `<attributes>` entry forms

**Explicit:**

```xml
<option name="DEFAULT_STRING">
  <value>
    <option name="FOREGROUND" value="5cc98a" />
    <option name="BACKGROUND" value="1b1d23" />
    <option name="FONT_TYPE" value="0" />
    <option name="EFFECT_COLOR" value="e5533c" />
    <option name="EFFECT_TYPE" value="2" />
    <option name="ERROR_STRIPE_COLOR" value="e5533c" />
  </value>
</option>
```

Those six are the **only** inner option names. Omit any you don't set.

**Inherited:**

```xml
<option name="PHP_VAR" baseAttributes="DEFAULT_LOCAL_VARIABLE" />
```

Self-closing, no `<value>`. This is the preferred form for language-specific keys — it keeps the file small and keeps languages consistent.

**Cleared:**

```xml
<option name="PHP_SCRIPTING_BACKGROUND"><value /></option>
```

Empty `<value/>` resets everything for that key. Necessary for `PHP_SCRIPTING_BACKGROUND` — otherwise the inherited Darcula value paints a grey band behind every block of PHP inside an HTML file.

**Partial clear:** an inner option with no `value` attribute clears just that facet:

```xml
<option name="ERRORS_ATTRIBUTES">
  <value>
    <option name="BACKGROUND" />
    <option name="EFFECT_COLOR" value="e5533c" />
    <option name="EFFECT_TYPE" value="2" />
    <option name="ERROR_STRIPE_COLOR" value="e5533c" />
  </value>
</option>
```

**`FONT_TYPE`** — `java.awt.Font` bitmask:

| Value | Meaning |
|---|---|
| `0` | plain |
| `1` | bold |
| `2` | italic |
| `3` | bold italic |

**`EFFECT_TYPE`**:

| Value | Effect |
|---|---|
| `-1` | none |
| `0` | boxed |
| `1` | underline |
| `2` | wavy underline |
| `3` | strikethrough |
| `4` | bold underline |
| `5` | bold dotted underline |

Values above 5 are not serialisable — do not emit them.

### 8.4 `<colors>` — editor chrome (complete)

```
TEXT                              → handled in <attributes>, not here
CARET_COLOR                       ← caret
CARET_ROW_COLOR                   ← mix(fgDefault, bgEditor, 0.955)
SELECTION_BACKGROUND              ← bgSelection
SELECTION_FOREGROUND              ← (omit — let syntax colours show through)
SELECTION_BACKGROUND_INACTIVE     ← bgSelectionInactive
GUTTER_BACKGROUND                 ← bgEditor
LINE_NUMBERS_COLOR                ← fgDisabled
LINE_NUMBER_ON_CARET_ROW_COLOR    ← fgMuted
ANNOTATIONS_COLOR                 ← fgSubtle
INDENT_GUIDE                      ← guideIndent
SELECTED_INDENT_GUIDE             ← guideIndentOn
VISUAL_INDENT_GUIDE               ← guideIndent
STRING_CONTENT_INDENT_GUIDE       ← guideIndent
WHITESPACES                       ← mix(fgDefault, bgEditor, 0.80)
RIGHT_MARGIN_COLOR                ← mix(fgDefault, bgEditor, 0.90)
SOFT_WRAP_SIGN_COLOR              ← fgSubtle
TEARLINE_COLOR                    ← separator
SELECTED_TEARLINE_COLOR           ← accentPrimary
METHOD_SEPARATORS_COLOR           ← separator
SEPARATOR_ABOVE_COLOR             ← separator
SEPARATOR_BELOW_COLOR             ← separator
READONLY_FRAGMENT_BACKGROUND      ← mix(fgDefault, bgEditor, 0.96)
FOLDED_TEXT_BORDER_COLOR          ← borderDefault
DOC_COMMENT_GUIDE                 ← guideIndent
DOC_COMMENT_LINK                  ← accentPrimary
RECENT_LOCATIONS_SELECTION        ← bgSelectionUi
GRID_STRIPE_COLOR                 ← mix(fgDefault, bgEditor, 0.965)

DOCUMENTATION_COLOR               ← bgRaised
LOOKUP_COLOR                      ← bgRaised
NOTIFICATION_BACKGROUND           ← bgRaised
ERROR_HINT                        ← mix(semError,   bgRaised, 0.86)
INFORMATION_HINT                  ← bgRaised
QUESTION_HINT                     ← mix(semInfo,    bgRaised, 0.86)
MODIFIED_TAB_ICON                 ← accentSecondary
INLINE_REFACTORING_SETTINGS_DEFAULT  ← alpha(fgDefault, 0.10)
INLINE_REFACTORING_SETTINGS_FOCUSED  ← alpha(accentPrimary, 0.25)
INLINE_REFACTORING_SETTINGS_HOVERED  ← alpha(fgDefault, 0.16)

CONSOLE_BACKGROUND_KEY            ← bgEditor

HTML_TAG_TREE_LEVEL0 … LEVEL5     ← alpha(accentPrimary, 0.05·(n+1))

VCS_ANNOTATIONS_COLOR_1 … _5      ← five steps of mix(accentPrimary, bgEditor, 0.95 → 0.75)
```

Scrollbar keys (same names, same values as §4.11) also belong here:

```
ScrollBar.thumbColor, ScrollBar.thumbBorderColor, ScrollBar.hoverThumbColor,
ScrollBar.hoverThumbBorderColor, ScrollBar.trackColor, ScrollBar.hoverTrackColor
  — and the .Transparent., .Mac., .Mac.Transparent. families
Scrollbar.Tabs.ThumbColor, Scrollbar.Tabs.HoveredThumbColor, Scrollbar.Tabs.TransparentThumbColor
```

### 8.5 `<colors>` — VCS gutter and file statuses

Changed-line markers in the gutter:

```
ADDED_LINES_COLOR                      ← mix(semSuccess, bgEditor, 0.60)
MODIFIED_LINES_COLOR                   ← mix(semModify,  bgEditor, 0.60)
DELETED_LINES_COLOR                    ← mix(semError,   bgEditor, 0.60)
WHITESPACES_MODIFIED_LINES_COLOR       ← mix(semModify,  bgEditor, 0.40)
IGNORED_ADDED_LINES_BORDER_COLOR       ← mix(semSuccess, bgEditor, 0.75)
IGNORED_MODIFIED_LINES_BORDER_COLOR    ← mix(semModify,  bgEditor, 0.75)
IGNORED_DELETED_LINES_BORDER_COLOR     ← mix(semError,   bgEditor, 0.75)
DIFF_SEPARATORS_BACKGROUND             ← separator
DIFF_SEPARATOR_WAVE                    ← semWarning
```

File status colours (Project view, tabs, commit dialog):

```
FILESTATUS_ADDED                       ← semSuccess
FILESTATUS_COPIED                      ← semSuccess
FILESTATUS_MODIFIED                    ← semModify
FILESTATUS_RENAMED                     ← semModify
FILESTATUS_DELETED                     ← fgDisabled
FILESTATUS_MERGED                      ← synConstant
FILESTATUS_UNKNOWN                     ← semWarning
FILESTATUS_NOT_CHANGED                 ← fgDefault
FILESTATUS_NOT_CHANGED_IMMEDIATE       ← fgDefault
FILESTATUS_NOT_CHANGED_RECURSIVE       ← fgDefault
FILESTATUS_HIJACKED                    ← semWarning
FILESTATUS_OBSOLETE                    ← fgDisabled
FILESTATUS_SWITCHED                    ← synConstant
FILESTATUS_SUPPRESSED                  ← fgDisabled
FILESTATUS_addedOutside                ← semSuccess
FILESTATUS_modifiedOutside             ← semModify
FILESTATUS_changelistConflict          ← semError
FILESTATUS_IDEA_FILESTATUS_IGNORED                      ← fgDisabled
FILESTATUS_IDEA_FILESTATUS_DELETED_FROM_FILE_SYSTEM     ← fgDisabled
FILESTATUS_IDEA_FILESTATUS_MERGED_WITH_CONFLICTS        ← semError
FILESTATUS_IDEA_FILESTATUS_MERGED_WITH_BOTH_CONFLICTS   ← semError
FILESTATUS_IDEA_FILESTATUS_MERGED_WITH_PROPERTY_CONFLICTS ← semError
FILESTATUS_IGNORE.PROJECT_VIEW.IGNORED                  ← fgDisabled
```

`FILESTATUS_ERRORS` is **not** a `<colors>` key — it lives in `<attributes>`.

### 8.6 Diff attributes

```xml
<option name="DIFF_INSERTED"><value>
  <option name="BACKGROUND" value="<mix(semSuccess, bgEditor, 0.82)>" />
  <option name="ERROR_STRIPE_COLOR" value="<semSuccess>" />
</value></option>
<option name="DIFF_MODIFIED"><value>
  <option name="BACKGROUND" value="<mix(semModify, bgEditor, 0.82)>" />
  <option name="ERROR_STRIPE_COLOR" value="<semModify>" />
</value></option>
<option name="DIFF_DELETED"><value>
  <option name="BACKGROUND" value="<mix(semError, bgEditor, 0.88)>" />
  <option name="ERROR_STRIPE_COLOR" value="<semError>" />
</value></option>
<option name="DIFF_CONFLICT"><value>
  <option name="BACKGROUND" value="<mix(semWarning, bgEditor, 0.82)>" />
  <option name="ERROR_STRIPE_COLOR" value="<semWarning>" />
</value></option>
<option name="DIFF_ABSENT"><value>
  <option name="BACKGROUND" value="<mix(fgDefault, bgEditor, 0.94)>" />
</value></option>
```

Also `DIFF_UNKNOWN`, `DIFF_DELETED_FROM_FS`.

Diff backgrounds must stay light enough that syntax colouring survives on top — keep contrast against `bg.editor` below ~1.6:1.

---

## 9. Console and terminal

### 9.1 Console streams (`<attributes>`)

```
CONSOLE_NORMAL_OUTPUT       FOREGROUND ← fgDefault
CONSOLE_ERROR_OUTPUT        FOREGROUND ← semError
CONSOLE_SYSTEM_OUTPUT       FOREGROUND ← semInfo
CONSOLE_USER_INPUT          FOREGROUND ← semSuccess, FONT_TYPE 2
CONSOLE_RANGE_TO_EXECUTE    BACKGROUND ← mix(accentPrimary, bgEditor, 0.88)
CONSOLE_SELECTED_PARAMETER  BACKGROUND ← bgSelection
```

Plus `CONSOLE_BACKGROUND_KEY` in `<colors>` (§8.4).

### 9.2 Console ANSI 16 (`<attributes>`)

The classic console **and the classic terminal** both render through these keys. There is no separate `TERMINAL_ANSI_*` family — keys of that name do not exist.

Set **both** `FOREGROUND` and `BACKGROUND` to the same hex on each key; that is what real themes do, and it makes ANSI background codes (`\033[41m`) work.

| Key | Token | ANSI index |
|---|---|---|
| `CONSOLE_BLACK_OUTPUT` | `ansi.black` | 0 |
| `CONSOLE_RED_OUTPUT` | `ansi.red` | 1 |
| `CONSOLE_GREEN_OUTPUT` | `ansi.green` | 2 |
| `CONSOLE_YELLOW_OUTPUT` | `ansi.yellow` | 3 |
| `CONSOLE_BLUE_OUTPUT` | `ansi.blue` | 4 |
| `CONSOLE_MAGENTA_OUTPUT` | `ansi.magenta` | 5 |
| `CONSOLE_CYAN_OUTPUT` | `ansi.cyan` | 6 |
| `CONSOLE_GRAY_OUTPUT` | `ansi.white` | 7 (light grey / "white") |
| `CONSOLE_DARKGRAY_OUTPUT` | `ansi.brightBlack` | 8 (bright black) |
| `CONSOLE_RED_BRIGHT_OUTPUT` | `ansi.brightRed` | 9 |
| `CONSOLE_GREEN_BRIGHT_OUTPUT` | `ansi.brightGreen` | 10 |
| `CONSOLE_YELLOW_BRIGHT_OUTPUT` | `ansi.brightYellow` | 11 |
| `CONSOLE_BLUE_BRIGHT_OUTPUT` | `ansi.brightBlue` | 12 |
| `CONSOLE_MAGENTA_BRIGHT_OUTPUT` | `ansi.brightMagenta` | 13 |
| `CONSOLE_CYAN_BRIGHT_OUTPUT` | `ansi.brightCyan` | 14 |
| `CONSOLE_WHITE_OUTPUT` | `ansi.brightWhite` | 15 (bright white) |

**There is no `CONSOLE_BLACK_BRIGHT_OUTPUT` and no `CONSOLE_WHITE_BRIGHT_OUTPUT`.** The naming is irregular: index 7 is `GRAY`, index 8 is `DARKGRAY`, index 15 is `WHITE`. Map exactly as in the table above or PHPUnit and Artisan output will come out wrong.

Example:

```xml
<option name="CONSOLE_RED_OUTPUT">
  <value>
    <option name="FOREGROUND" value="e5533c" />
    <option name="BACKGROUND" value="e5533c" />
  </value>
</option>
```

### 9.3 New block terminal (2024.1+)

The reworked terminal has its own complete 16-key family, and unlike the console it **does** have black-bright and white-bright.

`<attributes>`:

```
BLOCK_TERMINAL_BLACK            ← ansi.black
BLOCK_TERMINAL_RED              ← ansi.red
BLOCK_TERMINAL_GREEN            ← ansi.green
BLOCK_TERMINAL_YELLOW           ← ansi.yellow
BLOCK_TERMINAL_BLUE             ← ansi.blue
BLOCK_TERMINAL_MAGENTA          ← ansi.magenta
BLOCK_TERMINAL_CYAN             ← ansi.cyan
BLOCK_TERMINAL_WHITE            ← ansi.white
BLOCK_TERMINAL_BLACK_BRIGHT     ← ansi.brightBlack
BLOCK_TERMINAL_RED_BRIGHT       ← ansi.brightRed
BLOCK_TERMINAL_GREEN_BRIGHT     ← ansi.brightGreen
BLOCK_TERMINAL_YELLOW_BRIGHT    ← ansi.brightYellow
BLOCK_TERMINAL_BLUE_BRIGHT      ← ansi.brightBlue
BLOCK_TERMINAL_MAGENTA_BRIGHT   ← ansi.brightMagenta
BLOCK_TERMINAL_CYAN_BRIGHT      ← ansi.brightCyan
BLOCK_TERMINAL_WHITE_BRIGHT     ← ansi.brightWhite
BLOCK_TERMINAL_COMMAND          ← FOREGROUND fgDefault, FONT_TYPE 1
BLOCK_TERMINAL_SEARCH_ENTRY     ← BACKGROUND mix(accentSecondary, bgEditor, 0.60)
BLOCK_TERMINAL_CURRENT_SEARCH_ENTRY ← BACKGROUND accentSecondary, FOREGROUND fgInverse
```

Again: set both `FOREGROUND` and `BACKGROUND` per key.

`<colors>`:

```
BLOCK_TERMINAL_DEFAULT_BACKGROUND              ← bgEditor
BLOCK_TERMINAL_DEFAULT_FOREGROUND              ← fgDefault
BLOCK_TERMINAL_BLOCK_BACKGROUND_START          ← bgBase
BLOCK_TERMINAL_BLOCK_BACKGROUND_END            ← bgBase
BLOCK_TERMINAL_HOVERED_BLOCK_BACKGROUND_START  ← bgHover
BLOCK_TERMINAL_HOVERED_BLOCK_BACKGROUND_END    ← bgHover
BLOCK_TERMINAL_SELECTED_BLOCK_BACKGROUND       ← bgRaised
BLOCK_TERMINAL_SELECTED_BLOCK_STROKE_COLOR     ← accentPrimary
BLOCK_TERMINAL_INACTIVE_SELECTED_BLOCK_BACKGROUND   ← bgBase
BLOCK_TERMINAL_INACTIVE_SELECTED_BLOCK_STROKE_COLOR ← borderDefault
BLOCK_TERMINAL_ERROR_BLOCK_STROKE_COLOR        ← semError
BLOCK_TERMINAL_PROMPT_SEPARATOR_COLOR          ← separator
BLOCK_TERMINAL_GENERATE_COMMAND_CARET_COLOR    ← caret
BLOCK_TERMINAL_GENERATE_COMMAND_PLACEHOLDER_FOREGROUND ← fgDisabled
```

### 9.4 Log levels

Used by the Run window's log filter and by Laravel/Monolog output viewers.

```
LOG_VERBOSE_OUTPUT   FOREGROUND ← fgDisabled
LOG_DEBUG_OUTPUT     FOREGROUND ← fgSubtle
LOG_INFO_OUTPUT      FOREGROUND ← fgDefault
LOG_WARNING_OUTPUT   FOREGROUND ← semWarning
LOG_ERROR_OUTPUT     FOREGROUND ← semError
LOG_EXPIRED_ENTRY    FOREGROUND ← fgDisabled
```

### 9.5 Hyperlinks in console output

Stack-trace file paths in PHPUnit / Artisan output are rendered with these:

```
HYPERLINK_ATTRIBUTES           FOREGROUND ← accentPrimary, EFFECT_TYPE 1, EFFECT_COLOR accentPrimary
FOLLOWED_HYPERLINK_ATTRIBUTES  FOREGROUND ← accentPrimaryMuted, EFFECT_TYPE 1
INACTIVE_HYPERLINK_ATTRIBUTES  FOREGROUND ← fgSubtle
CTRL_CLICKABLE                 FOREGROUND ← accentPrimary, EFFECT_TYPE 1
```

---

## 10. Syntax attributes

### 10.1 The inheritance model

IntelliJ languages resolve colours through a chain:

```
language key  →  DEFAULT_* key  →  parent_scheme's value
```

`DEFAULT_*` keys are the **Language Defaults** page in Settings. Almost every language — PHP included — inherits from them. This is why a theme can style 40 languages by setting ~35 keys.

**Strategy for a generator:** set every `DEFAULT_*` key explicitly, then set only the language keys that have no adequate default. Do not enumerate every language.

### 10.2 Base

```
TEXT                  FOREGROUND ← fgDefault,  BACKGROUND ← bgEditor
BAD_CHARACTER         FOREGROUND ← synInvalid, EFFECT_TYPE 2, EFFECT_COLOR semError
```

`TEXT`'s `BACKGROUND` is the editor background. It must match `Editor.background` in the `.theme.json` and `CONSOLE_BACKGROUND_KEY` in `<colors>`, or the editor and its gutter will disagree.

### 10.3 `DEFAULT_*` — complete

```
DEFAULT_IDENTIFIER                 ← fgDefault
DEFAULT_KEYWORD                    ← synKeyword            [FONT_TYPE 1 optional]
DEFAULT_NUMBER                     ← synNumber
DEFAULT_STRING                     ← synString
DEFAULT_VALID_STRING_ESCAPE        ← synConstant
DEFAULT_INVALID_STRING_ESCAPE      ← synInvalid, EFFECT_TYPE 2
DEFAULT_LINE_COMMENT               ← synComment            [FONT_TYPE 2 optional]
DEFAULT_BLOCK_COMMENT              ← synComment            [FONT_TYPE 2 optional]
DEFAULT_DOC_COMMENT                ← synComment            [FONT_TYPE 2]
DEFAULT_DOC_COMMENT_TAG            ← mix(synComment, synKeyword, 0.5), FONT_TYPE 2
DEFAULT_DOC_COMMENT_TAG_VALUE      ← mix(synComment, synType, 0.5),    FONT_TYPE 2
DEFAULT_DOC_MARKUP                 ← synComment
DEFAULT_OPERATION_SIGN             ← synOperator
DEFAULT_BRACES                     ← synPunct
DEFAULT_BRACKETS                   ← synPunct
DEFAULT_PARENTHS                   ← synPunct
DEFAULT_DOT                        ← synPunct
DEFAULT_SEMICOLON                  ← synPunct
DEFAULT_COMMA                      ← synPunct
DEFAULT_LABEL                      ← synConstant
DEFAULT_CONSTANT                   ← synConstant
DEFAULT_PREDEFINED_SYMBOL          ← synConstant
DEFAULT_METADATA                   ← synMetadata
DEFAULT_LOCAL_VARIABLE             ← synVariable
DEFAULT_REASSIGNED_LOCAL_VARIABLE  ← synVariable, EFFECT_TYPE 1, EFFECT_COLOR fgDisabled
DEFAULT_GLOBAL_VARIABLE            ← synVariable, FONT_TYPE 2
DEFAULT_PARAMETER                  ← synVariable
DEFAULT_REASSIGNED_PARAMETER       ← synVariable, EFFECT_TYPE 1, EFFECT_COLOR fgDisabled
DEFAULT_INSTANCE_FIELD             ← mix(synVariable, synType, 0.45)
DEFAULT_STATIC_FIELD               ← mix(synVariable, synType, 0.45), FONT_TYPE 2
DEFAULT_INSTANCE_METHOD            ← synFunction
DEFAULT_STATIC_METHOD              ← synFunction, FONT_TYPE 2
DEFAULT_FUNCTION_CALL              ← synFunction
DEFAULT_FUNCTION_DECLARATION       ← synFunction
DEFAULT_CLASS_NAME                 ← synType
DEFAULT_CLASS_REFERENCE            ← synType
DEFAULT_INTERFACE_NAME             ← synType, FONT_TYPE 2
DEFAULT_TAG                        ← synKeyword
DEFAULT_ATTRIBUTE                  ← synMetadata
DEFAULT_ENTITY                     ← synConstant
DEFAULT_HIGHLIGHTED_REFERENCE      ← fgDefault, EFFECT_TYPE 1, EFFECT_COLOR accentPrimary
DEFAULT_TEMPLATE_LANGUAGE_COLOR    ← BACKGROUND mix(accentPrimary, bgEditor, 0.965)
```

`DEFAULT_COMMA` and `DEFAULT_SEMICOLON` did not appear in the two base schemes I read; they are widely used but `[UNVERIFIED]`. Emitting them is harmless (unknown keys are ignored).

`DEFAULT_TEMPLATE_LANGUAGE_COLOR` is the tint behind template-language regions — Blade and Twig both use it. Keep it *very* subtle (contrast < 1.1:1) or `.blade.php` files become unreadable.

### 10.4 Inspections and severities

```
ERRORS_ATTRIBUTES          EFFECT_TYPE 2, EFFECT_COLOR semError,   ERROR_STRIPE_COLOR semError
WARNING_ATTRIBUTES         EFFECT_TYPE 2, EFFECT_COLOR semWarning, ERROR_STRIPE_COLOR semWarning
WEAK_WARNING_ATTRIBUTES    EFFECT_TYPE 2, EFFECT_COLOR mix(semWarning,bgEditor,0.35),
                           ERROR_STRIPE_COLOR mix(semWarning,bgEditor,0.35)
INFO_ATTRIBUTES            EFFECT_TYPE 2, EFFECT_COLOR semInfo
INFORMATION_ATTRIBUTES     (leave empty)
GENERIC_SERVER_ERROR_OR_WARNING  EFFECT_TYPE 2, EFFECT_COLOR semWarning
DUPLICATE_FROM_SERVER      BACKGROUND mix(fgDefault, bgEditor, 0.95)
RUNTIME_ERROR              EFFECT_TYPE 2, EFFECT_COLOR semError
WRONG_REFERENCES_ATTRIBUTES FOREGROUND semError
TYPO                       EFFECT_TYPE 2, EFFECT_COLOR mix(semSuccess, bgEditor, 0.3)
NOT_USED_ELEMENT_ATTRIBUTES FOREGROUND fgDisabled
DEPRECATED_ATTRIBUTES      EFFECT_TYPE 3   (strikethrough)
MARKED_FOR_REMOVAL_ATTRIBUTES EFFECT_TYPE 3, EFFECT_COLOR semError
FILESTATUS_ERRORS          FOREGROUND semError
SUGGESTION                 EFFECT_TYPE 1, EFFECT_COLOR accentPrimary
```

Use wavy underlines (`EFFECT_TYPE 2`) rather than backgrounds for severities. Background-based error highlighting fights with selection and with diff.

### 10.5 Identifiers, search, braces, folding

```
IDENTIFIER_UNDER_CARET_ATTRIBUTES        BACKGROUND mix(accentPrimary, bgEditor, 0.84)
WRITE_IDENTIFIER_UNDER_CARET_ATTRIBUTES  BACKGROUND mix(accentSecondary, bgEditor, 0.80)
TEXT_SEARCH_RESULT_ATTRIBUTES  BACKGROUND mix(accentSecondary, bgEditor, 0.62), FOREGROUND fgDefault
SEARCH_RESULT_ATTRIBUTES       BACKGROUND mix(accentSecondary, bgEditor, 0.62)
WRITE_SEARCH_RESULT_ATTRIBUTES BACKGROUND mix(accentSecondary, bgEditor, 0.52)
BLINKING_HIGHLIGHTS_ATTRIBUTES BACKGROUND accentPrimary, FOREGROUND fgInverse
MATCHED_BRACE_ATTRIBUTES       BACKGROUND mix(accentPrimary, bgEditor, 0.80), FONT_TYPE 1
UNMATCHED_BRACE_ATTRIBUTES     BACKGROUND mix(semError, bgEditor, 0.80)
MATCHED_TAG_NAME               BACKGROUND mix(accentPrimary, bgEditor, 0.85)
FOLDED_TEXT_ATTRIBUTES         FOREGROUND fgSubtle, BACKGROUND mix(fgDefault, bgEditor, 0.92)
DELETED_TEXT_ATTRIBUTES        FOREGROUND fgDisabled, EFFECT_TYPE 3
INJECTED_LANGUAGE_FRAGMENT     BACKGROUND mix(accentTertiary, bgEditor, 0.96)
TODO_DEFAULT_ATTRIBUTES        FOREGROUND semWarning, FONT_TYPE 1
LIVE_TEMPLATE_ATTRIBUTES       EFFECT_TYPE 0, EFFECT_COLOR accentPrimary
LIVE_TEMPLATE_INACTIVE_SEGMENT FOREGROUND fgSubtle
TEMPLATE_VARIABLE_ATTRIBUTES   FOREGROUND accentPrimary, FONT_TYPE 1
BOOKMARKS_ATTRIBUTES           ERROR_STRIPE_COLOR accentSecondary
```

### 10.6 Breadcrumbs, inlays, code lens

```
BREADCRUMBS_DEFAULT   FOREGROUND fgMuted
BREADCRUMBS_HOVERED   FOREGROUND fgDefault,  BACKGROUND bgHover
BREADCRUMBS_CURRENT   FOREGROUND fgDefault,  BACKGROUND bgSelectionUi
BREADCRUMBS_INACTIVE  FOREGROUND fgDisabled

INLINE_PARAMETER_HINT             FOREGROUND fgSubtle, BACKGROUND mix(fgDefault,bgEditor,0.92)
INLINE_PARAMETER_HINT_HIGHLIGHTED FOREGROUND fgDefault, BACKGROUND mix(accentPrimary,bgEditor,0.82)
INLINE_PARAMETER_HINT_CURRENT     FOREGROUND fgInverse, BACKGROUND accentPrimary
INLAY_DEFAULT                     FOREGROUND fgSubtle, BACKGROUND mix(fgDefault,bgEditor,0.92)
INLAY_TEXT_WITHOUT_BACKGROUND     FOREGROUND fgSubtle
INLAY_BUTTON_DEFAULT              BACKGROUND bgRaised
INLAY_BUTTON_HOVERED              BACKGROUND bgHover
INLAY_BUTTON_FOCUSED              BACKGROUND bgPress
INLINE_SUGGESTION                 FOREGROUND fgDisabled, FONT_TYPE 2
CODE_LENS_BORDER_COLOR            EFFECT_COLOR borderDefault
```

### 10.7 Debugger and coverage

```
BREAKPOINT_ATTRIBUTES              BACKGROUND mix(semError, bgEditor, 0.82)
EXECUTIONPOINT_ATTRIBUTES          BACKGROUND mix(accentPrimary, bgEditor, 0.76), FOREGROUND fgDefault
NOT_TOP_FRAME_ATTRIBUTES           BACKGROUND mix(accentPrimary, bgEditor, 0.90)
EVALUATED_EXPRESSION_ATTRIBUTES    BACKGROUND mix(accentSecondary, bgEditor, 0.84)
EVALUATED_EXPRESSION_EXECUTION_LINE_ATTRIBUTES BACKGROUND mix(accentSecondary, bgEditor, 0.76)
DEBUGGER_INLINED_VALUES            FOREGROUND fgSubtle, FONT_TYPE 2
DEBUGGER_INLINED_VALUES_MODIFIED   FOREGROUND accentSecondary, FONT_TYPE 2
DEBUGGER_INLINED_VALUES_EXECUTION_LINE FOREGROUND accentPrimary, FONT_TYPE 2
DEBUGGER_SMART_STEP_INTO_TARGET    BACKGROUND mix(accentPrimary, bgEditor, 0.76)
DEBUGGER_SMART_STEP_INTO_SELECTION BACKGROUND accentPrimary, FOREGROUND fgInverse
INLINE_STACK_FRAMES                FOREGROUND fgSubtle

LINE_FULL_COVERAGE     FOREGROUND semSuccess
LINE_PARTIAL_COVERAGE  FOREGROUND semWarning
LINE_NONE_COVERAGE     FOREGROUND semError
```

Xdebug step-debugging in PhpStorm uses `EXECUTIONPOINT_ATTRIBUTES` for the current line — make it clearly visible but not so strong it hides the code.

### 10.8 Semantic / rainbow highlighting

```
RAINBOW_COLOR0 ← accentPrimary
RAINBOW_COLOR1 ← accentSecondary
RAINBOW_COLOR2 ← accentTertiary
RAINBOW_COLOR3 ← synConstant
RAINBOW_COLOR4 ← synFunction
```

---

## 11. PHP, Laravel and web keys (PhpStorm)

### 11.1 The crucial fact about PHP keys

**PHP keys are `PHP_*` with underscores, not `PHP.*` with dots.** Dotted `PHP.KEYWORD`-style keys do not exist and are silently ignored.

And one key contains a **literal space**, confirmed in six independent real `.icls` files:

```xml
<option name="PHP_PREDEFINED SYMBOL">
```

Not an underscore. `PHP_PREDEFINED_SYMBOL` does nothing.

### 11.2 What a modern PHP theme must set

Everything else inherits from `DEFAULT_*`. Modern PhpStorm exports (2021+) set only ~12 PHP keys; legacy ones set 35. Set the short list.

```
PHP_TAG               FOREGROUND ← synMetadata          (<?php ?>) — no DEFAULT_ equivalent
PHP_SCRIPTING_BACKGROUND  <value/>                      — MUST be cleared, see below
PHP_VAR               baseAttributes="DEFAULT_LOCAL_VARIABLE"
PHP_PARAMETER         baseAttributes="DEFAULT_PARAMETER"
PHP_INSTANCE_FIELD    baseAttributes="DEFAULT_INSTANCE_FIELD"
PHP_STRING            baseAttributes="DEFAULT_STRING"
PHP_IDENTIFIER        baseAttributes="DEFAULT_IDENTIFIER"
PHP_CONCATENATION     FOREGROUND ← synOperator
PHP_EXEC_COMMAND_ID   baseAttributes="DEFAULT_STRING"    (backtick shell-exec)
PHP_HEREDOC_ID        FOREGROUND ← synKeyword
PHP_HEREDOC_CONTENT   baseAttributes="DEFAULT_STRING"
PHP_PREDEFINED SYMBOL FOREGROUND ← synConstant           (MIND THE SPACE)
PHP_ATTRIBUTE         FOREGROUND ← synMetadata           (PHP 8 #[Attribute])
PHP_NAMED_ARGUMENT    FOREGROUND ← synVariable, FONT_TYPE 2   (PHP 8 foo(name: $x))
PHP_PRIMITIVE_TYPE_HINT FOREGROUND ← synKeyword          (int, string, ?array)
MAGIC_MEMBER_ACCESS   FOREGROUND ← synVariable, FONT_TYPE 2   (no PHP_ prefix!)
```

**`PHP_SCRIPTING_BACKGROUND` must be explicitly cleared** with `<option name="PHP_SCRIPTING_BACKGROUND"><value /></option>`. If you don't, the inherited value from `parent_scheme` paints a grey band behind every `<?php … ?>` block inside `.blade.php` and `.html` files, which looks broken on a custom background.

### 11.3 PHP keys that exist but are usually unnecessary

Verified to exist in real schemes; set them only if the caller wants fine-grained control. Otherwise they inherit correctly.

```
PHP_KEYWORD  PHP_NUMBER  PHP_COMMENT  PHP_DOC_COMMENT_ID  PHP_DOC_TAG
PHP_OPERATION_SIGN  PHP_BRACES  PHP_BRACKETS  PHP_PARENTHESES
PHP_COMMA  PHP_SEMICOLON  PHP_BAD_CHARACTER  PHP_ESCAPE_SEQUENCE
PHP_CLASS  PHP_INTERFACE  PHP_FUNCTION  PHP_FUNCTION_CALL
PHP_STATIC_FIELD  PHP_INSTANCE_METHOD  PHP_STATIC_METHOD
PHP_CONSTANT  PHP_VAR_VAR  PHP_MARKUP_ID
```

Note PHPDoc uses `PHP_DOC_COMMENT_ID` and `PHP_DOC_TAG` only — there is **no** `PHP_DOC_TAG_VALUE` or `PHP_DOC_MARKUP`. Modern themes skip both and rely on `DEFAULT_DOC_COMMENT*`.

Do not emit `PHP_CODE` — legacy, obsolete.

### 11.4 Blade (Laravel)

Only two keys exist in the entire platform:

```
BLADE_DIRECTIVE            FOREGROUND ← synKeyword, FONT_TYPE 1     (@if, @foreach, @extends)
BLADE_TEXT_BLOCK_BOUNDARY  FOREGROUND ← synMetadata                 ({{ }} boundaries)
```

Everything else in a `.blade.php` file renders through the HTML keys, injected-PHP keys, `DEFAULT_TEMPLATE_LANGUAGE_COLOR` and `INJECTED_LANGUAGE_FRAGMENT`. There is no `BLADE_COMMENT` / `BLADE_ECHO` / `BLADE_TAG` key — `{{-- --}}` falls through to `DEFAULT_BLOCK_COMMENT`. `[UNVERIFIED but consistent with every theme examined.]`

### 11.5 Twig and Smarty

```
TWIG_KEYWORD          ← synKeyword
TWIG_IDENTIFIER       ← synVariable
TWIG_STRING           ← synString
TWIG_NUMBER           ← synNumber
TWIG_COMMENT          ← synComment, FONT_TYPE 2
TWIG_BRACKETS         ← synMetadata
TWIG_OPERATION_SIGN   ← synOperator
TWIG_BAD_CHARACTER    ← synInvalid

SMARTY_IDENTIFIER  SMARTY_STRING  SMARTY_KEYWORD  SMARTY_NUMBER
SMARTY_COMMENT  SMARTY_BRACKETS  SMARTY_OPERATION_SIGN  SMARTY_BAD_CHARACTER
SMARTY_BACKGROUND    ← clear with <value/>, same reason as PHP_SCRIPTING_BACKGROUND
```

### 11.6 HTML / XML

```
HTML_TAG               ← synPunct
HTML_TAG_NAME          ← synKeyword
HTML_ATTRIBUTE_NAME    ← synMetadata
HTML_ATTRIBUTE_VALUE   ← synString
HTML_ENTITY_REFERENCE  ← synConstant
XML_TAG                ← synPunct
XML_TAG_NAME           ← synKeyword
XML_ATTRIBUTE_NAME     ← synMetadata
XML_ATTRIBUTE_VALUE    ← synString
XML_ENTITY_REFERENCE   ← synConstant
XML_NS_PREFIX          ← synType
XML_PROLOGUE           ← synComment
TAG_ATTR_KEY           ← synMetadata
```

Plus the `<colors>` keys `HTML_TAG_TREE_LEVEL0` … `LEVEL5` (§8.4).

### 11.7 CSS / SCSS / LESS

```
CSS.IDENT          ← synType          (selectors)
CSS.TAG_NAME       ← synKeyword
CSS.PROPERTY_NAME  ← synVariable
CSS.PROPERTY_VALUE ← synString
CSS.KEYWORD        ← synKeyword
CSS.FUNCTION       ← synFunction
CSS.STRING         ← synString
CSS.NUMBER         ← synNumber
CSS.COLOR          ← synConstant
CSS.HASH           ← synType          (#id)
CSS.PSEUDO         ← synMetadata
CSS.URL            ← synString
CSS.IMPORTANT      ← semError, FONT_TYPE 1
CSS.COMMENT        ← synComment, FONT_TYPE 2
SASS_VARIABLE      ← synVariable
SASS_MIXIN         ← synFunction
SASS_COMMENT       baseAttributes="CSS.COMMENT"
SASS_IDENTIFIER    ← synType
LESS_VARIABLE      ← synVariable
STYLUS_VARIABLE    ← synVariable
```

Note these use **dots**, unlike PHP.

### 11.8 JavaScript / TypeScript

```
JS.KEYWORD                  ← synKeyword
JS.STRING                   ← synString
JS.NUMBER                   ← synNumber
JS.REGEXP                   ← synConstant
JS.LINE_COMMENT             ← synComment, FONT_TYPE 2
JS.BLOCK_COMMENT            ← synComment, FONT_TYPE 2
JS.DOC_COMMENT              ← synComment, FONT_TYPE 2
JS.DOC_TAG                  baseAttributes="DEFAULT_DOC_COMMENT_TAG"
JS.DOC_MARKUP               baseAttributes="DEFAULT_DOC_MARKUP"
JS.VALID_STRING_ESCAPE      ← synConstant
JS.INVALID_STRING_ESCAPE    ← synInvalid
JS.LOCAL_VARIABLE           ← synVariable
JS.GLOBAL_VARIABLE          ← synVariable, FONT_TYPE 2
JS.GLOBAL_FUNCTION          ← synFunction
JS.PARAMETER                ← synVariable
JS.INSTANCE_MEMBER_VARIABLE ← mix(synVariable, synType, 0.45)
JS.INSTANCE_MEMBER_FUNCTION ← synFunction
JS.STATIC_MEMBER_VARIABLE   ← mix(synVariable, synType, 0.45)
JS.STATIC_MEMBER_FUNCTION   ← synFunction, FONT_TYPE 2
JS.EXPORTED.VARIABLE        ← synVariable          (second DOT, not underscore)
JS.ATTRIBUTE                ← synMetadata
JS.MODULE_NAME              ← synType
TS.PARAMETER                ← synVariable
TS.GLOBAL_VARIABLE          ← synVariable
TS.MODULE_NAME              ← synType
TS.TYPE_PARAMETER           ← synType
TS.TYPE_GUARD               ← synKeyword
NG.PROPERTY_BINDING_ATTR_NAME     ← synMetadata
NG.EVENT_BINDING_ATTR_NAME        ← synMetadata
NG.BANANA_BINDING_ATTR_NAME       ← synMetadata
NG.TEMPLATE_BINDINGS_ATTR_NAME    ← synMetadata
```

### 11.9 JSON, YAML, Markdown, regex, misc

```
JSON.KEYWORD        ← synKeyword
JSON.STRING         ← synString
JSON.NUMBER         ← synNumber
JSON.PROPERTY_KEY   ← synType
JSON.BRACES         ← synPunct
JSON.BRACKETS       ← synPunct
JSON.COLON          ← synPunct
JSON.COMMA          ← synPunct
JSON.VALID_ESCAPE   ← synConstant

YAML_SCALAR_KEY     ← synType
YAML_SCALAR_VALUE   ← synString
YAML_SCALAR_STRING  ← synString
YAML_SCALAR_DSTRING ← synString
YAML_SCALAR_LIST    ← synString
YAML_TEXT           ← fgDefault
YAML_COMMENT        ← synComment, FONT_TYPE 2
YAML_ANCHOR         ← synConstant
YAML_SIGN           ← synPunct

MARKDOWN_HEADER_LEVEL_1 … _6   ← synKeyword, FONT_TYPE 1
MARKDOWN_BOLD                  ← fgDefault, FONT_TYPE 1
MARKDOWN_ITALIC                ← fgDefault, FONT_TYPE 2
MARKDOWN_CODE_SPAN             ← synString
MARKDOWN_CODE_SPAN_MARKER      ← synPunct
MARKDOWN_CODE_FENCE            ← BACKGROUND mix(fgDefault, bgEditor, 0.96)
MARKDOWN_LINK_TEXT             ← accentPrimary
MARKDOWN_LINK_LABEL            ← synType
MARKDOWN_LINK_TITLE            ← synString
MARKDOWN_LINK_DESTINATION      ← synComment, EFFECT_TYPE 1
MARKDOWN_AUTO_LINK             ← accentPrimary, EFFECT_TYPE 1
MARKDOWN_TABLE_SEPARATOR       ← synPunct

REGEXP.META            ← synKeyword
REGEXP.BRACES          ← synPunct
REGEXP.BRACKETS        ← synPunct
REGEXP.PARENTHS        ← synPunct
REGEXP.COMMA           ← synPunct
REGEXP.CHAR_CLASS      ← synConstant
REGEXP.ESC_CHARACTER   ← synConstant
REGEXP.QUOTE_CHARACTER ← synPunct
REGEXP.INVALID_STRING_ESCAPE ← synInvalid
REGEXP.REDUNDANT_ESCAPE      ← synComment
REGEXP_MATCHED_GROUPS        ← BACKGROUND mix(accentPrimary, bgEditor, 0.85)

PROPERTIES.KEY                    ← synType
PROPERTIES.KEY_VALUE_SEPARATOR    ← synPunct
PROPERTIES.VALID_STRING_ESCAPE    ← synConstant
PROPERTIES.INVALID_STRING_ESCAPE  ← synInvalid
DOCKER_KEYWORD    ← synKeyword
DOCKER_VARIABLE   ← synVariable
INI.SECTION       ← synType
EDITORCONFIG_VARIABLE ← synVariable
APACHE_CONFIG.IDENTIFIER ← synType
APACHE_CONFIG.COMMENT    ← synComment
HTTP_REQUEST_PARAMETER_NAME   ← synMetadata
HTTP_REQUEST_PARAMETER_VALUE  ← synString
HTTP_REQUEST_VARIABLE_BRACES  ← synPunct
HTTP_REQUEST_MESSAGE_BODY     ← fgDefault
SQL_OUTER_QUERY_COLUMN  ← synType
SQL_SYNTHETIC_ENTITY    ← synType, FONT_TYPE 2
GRID_ERROR_VALUE        ← semError
CUSTOM_KEYWORD1_ATTRIBUTES … CUSTOM_KEYWORD4_ATTRIBUTES ← synKeyword / synType / synConstant / synFunction
CUSTOM_NUMBER_ATTRIBUTES  ← synNumber
CUSTOM_STRING_ATTRIBUTES  ← synString
CUSTOM_LINE_COMMENT_ATTRIBUTES      ← synComment
CUSTOM_MULTI_LINE_COMMENT_ATTRIBUTES← synComment
CUSTOM_VALID_STRING_ESCAPE_ATTRIBUTES   ← synConstant
CUSTOM_INVALID_STRING_ESCAPE_ATTRIBUTES ← synInvalid
```

Most SQL highlighting in PhpStorm flows through `DEFAULT_*`; there is no `SQL.*` family.

### 11.10 Legacy keys with spaces

Some old keys are plain English strings containing spaces. They still resolve and appear in exported schemes. You never need to emit them, but a parser reading existing `.icls` files must tolerate them:

`Class`, `Interface name`, `Static method access`, `Static property reference ID`, `Method call`, `Number`, `String`, `Valid string escape`, `Closure braces`, `Abstract class name`, `Annotation`, `Anotation attribute name` (sic — misspelled in the platform), `Map key`, `FIRST SYMBOL IN LIST`.

---

## 12. Plugin packaging

### 12.1 Directory layout

```
acme-theme/
├── build.gradle.kts
├── gradle.properties
├── settings.gradle.kts
├── gradle/wrapper/…
└── src/main/resources/
    ├── META-INF/
    │   ├── plugin.xml
    │   └── pluginIcon.svg          ← 40×40, shown in the Plugins list
    └── themes/
        ├── acme-dark.theme.json
        ├── acme-dark.xml
        ├── acme-darker.theme.json
        ├── acme-darker.xml
        ├── acme-light.theme.json
        └── acme-light.xml
```

Paths inside the jar mirror the resources root, so `path="/themes/acme-dark.theme.json"` and `"editorScheme": "/themes/acme-dark.xml"` both resolve. The leading slash is required.

`buildPlugin` produces `build/distributions/acme-theme-1.0.0.zip` containing `acme-theme/lib/acme-theme-1.0.0.jar`.

### 12.2 `plugin.xml`

```xml
<idea-plugin>
  <id>nl.pendo.acme-theme</id>
  <name>Acme Theme</name>
  <version>1.0.0</version>
  <vendor url="https://pendo.nl">Pendo</vendor>

  <idea-version since-build="233"/>

  <depends>com.intellij.modules.platform</depends>

  <description><![CDATA[
    Acme — a five-colour theme family for JetBrains IDEs.
    Includes Dark, Darker and Light variants.
  ]]></description>

  <extensions defaultExtensionNs="com.intellij">
    <themeProvider id="8f2c1a30-5b41-4e7d-9c2a-1f6e0b93d7a1"
                   path="/themes/acme-dark.theme.json"/>
    <themeProvider id="c41d9e72-a8b3-4f16-8d05-7e2c4a91b638"
                   path="/themes/acme-darker.theme.json"/>
    <themeProvider id="2a7f5c18-6d94-4b23-a1e7-5c80f3d62e94"
                   path="/themes/acme-light.theme.json"/>
  </extensions>
</idea-plugin>
```

Rules:

- **`<depends>com.intellij.modules.platform</depends>`** — correct for a theme-only plugin, and it makes the plugin load in every IntelliJ-based IDE including PhpStorm. Do not use `com.intellij.modules.lang`; that's only needed if you also ship code.
- **`themeProvider@id` must be globally unique and must never change.** It is the persisted identity of the look-and-feel. Change it and every user's selected theme silently resets. Generate a UUID per variant, or use a reverse-DNS string (`nl.pendo.acme.dark`). Either is fine; consistency across releases is what matters.
- **`themeProvider@path`** is relative to the resources root, leading slash required.
- **Omit `until-build`.** Themes are essentially never binary-incompatible, and an `until-build` makes the plugin expire at the next IDE release.
- `targetUi="islands"` registers a variant for the Islands UI. `[UNVERIFIED: introducing build.]` Only add if you generated an Islands variant.

`pluginIcon.svg` is required for Marketplace but not for local install. A plain 40×40 SVG with the palette's primary accent is adequate.

### 12.3 `build.gradle.kts` (IntelliJ Platform Gradle Plugin 2.x)

```kotlin
plugins {
    id("org.jetbrains.intellij.platform") version "2.19.0"
}

group = "nl.pendo"
version = "1.0.0"

repositories {
    mavenCentral()
    intellijPlatform { defaultRepositories() }
}

dependencies {
    intellijPlatform {
        // Build against PhpStorm so runIde launches PhpStorm:
        phpstorm("2024.3")
        // Or, for a theme that ships to all IDEs, the Community base is enough:
        // intellijIdeaCommunity("2024.3")
    }
}

intellijPlatform {
    buildSearchableOptions = false      // meaningless for a theme, saves a slow build step

    pluginConfiguration {
        id = "nl.pendo.acme-theme"
        name = "Acme Theme"
        version = project.version.toString()
        ideaVersion {
            sinceBuild = "233"
            untilBuild = provider { null }
        }
    }

    publishing { token = providers.environmentVariable("PUBLISH_TOKEN") }

    signing {
        certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
        privateKey       = providers.environmentVariable("PRIVATE_KEY")
        password         = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }
}
```

`settings.gradle.kts`:

```kotlin
rootProject.name = "acme-theme"
```

Requirements for the 2.x plugin: target platform ≥ 2023.3, Gradle ≥ 8.5, JDK 17. No `java` or `kotlin` plugin is needed for a code-free theme.

Tasks: `./gradlew runIde`, `buildPlugin`, `verifyPlugin`, `publishPlugin`.

### 12.4 Building without Gradle

A theme plugin is just a jar. For a generator that wants to skip the toolchain entirely:

```bash
cd src/main/resources
zip -r ../../../acme-theme.jar META-INF themes
cd ../../..
mkdir -p acme-theme/lib && mv acme-theme.jar acme-theme/lib/
zip -r acme-theme.zip acme-theme
```

The resulting `acme-theme.zip` installs via *Install Plugin from Disk*. This works and is how you iterate fastest when you have no JVM toolchain available — but it skips `verifyPlugin`, so validate the JSON/XML yourself (§16).

---

## 13. Installing and iterating

### 13.1 Install without publishing

Settings → Plugins → ⚙ → **Install Plugin from Disk…** → pick `build/distributions/acme-theme-1.0.0.zip` → restart.

Or drop the *unzipped distribution folder* (not the bare jar) into the plugins directory:

| OS | Plugins directory |
|---|---|
| macOS | `~/Library/Application Support/JetBrains/PhpStorm<version>/plugins` |
| Linux | `~/.local/share/JetBrains/PhpStorm<version>` |
| Windows | `%APPDATA%\JetBrains\PhpStorm<version>\plugins` |

The selected theme is recorded in `options/laf.xml` in the config directory (macOS: `~/Library/Application Support/JetBrains/PhpStorm<version>`).

### 13.2 The development loop

`./gradlew runIde` launches a sandboxed IDE with the theme already registered — no install step, and the sandbox config lives in `build/idea-sandbox/` so you can wreck it freely. `runIde` also enables **internal mode** automatically, which you need for the two tools below.

**`.theme.json` is not hot-reloaded.** There is no watch mode; editing the file means restarting `runIde`. The practical loop is: prototype colours live with LaF Defaults, then transcribe into the generator's token table.

### 13.3 Finding key names

**LaF Defaults** — Tools → Internal Actions → UI → LaF Defaults. Lists every live UI key with its current value; tick "Colors only", click a value, pick a colour, and the IDE updates in real time. The Name column is exactly what you put in the `ui` block. Changes are not persisted — copy them out.

**UI Inspector** — hover an element and press **Ctrl+Alt+click** (**Ctrl+Option+click** on macOS). Reports the Swing component class, its LaF keys, the `AllIcons.Group.Name` reference for icons (convert to `/group/name.svg` for the `icons` map), and the `TextAttributesKey` external name for editor tokens.

If Tools → Internal Actions is missing outside `runIde`: Help → Edit Custom Properties, add `idea.is.internal=true`, restart.

**JSON schema completion** — PhpStorm maps a schema onto `*.theme.json` files, so editing a theme file inside the IDE gives autocompletion and validation on `ui` keys. This is the fastest way to check a key exists.

**Export an existing scheme** to learn attribute names: Settings → Editor → Color Scheme → ⚙ → Export → *IntelliJ IDEA color scheme (.icls)*. The export contains only non-default values, so start from a scheme you have already heavily customised.

---

## 14. Reference implementation (PHP)

Minimal, dependency-free OKLCH helpers sufficient to run §1. Drop into a generator.

```php
<?php

final class Oklch
{
    public function __construct(
        public float $l,   // 0..1
        public float $c,   // 0..~0.37
        public float $h,   // 0..360
    ) {}
}

/** #RRGGBB -> [r,g,b] linear-light 0..1 */
function srgbToLinear(string $hex): array
{
    $hex = ltrim($hex, '#');
    $f = fn (int $v) => ($v / 255) <= 0.04045
        ? ($v / 255) / 12.92
        : ((($v / 255) + 0.055) / 1.055) ** 2.4;

    return [
        $f(hexdec(substr($hex, 0, 2))),
        $f(hexdec(substr($hex, 2, 2))),
        $f(hexdec(substr($hex, 4, 2))),
    ];
}

function linearToSrgb(array $rgb): string
{
    $f = function (float $v): int {
        $v = $v <= 0.0031308 ? $v * 12.92 : 1.055 * ($v ** (1 / 2.4)) - 0.055;
        return (int) round(max(0, min(1, $v)) * 255);
    };

    return sprintf('#%02X%02X%02X', $f($rgb[0]), $f($rgb[1]), $f($rgb[2]));
}

function hexToOklch(string $hex): Oklch
{
    [$r, $g, $b] = srgbToLinear($hex);

    $l = 0.4122214708 * $r + 0.5363325363 * $g + 0.0514459929 * $b;
    $m = 0.2119034982 * $r + 0.6806995451 * $g + 0.1073969566 * $b;
    $s = 0.0883024619 * $r + 0.2817188376 * $g + 0.6299787005 * $b;

    $l_ = $l ** (1 / 3); $m_ = $m ** (1 / 3); $s_ = $s ** (1 / 3);

    $L =  0.2104542553 * $l_ + 0.7936177850 * $m_ - 0.0040720468 * $s_;
    $a =  1.9779984951 * $l_ - 2.4285922050 * $m_ + 0.4505937099 * $s_;
    $bb =  0.0259040371 * $l_ + 0.7827717662 * $m_ - 0.8086757660 * $s_;

    $C = sqrt($a * $a + $bb * $bb);
    $H = $C < 1e-6 ? 0.0 : fmod(rad2deg(atan2($bb, $a)) + 360, 360);

    return new Oklch($L, $C, $H);
}

function oklchToHex(Oklch $col): string
{
    $L = max(0.0, min(1.0, $col->l));
    $a = $col->c * cos(deg2rad($col->h));
    $b = $col->c * sin(deg2rad($col->h));

    $l_ = $L + 0.3963377774 * $a + 0.2158037573 * $b;
    $m_ = $L - 0.1055613458 * $a - 0.0638541728 * $b;
    $s_ = $L - 0.0894841775 * $a - 1.2914855480 * $b;

    $l = $l_ ** 3; $m = $m_ ** 3; $s = $s_ ** 3;

    $rgb = [
         4.0767416621 * $l - 3.3077115913 * $m + 0.2309699292 * $s,
        -1.2684380046 * $l + 2.6097574011 * $m - 0.3413193965 * $s,
        -0.0041960863 * $l - 0.7034186147 * $m + 1.7076147010 * $s,
    ];

    // Naive gamut clamp: reduce chroma until in-gamut.
    if (max($rgb) > 1.0 || min($rgb) < 0.0) {
        if ($col->c > 0.001) {
            return oklchToHex(new Oklch($col->l, $col->c * 0.96, $col->h));
        }
    }

    return linearToSrgb($rgb);
}

function lighten(string $hex, float $dL): string
{
    $o = hexToOklch($hex);
    return oklchToHex(new Oklch($o->l + $dL, $o->c, $o->h));
}

function desat(string $hex, float $factor): string
{
    $o = hexToOklch($hex);
    return oklchToHex(new Oklch($o->l, $o->c * $factor, $o->h));
}

/**
 * OKLab interpolation in RECTANGULAR coordinates. $t = 0 -> $a, 1 -> $b.
 *
 * Do NOT interpolate hue polarly here. Mixing a warm accent into a
 * blue-tinted background along the hue circle detours through magenta,
 * which is how generated themes end up with purple "deleted line" gutters.
 */
function mixColors(string $a, string $b, float $t): string
{
    $A = hexToOklch($a);
    $B = hexToOklch($b);

    $aA = $A->c * cos(deg2rad($A->h));
    $bA = $A->c * sin(deg2rad($A->h));
    $aB = $B->c * cos(deg2rad($B->h));
    $bB = $B->c * sin(deg2rad($B->h));

    $L  = $A->l + ($B->l - $A->l) * $t;
    $x  = $aA + ($aB - $aA) * $t;
    $y  = $bA + ($bB - $bA) * $t;

    $C = sqrt($x * $x + $y * $y);
    $H = $C < 1e-6 ? 0.0 : fmod(rad2deg(atan2($y, $x)) + 360, 360);

    return oklchToHex(new Oklch($L, $C, $H));
}

function withAlpha(string $hex, float $alpha): string
{
    return strtoupper($hex) . sprintf('%02X', (int) round(max(0, min(1, $alpha)) * 255));
}

function relativeLuminance(string $hex): float
{
    [$r, $g, $b] = srgbToLinear($hex);
    return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
}

function contrastRatio(string $a, string $b): float
{
    $la = relativeLuminance($a);
    $lb = relativeLuminance($b);
    [$hi, $lo] = $la > $lb ? [$la, $lb] : [$lb, $la];

    return ($hi + 0.05) / ($lo + 0.05);
}

/** Move $fg's lightness until it clears $target against $bg. */
function ensureContrast(string $fg, string $bg, float $target, int $sign): string
{
    for ($i = 0; $i < 60 && contrastRatio($fg, $bg) < $target; $i++) {
        $o  = hexToOklch($fg);
        $fg = oklchToHex(new Oklch($o->l + $sign * 0.01, $o->c, $o->h));
    }

    // Last resort: desaturate and retry once.
    if (contrastRatio($fg, $bg) < $target) {
        $o  = hexToOklch($fg);
        $fg = oklchToHex(new Oklch($o->l, $o->c * 0.8, $o->h));
    }

    return $fg;
}

/** Strip '#' for editor-scheme XML values. */
function xmlHex(string $hex): string
{
    return strtolower(ltrim($hex, '#'));
}
```

---

## 15. Worked example

Input palette:

```
C1 #1B1D23   anchor
C2 #D4D7DE   ink
C3 #4C8DF6   primary accent
C4 #E5A33C   secondary accent
C5 #5CC98A   tertiary accent
```

### 15.1 Derived token table

Produced by running §1 exactly as written. These are real computed values, not illustrative.

```
bgEditor             #1A1D23      semError             #DA685E
bgBase               #1F2228      semWarning           #E5A33C
bgRaised             #24272D      semSuccess           #5CC98A
bgSunken             #171A20      semInfo              #3199D7
bgOverlay            #282C31      semModify            #5592DE
bgHover              #272B30
bgPress              #2C3036      borderDefault        #3E4248
                                  borderStrong         #53565D
fgDefault            #D4D7DE      separator            #35383E
fgMuted              #9C9FA6      shadow               #0000018C
fgSubtle             #7C7F86      caret                #4C8DF6
fgDisabled           #5D6067      guideIndent          #2D3036
fgInverse            #090B0F      guideIndentOn        #4B4E55

accentPrimary        #4C8DF6      ansiBlack            #32353C
accentPrimaryHover   #649EFC      ansiRed              #DD6B60
accentPrimaryMuted   #6D91C9      ansiGreen            #5CC98A
accentSecondary      #E5A33C      ansiYellow           #E5A33C
accentTertiary       #5CC98A      ansiBlue             #4C8DF6
                                  ansiMagenta          #C16FBF
bgSelection          #283854      ansiCyan             #18A5B2
bgSelectionInactive  #212B3D      ansiWhite            #9C9FA6
bgSelectionUi        #314970      ansiBrightBlack      #5D6067
fgSelection          #D4D7DE      ansiBrightRed        #FEA196
                                  ansiBrightGreen      #7ED58C
synKeyword           #4C8DF6      ansiBrightYellow     #E5B64C
synString            #5CC98A      ansiBrightBlue       #92C1FE
synNumber            #E7A231      ansiBrightMagenta    #EC9EE9
synComment           #81858B      ansiBrightCyan       #1CD6E6
synType              #E5A33C      ansiBrightWhite      #D4D7DE
synFunction          #4EAFC5
synVariable          #D4D7DE
synConstant          #FD8A96
synOperator          #9C9FA6
synPunct             #7C7F86
synMetadata          #DBA75C
synInvalid           #DA685E
```

Note what the algorithm did on its own:

- `semWarning` and `semSuccess` resolved to `C4` and `C5` verbatim, because their hues already sat within 25° of amber and green. `ansiYellow` and `ansiGreen` inherited them. Console output from Artisan and PHPUnit therefore uses the actual brand palette.
- `semError` was synthesised, because no input colour is red.
- `synComment` started at `mix(fgDefault, bgEditor, 0.55)` = 4.1:1 and was lifted by the repair loop to 4.55:1.
- `synFunction` is the OKLab midpoint of the blue and green accents — a teal that belongs to the palette without being one of its members.

Contrast audit:

```
fgDefault   on bgEditor   11.72   ✓ (≥ 7.0)
fgMuted     on bgBase      6.01   ✓ (≥ 4.5)
fgSubtle    on bgBase      3.97   ✓ (≥ 3.5)
synComment  on bgEditor    4.55   ✓ (≥ 4.5)
synKeyword  on bgEditor    5.18   ✓
synString   on bgEditor    8.18   ✓
synType     on bgEditor    7.75   ✓
synNumber   on bgEditor    7.73   ✓
synFunction on bgEditor    6.64   ✓
synConstant on bgEditor    7.44   ✓
fgInverse   on accentPrimary       6.05   ✓
fgDefault   on bgSelection         8.17   ✓
bgSelection vs bgEditor             1.43   ✓ (visible, not shouting)
```

### 15.2 `acme-dark.theme.json`

Complete and valid: 89 colour tokens, 790 leaf `ui` keys, 35 icon-palette entries.

```json
{
  "name": "Acme Dark",
  "dark": true,
  "author": "Pendo",
  "editorScheme": "/themes/acme-dark.xml",
  "colors": {
    "bgEditor": "#1A1D23",
    "bgBase": "#1F2228",
    "bgRaised": "#24272D",
    "bgSunken": "#171A20",
    "bgOverlay": "#282C31",
    "bgHover": "#272B30",
    "bgPress": "#2C3036",
    "fgDefault": "#D4D7DE",
    "fgMuted": "#9C9FA6",
    "fgSubtle": "#7C7F86",
    "fgDisabled": "#5D6067",
    "fgInverse": "#090B0F",
    "accentPrimary": "#4C8DF6",
    "accentPrimaryHover": "#649EFC",
    "accentPrimaryMuted": "#6D91C9",
    "accentSecondary": "#E5A33C",
    "accentTertiary": "#5CC98A",
    "bgSelection": "#283854",
    "bgSelectionInactive": "#212B3D",
    "bgSelectionUi": "#314970",
    "fgSelection": "#D4D7DE",
    "semError": "#DA685E",
    "semWarning": "#E5A33C",
    "semSuccess": "#5CC98A",
    "semInfo": "#3199D7",
    "semModify": "#5592DE",
    "borderDefault": "#3E4248",
    "borderStrong": "#53565D",
    "borderFocus": "#4C8DF6",
    "separator": "#35383E",
    "shadow": "#0000018C",
    "caret": "#4C8DF6",
    "guideIndent": "#2D3036",
    "guideIndentOn": "#4B4E55",
    "ansiBlack": "#32353C",
    "ansiRed": "#DD6B60",
    "ansiGreen": "#5CC98A",
    "ansiYellow": "#E5A33C",
    "ansiBlue": "#4C8DF6",
    "ansiMagenta": "#C16FBF",
    "ansiCyan": "#18A5B2",
    "ansiWhite": "#9C9FA6",
    "ansiBrightBlack": "#5D6067",
    "ansiBrightRed": "#FEA196",
    "ansiBrightGreen": "#7ED58C",
    "ansiBrightYellow": "#E5B64C",
    "ansiBrightBlue": "#92C1FE",
    "ansiBrightMagenta": "#EC9EE9",
    "ansiBrightCyan": "#1CD6E6",
    "ansiBrightWhite": "#D4D7DE",
    "synKeyword": "#4C8DF6",
    "synString": "#5CC98A",
    "synNumber": "#E7A231",
    "synComment": "#81858B",
    "synType": "#E5A33C",
    "synFunction": "#4EAFC5",
    "synVariable": "#D4D7DE",
    "synConstant": "#FD8A96",
    "synOperator": "#9C9FA6",
    "synPunct": "#7C7F86",
    "synMetadata": "#DBA75C",
    "synInvalid": "#DA685E",
    "sbThumb": "#D4D7DE33",
    "sbThumbHover": "#D4D7DE52",
    "sbTrack": "#00000000",
    "sbTrackHover": "#D4D7DE0F",
    "transparent": "#00000000",
    "focusRing": "#4C8DF68C",
    "errRing": "#DA685E8C",
    "warnRing": "#E5A33C8C",
    "errRingWeak": "#DA685E47",
    "warnRingWeak": "#E5A33C47",
    "borderDisabled": "#2E3238",
    "tintErrorBg": "#342B2F",
    "tintWarnBg": "#34302E",
    "tintInfoBg": "#242F3A",
    "tintSuccessBg": "#273433",
    "tintErrorRaised": "#3C3134",
    "tintWarnRaised": "#3C3733",
    "tintInfoRaised": "#293642",
    "tintSuccessRaised": "#2D3B39",
    "tintAccentWeak": "#252E3E",
    "tintAccentSoft": "#29364C",
    "stripeRow": "#24272D",
    "trackNeutral": "#35383E",
    "searchMatch": "#71593A",
    "shadow0": "#0000016B",
    "shadow1": "#00000129",
    "shadowCorner": "#00000140"
  },
  "ui": {
    "*": {
      "background": "bgBase",
      "foreground": "fgDefault",
      "textForeground": "fgDefault",
      "caretForeground": "fgDefault",
      "infoForeground": "fgSubtle",
      "disabledForeground": "fgDisabled",
      "disabledText": "fgDisabled",
      "inactiveForeground": "fgMuted",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "selectionInactiveBackground": "bgSelectionInactive",
      "selectionBackgroundInactive": "bgSelectionInactive",
      "selectionInactiveForeground": "fgSelection",
      "selectionForegroundInactive": "fgSelection",
      "inactiveBackground": "bgBase",
      "disabledBackground": "bgBase",
      "borderColor": "borderDefault",
      "separatorColor": "separator",
      "acceleratorForeground": "fgSubtle",
      "acceleratorSelectionForeground": "fgSelection"
    },
    "Panel": {
      "background": "bgBase",
      "foreground": "fgDefault"
    },
    "Viewport": {
      "background": "bgBase",
      "foreground": "fgDefault"
    },
    "ScrollPane": {
      "background": "bgBase",
      "foreground": "fgDefault"
    },
    "Label": {
      "background": "bgBase",
      "foreground": "fgDefault",
      "disabledForeground": "fgDisabled",
      "disabledText": "fgDisabled",
      "selectedForeground": "fgSelection",
      "infoForeground": "fgSubtle",
      "errorForeground": "semError",
      "warningForeground": "semWarning",
      "successForeground": "semSuccess"
    },
    "OptionPane": {
      "background": "bgOverlay",
      "foreground": "fgDefault",
      "messageForeground": "fgDefault"
    },
    "AlertDialog": {
      "background": "bgOverlay"
    },
    "SplitPane": {
      "background": "bgBase"
    },
    "SplitPaneDivider": {
      "draggingColor": "accentPrimary"
    },
    "OnePixelDivider": {
      "background": "separator"
    },
    "Separator": {
      "separatorColor": "separator"
    },
    "Group": {
      "separatorColor": "separator",
      "disabledSeparatorColor": "separator"
    },
    "Borders": {
      "color": "borderDefault",
      "ContrastBorderColor": "borderStrong"
    },
    "TitledBorder": {
      "titleColor": "fgMuted"
    },
    "Window": {
      "border": "1,1,1,1,3E4248",
      "undecorated": {
        "border": "1,1,1,1,3E4248"
      }
    },
    "Component": {
      "borderColor": "borderDefault",
      "disabledBorderColor": "borderDisabled",
      "focusedBorderColor": "accentPrimary",
      "focusColor": "focusRing",
      "errorFocusColor": "errRing",
      "inactiveErrorFocusColor": "errRingWeak",
      "warningFocusColor": "warnRing",
      "inactiveWarningFocusColor": "warnRingWeak",
      "iconColor": "fgSubtle",
      "hoverIconColor": "fgDefault",
      "infoForeground": "fgSubtle",
      "arc": 6,
      "focusWidth": 2
    },
    "TextField": {
      "background": "bgEditor",
      "foreground": "fgDefault",
      "caretForeground": "caret",
      "inactiveForeground": "fgDisabled",
      "selectionBackground": "bgSelection",
      "selectionForeground": "fgSelection"
    },
    "TextArea": {
      "background": "bgEditor",
      "foreground": "fgDefault",
      "caretForeground": "caret",
      "inactiveForeground": "fgDisabled",
      "selectionBackground": "bgSelection",
      "selectionForeground": "fgSelection"
    },
    "TextPane": {
      "background": "bgEditor",
      "foreground": "fgDefault",
      "caretForeground": "caret",
      "inactiveForeground": "fgDisabled",
      "selectionBackground": "bgSelection",
      "selectionForeground": "fgSelection"
    },
    "EditorPane": {
      "background": "bgEditor",
      "foreground": "fgDefault",
      "caretForeground": "caret",
      "inactiveForeground": "fgDisabled",
      "selectionBackground": "bgSelection",
      "selectionForeground": "fgSelection"
    },
    "FormattedTextField": {
      "background": "bgEditor",
      "foreground": "fgDefault",
      "caretForeground": "caret",
      "inactiveForeground": "fgDisabled",
      "selectionBackground": "bgSelection",
      "selectionForeground": "fgSelection"
    },
    "PasswordField": {
      "background": "bgEditor",
      "foreground": "fgDefault",
      "caretForeground": "caret",
      "inactiveForeground": "fgDisabled",
      "selectionBackground": "bgSelection",
      "selectionForeground": "fgSelection",
      "capsLockIconColor": "semWarning"
    },
    "TextComponent": {
      "selectionBackgroundInactive": "bgSelectionInactive"
    },
    "SearchField": {
      "errorBackground": "tintErrorRaised",
      "errorForeground": "semError"
    },
    "Button": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "startBackground": "bgRaised",
      "endBackground": "bgRaised",
      "startBorderColor": "borderDefault",
      "endBorderColor": "borderDefault",
      "focusedBorderColor": "accentPrimary",
      "disabledBorderColor": "borderDisabled",
      "disabledText": "fgDisabled",
      "shadowColor": "transparent",
      "shadowWidth": 0,
      "arc": 6,
      "loadingForeground": "fgSubtle",
      "default": {
        "foreground": "fgInverse",
        "startBackground": "accentPrimary",
        "endBackground": "accentPrimary",
        "startBorderColor": "accentPrimary",
        "endBorderColor": "accentPrimary",
        "focusColor": "focusRing",
        "focusedBorderColor": "accentPrimaryHover",
        "shadowColor": "transparent",
        "loadingForeground": "fgInverse"
      },
      "Split": {
        "default": {
          "separatorColor": "borderStrong",
          "iconColor": "fgInverse"
        }
      }
    },
    "OptionButton": {
      "separatorColor": "borderDefault",
      "default": {
        "separatorColor": "borderStrong"
      }
    },
    "ToggleButton": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "disabledText": "fgDisabled",
      "onBackground": "semSuccess",
      "onForeground": "fgInverse",
      "offBackground": "fgDisabled",
      "offForeground": "fgMuted",
      "buttonColor": "bgRaised",
      "borderColor": "borderDefault"
    },
    "ActionButton": {
      "hoverBackground": "bgHover",
      "hoverBorderColor": "transparent",
      "pressedBackground": "bgPress",
      "pressedBorderColor": "transparent",
      "focusedBorderColor": "accentPrimary",
      "separatorColor": "separator",
      "hoverSeparatorColor": "borderDefault"
    },
    "SegmentedButton": {
      "selectedButtonColor": "bgRaised",
      "focusedSelectedButtonColor": "bgHover",
      "selectedStartBorderColor": "borderDefault",
      "selectedEndBorderColor": "borderDefault"
    },
    "DisclosureButton": {
      "defaultBackground": "bgRaised",
      "hoverOverlay": "#D4D7DE0F",
      "pressedOverlay": "#D4D7DE1A"
    },
    "CheckBox": {
      "background": "bgBase",
      "foreground": "fgDefault",
      "disabledText": "fgDisabled",
      "select": "accentPrimary"
    },
    "RadioButton": {
      "background": "bgBase",
      "foreground": "fgDefault",
      "disabledText": "fgDisabled"
    },
    "ComboBox": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "nonEditableBackground": "bgRaised",
      "disabledForeground": "fgDisabled",
      "modifiedItemForeground": "accentSecondary",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "ArrowButton": {
        "background": "bgRaised",
        "nonEditableBackground": "bgRaised",
        "iconColor": "fgSubtle",
        "disabledIconColor": "fgDisabled"
      }
    },
    "ComboBoxButton": {
      "background": "bgRaised"
    },
    "Spinner": {
      "background": "bgRaised"
    },
    "Slider": {
      "background": "bgBase",
      "foreground": "fgDefault",
      "buttonColor": "accentPrimary",
      "buttonBorderColor": "accentPrimary",
      "trackColor": "trackNeutral",
      "tickColor": "fgSubtle",
      "focus": "focusRing"
    },
    "Tree": {
      "background": "bgBase",
      "foreground": "fgDefault",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "selectionInactiveBackground": "bgSelectionInactive",
      "hoverBackground": "bgHover",
      "hoverInactiveBackground": "bgHover",
      "modifiedItemForeground": "accentSecondary",
      "errorForeground": "semError",
      "hash": "guideIndent",
      "paintLines": false,
      "rowHeight": 24,
      "forceFocusedSelectionForeground": "fgSelection",
      "Selection": {
        "arc": 6
      }
    },
    "List": {
      "background": "bgBase",
      "foreground": "fgDefault",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "selectionInactiveBackground": "bgSelectionInactive",
      "selectionInactiveForeground": "fgSelection",
      "hoverBackground": "bgHover",
      "hoverInactiveBackground": "bgHover",
      "dropLineColor": "accentPrimary",
      "rowHeight": 22,
      "Button": {
        "hoverBackground": "bgHover",
        "separatorColor": "separator"
      },
      "Line": {
        "hoverBackground": "bgHover"
      },
      "Tag": {
        "background": "tintAccentSoft",
        "foreground": "accentPrimary"
      }
    },
    "Table": {
      "background": "bgBase",
      "foreground": "fgDefault",
      "gridColor": "separator",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "selectionInactiveBackground": "bgSelectionInactive",
      "selectionInactiveForeground": "fgSelection",
      "hoverBackground": "bgHover",
      "hoverInactiveBackground": "bgHover",
      "focusCellBackground": "bgSelectionUi",
      "focusCellForeground": "fgSelection",
      "lightSelectionBackground": "tintAccentWeak",
      "lightSelectionForeground": "fgDefault",
      "lightSelectionInactiveBackground": "tintAccentWeak",
      "lightSelectionInactiveForeground": "fgMuted",
      "alternativeRowBackground": "stripeRow",
      "stripeColor": "stripeRow",
      "dropLineColor": "accentPrimary",
      "dropLineShortColor": "accentPrimary",
      "sortIconColor": "fgSubtle"
    },
    "TableHeader": {
      "background": "bgSunken",
      "foreground": "fgMuted",
      "separatorColor": "separator",
      "bottomSeparatorColor": "separator",
      "focusCellBackground": "bgHover"
    },
    "SettingsTree": {
      "rowHeight": 24
    },
    "SidePanel": {
      "background": "bgSunken"
    },
    "DragAndDrop": {
      "areaBackground": "tintAccentWeak",
      "areaForeground": "accentPrimary",
      "borderColor": "accentPrimary",
      "rowBackground": "tintAccentSoft"
    },
    "ToolWindow": {
      "background": "bgBase",
      "borderColor": "borderDefault",
      "Header": {
        "background": "bgSunken",
        "inactiveBackground": "bgSunken",
        "borderColor": "borderDefault",
        "height": 30
      },
      "HeaderCloseButton": {
        "background": "bgHover"
      },
      "HeaderTab": {
        "underlineColor": "accentPrimary",
        "inactiveUnderlineColor": "accentPrimaryMuted",
        "underlineHeight": 2,
        "underlinedTabBackground": "bgHover",
        "underlinedTabInactiveBackground": "bgBase",
        "hoverBackground": "bgHover",
        "hoverInactiveBackground": "bgHover",
        "selectedInactiveBackground": "bgBase"
      },
      "Button": {
        "foreground": "fgMuted",
        "hoverBackground": "bgHover",
        "selectedBackground": "bgSelectionUi",
        "selectedForeground": "fgSelection",
        "DragAndDrop": {
          "buttonDropBackground": "tintAccentSoft",
          "buttonDropBorderColor": "accentPrimary",
          "buttonFloatingBackground": "bgRaised"
        }
      },
      "DragAndDrop": {
        "areaBackground": "tintAccentWeak"
      },
      "Stripe": {
        "background": "bgSunken",
        "borderColor": "borderDefault",
        "separatorColor": "separator",
        "DragAndDrop": {
          "separatorColor": "accentPrimary"
        }
      }
    },
    "StripeToolbar": {
      "Button": {
        "size": 30,
        "iconSize": 20
      }
    },
    "EditorTabs": {
      "background": "bgSunken",
      "borderColor": "borderDefault",
      "underTabsBorderColor": "borderDefault",
      "underlinedBorderColor": "accentPrimary",
      "underlineColor": "accentPrimary",
      "inactiveUnderlineColor": "accentPrimaryMuted",
      "underlineHeight": 2,
      "underlineArc": 2,
      "underlinedTabBackground": "bgEditor",
      "underlinedTabForeground": "fgDefault",
      "inactiveUnderlinedTabBackground": "bgBase",
      "inactiveUnderlinedTabBorderColor": "borderDefault",
      "hoverBackground": "bgHover",
      "hoverInactiveBackground": "bgHover",
      "hoverSelectedBackground": "bgHover",
      "hoverSelectedInactiveBackground": "bgHover",
      "unselectedAlpha": 0.75,
      "unselectedBlend": 0.75
    },
    "DefaultTabs": {
      "background": "bgSunken",
      "borderColor": "borderDefault",
      "hoverBackground": "bgHover",
      "underlineColor": "accentPrimary",
      "inactiveUnderlineColor": "accentPrimaryMuted",
      "underlineHeight": 2,
      "underlinedTabBackground": "bgBase",
      "underlinedTabForeground": "fgDefault"
    },
    "DebuggerTabs": {
      "underlinedTabBackground": "bgBase",
      "underlineHeight": 2
    },
    "TabbedPane": {
      "background": "bgBase",
      "foreground": "fgDefault",
      "contentAreaColor": "borderDefault",
      "disabledForeground": "fgDisabled",
      "disabledUnderlineColor": "fgDisabled",
      "focusColor": "bgHover",
      "hoverColor": "bgHover",
      "underlineColor": "accentPrimary",
      "tabSelectionHeight": 2
    },
    "MainWindow": {
      "Tab": {
        "background": "bgSunken",
        "foreground": "fgMuted",
        "selectedBackground": "bgEditor",
        "selectedForeground": "fgDefault",
        "selectedInactiveBackground": "bgBase",
        "hoverBackground": "bgHover",
        "hoverForeground": "fgDefault",
        "separatorColor": "separator",
        "borderColor": "borderDefault"
      }
    },
    "FileColor": {
      "Blue": "#3199D724",
      "Green": "#5CC98A24",
      "Orange": "#E5A33C24",
      "Rose": "#DA685E24",
      "Violet": "#FD8A9624",
      "Yellow": "#E5A33C24",
      "Gray": "#7C7F8624"
    },
    "MenuBar": {
      "borderColor": "borderDefault",
      "foreground": "fgDefault",
      "disabledForeground": "fgDisabled",
      "disabledBackground": "bgSunken",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "highlight": "borderDefault",
      "shadow": "borderDefault"
    },
    "Menu": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "borderColor": "borderDefault",
      "separatorColor": "separator",
      "disabledBackground": "bgRaised",
      "disabledForeground": "fgDisabled",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "acceleratorForeground": "fgSubtle",
      "acceleratorSelectionForeground": "fgSelection",
      "Selection": {
        "arc": 6
      }
    },
    "MenuItem": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "disabledBackground": "bgRaised",
      "disabledForeground": "fgDisabled",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "acceleratorForeground": "fgSubtle"
    },
    "CheckBoxMenuItem": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "disabledBackground": "bgRaised",
      "disabledForeground": "fgDisabled",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "acceleratorForeground": "fgSubtle",
      "acceleratorSelectionForeground": "fgSelection"
    },
    "RadioButtonMenuItem": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "disabledBackground": "bgRaised",
      "disabledForeground": "fgDisabled",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "acceleratorForeground": "fgSubtle",
      "acceleratorSelectionForeground": "fgSelection"
    },
    "PopupMenu": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "translucentBackground": "#24272DF5",
      "borderWidth": 1,
      "Selection": {
        "arc": 6
      }
    },
    "PopupMenuSeparator": {
      "height": 9,
      "stripeWidth": 1,
      "stripeIndent": 4
    },
    "MainMenu": {
      "selectionBackground": "bgSelectionUi",
      "selectionForeground": "fgSelection",
      "transparentSelectionBackground": "#D4D7DE1A",
      "Selection": {
        "fullScreenArc": 6
      }
    },
    "Popup": {
      "background": "bgRaised",
      "borderColor": "borderDefault",
      "inactiveBorderColor": "borderDefault",
      "innerBorderColor": "borderDefault",
      "borderWidth": 1,
      "paintBorder": true,
      "separatorColor": "separator",
      "separatorForeground": "fgSubtle",
      "Header": {
        "activeBackground": "bgSunken",
        "inactiveBackground": "bgSunken",
        "activeForeground": "fgDefault",
        "inactiveForeground": "fgMuted"
      },
      "Toolbar": {
        "background": "bgRaised",
        "borderColor": "borderDefault"
      },
      "Advertiser": {
        "background": "bgSunken",
        "foreground": "fgSubtle",
        "borderColor": "borderDefault"
      },
      "Selection": {
        "arc": 6
      }
    },
    "CompletionPopup": {
      "foreground": "fgDefault",
      "selectionBackground": "bgSelectionUi",
      "selectionInactiveBackground": "bgSelectionInactive",
      "matchForeground": "accentPrimary",
      "nonFocusedMask": "#1F222859",
      "Advertiser": {
        "background": "bgSunken",
        "foreground": "fgSubtle"
      }
    },
    "ComplexPopup": {
      "Header": {
        "background": "bgSunken"
      }
    },
    "ToolTip": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "borderColor": "borderDefault",
      "infoForeground": "fgSubtle",
      "linkForeground": "accentPrimary",
      "shortcutForeground": "fgSubtle",
      "paintBorder": true,
      "Actions": {
        "background": "bgSunken",
        "infoForeground": "fgSubtle"
      }
    },
    "Tooltip": {
      "separatorColor": "separator"
    },
    "HelpTooltip": {
      "borderColor": "borderDefault"
    },
    "InformationHint": {
      "borderColor": "borderDefault"
    },
    "DebuggerPopup": {
      "borderColor": "borderDefault"
    },
    "InplaceRefactoringPopup": {
      "borderColor": "accentPrimary"
    },
    "GutterTooltip": {
      "infoForeground": "fgSubtle",
      "lineSeparatorColor": "separator"
    },
    "ValidationTooltip": {
      "errorBackground": "tintErrorRaised",
      "errorForeground": "semError",
      "errorBorderColor": "semError",
      "warningBackground": "tintWarnRaised",
      "warningForeground": "semWarning",
      "warningBorderColor": "semWarning"
    },
    "ParameterInfo": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "borderColor": "borderDefault",
      "infoForeground": "fgSubtle",
      "disabledForeground": "fgDisabled",
      "currentParameterForeground": "accentPrimary",
      "currentOverloadBackground": "bgHover",
      "lineSeparatorColor": "separator"
    },
    "SpeedSearch": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "borderColor": "borderDefault",
      "errorForeground": "semError"
    },
    "ScrollBar": {
      "thumbColor": "sbThumb",
      "thumbBorderColor": "sbThumb",
      "hoverThumbColor": "sbThumbHover",
      "hoverThumbBorderColor": "sbThumbHover",
      "trackColor": "sbTrack",
      "hoverTrackColor": "sbTrackHover",
      "Transparent.thumbColor": "sbThumb",
      "Transparent.thumbBorderColor": "sbThumb",
      "Transparent.hoverThumbColor": "sbThumbHover",
      "Transparent.hoverThumbBorderColor": "sbThumbHover",
      "Transparent.trackColor": "sbTrack",
      "Transparent.hoverTrackColor": "sbTrackHover",
      "Mac.thumbColor": "sbThumb",
      "Mac.thumbBorderColor": "sbThumb",
      "Mac.hoverThumbColor": "sbThumbHover",
      "Mac.hoverThumbBorderColor": "sbThumbHover",
      "Mac.trackColor": "sbTrack",
      "Mac.hoverTrackColor": "sbTrackHover",
      "Mac.Transparent.thumbColor": "sbThumb",
      "Mac.Transparent.thumbBorderColor": "sbThumb",
      "Mac.Transparent.hoverThumbColor": "sbThumbHover",
      "Mac.Transparent.hoverThumbBorderColor": "sbThumbHover",
      "Mac.Transparent.trackColor": "sbTrack",
      "Mac.Transparent.hoverTrackColor": "sbTrackHover",
      "background": "bgBase"
    },
    "Scrollbar.Tabs.ThumbColor": "sbThumb",
    "Scrollbar.Tabs.HoveredThumbColor": "sbThumbHover",
    "Scrollbar.Tabs.TransparentThumbColor": "sbThumb",
    "StatusBar": {
      "background": "bgSunken",
      "borderColor": "borderDefault",
      "Widget": {
        "foreground": "fgMuted",
        "hoverBackground": "bgHover",
        "hoverForeground": "fgDefault",
        "pressedBackground": "bgPress"
      },
      "Breadcrumbs": {
        "foreground": "fgMuted",
        "hoverForeground": "fgDefault",
        "hoverBackground": "bgHover",
        "pressedBackground": "bgPress",
        "selectionBackground": "bgSelectionUi",
        "selectionInactiveBackground": "bgSelectionInactive"
      }
    },
    "ToolBar": {
      "background": "bgSunken",
      "foreground": "fgDefault",
      "separatorColor": "separator",
      "borderHandleColor": "borderDefault"
    },
    "Toolbar": {
      "Floating": {
        "background": "bgRaised",
        "borderColor": "borderDefault"
      }
    },
    "MainToolbar": {
      "background": "bgSunken",
      "separatorColor": "separator",
      "Button": {
        "size": 34,
        "iconSize": 20
      }
    },
    "NavBar": {
      "borderColor": "borderDefault",
      "borderWidth": 1
    },
    "TitlePane": {
      "background": "bgSunken",
      "inactiveBackground": "bgSunken",
      "infoForeground": "fgMuted",
      "inactiveInfoForeground": "fgDisabled",
      "Button": {
        "hoverBackground": "bgHover"
      }
    },
    "MemoryIndicator": {
      "usedBackground": "accentPrimaryMuted",
      "allocatedBackground": "trackNeutral"
    },
    "RunWidget": {
      "foreground": "fgInverse",
      "iconColor": "fgInverse",
      "runIconColor": "fgInverse",
      "runningBackground": "semSuccess",
      "runningIconColor": "fgInverse",
      "stopBackground": "semError",
      "hoverBackground": "#090B0F1F",
      "pressedBackground": "#090B0F33"
    },
    "RunToolbar": {
      "Run": {
        "activeBackground": "#294139"
      },
      "Debug": {
        "activeBackground": "#223748"
      },
      "Profile": {
        "activeBackground": "#44392D"
      }
    },
    "ProgressBar": {
      "background": "trackNeutral",
      "foreground": "accentPrimary",
      "progressColor": "accentPrimary",
      "trackColor": "trackNeutral",
      "indeterminateStartColor": "accentPrimaryMuted",
      "indeterminateEndColor": "accentPrimary",
      "selectionBackground": "fgDefault",
      "selectionForeground": "fgInverse",
      "failedColor": "semError",
      "failedEndColor": "#8B4D49",
      "passedColor": "semSuccess",
      "passedEndColor": "#458161",
      "warningColor": "semWarning",
      "warningEndColor": "#8F6D3D"
    },
    "ProgressIcon": {
      "color": "accentPrimary"
    },
    "Link": {
      "activeForeground": "accentPrimary",
      "hoverForeground": "accentPrimaryHover",
      "pressedForeground": "accentPrimaryHover",
      "visitedForeground": "accentPrimaryMuted",
      "secondaryForeground": "fgSubtle",
      "focusedBorderColor": "accentPrimary"
    },
    "Counter": {
      "background": "accentPrimary",
      "foreground": "fgInverse"
    },
    "Tag": {
      "background": "tintAccentSoft",
      "foreground": "accentPrimary"
    },
    "Abbreviation": {
      "background": "tintAccentSoft",
      "foreground": "accentPrimary",
      "borderColor": "borderDefault"
    },
    "IconBadge": {
      "errorBackground": "semError",
      "warningBackground": "semWarning",
      "infoBackground": "semInfo",
      "successBackground": "semSuccess"
    },
    "Badge": {
      "blueBackground": "semInfo",
      "blueForeground": "fgInverse",
      "greenBackground": "semSuccess",
      "greenForeground": "fgInverse",
      "greenOutlineBorderColor": "semSuccess",
      "greenOutlineForeground": "semSuccess",
      "disabledBackground": "trackNeutral",
      "disabledForeground": "fgDisabled",
      "blueSecondaryBackground": "#273847",
      "blueSecondaryForeground": "semInfo",
      "greenSecondaryBackground": "#2D403B",
      "greenSecondaryForeground": "semSuccess",
      "graySecondaryBackground": "trackNeutral",
      "graySecondaryForeground": "fgMuted",
      "purpleSecondaryBackground": "#47363C",
      "purpleSecondaryForeground": "synConstant"
    },
    "Notification": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "borderColor": "borderDefault",
      "linkForeground": "accentPrimary",
      "errorBackground": "tintErrorRaised",
      "errorBorderColor": "semError",
      "errorForeground": "fgDefault",
      "iconHoverBackground": "bgHover",
      "arc": 8,
      "MoreButton": {
        "background": "bgSunken",
        "foreground": "fgMuted",
        "innerBorderColor": "borderDefault"
      },
      "Button": {
        "background": "bgRaised",
        "foreground": "fgDefault",
        "borderColor": "borderDefault"
      },
      "ToolWindow": {
        "errorBackground": "tintErrorBg",
        "errorBorderColor": "semError",
        "errorForeground": "fgDefault",
        "warningBackground": "tintWarnBg",
        "warningBorderColor": "semWarning",
        "warningForeground": "fgDefault",
        "informativeBackground": "tintInfoBg",
        "informativeBorderColor": "semInfo",
        "informativeForeground": "fgDefault"
      },
      "Shadow": {
        "borderInsets": "4,4,4,4",
        "bottom0Color": "shadow0",
        "bottom1Color": "shadow1",
        "top0Color": "shadow0",
        "top1Color": "shadow1",
        "left0Color": "shadow0",
        "left1Color": "shadow1",
        "right0Color": "shadow0",
        "right1Color": "shadow1",
        "bottomLeft0Color": "shadowCorner",
        "bottomLeft1Color": "shadow1",
        "bottomRight0Color": "shadowCorner",
        "bottomRight1Color": "shadow1",
        "topLeft0Color": "shadowCorner",
        "topLeft1Color": "shadow1",
        "topRight0Color": "shadowCorner",
        "topRight1Color": "shadow1"
      }
    },
    "NotificationsToolwindow": {
      "newNotification": {
        "background": "tintAccentWeak",
        "hoverBackground": "bgHover"
      },
      "Notification": {
        "hoverBackground": "bgHover"
      }
    },
    "Banner": {
      "infoBackground": "tintInfoBg",
      "infoBorderColor": "semInfo",
      "successBackground": "tintSuccessBg",
      "successBorderColor": "semSuccess",
      "warningBackground": "tintWarnBg",
      "warningBorderColor": "semWarning",
      "errorBackground": "tintErrorBg",
      "errorBorderColor": "semError",
      "aiBackground": "#372E34",
      "aiBorderColor": "synConstant"
    },
    "SearchEverywhere": {
      "SearchField": {
        "background": "bgRaised",
        "borderColor": "borderDefault",
        "infoForeground": "fgSubtle"
      },
      "Header": {
        "background": "bgRaised"
      },
      "Tab": {
        "selectedBackground": "bgSelectionUi",
        "selectedForeground": "fgSelection"
      },
      "List": {
        "separatorColor": "separator",
        "separatorForeground": "fgSubtle",
        "settingsBackground": "bgSunken"
      },
      "Advertiser": {
        "background": "bgSunken",
        "foreground": "fgSubtle"
      }
    },
    "SearchMatch": {
      "startBackground": "searchMatch",
      "endBackground": "searchMatch"
    },
    "SearchOption": {
      "selectedBackground": "bgSelectionUi",
      "selectedHoveredBackground": "bgHover",
      "selectedPressedBackground": "bgPress"
    },
    "NewClass": {
      "SearchField": {
        "background": "bgRaised"
      }
    },
    "Editor": {
      "background": "bgEditor",
      "foreground": "fgDefault",
      "shortcutForeground": "accentPrimary",
      "SearchField": {
        "background": "bgRaised",
        "borderColor": "borderDefault"
      },
      "Toolbar": {
        "borderColor": "borderDefault"
      },
      "ToolTip": {
        "background": "bgRaised",
        "errorBackground": "tintErrorRaised",
        "errorBorder": "semError",
        "warningBackground": "tintWarnRaised",
        "warningBorder": "semWarning",
        "successBackground": "tintSuccessRaised",
        "successBorder": "semSuccess",
        "selectionBackground": "bgSelectionUi",
        "iconHoverBackground": "bgHover"
      }
    },
    "VersionControl": {
      "Log": {
        "Commit": {
          "currentBranchBackground": "tintAccentWeak",
          "hoveredBackground": "bgHover",
          "selectionBackground": "bgSelectionUi",
          "selectionForeground": "fgSelection",
          "selectionInactiveBackground": "bgSelectionInactive",
          "selectionInactiveForeground": "fgSelection",
          "unmatchedForeground": "fgDisabled",
          "rowHeight": 24,
          "Reference": {
            "foreground": "fgSubtle"
          }
        },
        "Graph": {
          "saturation": 0.6,
          "brightness": 0.8
        }
      },
      "GitLog": {
        "headIconColor": "accentSecondary",
        "localBranchIconColor": "semSuccess",
        "remoteBranchIconColor": "semInfo",
        "tagIconColor": "accentSecondary",
        "otherIconColor": "fgSubtle"
      },
      "RefLabel": {
        "foreground": "fgDefault",
        "backgroundBase": "bgRaised",
        "backgroundBrightness": 0.6
      },
      "FileHistory": {
        "Commit": {
          "selectedBranchBackground": "tintAccentWeak"
        }
      },
      "MarkerPopup": {
        "borderColor": "borderDefault",
        "Toolbar": {
          "background": "bgRaised"
        }
      },
      "Merge": {
        "Status": {
          "NoConflicts": {
            "foreground": "semSuccess"
          }
        }
      }
    },
    "CombinedDiff": {
      "BlockBorder": {
        "selectedActiveColor": "accentPrimary",
        "selectedInactiveColor": "borderDefault"
      }
    },
    "Debugger": {
      "Variables": {
        "valueForeground": "fgDefault",
        "typeForeground": "synType",
        "changedValueForeground": "accentSecondary",
        "modifyingValueForeground": "accentSecondary",
        "collectingDataForeground": "fgSubtle",
        "evaluatingExpressionForeground": "fgSubtle",
        "exceptionForeground": "semError",
        "errorMessageForeground": "semError"
      },
      "EvaluateExpression": {
        "background": "bgEditor"
      }
    },
    "Plugins": {
      "background": "bgBase",
      "borderColor": "borderDefault",
      "hoverBackground": "bgHover",
      "lightSelectionBackground": "tintAccentWeak",
      "disabledForeground": "fgDisabled",
      "SectionHeader": {
        "background": "bgSunken",
        "foreground": "fgMuted"
      },
      "Tab": {
        "hoverBackground": "bgHover",
        "selectedBackground": "bgSelectionUi",
        "selectedForeground": "fgSelection"
      },
      "SearchField": {
        "background": "bgRaised"
      },
      "tagBackground": "trackNeutral",
      "tagForeground": "fgMuted",
      "eapTagBackground": "#423A31",
      "paidTagBackground": "#2D403B",
      "trialTagBackground": "#273847",
      "suggestedLabelBackground": "tintAccentSoft",
      "Button": {
        "installBackground": "bgRaised",
        "installBorderColor": "semSuccess",
        "installForeground": "semSuccess",
        "installFillBackground": "semSuccess",
        "installFillForeground": "fgInverse",
        "installFocusedBackground": "#344C43",
        "updateBackground": "accentPrimary",
        "updateBorderColor": "accentPrimary",
        "updateForeground": "fgInverse"
      }
    },
    "WelcomeScreen": {
      "background": "bgBase",
      "borderColor": "borderDefault",
      "separatorColor": "separator",
      "captionBackground": "bgSunken",
      "captionForeground": "fgDefault",
      "headerBackground": "bgSunken",
      "headerForeground": "fgDefault",
      "footerBackground": "bgSunken",
      "footerForeground": "fgMuted",
      "groupIconBorderColor": "borderDefault",
      "Details": {
        "background": "bgBase"
      },
      "SidePanel": {
        "background": "bgSunken"
      },
      "Banner": {
        "background": "bgSunken"
      },
      "Projects": {
        "background": "bgBase",
        "selectionBackground": "bgSelectionUi",
        "selectionInactiveBackground": "bgSelectionInactive",
        "actions": {
          "background": "bgBase",
          "selectionBackground": "bgSelectionUi",
          "selectionBorderColor": "accentPrimary"
        }
      },
      "LearnTab": {
        "CourseCard": {
          "hover": "bgHover"
        }
      }
    },
    "Bookmark": {
      "iconBackground": "accentSecondary",
      "Mnemonic": {
        "iconForeground": "fgInverse"
      },
      "MnemonicAvailable": {
        "foreground": "fgMuted",
        "background": "bgRaised",
        "borderColor": "borderDefault"
      },
      "MnemonicAssigned": {
        "foreground": "fgInverse",
        "background": "accentSecondary"
      },
      "MnemonicCurrent": {
        "foreground": "fgInverse",
        "background": "accentPrimary"
      }
    },
    "GotItTooltip": {
      "background": "bgRaised",
      "foreground": "fgDefault",
      "borderColor": "borderDefault",
      "linkForeground": "accentPrimary",
      "shortcutForeground": "fgSubtle",
      "shortcutBackground": "bgSunken",
      "codeForeground": "synString",
      "codeBackground": "bgSunken",
      "codeBorderColor": "borderDefault",
      "stepForeground": "fgSubtle",
      "secondaryActionForeground": "fgMuted",
      "iconFillColor": "accentPrimary",
      "iconBorderColor": "accentPrimary",
      "imageBorderColor": "borderDefault",
      "animationBackground": "bgSunken",
      "arc": 8,
      "Header": {
        "foreground": "fgDefault"
      },
      "Button": {
        "foreground": "fgInverse",
        "startBackground": "accentPrimary",
        "endBackground": "accentPrimary",
        "startBorderColor": "accentPrimary",
        "endBorderColor": "accentPrimary",
        "contrastBackground": "bgRaised"
      }
    },
    "Code": {
      "Inline": {
        "backgroundColor": "bgSunken",
        "foregroundColor": "synString",
        "borderColor": "borderDefault",
        "borderRadius": 4
      },
      "Block": {
        "backgroundColor": "bgSunken",
        "foregroundColor": "fgDefault",
        "borderColor": "borderDefault",
        "borderRadius": 6,
        "EditorPane": {
          "backgroundColor": "bgEditor",
          "borderColor": "borderDefault"
        }
      }
    },
    "Shortcut": {
      "background": "bgSunken",
      "foreground": "fgMuted",
      "borderColor": "borderDefault",
      "borderRadius": 4
    },
    "Island": {
      "borderColor": "borderDefault",
      "arc": 12,
      "borderWidth": 1,
      "inactiveAlpha": 0.7
    },
    "Islands": {
      "borderColor": "borderDefault",
      "inactiveAlpha": 0.7
    },
    "Ide": {
      "Shadow": {
        "borderInsets": "4,4,4,4",
        "bottom0Color": "shadow0",
        "bottom1Color": "shadow1",
        "top0Color": "shadow0",
        "top1Color": "shadow1",
        "left0Color": "shadow0",
        "left1Color": "shadow1",
        "right0Color": "shadow0",
        "right1Color": "shadow1",
        "bottomLeft0Color": "shadowCorner",
        "bottomLeft1Color": "shadow1",
        "bottomRight0Color": "shadowCorner",
        "bottomRight1Color": "shadow1",
        "topLeft0Color": "shadowCorner",
        "topLeft1Color": "shadow1",
        "topRight0Color": "shadowCorner",
        "topRight1Color": "shadow1"
      }
    }
  },
  "icons": {
    "ColorPalette": {
      "Actions.Red": "semError",
      "Actions.Red.Dark": "semError",
      "Actions.Yellow": "semWarning",
      "Actions.Yellow.Dark": "semWarning",
      "Actions.Green": "semSuccess",
      "Actions.Green.Dark": "semSuccess",
      "Actions.Blue": "accentPrimary",
      "Actions.Blue.Dark": "accentPrimary",
      "Actions.Grey": "fgSubtle",
      "Actions.Grey.Dark": "fgSubtle",
      "Actions.GreyInline": "fgSubtle",
      "Actions.GreyInline.Dark": "fgSubtle",
      "Objects.Grey": "fgSubtle",
      "Objects.Blue": "accentPrimary",
      "Objects.Green": "semSuccess",
      "Objects.GreenAndroid": "semSuccess",
      "Objects.Yellow": "accentSecondary",
      "Objects.YellowDark": "#D19022",
      "Objects.Purple": "synConstant",
      "Objects.Pink": "#FC906C",
      "Objects.Red": "semError",
      "Objects.RedStatus": "semError",
      "Objects.BlackText": "bgEditor",
      "Checkbox.Background.Default.Dark": "bgRaised",
      "Checkbox.Background.Disabled.Dark": "bgBase",
      "Checkbox.Background.Selected.Dark": "accentPrimary",
      "Checkbox.Border.Default.Dark": "borderStrong",
      "Checkbox.Border.Disabled.Dark": "borderDefault",
      "Checkbox.Border.Selected.Dark": "accentPrimary",
      "Checkbox.Foreground.Selected.Dark": "fgInverse",
      "Checkbox.Foreground.Disabled.Dark": "fgDisabled",
      "Checkbox.Focus.Wide.Dark": "#4C8DF673",
      "Checkbox.Focus.Thin.Default.Dark": "accentPrimary",
      "Checkbox.Focus.Thin.Selected.Dark": "accentPrimary",
      "Tree.iconColor.Dark": "fgMuted"
    }
  },
  "iconColorsOnSelection": {
    "#7C7F86": "#D4D7DE",
    "#9C9FA6": "#D4D7DE"
  }
}
```

### 15.3 `acme-dark.xml` (abridged)

The full generated scheme has 119 `<colors>` options and 308 `<attributes>` entries. Structure and the parts most often got wrong:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<scheme name="Acme Dark" version="142" parent_scheme="Darcula">
  <metaInfo>
    <property name="ide">PhpStorm</property>
    <property name="originalScheme">Acme Dark</property>
  </metaInfo>

  <colors>
    <option name="CARET_COLOR" value="4c8df6" />
    <option name="CARET_ROW_COLOR" value="21242a" />
    <option name="SELECTION_BACKGROUND" value="283854" />
    <option name="GUTTER_BACKGROUND" value="1a1d23" />
    <option name="LINE_NUMBERS_COLOR" value="5d6067" />
    <option name="INDENT_GUIDE" value="2d3036" />
    <option name="CONSOLE_BACKGROUND_KEY" value="1a1d23" />
    <!-- ... 112 more <colors> options ... -->
    <option name="ADDED_LINES_COLOR" value="365c4a" />
    <option name="MODIFIED_LINES_COLOR" value="324967" />
    <option name="DELETED_LINES_COLOR" value="623b3b" />
    <option name="FILESTATUS_ADDED" value="5cc98a" />
    <option name="ScrollBar.thumbColor" value="d4d7de33" />
    <option name="BLOCK_TERMINAL_DEFAULT_BACKGROUND" value="1a1d23" />
  </colors>

  <attributes>
    <option name="TEXT">
      <value>
        <option name="FOREGROUND" value="d4d7de" />
        <option name="BACKGROUND" value="1a1d23" />
      </value>
    </option>
    <option name="DEFAULT_KEYWORD">
      <value>
        <option name="FOREGROUND" value="4c8df6" />
        <option name="FONT_TYPE" value="1" />
      </value>
    </option>
    <option name="DEFAULT_STRING">
      <value>
        <option name="FOREGROUND" value="5cc98a" />
      </value>
    </option>
    <option name="DEFAULT_LINE_COMMENT">
      <value>
        <option name="FOREGROUND" value="81858b" />
        <option name="FONT_TYPE" value="2" />
      </value>
    </option>
    <option name="ERRORS_ATTRIBUTES">
      <value>
        <option name="EFFECT_COLOR" value="da685e" />
        <option name="EFFECT_TYPE" value="2" />
        <option name="ERROR_STRIPE_COLOR" value="da685e" />
      </value>
    </option>
    <!-- ... the rest of DEFAULT_*, inspections, search, inlays, diff, debugger ... -->

    <option name="CONSOLE_RED_OUTPUT">
      <value>
        <option name="FOREGROUND" value="dd6b60" />
        <option name="BACKGROUND" value="dd6b60" />
      </value>
    </option>
    <option name="CONSOLE_GRAY_OUTPUT">
      <value>
        <option name="FOREGROUND" value="9c9fa6" />
        <option name="BACKGROUND" value="9c9fa6" />
      </value>
    </option>
    <option name="CONSOLE_DARKGRAY_OUTPUT">
      <value>
        <option name="FOREGROUND" value="5d6067" />
        <option name="BACKGROUND" value="5d6067" />
      </value>
    </option>
    <option name="CONSOLE_WHITE_OUTPUT">
      <value>
        <option name="FOREGROUND" value="d4d7de" />
        <option name="BACKGROUND" value="d4d7de" />
      </value>
    </option>
    <!-- ... the other 12 CONSOLE_* ANSI keys, then the 16 BLOCK_TERMINAL_* ... -->

    <option name="PHP_TAG">
      <value>
        <option name="FOREGROUND" value="dba75c" />
      </value>
    </option>
    <option name="PHP_SCRIPTING_BACKGROUND"><value /></option>
    <option name="PHP_VAR" baseAttributes="DEFAULT_LOCAL_VARIABLE" />
    <option name="PHP_PARAMETER" baseAttributes="DEFAULT_PARAMETER" />
    <option name="PHP_INSTANCE_FIELD" baseAttributes="DEFAULT_INSTANCE_FIELD" />
    <option name="PHP_STRING" baseAttributes="DEFAULT_STRING" />
    <option name="PHP_IDENTIFIER" baseAttributes="DEFAULT_IDENTIFIER" />
    <option name="PHP_CONCATENATION">
      <value>
        <option name="FOREGROUND" value="9c9fa6" />
      </value>
    </option>
    <option name="PHP_EXEC_COMMAND_ID" baseAttributes="DEFAULT_STRING" />
    <option name="PHP_HEREDOC_ID">
      <value>
        <option name="FOREGROUND" value="4c8df6" />
      </value>
    </option>
    <option name="PHP_HEREDOC_CONTENT" baseAttributes="DEFAULT_STRING" />
    <option name="PHP_PREDEFINED SYMBOL">
      <value>
        <option name="FOREGROUND" value="fd8a96" />
      </value>
    </option>
    <option name="PHP_ATTRIBUTE">
      <value>
        <option name="FOREGROUND" value="dba75c" />
      </value>
    </option>
    <option name="PHP_NAMED_ARGUMENT">
      <value>
        <option name="FOREGROUND" value="d4d7de" />
        <option name="FONT_TYPE" value="2" />
      </value>
    </option>
    <option name="PHP_PRIMITIVE_TYPE_HINT">
      <value>
        <option name="FOREGROUND" value="4c8df6" />
      </value>
    </option>
    <option name="MAGIC_MEMBER_ACCESS">
      <value>
        <option name="FOREGROUND" value="d4d7de" />
        <option name="FONT_TYPE" value="2" />
      </value>
    </option>
    <!-- ... Blade, Twig, HTML, CSS, JS, JSON, YAML, Markdown, regex ... -->
  </attributes>
</scheme>
```

### 15.4 `plugin.xml`

See §12.2 — unchanged except for names and ids.

---

## 16. Validation checklist

Run every item before shipping. Most are mechanical and a generator should self-check them.

### 16.1 Syntactic

- [ ] `.theme.json` parses as JSON. No trailing commas, no comments (JSON5 is not accepted).
- [ ] The editor scheme parses as XML.
- [ ] Every `.theme.json` colour literal starts with `#` and is 7 or 9 characters.
- [ ] Every editor-scheme value is 6 or 8 hex digits with **no** `#`.
- [ ] Every string value in `ui` is either a `#` literal, a defined key in `colors`, a border/insets string (`n,n,n,n[,hex]`), or a boolean/number. **Anything else is a silent no-op.**
- [ ] No `ui` or `ColorPalette` reference points at an undefined `colors` token. (The reverse is fine and expected: the `colors` block carries the whole §1.12 token table, including the syntax and ANSI tokens that only the editor scheme XML consumes.)
- [ ] Integer keys (`underlineHeight`, `arc`, `rowHeight`, `*Insets`, `*Size`, …) received numbers, not hex strings.
- [ ] `themeProvider@path` in `plugin.xml` matches the actual resource path, leading slash included.
- [ ] `editorScheme` in each `.theme.json` matches the actual XML resource path.
- [ ] Every `themeProvider@id` is unique within the plugin and stable across releases.

### 16.2 Semantic

- [ ] `"dark"` matches reality (`L(bgEditor) < L(fgDefault)`).
- [ ] `parent_scheme` is `Darcula` for dark schemes, `Default` for light.
- [ ] `TEXT`'s `BACKGROUND`, `Editor.background`, `CONSOLE_BACKGROUND_KEY` and `GUTTER_BACKGROUND` are all the same colour.
- [ ] `PHP_SCRIPTING_BACKGROUND` is explicitly cleared with `<value />`.
- [ ] `PHP_PREDEFINED SYMBOL` contains a space, not an underscore.
- [ ] All four `ScrollBar` families are present (plain, `.Transparent.`, `.Mac.`, `.Mac.Transparent.`).
- [ ] `FileColor.*` values carry an alpha channel.
- [ ] Icon palette uses `.Dark`-suffixed keys for `Actions.*` / `Checkbox.*` / `Tree.iconColor` in a dark theme, and unsuffixed `Objects.*` always.
- [ ] `Objects.BlackText` is set to the editor background, not the foreground.
- [ ] The 16 `CONSOLE_*` ANSI keys use the irregular naming (`GRAY` = 7, `DARKGRAY` = 8, `WHITE` = 15) and each sets both `FOREGROUND` and `BACKGROUND`.
- [ ] No key from the "does not exist" list in §6.6 was emitted.
- [ ] `until-build` is absent from `plugin.xml` and `ideaVersion`.

### 16.3 Perceptual

- [ ] Every contrast floor in §1.5 passes. Report any that had to be repaired.
- [ ] The surface ramp spans ΔL ≤ 0.09 and `bgEditor` is at the extreme.
- [ ] `syn.keyword` vs `syn.string` differ by ΔH ≥ 45° or ΔL ≥ 0.15.
- [ ] No background token has OKLCH chroma above 0.012.
- [ ] Diff backgrounds sit below 1.6:1 against `bgEditor` — syntax must remain readable inside a diff.
- [ ] `DEFAULT_TEMPLATE_LANGUAGE_COLOR` sits below 1.1:1 against `bgEditor`.
- [ ] No mix of a warm colour into a cool background produced an unintended purple (§14, rectangular OKLab).
- [ ] At most one syntax role is bold.

### 16.4 Manual smoke test in the IDE

Open one file of each and look:

1. A PHP class with a docblock, a PHP 8 attribute, typed properties, a heredoc and a `match`.
2. A `.blade.php` with directives and `{{ }}` echoes — check there is no grey band behind the PHP.
3. `composer.json`, a `.env`, a `docker-compose.yml`, a migration.
4. `php artisan route:list` and a failing `phpunit` run in the terminal — check ANSI colours.
5. A Git diff view with added/modified/deleted lines, and the Git log graph.
6. An Xdebug breakpoint stopped on a line.
7. Settings dialog, Search Everywhere, the completion popup, a right-click context menu.
8. The Project tool window with modified/added/ignored files visible.

---

## 17. Common failure modes

| Symptom | Cause |
|---|---|
| A key "does nothing" | Typo, or the key doesn't exist. Both are silent. Check §4–§6 or the LaF Defaults list. |
| Colour comes out black | Hex written without `#` in `.theme.json`, or with `#` in the XML. |
| One panel stays Darcula-grey | A platform key not covered by `*` and not set explicitly. Platform keys register lazily; the wildcard misses them. |
| Grey band behind PHP inside HTML | `PHP_SCRIPTING_BACKGROUND` not cleared. |
| Checkbox glyphs unchanged | Checkbox/radio glyphs are SVG icons — recolour via `icons.ColorPalette`, not `CheckBox.*`. |
| Icons unchanged in a dark theme | Wrote `Actions.Blue` instead of `Actions.Blue.Dark`. |
| `Objects.Yellow.Dark` ignored | That key doesn't exist; `Objects.*` has no dark variants. |
| Icons vanish on selected rows | Selection too tinted; set `iconColorsOnSelection`. |
| Console colours wrong for bright black/white | Mapped `CONSOLE_*` ANSI slots by name instead of by index — see the §9.2 table. |
| Purple "deleted lines" gutter | Polar hue interpolation in `mix()`. Use rectangular OKLab. |
| Comments unreadable | Skipped the §1.5 repair loop on `synComment`. |
| Theme resets for users after an update | A `themeProvider@id` changed. |
| Plugin stops loading at the next IDE release | `until-build` was set. |
| Editing `.theme.json` while `runIde` is up changes nothing | Theme files are not hot-reloaded. Restart `runIde`. |
| Everything unstyled for one language | `parent_scheme` missing, so nothing was inherited. |

---

## 18. Prompt template

Give a generating model this document plus the following instruction block.

```
You are generating a JetBrains IDE theme plugin. Follow the attached
spec ("PhpStorm / IntelliJ Platform Theme Generation Spec") exactly.

INPUT
  name:     <theme family name>
  id:       <reverse-DNS plugin id>
  author:   <name>
  palette:  C1 <#hex anchor>
            C2 <#hex ink>
            C3 <#hex primary accent>
            C4 <#hex secondary accent>
            C5 <#hex tertiary accent>
  variants: <dark | darker | light | contrast | muted | vivid, one or more>

PROCEDURE
  1. Run §1 to build the token table. Show it, with the §1.5 contrast
     audit, before writing any file. State every repair the loop made.
  2. For each variant, apply the §1.11 transformation to the seeds and
     re-run §1 from the top. Do not hand-tune the output.
  3. Emit one .theme.json per variant using §2–§7. Every ui value must be
     a token reference, a #hex literal, a number, a boolean, or a
     border/insets string. Emit every key listed in §4 and §5.
  4. Emit one editor scheme XML per variant using §8–§11. Set
     parent_scheme. Clear PHP_SCRIPTING_BACKGROUND. Remember the space in
     PHP_PREDEFINED SYMBOL.
  5. Emit plugin.xml (§12.2), build.gradle.kts (§12.3), settings.gradle.kts
     and gradle.properties. Generate a fresh UUID per themeProvider.
  6. Run the §16 checklist and report the result of every item. Do not
     claim a pass you did not verify.

OUTPUT
  Complete file contents, no ellipses, no "... rest unchanged". If a file
  is long, emit it in full anyway.

CONSTRAINTS
  - Never write a raw hex into a ui key; use the colors block.
  - Never invent a key name. If unsure it exists, omit it.
  - Do not set fonts unless asked.
  - Do not emit a background image.
```

---

## 19. Sources

- [Theme Structure](https://plugins.jetbrains.com/docs/intellij/theme-structure.html) — IntelliJ Platform Plugin SDK
- [Customizing Themes – Icons and UI Controls](https://plugins.jetbrains.com/docs/intellij/themes-customize.html)
- [Themes – Editor Schemes and Background Images](https://plugins.jetbrains.com/docs/intellij/themes-extras.html)
- [Exposing Theme Metadata](https://plugins.jetbrains.com/docs/intellij/themes-metadata.html)
- [Creating a Theme Project](https://plugins.jetbrains.com/docs/intellij/creating-theme-project.html)
- [Color Scheme Management](https://plugins.jetbrains.com/docs/intellij/color-scheme-management.html)
- [Icons style / palette](https://plugins.jetbrains.com/docs/intellij/icons-style.html)
- [UI Inspector](https://plugins.jetbrains.com/docs/intellij/internal-ui-inspector.html) · [LaF Defaults](https://plugins.jetbrains.com/docs/intellij/internal-ui-laf-defaults.html)
- [IntelliJ Platform Gradle Plugin 2.x](https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html)
- [Themes in IntelliJ-based IDEs](https://blog.jetbrains.com/platform/2021/10/themes-in-intellij-based-ides/) — JetBrains blog
- [Managing plugins](https://www.jetbrains.com/help/idea/managing-plugins.html) · [IDE directories](https://www.jetbrains.com/help/idea/directories-used-by-the-ide-to-store-settings-caches-plugins-and-logs.html)
- Key lists: [IntelliJPlatform.themeMetadata.json](https://github.com/JetBrains/intellij-community/blob/master/platform/platform-resources/src/themes/metadata/IntelliJPlatform.themeMetadata.json), [JDK.themeMetadata.json](https://github.com/JetBrains/intellij-community/blob/master/platform/platform-resources/src/themes/metadata/JDK.themeMetadata.json), [DefaultColorSchemesManager.xml](https://github.com/JetBrains/intellij-community/blob/master/platform/platform-resources/src/DefaultColorSchemesManager.xml)
- Reference themes: [HighContrast.theme.json](https://github.com/JetBrains/intellij-community/blob/master/platform/platform-resources/src/themes/HighContrast.theme.json), [ReSharperDark.theme.json](https://github.com/JetBrains/rider-theme-pack/blob/master/src/main/resources/ReSharperDark.theme.json), [dracula/jetbrains](https://github.com/dracula/jetbrains), [catppuccin/jetbrains](https://github.com/catppuccin/jetbrains)
- PHP key verification: [brendt/phpstorm-light-lite-theme](https://github.com/brendt/phpstorm-light-lite-theme/blob/master/Light_Lite.icls), [brendt/phpstorm-photon-theme](https://github.com/brendt/phpstorm-photon-theme), [ho3ein-mola/PhpStorm_Color_Scheme](https://github.com/ho3ein-mola/PhpStorm_Color_Scheme), [simshaun/s2-phpstorm-colorschemes](https://github.com/simshaun/s2-phpstorm-colorschemes), [freekmurze/phpstorm-color-schemes](https://github.com/freekmurze/phpstorm-color-schemes)
