// Part of phpstorm-theme-generator — see LICENSE.
/**
 * Style options: the non-colour decisions.
 *
 * Material Theme UI exposes these as live sliders, which needs a code plugin
 * calling UIManager.put() at runtime. Our sliders live in the generator
 * instead: we bake the chosen value — and since we generate rather than
 * hand-author, baking is cheap.
 * MTUI ships 88 theme files to cover its contrast x compact combinations; we
 * emit whichever combination is asked for.
 *
 * Everything here is applied as a post-pass over the finished `ui` object, so
 * the emitter stays a straight-line mapping and all the option logic lives in
 * one readable place.
 */

import { ICON_SETS } from './icon-sets.js';

export const DEFAULT_OPTIONS = {
  density: 24,               // tree row height in px, 18..32; or compact | default | comfortable
  radius: 6,                 // selection arc in px, 0..12; or sharp | soft | round
  underlineHeight: 2,        // 1..4
  borderless: false,
  accentScrollbars: false,
  italicComments: true,
  boldKeywords: true,
  monochromeIcons: false,
  fileIcons: null,           // an icon set id from icon-sets.js; bundles the icons + their IconProvider
  font: null,                // {editor, editorSize, lineSpacing, ligatures, console, consoleSize}
  wallpaper: null            // {path, transparency, fill, anchor} — set by package.js
};

/** Row heights, header heights and insets, in px. The named anchors the slider interpolates between. */
export const DENSITY = {
  compact:     { treeRow: 20, listRow: 18, toolHeader: 26, toolbarBtn: 30, stripeBtn: 26,
                 sepHeight: 6,  tabInsets: '0,8,0,8',   menuInset: 2 },
  default:     { treeRow: 24, listRow: 22, toolHeader: 30, toolbarBtn: 34, stripeBtn: 30,
                 sepHeight: 9,  tabInsets: '0,12,0,12', menuInset: 4 },
  comfortable: { treeRow: 30, listRow: 28, toolHeader: 36, toolbarBtn: 40, stripeBtn: 36,
                 sepHeight: 12, tabInsets: '0,16,0,16', menuInset: 6 }
};

/** Corner radii, in px. Anchors, as above. */
export const RADIUS = {
  sharp: { component: 0, selection: 0, notification: 0, chip: 0, island: 0, underline: 0 },
  soft:  { component: 6, selection: 6, notification: 8, chip: 4, island: 12, underline: 2 },
  round: { component: 10, selection: 10, notification: 14, chip: 8, island: 18, underline: 4 }
};

export const DENSITY_RANGE = [18, 32];
export const RADIUS_RANGE = [0, 12];

/* Piecewise-linear through the anchors, keyed on `axis`; the end segments
   extend past the outer anchors. Exact at every anchor. */
function interpolate(anchors, axis, x) {
  const pts = Object.values(anchors).sort((a, b) => a[axis] - b[axis]);
  let i = pts.findIndex(p => x <= p[axis]);
  i = i < 0 ? pts.length - 1 : Math.max(1, i);
  const a = pts[i - 1], b = pts[i], t = (x - a[axis]) / (b[axis] - a[axis]);
  const lerp = (u, v) => Math.max(0, Math.round(u + (v - u) * t));
  const out = {};
  for (const k of Object.keys(a)) {
    out[k] = typeof a[k] === 'string'
      ? a[k].split(',').map((n, j) => lerp(+n, +b[k].split(',')[j])).join(',')
      : lerp(a[k], b[k]);
  }
  return out;
}
export const densityMetrics = px => interpolate(DENSITY, 'treeRow', px);
export const radiusMetrics = px => interpolate(RADIUS, 'selection', px);

