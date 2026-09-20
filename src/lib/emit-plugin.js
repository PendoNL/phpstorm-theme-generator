// Part of phpstorm-theme-generator — see LICENSE.
/**
 * plugin.xml, build.gradle.kts and the plugin icon.
 *
 * themeProvider ids are derived deterministically from the plugin id + variant
 * slug, so they stay stable across regenerations. That is load-bearing: the id
 * is the persisted identity of the look-and-feel, and changing it silently
 * resets the selected theme for every user.
 */

/* ---------- plugin scaffolding ---------- */
export function uuidFrom(str){
  let a=0x811c9dc5, out=[];
  for(let i=0;i<16;i++){
    for(let j=0;j<str.length;j++){a^=str.charCodeAt(j)+i*31;a=Math.imul(a,0x01000193)>>>0;}
    out.push((a&0xff).toString(16).padStart(2,'0'));
  }
  const hx=out.join('');
  return `${hx.slice(0,8)}-${hx.slice(8,12)}-4${hx.slice(13,16)}-a${hx.slice(17,20)}-${hx.slice(20,32)}`;
}
export function buildPluginXml(meta,variants,{iconProvider=null}={}){
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const provs=variants.map(v=>
`    <themeProvider id="${uuidFrom(meta.id+'::'+v.slug)}"
                   path="/themes/${v.slug}.theme.json"/>`).join('\n');
  return `<idea-plugin>
  <id>${esc(meta.id)}</id>
  <name>${esc(meta.family)}</name>
  <version>1.0.0</version>
  <vendor>${esc(meta.author)}</vendor>

  <idea-version since-build="233"/>

  <depends>com.intellij.modules.platform</depends>

  <description><![CDATA[
    <p>${esc(meta.family)} &mdash; a theme family generated from five seed colours.</p>
    <p>Variants: ${variants.map(v=>esc(v.name)).join(', ')}.</p>
  ]]></description>

  <extensions defaultExtensionNs="com.intellij">
${provs}${iconProvider?`
    <iconProvider implementation="${iconProvider}" order="first"/>`:''}
  </extensions>${iconProvider?`

  <applicationListeners>
    <listener class="${iconProvider}"
              topic="com.intellij.ide.ui.LafManagerListener"/>
  </applicationListeners>`:''}
</idea-plugin>
`;
}
export function buildGradle(meta,{java=false}={}){
  return `plugins {
${java?'    id("java")\n':''}    id("org.jetbrains.intellij.platform") version "2.19.0"
}

group = "${meta.id.split('.').slice(0,-1).join('.')||'com.example'}"
version = "1.0.0"

repositories {
    mavenCentral()
    intellijPlatform { defaultRepositories() }
}

dependencies {
    intellijPlatform {
        phpstorm("2024.3")
    }
}

intellijPlatform {
    buildSearchableOptions = false

    pluginConfiguration {
        id = "${meta.id}"
        name = "${meta.family}"
        version = project.version.toString()
        ideaVersion {
            sinceBuild = "233"
            untilBuild = provider { null }
        }
    }
}
`;
}
/* The terms every generated theme ships under. They travel inside the plugin
   so they survive being passed on; the icon sets keep their own notices. */
export function buildThemeLicense(meta){
  return `${meta.family} - by ${meta.author}
Generated with phpstorm-theme-generator
https://github.com/PendoNL/phpstorm-theme-generator

This theme is licensed under the Creative Commons
Attribution-NonCommercial-ShareAlike 4.0 International licence (CC BY-NC-SA 4.0):
https://creativecommons.org/licenses/by-nc-sa/4.0/

In short: use it anywhere, including at work. Share it and change it, as long
as you give credit and keep these terms. Do not sell it, and if you publish it
- on the JetBrains Marketplace or anywhere else - publish it free of charge.

Bundled file icons, if any, remain under their own authors' licences; see the
notices in forge-icons/.
`;
}
export const PLUGIN_ICON=`<svgxmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <rect width="40" height="40" rx="8" fill="#COL1"/>
  <rect x="7" y="9"  width="26" height="4" rx="2" fill="#COL3"/>
  <rect x="7" y="18" width="18" height="4" rx="2" fill="#COL4"/>
  <rect x="7" y="27" width="22" height="4" rx="2" fill="#COL5"/>
</svg>
`;
