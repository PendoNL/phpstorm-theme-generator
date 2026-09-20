// Part of phpstorm-theme-generator — see LICENSE.
/**
 * Browser UI. Everything here is DOM wiring; the generator itself is pure and
 * lives in ../lib, which is also what the CLI uses.
 */
import { VARIANTS, deriveTokens } from '../lib/derive.js';
import { cr, fromOklch } from '../lib/color.js';
import { buildPlugin, slugify } from '../lib/package.js';
import { DEFAULT_OPTIONS, densityMetrics, radiusMetrics } from '../lib/options.js';
import { wallpaperPng } from '../lib/png.js';
import { ICON_SETS } from '../lib/icon-sets.js';
import { FILE_ICON_SLOTS, fileIconFor, fileIconSvg } from '../lib/file-icons.js';
import { PHP_LINES, BLADE_LINES, GUT_PHP, TERM_HTML,
         renderCode, renderTree, renderDiff } from './preview.js';

const build = deriveTokens;

const $=s=>document.querySelector(s);
const ROLES=[
  ['C1','Anchor','editor background'],
  ['C2','Ink','default text'],
  ['C3','Primary accent','selection, keywords'],
  ['C4','Secondary accent','types, warnings'],
  ['C5','Tertiary accent','strings, success']
];
const PRESETS=[
  {n:'Pendo',     p:['#181D23','#D4D7DE','#4C8DF6','#E5A33C','#5CC98A']},
  {n:'Nord',      p:['#2E3440','#D8DEE9','#88C0D0','#EBCB8B','#A3BE8C']},
  {n:'Gruvbox',   p:['#282828','#EBDBB2','#83A598','#FABD2F','#B8BB26']},
  {n:'Rosé',      p:['#191724','#E0DEF4','#9CCFD8','#F6C177','#31748F']},
  {n:'Cobalt',    p:['#122738','#E1EFFF','#3AD900','#FFC600','#80FCFF']},
  {n:'Paper',     p:['#FBF9F3','#2B2A26','#3C6E9F','#B07B26','#4E7A45']}
];
const state={
  palette:[...PRESETS[0].p],
  count:5,
  variant:'dark',
  family:'Custom Theme',
  lang:'php',
  view:'preview',
  query:'',
  file:0,
  download:{mode:'all',set:['dark','light']},
  options:{...DEFAULT_OPTIONS}
};
let current=null, generated=null, audit={passed:0,total:0}, themeKeys=0;

function normHex(s){
  if(!s) return null;
  s=s.trim().replace(/^#/,'');
  if(/^[0-9a-f]{3}$/i.test(s)) s=s.split('').map(c=>c+c).join('');
  return /^[0-9a-f]{6}$/i.test(s)?'#'+s.toUpperCase():null;
}

/* ---- seed inputs ---- */
function buildSeedInputs(){
  $('#seeds').innerHTML=ROLES.map(([slot,role,note],i)=>`
    <div class="seed">
      <input type="color" id="col${i}" aria-label="${role} — ${note}">
      <div class="meta">
        <span class="role">${role}</span>
        <span class="rnote">${note}</span>
      </div>
      <input class="hexin" id="hex${i}" spellcheck="false" aria-label="${slot} hex">
    </div>`).join('');
  ROLES.forEach((_,i)=>{
    $('#col'+i).addEventListener('input',e=>{state.palette[i]=e.target.value.toUpperCase();syncInputs();render();});
    $('#hex'+i).addEventListener('change',e=>{
      const v=normHex(e.target.value);
      if(v){state.palette[i]=v;syncInputs();render();} else syncInputs();
    });
  });
}
/* The colours actually in play. The rest stay in state, so going back up to
   five brings back what was there rather than the derived stand-ins. */
const activePalette=()=>state.palette.slice(0,state.count);
function syncInputs(){
  state.palette.forEach((c,i)=>{ $('#col'+i).value=c; $('#hex'+i).value=c; });
  document.querySelectorAll('.seed').forEach((el,i)=>{ el.hidden=i>=state.count; });
  $('#seedcount').value=String(state.count);
  const key=state.palette.join();
  [...document.querySelectorAll('.preset')].forEach((b,i)=>
    b.setAttribute('aria-pressed',String(PRESETS[i].p.join()===key)));
}

/* ---- presets ---- */
function buildPresets(){
  const menu=$('#presetmenu'), btn=$('#btn-presets');
  const open=on=>{ menu.hidden=!on; btn.setAttribute('aria-expanded',String(on)); };
  btn.addEventListener('click',e=>{ e.stopPropagation(); open(menu.hidden); });
  document.addEventListener('click',e=>{ if(!menu.hidden&&!menu.contains(e.target)) open(false); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!menu.hidden){ open(false); btn.focus(); } });
  menu.innerHTML=PRESETS.map((p,i)=>
    `<button class="preset" data-i="${i}" aria-pressed="false"><span class="dots">${
      p.p.map(c=>`<i style="background:${c}"></i>`).join('')}</span>${p.n}</button>`).join('');
  menu.addEventListener('click',e=>{
    const b=e.target.closest('.preset'); if(!b) return;
    open(false);
    state.palette=[...PRESETS[+b.dataset.i].p];
    state.count=5;
    state.family=PRESETS[+b.dataset.i].n;
    $('#famname').value=state.family;
    syncInputs(); render();
  });
}