function resolveScale(value, anchors, axis, [min, max], what) {
  if (typeof value === 'string' && anchors[value]) return anchors[value][axis];
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new TypeError(`unknown ${what}: ${value}`);
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function resolveOptions(partial = {}) {
  const o = { ...DEFAULT_OPTIONS, ...partial };
  o.fileIcons = o.fileIcons === true ? 'heroicons' : (o.fileIcons || null);
  if (o.fileIcons && !ICON_SETS[o.fileIcons]) throw new TypeError(`unknown icon set: ${o.fileIcons}`);
  o.density = resolveScale(o.density, DENSITY, 'treeRow', DENSITY_RANGE, 'density');
  o.radius = resolveScale(o.radius, RADIUS, 'selection', RADIUS_RANGE, 'radius');
  o.underlineHeight = Math.max(0, Math.min(4, Math.round(o.underlineHeight)));
  return o;
}

/**
 * Overwrite the option-driven keys on a finished `ui` object.
 * Mutates and returns `ui`; `colors` may gain new tokens.
 */
export function applyStyleOptions(ui, colors, T, options) {
  const o = resolveOptions(options);
  const d = densityMetrics(o.density);
  const r = radiusMetrics(o.radius);

  /* ---- density ---- */
  ui.Tree.rowHeight = d.treeRow;
  ui.List.rowHeight = d.listRow;
  ui.SettingsTree.rowHeight = d.treeRow;
  ui.VersionControl.Log.Commit.rowHeight = d.treeRow;
  ui.ToolWindow.Header.height = d.toolHeader;
  ui.MainToolbar.Button.size = d.toolbarBtn;
  ui.StripeToolbar.Button.size = d.stripeBtn;
  ui.StripeToolbar.Button.iconSize = Math.round(d.stripeBtn * 0.66);
  ui.MainToolbar.Button.iconSize = Math.round(d.toolbarBtn * 0.59);
  ui.PopupMenuSeparator.height = d.sepHeight;
  ui.PopupMenuSeparator.stripeIndent = d.menuInset;
  ui.EditorTabs.tabInsets = d.tabInsets;
  ui.TabbedPane.tabHeight = d.toolHeader;
  ui.Menu.Selection.innerInsets = `${d.menuInset},${d.menuInset * 2},${d.menuInset},${d.menuInset * 2}`;

  /* ---- corner radius ---- */
  ui.Component.arc = r.component;
  ui.Button.arc = r.component;
  ui.Tree.Selection.arc = r.selection;
  ui.Popup.Selection.arc = r.selection;
  ui.Menu.Selection.arc = r.selection;
  ui.PopupMenu.Selection.arc = r.selection;
  ui.MainMenu.Selection.fullScreenArc = r.selection;
  ui.Notification.arc = r.notification;
  ui.GotItTooltip.arc = r.notification;
  ui.Code.Inline.borderRadius = r.chip;
  ui.Code.Block.borderRadius = r.chip + 2;
  ui.Shortcut.borderRadius = r.chip;
  ui.Island.arc = r.island;
  ui.EditorTabs.underlineArc = Math.min(r.underline, o.underlineHeight);

  /* ---- tab underline thickness ---- */
  const uh = o.underlineHeight;
  ui.EditorTabs.underlineHeight = uh;
  ui.DefaultTabs.underlineHeight = uh;
  ui.DebuggerTabs.underlineHeight = uh;
  ui.ToolWindow.HeaderTab.underlineHeight = uh;
  ui.TabbedPane.tabSelectionHeight = uh;

  /* ---- borderless ----
     MTUI calls this "Toggle Borderless" and does it at runtime. Baking it
     means pointing every border token at a transparent colour rather than
     deleting keys, so nothing falls back to the base look-and-feel. */
  if (o.borderless) {
    colors.borderTransparent = '#00000000';
    for (const key of ['borderDefault', 'borderStrong', 'separator']) colors[key] = '#00000000';
    ui['*'].borderColor = 'borderTransparent';
    ui['*'].separatorColor = 'borderTransparent';
    ui.Popup.paintBorder = false;
    ui.ToolTip.paintBorder = false;
    ui.Popup.borderWidth = 0;
    ui.PopupMenu.borderWidth = 0;
    ui.NavBar.borderWidth = 0;
    ui.Window.border = '0,0,0,0';
    ui.Window.undecorated.border = '0,0,0,0';
  }

  /* ---- accent scrollbars ---- */
  if (o.accentScrollbars) {
    colors.sbThumb = T.accentPrimaryMuted;
    colors.sbThumbHover = T.accentPrimary;
  }

  /* ---- wallpaper ---- */
  if (o.wallpaper) {
    return { ui, background: {
      image: o.wallpaper.path,
      transparency: o.wallpaper.transparency ?? 12,
      fill: o.wallpaper.fill ?? 'scale',
      anchor: o.wallpaper.anchor ?? 'center'
    }, emptyFrameBackground: {
      image: o.wallpaper.path,
      transparency: (o.wallpaper.transparency ?? 12) + 8,
      fill: 'scale', anchor: 'center'
    } };
  }
  return { ui };
}

/** Collapse the icon palette to a single neutral, per Atom Material Icons' monochrome filter. */
export function monochromeIconPalette(palette, T) {
  const out = {};
  for (const key of Object.keys(palette)) {
    out[key] = key.startsWith('Checkbox.') ? palette[key]
      : key === 'Objects.BlackText' ? palette[key]
      : 'fgMuted';
  }
  return out;
}

/** Attribute keys whose FONT_TYPE the comment/keyword toggles control. */
export const COMMENT_ATTRS = new Set([
  'DEFAULT_LINE_COMMENT', 'DEFAULT_BLOCK_COMMENT', 'DEFAULT_DOC_COMMENT',
  'DEFAULT_DOC_COMMENT_TAG', 'DEFAULT_DOC_COMMENT_TAG_VALUE',
  'CSS.COMMENT', 'TWIG_COMMENT', 'YAML_COMMENT',
  'JS.LINE_COMMENT', 'JS.BLOCK_COMMENT', 'JS.DOC_COMMENT'
]);
export const KEYWORD_ATTRS = new Set(['DEFAULT_KEYWORD', 'JS.KEYWORD']);
