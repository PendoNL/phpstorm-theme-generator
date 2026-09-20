// Part of phpstorm-theme-generator — see LICENSE.
/**
 * The derivation: five seed colours -> a complete token table.
 *
 * Seed roles are fixed, never guessed from the colours themselves:
 *   C1 anchor (editor background)   C2 ink (default text)
 *   C3 primary accent               C4 secondary accent   C5 tertiary accent
 *
 * Every variant re-runs this whole function on transformed seeds. Nothing is
 * hand-tuned, which is the point: one palette, a family of internally consistent themes.
 */
import { clamp, toOklch, fromOklch, lighten, desat, rotate, mix, alpha, cr, ensure, hueNear }
  from './color.js';

export const VARIANTS=[
  {id:'dark',    label:'Dark',     mode:'dark'},
  {id:'darker',  label:'Darker',   mode:'dark'},
  {id:'contrast',label:'Contrast', mode:'dark'},
  {id:'muted',   label:'Muted',    mode:'dark'},
  {id:'vivid',   label:'Vivid',    mode:'dark'},
  {id:'oled',    label:'OLED',     mode:'dark'},
  {id:'neon',    label:'Neon',     mode:'other'},
  {id:'light',          label:'Light',          mode:'light'},
  {id:'paper',          label:'Paper',          mode:'light'},
  {id:'tinted',         label:'Tinted',         mode:'light'},
  {id:'light-contrast', label:'Light Contrast', mode:'light'},
  {id:'soft',           label:'Soft',           mode:'light'},
  {id:'light-vivid',    label:'Light Vivid',    mode:'light'}
];
/* Paper's page and ink lean to this hue whatever the palette: warm, like stock. */
const PAPER_HUE=85;
/* Below this OKLCH chroma a colour has no hue worth preserving. */
const CHROMATIC=0.02;

/**
 * Two, three or four colours in, the five seeds out.
 *
 *   2  anchor + ink. There is no accent to build from, so the accents are
 *      tones of the ink: a duotone. Green on black stays green, white on
 *      black stays grey.
 *   3  + one accent. The other two sit a third of the hue circle either side.
 *   4  + two accents. The third takes the middle of the widest free arc.
 *
 * `tonal` tells deriveTokens that hue is not available to tell syntax apart,
 * so it must not go looking for one. Five colours pass through untouched.
 */
export function expandSeeds(p){
  if(!Array.isArray(p)||p.length<2||p.length>5)
    throw new TypeError('palette must be 2 to 5 hex colours');
  if(p.length===5) return {seeds:p,tonal:false};
  const [C1,C2]=p;
  const o1=toOklch(C1), o2=toOklch(C2);
  /* Tones step from the base toward the page, plus one a touch past it, and
     stay far enough apart that lightness alone separates keyword from string. */
  const tones=(base)=>{
    const o=toOklch(base), toPage=o1.l<o.l?-1:1;
    const at=(dl,k)=>fromOklch(clamp(o.l+toPage*dl,0.08,0.96),o.c*k,o.h);
    return [at(0.20,1),at(0.10,0.85),at(-0.05,1.1)];
  };
  if(p.length===2) return {seeds:[C1,C2,...tones(C2)],tonal:true};
  const o3=toOklch(p[2]);
  if(p.length===3){
    if(o3.c<0.04){ const [,b,c]=tones(p[2]); return {seeds:[C1,C2,p[2],b,c],tonal:true}; }
    return {seeds:[C1,C2,p[2],rotate(p[2],120),rotate(p[2],-120)],tonal:false};
  }
  const o4=toOklch(p[3]);
  if(o3.c<0.04||o4.c<0.04){
    const o=o3.c>=o4.c?o3:o4;
    return {seeds:[...p,fromOklch(clamp((o3.l+o4.l)/2+(o1.l<o2.l?0.08:-0.08),0.08,0.96),o.c,o.h)],
            tonal:o3.c<0.04&&o4.c<0.04};
  }
  const lo=Math.min(o3.h,o4.h), hi=Math.max(o3.h,o4.h);
  const inner=hi-lo, h5=inner>=180 ? lo+inner/2 : (hi+(360-inner)/2)%360;
  return {seeds:[...p,fromOklch((o3.l+o4.l)/2,(o3.c+o4.c)/2,h5)],tonal:false};
}