/* ---- variants ---- */
function buildVariants(){
  const row=(mode,label)=>`<div class="varrow" data-mode="${mode}" role="group" aria-label="${label} variants">
    <span class="varmode">${label}</span>`+VARIANTS.filter(v=>v.mode===mode).map(v=>
    `<button class="varbtn" data-v="${v.id}" aria-pressed="${v.id===state.variant}">
       <span class="chip" id="chip-${v.id}"><i></i></span>${v.label}</button>`).join('')+`</div>`;
  $('#varlist').innerHTML=row('dark','Dark')+row('light','Light')+row('other','Other');
  $('#varlist').addEventListener('click',e=>{
    const b=e.target.closest('.varbtn'); if(!b) return;
    state.variant=b.dataset.v; render();
  });
}
function paintVariantChips(){
  for(const v of VARIANTS){
    const r=build(activePalette(),v.id);
    const el=document.getElementById('chip-'+v.id);
    if(!el) continue;
    el.style.background=r.T.bgEditor;
    el.firstElementChild.style.background=r.T.accentPrimary;
    const btn=el.closest('.varbtn');
    btn.setAttribute('aria-pressed',String(v.id===state.variant));
  }
}

/* ---- style options ---------------------------------------------------
   These are the settings Material Theme UI exposes as live sliders. It can
   afford to, because it is a code plugin patching UIManager at runtime; we
   bake the value into the generated theme instead. The preview mirrors each
   one so the trade is visible before you download. */
function buildStyleControls(){
  /* "Default" leaves the IDE's own icons alone and keeps the plugin free of
     code; any set bundles its SVGs plus the small provider that serves them. */
  $('#opt-fileicons').innerHTML=`<option value="">Default</option>`
    +Object.entries(ICON_SETS).map(([id,s])=>`<option value="${id}">${s.label}</option>`).join('');
  $('#opt-fileicons').addEventListener('change',e=>{
    state.options.fileIcons=e.target.value||null; render();
  });

  const range=(id,key)=>$(id).addEventListener('input',e=>{
    state.options[key]=+e.target.value;
    $(id+'-out').textContent=e.target.value+'px';
    render();
  });
  range('#opt-density','density');
  range('#opt-radius','radius');
  range('#opt-underline','underlineHeight');

  const check=(id,key)=>$(id).addEventListener('change',e=>{
    state.options[key]=e.target.checked; render();
  });
  check('#opt-italic','italicComments');
  check('#opt-bold','boldKeywords');
  check('#opt-borderless','borderless');
  check('#opt-accentscroll','accentScrollbars');
  check('#opt-mono','monochromeIcons');
  check('#opt-wallpaper','wallpaper');

  for(const id of ['#opt-font','#opt-fontsize','#opt-linespacing','#opt-ligatures'])
    $(id).addEventListener('input',syncFont);
}

const FLAG_KEYS=['italicComments','boldKeywords','borderless','accentScrollbars',
                 'monochromeIcons','wallpaper'];
function syncStyleSummary(){
  const open=!$('#stylebox').hidden;
  const o=state.options;
  const on=FLAG_KEYS.filter(k=>o[k]).length;
  $('#style-summary').textContent = open ? ''
    : o.density+'px rows, '+o.radius+'px corners, '+on+' on';
  $('#style-caret').textContent = open ? '\u25B2' : '\u25BC';
  $('#btn-style').setAttribute('aria-expanded',String(open));
}

