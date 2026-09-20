// Part of phpstorm-theme-generator — see LICENSE.
/**
 * The fake PhpStorm shown in the preview: sample PHP/Blade, a Laravel-ish
 * project tree, artisan/phpunit terminal output and a git diff.
 *
 * Token arrays are [class, text, class, text, ...] pairs. An odd length used
 * to throw and silently kill the whole render, so renderCode now walks pairs
 * defensively — see test/ui.smoke.test.js.
 */

export const PHP_LINES=[
 ['c','<?php'],
 [],
 ['k','declare','p','(','v','strict_types','op','=','n','1','p',');'],
 [],
 ['k','namespace ','ty','App\\Http\\Controllers','p',';'],
 [],
 ['k','use ','ty','App\\Models\\Invoice','p',';'],
 ['k','use ','ty','Illuminate\\Http\\Request','p',';'],
 [],
 ['c','/**'],
 ['c',' * Issues invoices for a confirmed order.'],
 ['c',' *'],
 ['doct',' * @throws ','docg','InvalidOrderException'],
 ['c',' */'],
 ['at','#[Route','p','(','s',"'/invoices'",'p',')]'],
 ['k','final class ','ty','InvoiceController ','k','extends ','ty','Controller','p',' {'],
 [],
 ['SEL','    private const int MAX_LINES = 250;'],
 [],
 ['k','    public function ','fn','store','p','(','ty','Request ','v','$request','p','): ','ty','Invoice'],
 ['p','    {'],
 ['CARET'],
 ['v','        $customer ','op','= ','v','$request','op','->','fn','user','p','()','op','->','v','customer','p',';'],
 ['v','        $lines    ','op','= ','v','$request','op','->','fn','validated','p','()','p','[','s',"'lines'",'p','];'],
 [],
 ['k','        if ','p','(','fn','count','p','(','v','$lines','p',') ','op','> ','cn','self','op','::','cn','MAX_LINES','p',') {'],
 ['k','            throw new ','ty','TooManyLinesException','p','(','cn','self','op','::','cn','MAX_LINES','p',');'],
 ['p','        }'],
 [],
 ['ERR','        return $this->invoices->issue(customer: $customer, lines: $lnies);'],
 ['p','    }'],
 ['p','}']
];
export const BLADE_LINES=[
 ['at','@extends','p','(','s',"'layouts.app'",'p',')'],
 [],
 ['at','@section','p','(','s',"'content'",'p',')'],
 ['p','    <','tag','article ','attr','class','op','=','s','"invoice"','p','>'],
 ['p','        <','tag','h1','p','>{{ ','v','$invoice','op','->','v','number','p',' }}</','tag','h1','p','>'],
 [],
 ['at','        @foreach ','p','(','v','$invoice','op','->','v','lines ','k','as ','v','$line','p',')'],
 ['p','            <','tag','tr ','attr','wire:key','op','=','s','"{{ $line->id }}"','p','>'],
 ['p','                <','tag','td','p','>{{ ','v','$line','op','->','v','description','p',' }}</','tag','td','p','>'],
 ['p','                <','tag','td','p','>{{ ','fn','money','p','(','v','$line','op','->','v','total','p',') }}</','tag','td','p','>'],
 ['p','            </','tag','tr','p','>'],
 ['at','        @endforeach'],
 [],
 ['at','        @if ','p','(','v','$invoice','op','->','fn','isOverdue','p','())'],
 ['p','            <','tag','span ','attr','class','op','=','s','"badge badge--late"','p','>'],
 ['at','                @lang','p','(','s',"'invoice.overdue'",'p',')'],
 ['p','            </','tag','span','p','>'],
 ['at','        @endif'],
 ['p','    </','tag','article','p','>'],
 ['at','@endsection'],
 [],
 ['c','{{-- totals are recomputed server-side --}}']
];
export const GUT_PHP=[
  {},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{v:'add'},{},{v:'add'},{},{cur:1},
  {v:'mod',bp:1},{v:'mod'},{},{},{},{},{},{v:'del'},{},{}
];

export function renderCode(el,gut,lines,gmarks){
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let code='',g='';
  lines.forEach((ln,i)=>{
    const mk=gmarks[i]||{};
    let cls='ln';
    let html='';
    if(ln[0]==='CARET'){ cls+=' caret'; html='&nbsp;'; }
    else if(ln[0]==='SEL'){ html='<span class="sel">'+esc(ln[1])+'</span>'; }
    else if(ln[0]==='ERR'){
      const t=ln[1];
      html=esc(t.slice(0,t.length-8))+'<span class="err">'+esc(t.slice(t.length-8,t.length-2))+'</span>'+esc(t.slice(-2));
    }
    else if(ln.length===0){ html='&nbsp;'; }
    else { for(let j=0;j+1<ln.length;j+=2) html+='<span class="'+ln[j]+'">'+esc(String(ln[j+1]))+'</span>'; }
    if(i===22) html+='<span class="hint">: Customer</span>';
    code+='<span class="'+cls+'">'+html+'</span>';
    g+='<div class="gl'+(mk.v?' '+mk.v:'')+(mk.cur?' cur':'')+(mk.bp?' bp':'')+'">'
      +'<span class="vcs"></span><b>'+(i+1)+'</b>'
      +(mk.bp?'<span class="bpdot"></span>':'<span class="mark"></span>')+'</div>';
  });
  el.innerHTML=code; gut.innerHTML=g;
}