export function transformSeeds(p,variant){
  let [C1,C2,C3,C4,C5]=p;
  const acc=(f)=>[C3,C4,C5]=[C3,C4,C5].map(f);
  /* The light family shares Light's swap - the ink seed becomes the page, the
     anchor becomes the ink - and then each sets its own page and accents. */
  const swapToLight=(pageL,inkL=0.26)=>{
    const oa=toOklch(C2),ob=toOklch(C1);
    C1=fromOklch(pageL,Math.min(oa.c,0.02),oa.h);
    C2=fromOklch(Math.min(ob.l,inkL),ob.c,ob.h);
  };
  const darken=(d,k,cap=()=>1)=>acc(c=>{const o=toOklch(c);return fromOklch(Math.min(o.l-d,cap(o.h)),o.c*k,o.h);});
  switch(variant){
    case 'darker':{
      const o=toOklch(C1); C1=fromOklch(o.l-0.045,o.c*0.9,o.h); break;
    }
    case 'light':{
      let a=C2,b=C1;
      const oa=toOklch(a),ob=toOklch(b);
      C1=fromOklch(Math.max(oa.l,0.965),Math.min(oa.c,0.02),oa.h);
      C2=fromOklch(Math.min(ob.l,0.26),ob.c,ob.h);
      acc(c=>{const o=toOklch(c);return fromOklch(o.l-0.14,o.c*1.15,o.h);});
      break;
    }
    case 'paper':
      swapToLight(0.95);
      C1=fromOklch(0.95,0.012,PAPER_HUE);
      C2=fromOklch(toOklch(C2).l,0.012,PAPER_HUE-20);
      darken(0.14,1.15);
      break;
    case 'tinted':
      // A little lower than Light: near white sRGB has no chroma left to give.
      swapToLight(0.94);
      C1=fromOklch(0.94,0.03,toOklch(C3).h);
      darken(0.14,1.15);
      break;
    case 'light-contrast':
      swapToLight(1,0.06);
      C1='#FFFFFF';
      C2=fromOklch(0.06,toOklch(C2).c*0.5,toOklch(C2).h);
      darken(0.18,1.1);
      break;
    case 'soft':
      swapToLight(0.90);
      acc(c=>desat(c,0.72));
      darken(0.16,1);
      break;
    case 'light-vivid':
      swapToLight(0.975);
      // Light's accents pushed to the gamut edge: fromOklch walks the chroma
      // back in, so overshooting is how you find the edge. Lightness stays
      // where Light puts it: going darker to gain contrast loses chroma faster.
      darken(0.14,1.6,()=>0.64);
      break;
    case 'contrast':{
      const o=toOklch(C2);
      C2=fromOklch(toOklch(C1).l<o.l?0.99:0.06,o.c*0.5,o.h);
      break;
    }
    case 'oled':
      // OLED only means anything on a dark theme, so a light palette is
      // inverted first - otherwise you get dark text on a black editor.
      if(toOklch(C1).l > toOklch(C2).l){ const swap=C1; C1=C2; C2=swap; }
      // Deliberately NOT black here: only the editor goes to #000000 (below),
      // while the surface ramp still grows from the real anchor. Setting the
      // anchor itself to black collapses the ramp, because OKLCH lightness
      // near zero maps to a handful of sRGB values - every panel comes out
      // black too and the chrome disappears.
      break;
    case 'neon':{
      // Neon is light on dark by definition, so invert a light palette (as OLED does).
      if(toOklch(C1).l > toOklch(C2).l){ const swap=C1; C1=C2; C2=swap; }
      // A dark, visibly coloured stage: the anchor's own hue if it has one,
      // otherwise the primary accent's. deriveTokens lifts its chroma cap to match.
      const o=toOklch(C1), hue=o.c>=CHROMATIC?o.h:toOklch(C3).h;
      C1=fromOklch(Math.min(o.l,0.17),clamp(o.c,0.035,0.06),hue);
      // As saturated as the gamut allows; fromOklch walks chroma back in by
      // itself. Only lift lightness off the floor - sRGB has less chroma to
      // give the lighter a colour gets, so brightening a hot pink dulls it.
      // A seed already on the gamut edge is kept as given: the walk-back
      // steps by 4%, so "boosting" it would lose a little.
      acc(c=>{const a=toOklch(c), hot=fromOklch(Math.max(a.l,0.62),a.c*1.3,a.h);
        return toOklch(hot).c>a.c ? hot : c;});
      break;
    }
    case 'muted': acc(c=>desat(c,0.72)); break;
    case 'vivid': acc(c=>{const o=toOklch(c);return fromOklch(o.l,o.c*1.25,o.h);}); break;
  }
  return {seeds:[C1,C2,C3,C4,C5],variant};
}