function syncFont(){
  const family=$('#opt-font').value.trim();
  const size=+$('#opt-fontsize').value||null;
  const spacing=+$('#opt-linespacing').value||null;
  const lig=$('#opt-ligatures').checked;
  const on=!!(family||size||spacing||lig);
  state.options.font = on
    ? {editor:family||null,editorSize:size,lineSpacing:spacing,ligatures:lig||null,
       console:null,consoleSize:null}
    : null;
  $('.fontbox .hintlet').textContent = on
    ? [family||'inherited',size?size+'px':null,spacing?spacing+' line':null,lig?'ligatures':null]
        .filter(Boolean).join(' \u00b7 ')
    : 'off \u2014 keeps your own';
  render();
}

/* Base64 without blowing the stack on a 100 KB raster. */
function bytesToBase64(bytes){
  let out='';
  for(let i=0;i<bytes.length;i+=0x8000)
    out+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
  return btoa(out);
}

function applyStyleToPreview(res){
  const ide=$('#ide');
  const o=state.options;
  const d=densityMetrics(o.density), r=radiusMetrics(o.radius);
  ide.style.setProperty('--o-row', d.treeRow+'px');
  ide.style.setProperty('--o-arc', r.selection+'px');
  ide.style.setProperty('--o-chip', r.chip+'px');
  ide.style.setProperty('--o-underline', o.underlineHeight+'px');
  ide.classList.toggle('borderless', o.borderless);
  ide.classList.toggle('no-italic', !o.italicComments);
  ide.classList.toggle('no-bold', !o.boldKeywords);

  if(o.borderless){
    ide.style.setProperty('--t-borderDefault','#00000000');
    ide.style.setProperty('--t-separator','#00000000');
  }
  if(o.monochromeIcons){
    for(const k of ['actionsBlue','actionsGreen','actionsYellow','actionsGrey',
                    'objectsPurple','objectsBlue'])
      ide.style.setProperty('--t-'+k, res.T.fgMuted);
  }
  /* Blank font fields write nothing to the theme, so they leave the preview
     on its defaults too. A named family only shows if this machine has it. */
  const f=o.font||{};
  const size=f.editorSize||null;
  const setOrClear=(k,v)=>v?ide.style.setProperty(k,v):ide.style.removeProperty(k);
  setOrClear('--o-font', f.editor ? JSON.stringify(f.editor)+',var(--mono)' : null);
  setOrClear('--o-font-size', size ? size+'px' : null);
  setOrClear('--o-line', (size||f.lineSpacing) ? Math.round((size||12)*(f.lineSpacing||1.5))+'px' : null);
  setOrClear('--o-liga', f.ligatures ? 'normal' : null);

  /* The same rules the bundled IconProvider applies, painted straight from
     the tokens the theme's icon palette will remap the placeholders to. */
  const set=o.fileIcons&&ICON_SETS[o.fileIcons];
  renderTree($('#tree'), set ? (name,isDir)=>{
    const hit=fileIconFor(name,isDir); if(!hit) return null;
    const token=o.monochromeIcons?'fgMuted':FILE_ICON_SLOTS[hit[1]].token;
    return fileIconSvg(o.fileIcons,hit[0],`var(--t-${token})`);
  } : null);
  $('#fileicons-note').textContent = set
    ? `${set.label} ${set.version}, ${set.spdx} licensed \u2014 ${set.note}. `
      +'Coloured per variant, shown only under these themes, and the plugin gains a small precompiled class.'
    : '';

  const editor=$('.editor');
  if(o.wallpaper){
    editor.style.backgroundImage =
      `url("data:image/png;base64,${bytesToBase64(wallpaperPng(res.T))}")`;
    editor.style.backgroundBlendMode='normal';
  } else {
    editor.style.backgroundImage='';
  }
}

/* ---- apply tokens to the preview ---- */
function applyPreviewVars(res){
  const ide=$('#ide');
  for(const [k,v] of Object.entries(res.T)) ide.style.setProperty('--t-'+k,v);
  for(const [k,v] of Object.entries(res.P)) ide.style.setProperty('--t-'+k,v);
}