export const TERM_HTML=`<span class="prompt">~/invoicing-api</span> <span class="a15">php artisan migrate --seed</span>
<span class="a8">   INFO</span>  Running migrations.

  <span class="a7">2026_09_02_add_credit_notes_table</span> <span class="a8">.................</span> <span class="a2">DONE</span>
  <span class="a7">2026_09_11_invoice_line_totals</span> <span class="a8">...................</span> <span class="a2">DONE</span>
  <span class="a7">2026_09_17_drop_legacy_vat_column</span> <span class="a8">................</span> <span class="a3">SKIPPED</span>

<span class="prompt">~/invoicing-api</span> <span class="a15">vendor/bin/phpunit --testdox</span>
<span class="a6">Invoice</span>
 <span class="a2">✔</span> Issues an invoice for a confirmed order
 <span class="a2">✔</span> Rejects more than 250 lines
 <span class="a1">✘</span> <span class="a9">Applies reverse-charge VAT for EU business customers</span>
   <span class="a8">│</span> Failed asserting that <span class="a11">0.00</span> matches expected <span class="a11">21.00</span>
   <span class="a8">│</span> <span class="a4">tests/Feature/InvoiceTest.php</span><span class="a8">:</span><span class="a11">118</span>

<span class="bgfail"> FAILURES! </span> <span class="a7">Tests: 3, Assertions: 11, Failures: 1.</span>

<span class="prompt">~/invoicing-api</span> <span class="a15">composer audit</span>
<span class="bgok"> OK </span> <span class="a7">No security vulnerability advisories found.</span>

<span class="prompt">~/invoicing-api</span> <span class="cur">&nbsp;</span>`;

const DIFF_ROWS=[
 ['','@@ -112,9 +112,14 @@ final class InvoiceController','m'],
 ['112','         $lines = $request->validated()[\'lines\'];',''],
 ['113','',''],
 ['114','-        if (count($lines) > 250) {','d'],
 ['114','+        if (count($lines) > self::MAX_LINES) {','i'],
 ['115','+            throw new TooManyLinesException(self::MAX_LINES);','i'],
 ['116','         }',''],
 ['117','',''],
 ['118','-        return $this->invoices->issue($customer, $lines);','d'],
 ['118','+        return $this->invoices->issue(','i'],
 ['119','+            customer: $customer,','i'],
 ['120','+            lines: $lines,','i'],
 ['121','+        );','i'],
 ['122','     }','']
];
const TREE_ROWS=[
 ['','invoicing-api','',0,'fold'],
 ['','app','',1,''],
 ['','Http','',2,''],
 ['','Controllers','',3,''],
 ['','InvoiceController.php','mod',3,'sel'],
 ['','OrderController.php','',3,''],
 ['','Models','',2,''],
 ['','Invoice.php','mod',2,''],
 ['','CreditNote.php','add',2,''],
 ['','resources','',1,''],
 ['','views','',2,''],
 ['','invoice.blade.php','',2,'hov'],
 ['','tests','',1,''],
 ['','InvoiceTest.php','mod',2,''],
 ['','.env','ign',1,''],
 ['','composer.json','',1,''],
 ['','docker-compose.yml','',1,'']
];
/* iconFor(name,isDir) may return ready SVG markup; without it the tree keeps
   its plain dots, which is what the IDE's own icons reduce to at this size. */
export function renderTree(el,iconFor){
  el.innerHTML=TREE_ROWS.map(([_,name,st,ind,extra])=>{
    const isDir=!name.includes('.')||name==='invoicing-api';
    const svg=iconFor&&iconFor(name,isDir);
    if(svg) return `<div class="tr ind${ind} ${st} ${extra}">`+
      `<span class="ic">${svg}</span><span class="nm">${name}</span></div>`;
    const col=isDir?'var(--t-actionsGrey)':(name.endsWith('.php')?'var(--t-actionsBlue)':
      name.endsWith('.yml')?'var(--t-actionsGreen)':'var(--t-actionsYellow)');
    return `<div class="tr ind${ind} ${st} ${extra}">`+
      `<span class="ic" style="background:${col};border-radius:${isDir?'2px':'50%'}"></span>`+
      `<span class="nm">${name}</span></div>`;
  }).join('');
}
export function renderDiff(el){
  el.innerHTML=DIFF_ROWS.map(([no,txt,cls])=>
    `<div class="dl ${cls}"><span class="no">${no}</span><span>${txt.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span></div>`).join('');
}