export function deriveTokens(palette,variant){
  const {seeds:full,tonal}=expandSeeds(palette);
  const {seeds}=transformSeeds(full,variant);
  let [C1,C2,C3,C4,C5]=seeds;
  const isDark=toOklch(C1).l<toOklch(C2).l;
  const sign=isDark?1:-1;
  const hp=toOklch(C3).h;
  const neon=variant==='neon';
  const wide = variant==='darker'?1.25 : variant==='oled'?1.45 : variant==='muted'||variant==='soft'?0.8 : 1;
  const T={}, repairs=[];

  /* Surfaces stay near-neutral (neon aside) and lean toward one hue. A grey
     anchor borrows the accent's; a coloured anchor keeps its own - repainting
     a deep purple in a pink accent's hue turns it brown. */
  const paper=variant==='paper', tinted=variant==='tinted';
  const hBg = paper ? PAPER_HUE : tinted ? hp
    : toOklch(palette[0]).c>=CHROMATIC && toOklch(C1).c>=0.005 ? toOklch(C1).h : hp;
  /* The cap is there because a faintly tinted background looks stained, and
     most anchors are near-neutral. A plainly coloured one - a yellow page, a
     deep purple - is a choice, not a stain: the cap eases off between 0.07
     and 0.12 of anchor chroma and is gone above that. */
  const own=toOklch(C1).c, free=paper||tinted?0:clamp((own-0.07)/0.05,0,1);
  const bgCap = Math.max(neon?0.06:tinted?0.035:paper?0.014:0.012, own*free), bgMin = neon?0.03:tinted?0.025:paper?0.010:0.008;
  const tint=(c,cap=bgCap)=>{const o=toOklch(c);return fromOklch(o.l,Math.min(Math.max(o.c,bgMin),cap),hBg);};
  // OLED must stay exactly #000000 or the panel keeps the pixels lit.
  T.bgEditor = variant==='oled' ? '#000000' : tint(C1);
  T.bgBase   = tint(lighten(C1, sign*0.020*wide));
  T.bgRaised = tint(lighten(C1, sign*0.042*wide));
  T.bgSunken = tint(lighten(C1,-sign*0.012*wide));
  T.bgOverlay= tint(lighten(C1, sign*0.060*wide));
  T.bgHover  = tint(lighten(C1, sign*0.055*wide));
  T.bgPress  = tint(lighten(C1, sign*0.075*wide));

  const highContrast = variant==='contrast'||variant==='light-contrast';
  const floors = highContrast?1.5:1;
  const reg=(name,got,want)=>{ if(Math.abs(cr(got.after,got.before)-0)>=0) {} };
  function fix(name,c,bg,target){
    const out=ensure(c,bg,target,sign);
    if(out!==c) repairs.push(name);
    return out;
  }
  /* A duotone tells syntax apart by tone alone, so the three accents need room
     between them. A variant can take that room away - carried to a light page,
     all three land on the contrast floor and come out as one colour. When that
     happens, lay them out again from the floor toward the ink. */
  if(tonal){
    const floorL=c=>toOklch(ensure(c,T.bgEditor,4.5*floors,sign)).l;
    const ls=[C3,C4,C5].map(floorL).sort((x,y)=>x-y);
    if(ls[1]-ls[0]<0.06||ls[2]-ls[1]<0.06){
      // from mid-grey, not from the page: a 1% step off pure black rounds back to black
      const o=toOklch(C3), base=floorL(fromOklch(0.5,o.c,o.h));
      const room=Math.min(Math.abs((isDark?0.97:0.10)-base),0.30);
      const at=t=>fromOklch(clamp(base+sign*room*t,0.05,0.97),o.c,o.h);
      [C3,C4,C5]=[at(0.10),at(0.50),at(1)];
    }
  }
  T.fgDefault = fix('fgDefault',C2,T.bgEditor,Math.min(7.0*floors,21));
  T.fgMuted   = fix('fgMuted',  mix(T.fgDefault,T.bgBase,0.28),T.bgBase,4.5*floors);
  T.fgSubtle  = fix('fgSubtle', mix(T.fgDefault,T.bgBase,0.45),T.bgBase,3.5*floors);
  T.fgDisabled= mix(T.fgDefault,T.bgBase,0.62);
  T.fgInverse = fromOklch(isDark?0.15:0.98,0.01,hp);

  T.accentPrimary      = C3;
  T.accentPrimaryHover = lighten(C3,sign*0.05);
  T.accentPrimaryMuted = desat(C3,0.55);
  T.accentSecondary    = C4;
  T.accentTertiary     = C5;
  /* The accent as running text - links, clickable references. The raw seed is
     fine as a button fill but can sit near 2:1 as type, above all when a dark
     palette is carried over to a light variant. */
  T.fgLink = fix('fgLink',C3,T.bgEditor,4.5*floors);

  /* Selection has to clear two bars at once: text on it stays readable, and
     it stays visible against the editor. Push accent out until the text is
     legible, then pull it back in until the band can actually be seen - on a
     true-black editor the first pass alone leaves it invisible. */
  let t=neon?0.68:0.74, sel=mix(C3,T.bgEditor,t);
  while(cr(T.fgDefault,sel)<4.5 && t<0.95){ t+=0.01; sel=mix(C3,T.bgEditor,t); }
  while(cr(sel,T.bgEditor)<1.25 && t>0.35){
    const next=mix(C3,T.bgEditor,t-0.01);
    if(cr(T.fgDefault,next)<4.5) break;
    t-=0.01; sel=next;
  }
  T.bgSelection         = sel;
  T.bgSelectionInactive = mix(C3,T.bgEditor,Math.min(t+0.12,0.95));
  T.bgSelectionUi       = mix(C3,T.bgBase,0.62);
  T.fgSelection         = T.fgDefault;

  const Lsem=clamp(toOklch(C3).l, isDark?0.62:0.48, isDark?0.78:0.58);
  const Csem=clamp(Math.max(toOklch(C3).c,toOklch(C4).c,toOklch(C5).c)*0.85,0.08,neon?0.24:0.16);
  const pick=(hTarget,fallback)=>{
    for(const c of [C3,C4,C5]) if(hueNear(toOklch(c).h,hTarget)) return c;
    return fallback;
  };
  /* sRGB keeps its most saturated yellows, greens and cyans near the top of
     the lightness range (at a mid lightness a "neon" yellow is mustard) and its
     most saturated blues and violets lower down. Neon
     therefore picks the lightness per hue; everything else shares one. */
  const litFor=(h,base)=>!neon?base : h>=60&&h<95?0.83 : h>=95&&h<160?0.87 : h>=160&&h<225?0.82 : h>=225&&h<320?base : Math.max(base,0.70);
  const gen=(base,c,h)=>fromOklch(litFor(h,base),c,h);
  T.semError   = pick(27, gen(Lsem,Csem,27));
  T.semWarning = pick(75, gen(Lsem,Csem,75));
  T.semSuccess = pick(148,gen(Lsem,Csem,148));
  T.semInfo    = gen(Lsem,Csem*0.9,240);
  T.semModify  = gen(Lsem,Csem*0.9,255);

  const bStrong = highContrast;
  // Neon draws its chrome in the accent, like a tube sign, rather than in grey.
  const line = neon ? C3 : T.fgDefault;
  T.borderDefault = mix(line,T.bgBase,bStrong?0.68:neon?0.74:0.80);
  T.borderStrong  = mix(line,T.bgBase,neon?0.58:0.68);
  T.borderFocus   = C3;
  T.separator     = mix(line,T.bgBase,bStrong?0.72:neon?0.82:0.86);
  T.shadow        = alpha(fromOklch(0.05,0.01,hp), isDark?0.55:0.18);
  T.caret         = C3;
  T.caretRow      = neon ? mix(C3,T.bgEditor,0.90) : mix(T.fgDefault,T.bgEditor,0.955);
  T.guideIndent   = mix(line,T.bgEditor,0.88);
  T.guideIndentOn = mix(line,T.bgEditor,neon?0.62:0.70);

  const Ln=isDark?0.66:0.50, Lb=isDark?0.80:0.62, Ca=clamp(Csem,0.09,neon?0.22:0.15);
  T.ansiBlack = isDark?lighten(T.bgEditor,0.10):mix(T.fgDefault,T.bgEditor,0.20);
  const ansiHues=[['Red',27],['Green',148],['Yellow',85],['Blue',255],['Magenta',328],['Cyan',205]];
  for(const [nm,h] of ansiHues) T['ansi'+nm]=pick(h,gen(Ln,Ca,h));
  T.ansiWhite=T.fgMuted;
  T.ansiBrightBlack=T.fgDisabled;
  for(const [nm,h] of ansiHues) T['ansiBright'+nm]=fromOklch(Lb,Ca*(neon?1:0.92),h);
  T.ansiBrightWhite=T.fgDefault;

  const synFloor=4.5*floors;
  T.synKeyword  = fix('synKeyword', C3, T.bgEditor, synFloor);
  T.synString   = fix('synString',  C5, T.bgEditor, synFloor);
  const o4=toOklch(C4);
  T.synNumber   = fix('synNumber',  fromOklch(o4.l,o4.c*1.05,o4.h), T.bgEditor, synFloor);
  T.synComment  = fix('synComment', mix(T.fgDefault,T.bgEditor,0.55), T.bgEditor, synFloor);
  T.synType     = fix('synType',    C4, T.bgEditor, synFloor);
  /* Function sits between the primary and tertiary accents. Walk the hue arc
     rather than averaging in OKLab: two opposed hues average to grey, which
     is how pink + green used to give a dull gold. Greys have no arc to walk. */
  const o3=toOklch(C3), o5=toOklch(C5);
  const arc=((o5.h-o3.h+540)%360)-180;
  const fnSeed = (o3.c<0.04||o5.c<0.04) ? mix(C3,C5,0.5)
    : fromOklch((o3.l+o5.l)/2,(o3.c+o5.c)/2,(o3.h+arc/2+360)%360);
  T.synFunction = fix('synFunction',fnSeed, T.bgEditor, synFloor);
  T.synVariable = T.fgDefault;
  /* Constant is the secondary accent swung 60 degrees back - unless that lands
     on another syntax colour (cyan - 60 = the green of the strings), in which
     case it goes to the middle of the widest free stretch of the hue circle. */
  let hConst=tonal ? o4.h : (o4.h+300)%360;
  const taken=[o3.h,o4.h,o5.h,toOklch(fnSeed).h];
  const gapTo=h=>Math.min(...taken.map(x=>Math.min(Math.abs(x-h),360-Math.abs(x-h))));
  if(!tonal && o4.c>=0.04 && gapTo(hConst)<35){
    const ring=[...taken].sort((a,b)=>a-b);
    let best=0;
    ring.forEach((h,i)=>{
      const span=((ring[(i+1)%ring.length]-h)+360)%360||360;
      if(span>best){ best=span; hConst=(h+span/2)%360; }
    });
  }
  // in a duotone the constant cannot move in hue, so it moves in tone instead
  T.synConstant = fix('synConstant',fromOklch(tonal?clamp(o4.l+sign*0.07,0.05,0.97):o4.l,
    tonal?o4.c*0.75:o4.c,hConst), T.bgEditor, synFloor);
  T.synOperator = T.fgMuted;
  T.synPunct    = T.fgSubtle;
  T.synMetadata = desat(T.synType,0.8);
  T.synInvalid  = fix('synInvalid',T.semError,T.bgEditor,synFloor);

  /* Keyword / string separation guard.
     These two carry most of the felt identity of a code editor; if they read
     the same, the file looks flat no matter how good the rest is. Separate by
     hue where there is chroma to work with, and by lightness where there
     isn't - rotating the hue of a grey does nothing, and an all-grey palette
     is a deliberate choice we should honour rather than colourise. */
  const dk=toOklch(T.synKeyword), ds=toOklch(T.synString);
  const dh=Math.min(Math.abs(dk.h-ds.h),360-Math.abs(dk.h-ds.h));
  const achromatic = dk.c<0.04 && ds.c<0.04;
  if(achromatic||tonal){
    if(Math.abs(dk.l-ds.l)<0.15){
      const dir = ds.l>=dk.l ? 1 : -1;
      T.synString=fix('synString',
        fromOklch(clamp(dk.l+dir*0.18,0.05,0.95),ds.c,ds.h),T.bgEditor,synFloor);
      repairs.push('synString (lightness separation)');
    }
  } else if(dh<45 && Math.abs(dk.l-ds.l)<0.15){
    T.synString=fix('synString',rotate(T.synString,40),T.bgEditor,synFloor);
    repairs.push('synString (hue separation)');
  }

  /* derived-for-UI extras */
  T.sbThumb      = alpha(T.fgDefault,0.20);
  T.sbThumbHover = alpha(T.fgDefault,0.32);
  T.sbTrack      = '#00000000';
  T.sbTrackHover = alpha(T.fgDefault,0.06);
  T.focusRing    = alpha(T.accentPrimary,neon?0.85:0.55);
  T.errRing      = alpha(T.semError,0.55);
  T.errRingWeak  = alpha(T.semError,0.28);
  T.warnRing     = alpha(T.semWarning,0.55);
  T.warnRingWeak = alpha(T.semWarning,0.28);
  T.borderDisabled = mix(T.borderDefault,T.bgBase,0.5);
  T.transparent  = '#00000000';
  T.stripeRow    = mix(T.fgDefault,T.bgBase,0.965);
  T.trackNeutral = mix(T.fgDefault,T.bgBase,0.86);
  T.searchMatch  = mix(T.accentSecondary,T.bgBase,0.55);
  T.tintAccentWeak = mix(T.accentPrimary,T.bgBase,0.88);
  T.tintAccentSoft = mix(T.accentPrimary,T.bgBase,0.80);
  T.tintErrorBg    = mix(T.semError,T.bgBase,0.88);
  T.tintWarnBg     = mix(T.semWarning,T.bgBase,0.88);
  T.tintInfoBg     = mix(T.semInfo,T.bgBase,0.88);
  T.tintSuccessBg  = mix(T.semSuccess,T.bgBase,0.88);
  T.tintErrorRaised   = mix(T.semError,T.bgRaised,0.86);
  T.tintWarnRaised    = mix(T.semWarning,T.bgRaised,0.86);
  T.tintInfoRaised    = mix(T.semInfo,T.bgRaised,0.86);
  T.tintSuccessRaised = mix(T.semSuccess,T.bgRaised,0.86);
  const sh=fromOklch(0.05,0.01,hp);
  T.shadow0=alpha(sh,0.42); T.shadow1=alpha(sh,0.16); T.shadowCorner=alpha(sh,0.25);

  /* preview-only conveniences (not exported as tokens) */
  const P={
    caretRow : T.caretRow,
    execLine : mix(T.accentPrimary,T.bgEditor,0.80),
    inlayBg  : mix(T.fgDefault,T.bgEditor,0.92),
    docTag   : mix(T.synComment,T.synKeyword,0.5),
    diffIns  : mix(T.semSuccess,T.bgEditor,0.82),
    diffDel  : mix(T.semError,T.bgEditor,0.88),
    diffMod  : mix(T.semModify,T.bgEditor,0.82),
    completionMatch : T.accentPrimary,
    memTrack : T.trackNeutral,
    fileYellow : alpha(T.accentSecondary,0.14),
    actionsBlue: T.accentPrimary, actionsGreen: T.semSuccess,
    actionsYellow: T.semWarning, actionsGrey: T.fgSubtle,
    objectsPurple: T.synConstant, objectsBlue: T.accentPrimary,
    kwWeight: '700'
  };

  return {T,P,isDark,sign,repairs:[...new Set(repairs)],variant,seeds};
}