/* ---- token list ---- */
const TOKEN_GROUPS=[
  ['Surfaces',['bgEditor','bgBase','bgRaised','bgSunken','bgOverlay','bgHover','bgPress']],
  ['Ink',['fgDefault','fgMuted','fgSubtle','fgDisabled','fgInverse']],
  ['Accents',['accentPrimary','accentPrimaryHover','accentPrimaryMuted','accentSecondary','accentTertiary']],
  ['Selection',['bgSelection','bgSelectionInactive','bgSelectionUi']],
  ['Semantic',['semError','semWarning','semSuccess','semInfo','semModify']],
  ['Structure',['borderDefault','borderStrong','separator','caret','caretRow','guideIndent','guideIndentOn']],
  ['Syntax',['synKeyword','synString','synNumber','synComment','synType','synFunction',
             'synVariable','synConstant','synOperator','synPunct','synMetadata','synInvalid']],
  ['ANSI',['ansiBlack','ansiRed','ansiGreen','ansiYellow','ansiBlue','ansiMagenta','ansiCyan','ansiWhite',
           'ansiBrightBlack','ansiBrightRed','ansiBrightGreen','ansiBrightYellow','ansiBrightBlue',
           'ansiBrightMagenta','ansiBrightCyan','ansiBrightWhite']]
];
function renderTokens(res){
  const q=state.query.trim().toLowerCase();
  let html='', shown=0, total=0;
  for(const [g,keys] of TOKEN_GROUPS){
    total+=keys.length;
    const hits=keys.map(k=>[k,res.T[k]||''])
      .filter(([k,v])=>!q||k.toLowerCase().includes(q)||v.toLowerCase().includes(q));
    if(!hits.length) continue;
    shown+=hits.length;
    html+=`<div class="tokgroup"><div class="lbl">${g}</div>`+hits.map(([k,v])=>
      `<button class="tok" data-v="${v}" title="Copy ${v}">
        <span class="sw" style="background:${v}"></span>
        <span class="nm">${k}</span><span class="vl">${v}</span></button>`).join('')+'</div>';
  }
  $('#tokens').innerHTML=html;
  $('#tokcount').textContent = q
    ? shown+' of '+total+' tokens match'
    : total+' tokens, grouped by role'+(themeKeys?' \u2014 the '+themeKeys+' theme keys are all built from these.':'.');
}

/* ---- contrast audit ---- */
function renderAudit(res){
  const T=res.T;
  const checks=[
    ['Default text on editor', T.fgDefault, T.bgEditor, 7.0],
    ['Muted text on base',     T.fgMuted,   T.bgBase,   4.5],
    ['Subtle text on base',    T.fgSubtle,  T.bgBase,   3.5],
    ['Comments on editor',     T.synComment,T.bgEditor, 4.5],
    ['Keywords on editor',     T.synKeyword,T.bgEditor, 4.5],
    ['Strings on editor',      T.synString, T.bgEditor, 4.5],
    ['Types on editor',        T.synType,   T.bgEditor, 4.5],
    ['Functions on editor',    T.synFunction,T.bgEditor,4.5],
    ['Constants on editor',    T.synConstant,T.bgEditor,4.5],
    ['Text on selection',      T.fgDefault, T.bgSelection, 4.5],
    ['Inverse on accent',      T.fgInverse, T.accentPrimary, 4.5],
    ['Error on base',          T.semError,  T.bgBase,   4.5],
    ['Success on base',        T.semSuccess,T.bgBase,   4.5]
  ];
  const row=(label,r,pass,near,verdict)=>
    `<div class="aud ${pass?'ok':(near?'fix':'bad')}"><span class="k">${label}</span>
      <span class="bar"><i style="width:${Math.min(100,r/12*100).toFixed(1)}%"></i></span>
      <span class="r">${r.toFixed(2)}</span><span class="s">${verdict}</span></div>`;
  const rows=[];
  let passed=0;
  for(const [label,a,b,target] of checks){
    const r=cr(a,b);
    const pass=r>=target;
    if(pass) passed++;
    rows.push(row(label,r,pass,r>=target*0.85,pass?(r>=4.5?'AA':'AA large'):'Low'));
  }
  const sel=cr(T.bgSelection,T.bgEditor);
  const selOk=sel>=1.25&&sel<=2.2;
  if(selOk) passed++;
  rows.splice(11,0,row('Selection visibility',sel,selOk,true,selOk?'Visible':'Off'));
  const total=checks.length+1;
  $('#audit').innerHTML=rows.join('');
  $('#audit-title').textContent = passed===total
    ? 'All '+total+' contrast checks pass'
    : passed+' of '+total+' contrast checks pass';
  $('#meta-contrast').textContent=passed+'/'+total;
  $('#led').classList.toggle('warn',passed!==total);
  $('#repairnote').textContent = res.repairs.length
    ? 'The repair loop lifted: '+res.repairs.join(', ')+'.'
    : 'No repairs were needed — every seed cleared its floor as given.';
  return {passed,total};
}

