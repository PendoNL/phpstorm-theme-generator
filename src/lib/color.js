// Part of phpstorm-theme-generator — see LICENSE.
/**
 * Colour maths: sRGB <-> OKLCH, rectangular OKLab mixing, WCAG contrast.
 *
 * Everything is done in OKLCH because its lightness is perceptually uniform,
 * which is what makes the contrast guarantees in derive.js hold. Mixing is
 * done in RECTANGULAR OKLab coordinates on purpose: interpolating hue polarly
 * sends a warm accent blended into a cool background on a detour through
 * magenta, which is how generated themes end up with purple "deleted line"
 * gutters.
 */

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

function srgbToLinear(hex){
  hex=hex.replace('#','');
  const f=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  return [f(parseInt(hex.slice(0,2),16)),f(parseInt(hex.slice(2,4),16)),f(parseInt(hex.slice(4,6),16))];
}
function linearToSrgb(rgb){
  const f=v=>{v=v<=0.0031308?v*12.92:1.055*Math.pow(Math.max(v,0),1/2.4)-0.055;
    return Math.round(clamp(v,0,1)*255);};
  return '#'+[f(rgb[0]),f(rgb[1]),f(rgb[2])].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
}
function toOklch(hex){
  const [r,g,b]=srgbToLinear(hex);
  const l=0.4122214708*r+0.5363325363*g+0.0514459929*b;
  const m=0.2119034982*r+0.6806995451*g+0.1073969566*b;
  const s=0.0883024619*r+0.2817188376*g+0.6299787005*b;
  const l_=Math.cbrt(l),m_=Math.cbrt(m),s_=Math.cbrt(s);
  const L=0.2104542553*l_+0.7936177850*m_-0.0040720468*s_;
  const A=1.9779984951*l_-2.4285922050*m_+0.4505937099*s_;
  const B=0.0259040371*l_+0.7827717662*m_-0.8086757660*s_;
  const C=Math.hypot(A,B);
  const H=C<1e-6?0:(Math.atan2(B,A)*180/Math.PI+360)%360;
  return {l:L,c:C,h:H};
}
function fromOklch(L,C,H){
  L=clamp(L,0,1); C=Math.max(C,0);
  const a=C*Math.cos(H*Math.PI/180), b=C*Math.sin(H*Math.PI/180);
  const l_=L+0.3963377774*a+0.2158037573*b;
  const m_=L-0.1055613458*a-0.0638541728*b;
  const s_=L-0.0894841775*a-1.2914855480*b;
  const l=l_**3,m=m_**3,s=s_**3;
  const rgb=[ 4.0767416621*l-3.3077115913*m+0.2309699292*s,
             -1.2684380046*l+2.6097574011*m-0.3413193965*s,
             -0.0041960863*l-0.7034186147*m+1.7076147010*s];
  if((Math.max(...rgb)>1||Math.min(...rgb)<0)&&C>0.001) return fromOklch(L,C*0.96,H);
  return linearToSrgb(rgb);
}
const lighten=(hex,d)=>{const o=toOklch(hex);return fromOklch(o.l+d,o.c,o.h);};
const desat  =(hex,f)=>{const o=toOklch(hex);return fromOklch(o.l,o.c*f,o.h);};
const rotate =(hex,d)=>{const o=toOklch(hex);return fromOklch(o.l,o.c,(o.h+d+360)%360);};
/* rectangular OKLab interpolation — never takes a hue detour */
function mix(a,b,t){
  const A=toOklch(a),B=toOklch(b);
  const aA=A.c*Math.cos(A.h*Math.PI/180), bA=A.c*Math.sin(A.h*Math.PI/180);
  const aB=B.c*Math.cos(B.h*Math.PI/180), bB=B.c*Math.sin(B.h*Math.PI/180);
  const L=A.l+(B.l-A.l)*t, x=aA+(aB-aA)*t, y=bA+(bB-bA)*t;
  const C=Math.hypot(x,y), H=C<1e-6?0:(Math.atan2(y,x)*180/Math.PI+360)%360;
  return fromOklch(L,C,H);
}
const alpha=(hex,a)=>hex.toUpperCase()+Math.round(clamp(a,0,1)*255).toString(16).padStart(2,'0').toUpperCase();
function lum(hex){const[r,g,b]=srgbToLinear(hex);return 0.2126*r+0.7152*g+0.0722*b;}
function cr(a,b){const x=lum(a),y=lum(b);const hi=Math.max(x,y),lo=Math.min(x,y);
  return (hi+0.05)/(lo+0.05);}
function ensure(fg,bg,target,sign){
  let n=0;
  while(cr(fg,bg)<target && n++<80){const o=toOklch(fg);fg=fromOklch(o.l+sign*0.01,o.c,o.h);}
  if(cr(fg,bg)<target){const o=toOklch(fg);fg=fromOklch(o.l,o.c*0.8,o.h);}
  return fg;
}
const hueNear=(h,t,tol=25)=>Math.min(Math.abs(h-t),360-Math.abs(h-t))<=tol;

/** Strip the leading '#' — editor colour scheme XML wants bare hex. */
export const noHash = h => h.replace('#', '').toLowerCase();

export { clamp, srgbToLinear, linearToSrgb, toOklch, fromOklch,
         lighten, desat, rotate, mix, alpha, lum, cr, ensure, hueNear };
