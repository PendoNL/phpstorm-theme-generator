// Part of phpstorm-theme-generator — see LICENSE.
/**
 * Turns a palette into a complete, installable plugin.
 *
 * Shared by the web UI and the CLI so there is exactly one definition of what
 * "a plugin" is. Returns byte arrays, not files — callers decide where they go.
 */
import { VARIANTS, deriveTokens } from './derive.js';
import { buildThemeJson } from './emit-theme.js';
import { buildSchemeXml } from './emit-scheme.js';
import { buildPluginXml, buildGradle, buildThemeLicense, PLUGIN_ICON } from './emit-plugin.js';
import { zipBytes } from './zip.js';
import { resolveOptions } from './options.js';
import { wallpaperPng } from './png.js';
import { buildFileIconEntries } from './file-icons.js';
import { ICON_PROVIDER_CLASS_NAME, ICON_PROVIDER_JAVA, iconProviderClassBytes } from './icon-provider-class.js';

export const slugify = s =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme';

/**
 * @param {object}   opts
 * @param {string[]} opts.palette  five #RRGGBB seeds, in role order
 * @param {string}   opts.family   display name, e.g. "Custom Theme"
 * @param {string}   opts.id       plugin id, e.g. "nl.pendo.custom-theme"
 * @param {string}   opts.author   vendor string
 * @param {string[]} [opts.variants] variant ids; defaults to all of them
 * @param {object}   [opts.options]  style options — see options.js
 */
export function buildPlugin({ palette, family = 'Custom Theme', id, author = 'phpstorm-theme-generator',
                              variants = VARIANTS.map(v => v.id), options = {} } = {}) {
  const opts = resolveOptions(options);
  if (!Array.isArray(palette) || palette.length !== 5)
    throw new TypeError('palette must be exactly 5 hex colours');
  for (const c of palette)
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new TypeError(`bad hex: ${c}`);

  const root = slugify(family);
  const pluginId = id || `com.example.${root}`;
  const meta = { family, id: pluginId, author };

  const chosen = VARIANTS.filter(v => variants.includes(v.id));
  if (!chosen.length) throw new Error('no known variants selected');

  const built = chosen.map(v => {
    const name = `${family} ${v.label}`;
    return { ...v, name, slug: slugify(name), res: deriveTokens(palette, v.id) };
  });

  const iconSvg = PLUGIN_ICON
    .replace('#COL1', palette[0]).replace('#COL3', palette[2])
    .replace('#COL4', palette[3]).replace('#COL5', palette[4]);

  // --- the jar: what the IDE actually reads ---
  const jarEntries = [
    { path: 'META-INF/' },
    { path: 'META-INF/MANIFEST.MF', body: 'Manifest-Version: 1.0\r\nCreated-By: phpstorm-theme-generator\r\n\r\n' },
    { path: 'META-INF/plugin.xml', body: buildPluginXml(meta, built,
        { iconProvider: opts.fileIcons ? ICON_PROVIDER_CLASS_NAME : null }) },
    { path: 'META-INF/pluginIcon.svg', body: iconSvg },
    { path: 'LICENSE.txt', body: buildThemeLicense(meta) },
    { path: 'themes/' }
  ];
  for (const v of built) {
    // Each variant gets its own wallpaper: it is derived from that variant's
    // own tokens, so a light theme does not inherit the dark one's wash.
    let perVariant = opts;
    if (opts.wallpaper) {
      const path = `themes/${v.slug}-bg.png`;
      jarEntries.push({ path, body: wallpaperPng(v.res.T) });
      perVariant = { ...opts, wallpaper: { ...opts.wallpaper, path: '/' + path } };
    }
    jarEntries.push({ path: `themes/${v.slug}.theme.json`,
      body: buildThemeJson(v.res, { name: v.name, author, slug: v.slug }, perVariant) });
    jarEntries.push({ path: `themes/${v.slug}.xml`,
      body: buildSchemeXml(v.res, { name: v.name }, perVariant) });
  }
  /* File icons need code - an IconProvider - which a theme plugin otherwise
     never has. The class is precompiled and generic (it only reads the rules
     file next to it), so the zip is still ready to install as downloaded. */
  const classPath = ICON_PROVIDER_CLASS_NAME.replace(/\./g, '/');
  if (opts.fileIcons) {
    jarEntries.push(...buildFileIconEntries(opts.fileIcons, built.map(v => v.name)));
    jarEntries.push({ path: classPath.split('/')[0] + '/' });
    jarEntries.push({ path: classPath + '.class', body: iconProviderClassBytes() });
  }
  const jar = zipBytes(jarEntries);

  // --- the distribution zip: <name>/lib/<name>.jar ---
  const dist = [
    { path: `${root}/` },
    { path: `${root}/lib/` },
    { path: `${root}/lib/${root}.jar`, body: jar }
  ];

  // --- an editable Gradle project, for people who want to hand-tune ---
  const src = [{ path: `${root}-src/` }];
  for (const e of jarEntries) {
    if (e.path.endsWith('/') || e.path.endsWith('MANIFEST.MF') || e.path.endsWith('.class')) continue;
    src.push({ path: `${root}-src/src/main/resources/${e.path}`, body: e.body });
  }
  if (opts.fileIcons)
    src.push({ path: `${root}-src/src/main/java/${classPath}.java`, body: ICON_PROVIDER_JAVA });
  src.push({ path: `${root}-src/build.gradle.kts`, body: buildGradle(meta, { java: opts.fileIcons }) });
  src.push({ path: `${root}-src/settings.gradle.kts`, body: `rootProject.name = "${root}"\n` });
  src.push({ path: `${root}-src/gradle.properties`,
    body: 'org.gradle.jvmargs=-Xmx2048m\nkotlin.stdlib.default.dependency=false\n' });

  return { root, meta, options: opts, variants: built, jarEntries, jar, dist, src,
           distZip: zipBytes(dist), srcZip: zipBytes(src) };
}