/* ---- file generation: all the real work lives in lib/package.js ---- */
function generate(){
  const fam=state.family.trim()||'Custom Theme';
  const g=buildPlugin({palette:activePalette(),family:fam,
    id:'com.example.'+slugify(fam)+'-theme',author:'phpstorm-theme-generator',
    ...(state.download.mode==='custom'&&state.download.set.length
      ? {variants:state.download.set} : {}),
    options:{...state.options,
      wallpaper: state.options.wallpaper
        ? {transparency:12,fill:'scale',anchor:'center'} : null}});
  g.display=g.jarEntries
    .filter(e=>!e.path.endsWith('/')&&!e.path.endsWith('MANIFEST.MF'))
    .map(e=>({path:`${g.root}/lib/${g.root}.jar \u2192 ${e.path}`,
              name:e.path.split('/').pop(), body:e.body}));
  generated=g;
  return g;
}

const leaves=o=>Object.values(o).reduce((n,v)=>n+(v&&typeof v==='object'?leaves(v):1),0);

function renderFiles(){
  const g=generated||generate();
  if(state.file>=g.display.length) state.file=0;
  const size=b=>typeof b==='string'?new TextEncoder().encode(b).length:b.length;
  $('#files').innerHTML=g.display.map((f,i)=>{
    const kb=size(f.body)/1024;
    return `<button class="frow" data-f="${i}" aria-pressed="${i===state.file}" title="${f.path}">
      <span class="fn2">${f.name}</span>
      <span class="sz">${kb<10?kb.toFixed(1):Math.round(kb)} KB</span></button>`;
  }).join('');
  const f=g.display[state.file];
  $('#filepreview').textContent = typeof f.body!=='string'
    ? 'Binary file, '+f.body.length+' bytes.'+(f.name.endsWith('.class')
        ? '\n\nThe precompiled icon provider. Its Java source ships in the Gradle sources\n'
         +'and in the repository under plugin-src/ - it only reads forge-icons.properties.' : '')
    : f.body.length>60000
    ? f.body.slice(0,60000)+'\n\n\u2026 truncated for display \u2026' : f.body;
}

/* Packaging every variant takes tens of milliseconds — too slow to run on
   every tick of a colour-picker drag, so the numbers that depend on it settle
   shortly after the last change instead. */
let metaT;
function refreshGenerated(){
  const g=generate();
  const theme=g.display.find(f=>f.name.endsWith(state.variant+'.theme.json'))
    ||g.display.find(f=>f.name.endsWith('.theme.json'));
  const keys=leaves(JSON.parse(theme.body).ui||{});
  if(keys!==themeKeys){ themeKeys=keys; renderTokens(current); }
  $('#meta-tokens').textContent=keys;
  $('#meta-files').textContent=g.display.length;
  $('#derivation').textContent=keys+' keys derived \u00b7 '+(audit.passed===audit.total
    ? 'all contrast checks pass' : audit.passed+' of '+audit.total+' contrast checks pass');
  if(state.view==='files') renderFiles();
}
function scheduleGenerated(){
  clearTimeout(metaT);
  metaT=setTimeout(refreshGenerated,180);
}

/* ---- views ---- */
function showView(v){
  state.view=v;
  for(const b of document.querySelectorAll('.view'))
    b.setAttribute('aria-selected',String(b.dataset.view===v));
  for(const p of document.querySelectorAll('.pane')) p.hidden = p.id!=='view-'+v;
  if(v==='files') renderFiles();
}

/* ---- toast ---- */
let toastT;
function toast(msg){
  clearTimeout(toastT);
  let el=$('#toast');
  if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);}
  el.textContent=msg; el.hidden=false;
  toastT=setTimeout(()=>{el.hidden=true},2600);
}

/* ---- main render ---- */
function render(){
  const res=build(activePalette(),state.variant);
  current=res; generated=null;
  applyPreviewVars(res);
  applyStyleToPreview(res);
  renderTokens(res);
  audit=renderAudit(res);
  paintVariantChips();
  syncStyleSummary();
  scheduleGenerated();
  renderCode($('#code'),$('#gutter'),
    state.lang==='php'?PHP_LINES:BLADE_LINES,
    state.lang==='php'?GUT_PHP:[]);
  $('#cpop').hidden = state.lang!=='php';
}

/* ---- wiring ---- */
buildSeedInputs(); buildPresets(); syncInputs(); buildVariants(); buildStyleControls();
renderTree($('#tree'));
$('#term').innerHTML=TERM_HTML;
renderDiff($('#diff'));
render();
refreshGenerated();

$('.views').addEventListener('click',e=>{
  const b=e.target.closest('.view'); if(b) showView(b.dataset.view);
});
$('#btn-audit').addEventListener('click',()=>showView('contrast'));
$('#files').addEventListener('click',e=>{
  const b=e.target.closest('.frow'); if(!b) return;
  state.file=+b.dataset.f; renderFiles();
});
$('#tokfilter').addEventListener('input',e=>{state.query=e.target.value; renderTokens(current);});
$('#btn-style').addEventListener('click',()=>{
  $('#stylebox').hidden=!$('#stylebox').hidden; syncStyleSummary();
});
$('#famname').addEventListener('input',e=>{state.family=e.target.value;render();});
$('#seedcount').addEventListener('change',e=>{
  state.count=+e.target.value;
  syncInputs(); render();
});


$('#tokens').addEventListener('click',e=>{
  const b=e.target.closest('.tok'); if(!b) return;
  navigator.clipboard?.writeText(b.dataset.v).then(()=>toast('Copied '+b.dataset.v),()=>{});
});
$('#btn-swap').addEventListener('click',()=>{
  [state.palette[0],state.palette[1]]=[state.palette[1],state.palette[0]];
  syncInputs(); render();
});
/* Shuffle history: every shuffle, plus whatever was on screen before each one
   if it was not a shuffle - a preset, a hand-tuned colour - so stepping back
   never skips something you had. A new shuffle always goes on the end, even
   from the middle, so nothing that lay ahead is lost. */
const shuffles={list:[],at:-1,max:100};
const snap=()=>({palette:[...state.palette],count:state.count});
function syncShuffleNav(){
  $('#btn-shuffle-prev').disabled=shuffles.at<=0;
  $('#btn-shuffle-next').disabled=shuffles.at>=shuffles.list.length-1;
}
function stepShuffle(d){
  const e=shuffles.list[shuffles.at+d]; if(!e) return;
  shuffles.at+=d;
  state.palette=[...e.palette]; state.count=e.count;
  syncShuffleNav(); syncInputs(); render();
}
$('#btn-shuffle-prev').addEventListener('click',()=>stepShuffle(-1));
$('#btn-shuffle-next').addEventListener('click',()=>stepShuffle(1));
$('#btn-random').addEventListener('click',()=>{
  const was=snap(), here=shuffles.list[shuffles.at];
  if(!here||here.count!==was.count||here.palette.join()!==was.palette.join()){
    shuffles.list.push(was);
  }
  const baseH=Math.random()*360;
  const dark=Math.random()>0.25;
  const jitter=()=> (Math.random()-0.5)*30;
  const loud=state.count===2&&Math.random()<0.3;
  const anchor=fromOklch(dark?0.16+Math.random()*0.06:(loud?0.92:0.965),loud?0.10+Math.random()*0.08:0.014,baseH);
  /* With accents, the ink stays a quiet near-neutral and they carry the colour.
     A duotone has no accents: the ink is the colour, so it gets a hue of its
     own, away from the anchor's - and sometimes a page that joins in. */
  const duo=state.count===2, inkH=(baseH+90+Math.random()*180)%360;
  const ink   =duo ? fromOklch(dark?0.84:0.40,0.12+Math.random()*0.10,inkH)
                   : fromOklch(dark?0.86:0.24,0.012,baseH);
  const spread=[0,120,240].sort(()=>Math.random()-0.5);
  const L=dark?0.70:0.55, C=0.11+Math.random()*0.05;
  state.palette=[anchor,ink,
    fromOklch(L,C,(baseH+spread[0]+jitter()+360)%360),
    fromOklch(L,C,(baseH+spread[1]+jitter()+360)%360),
    fromOklch(L,C,(baseH+spread[2]+jitter()+360)%360)];
  shuffles.list=[...shuffles.list,snap()].slice(-shuffles.max);
  shuffles.at=shuffles.list.length-1;
  syncShuffleNav();
  syncInputs(); render();
});
$('#lang-php').addEventListener('click',()=>{state.lang='php';
  $('#lang-php').setAttribute('aria-pressed','true');$('#lang-blade').setAttribute('aria-pressed','false');render();});
$('#lang-blade').addEventListener('click',()=>{state.lang='blade';
  $('#lang-php').setAttribute('aria-pressed','false');$('#lang-blade').setAttribute('aria-pressed','true');render();});
$('#pan-term').addEventListener('click',()=>{
  $('#term').hidden=false; $('#diff').hidden=true;
  $('#pan-term').setAttribute('aria-pressed','true'); $('#pan-diff').setAttribute('aria-pressed','false');
  $('#pt-a').textContent='Terminal';
});
$('#pan-diff').addEventListener('click',()=>{
  $('#term').hidden=true; $('#diff').hidden=false;
  $('#pan-term').setAttribute('aria-pressed','false'); $('#pan-diff').setAttribute('aria-pressed','true');
  $('#pt-a').textContent='Git';
});
/* ---- saving ----
   Three hosts, three paths:
     - Claude artifact sandbox: page-initiated downloads are inert, so the
       `downloads` capability performs the save.
     - Any ordinary browser (GitHub Pages, file://, `npm run dev`): a Blob URL
       plus an <a download> works and needs no permission at all.
     - Artifact sandbox with the capability denied: neither works, so fall
       back to showing the files rather than failing silently.
   Buttons never change their own labels. */
const inClaudeHost = typeof window.claude?.use === 'function';
const downloadsReady = inClaudeHost
  ? Promise.resolve(window.claude.use('downloads')).catch(() => null)
  : Promise.resolve(null);

function showFiles(){ showView('files'); }

async function save(filename, bytes, note){
  const blob = new Blob([bytes], {type:'application/zip'});
  const downloads = await downloadsReady;

  if (downloads) {
    try { await downloads.save({filename, data: blob}); toast(note); }
    catch (err) {
      const code = err && err.code;
      if (code === 'declined') return;
      if (code === 'rate_limited') { toast('A save prompt is already open'); return; }
      showFiles(); toast('Could not save here \u2014 showing the files instead');
    }
    return;
  }

  if (!inClaudeHost) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast(note);
    return;
  }

  showFiles();
  toast('Saving is not enabled here \u2014 showing the files instead');
}

/* ---- the download button asks first: every variant, or a chosen set ---- */
{
  const menu=$('#dlmenu'), btn=$('#btn-zip'), go=$('#dl-go');
  const open=on=>{ menu.hidden=!on; btn.setAttribute('aria-expanded',String(on)); };
  const count=()=>state.download.mode==='custom'?state.download.set.length:VARIANTS.length;
  const sync=()=>{
    $('#dl-set').hidden=state.download.mode!=='custom';
    go.disabled=!count();
    go.textContent=count()?`Download ${count()} variant${count()===1?'':'s'}`:'Pick at least one';
    generated=null; refreshGenerated();
  };
  $('#dl-set').innerHTML=['dark','light','other'].map(mode=>
    `<div class="dlrow" role="group" aria-label="${mode} variants">`+VARIANTS.filter(v=>v.mode===mode).map(v=>
      `<label class="dlchk"><input type="checkbox" value="${v.id}"${state.download.set.includes(v.id)?' checked':''}>${v.label}</label>`
    ).join('')+`</div>`).join('');
  btn.addEventListener('click',e=>{ e.stopPropagation(); open(menu.hidden); });
  document.addEventListener('click',e=>{ if(!menu.hidden&&!menu.contains(e.target)) open(false); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!menu.hidden){ open(false); btn.focus(); } });
  menu.addEventListener('change',e=>{
    if(e.target.name==='dlmode') state.download.mode=e.target.value;
    else state.download.set=[...menu.querySelectorAll('#dl-set input:checked')].map(i=>i.value);
    sync();
  });
  go.addEventListener('click',()=>{
    open(false);
    const g = generate();
    save(g.root + '.zip', g.distZip,
      'Saved ' + g.root + '.zip \u2014 Settings \u203a Plugins \u203a \u2699 \u203a Install Plugin from Disk');
  });
  sync();
}
$('#btn-src').addEventListener('click', () => {
  const g = generate();
  save(g.root + '-src.zip', g.srcZip, 'Saved the Gradle project');
});
