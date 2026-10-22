/* Topic page renderer. Needs window.CATALOG and window.TOPIC. */
(function(){
"use strict";
var T=window.TOPIC, C=window.CATALOG;
var STOPS=T.stops, R=T.readings, N=STOPS.length;
var MOD=C.modules.filter(function(m){return m.id===T.module;})[0];
var KEY="smm-rm-"+T.id;

/* ---------- helpers ---------- */
function el(tag,attrs,html){var e=document.createElement(tag); if(attrs){for(var k in attrs){ if(k==="class") e.className=attrs[k]; else e.setAttribute(k,attrs[k]); }} if(html!=null) e.innerHTML=html; return e;}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function stop(id){for(var i=0;i<N;i++) if(STOPS[i].id===id) return STOPS[i];}
function byTier(t){return R.filter(function(r){return r.tier===t;});}
function smooth(){ try{ return matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"; }catch(e){ return "auto"; } }
function go(id){ var t=document.getElementById(id); if(t) t.scrollIntoView({behavior:smooth(),block:"start"}); }
var done={};
try{ done=JSON.parse(localStorage.getItem(KEY)||"{}")||{}; }catch(e){ done={}; }
function saveDone(){ try{ localStorage.setItem(KEY,JSON.stringify(done)); }catch(e){} syncAll(); }
var TIERNAME=["Tier 1 · Primary","Tier 2 · Adjacent","Tier 3 · Outside the syllabus"];
var ACT={read:"Read",skim:"Skim",glance:"Glance",skip:"Skip"};
var MIN={read:2,skim:1,glance:0.5,skip:0};

var app=document.getElementById("app");
document.title=T.title+" · SMM Reading Map";

/* ---------- top bar ---------- */
var ready=MOD.topics.filter(function(t){return t.file;});
var idx=MOD.topics.map(function(t){return t.file;}).indexOf(T.file);
var topicNo=idx+1;
var jumps=[["route","Road map"],["skim","Skim guide"],["map","Tier map"],["tier1","Tier 1"],["tier2","Tier 2"],["tier3","Tier 3"]];
(T.extras||[]).forEach(function(x){jumps.push([x.id,x.nav||x.title]);});
if(window.GLOSSARY && (window.GLOSSARY[T.module]||[]).length) jumps.push(["glossary","Glossary"]);
else jumps.push(["notes","Notes"]);
var top=el("nav",{class:"topbar","aria-label":"Page"});
top.innerHTML='<div class="wrap"><a class="home" href="index.html#'+MOD.id+'">SMM Reading Map</a><span class="crumb" title="Topic '+topicNo+' of '+MOD.topics.length+' in Module '+MOD.n+'">Module '+MOD.n+' · '+topicNo+' of '+MOD.topics.length+'</span><div class="jump">'+
  jumps.map(function(j){return '<a href="#'+j[0]+'">'+esc(j[1])+'</a>';}).join("")+'</div></div>';
app.appendChild(top);

/* ---------- reading progress: a strip inside the sticky top bar ----------
   The bar is split into Tier 1, 2 and 3, each as wide as its share of the reading list,
   and each fills as its items are ticked. Skim-guide pages are counted separately. */
var TCOUNT=[1,2,3].map(function(n){return byTier(n).length;});
var rb=el("div",{class:"readbar",role:"group","aria-label":"Reading progress"});
rb.innerHTML='<div class="wrap">'+
  '<div class="rb-total"><b class="rb-pct" aria-live="polite">0%</b><span class="rb-lab"></span></div>'+
  '<div class="rb-track" aria-hidden="true">'+[1,2,3].map(function(n){
     return TCOUNT[n-1]?'<a class="rb-seg s'+n+'" href="#tier'+n+'" tabindex="-1" style="flex-grow:'+TCOUNT[n-1]+'"><i></i></a>':'';
   }).join("")+'</div>'+
  '<div class="rb-tiers">'+[1,2,3].map(function(n){
     return '<a class="rb-t" href="#tier'+n+'"><span class="tierchip t'+n+'">T'+n+'</span><span class="rb-n">0%</span></a>';
   }).join("")+'<span class="rb-skim"></span></div>'+
 '</div>';
top.appendChild(rb);
function fmtPct(v){ return (v>0 && v<1) ? "<1%" : Math.floor(v+1e-9)+"%"; }
function credit(r){ var c=COVER[r.id]; if(!c) return done[r.id]?1:0; var t=partsTotal(r); return t?partsTicked(r)/t:(isRead(r)?1:0); }
function updateReadbar(){
  if(!rb) return;
  /* a reading linked to skim pages earns part credit as its pages are ticked, so every skim tick moves the bar */
  var tot=0, dn=0, cr=0, pt=0, tiers=rb.querySelectorAll(".rb-t");
  [1,2,3].forEach(function(n){
    var all=byTier(n), d=all.filter(isRead).length, part=all.filter(function(r){return !isRead(r) && partsTicked(r)>0;}).length;
    var c=all.reduce(function(s,r){return s+credit(r);},0);
    tot+=all.length; dn+=d; cr+=c; pt+=part;
    var pv=all.length?c*100/all.length:0, p=fmtPct(pv);
    var seg=rb.querySelector(".rb-seg.s"+n); if(seg) seg.firstChild.style.width=(all.length?c*100/all.length:0)+"%";
    var t=tiers[n-1], txt=d+" of "+all.length+" read"+(part?", "+part+" part-read":"");
    t.querySelector(".rb-n").textContent=p;
    t.setAttribute("aria-label",TIERNAME[n-1]+": "+txt+" ("+p+"). Go to the list.");
    t.title=TIERNAME[n-1]+": "+txt;
    t.classList.toggle("full",all.length>0 && d===all.length);
  });
  var pv=tot?cr*100/tot:0, complete=tot>0 && dn===tot;
  rb.querySelector(".rb-pct").textContent=fmtPct(pv);
  rb.querySelector(".rb-lab").textContent=complete?"All "+tot+" readings done":dn+" of "+tot+" readings done"+(pt?" · "+pt+" part-read":"");
  rb.classList.toggle("complete",complete);
  var a=0, at=0, f=0, ft=0; (T.skim||[]).forEach(function(B){ var c=bookCounts(B); a+=c.p; at+=c.pt; f+=c.f; ft+=c.ft; });
  rb.querySelector(".rb-skim").textContent=at?"Skim guide: "+a+" of "+at+" parts"+(ft?" · fast route "+f+" of "+ft:""):"";
  try{ localStorage.setItem("smm-rm-sum-"+T.file,JSON.stringify({d:dn,t:tot,p:Math.round(pv*10)/10})); }catch(e){}
}
/* keep jump targets clear of the sticky bar, whatever its height */
function setBarHeight(){ document.documentElement.style.setProperty("--tbh",top.offsetHeight+"px"); }
setBarHeight();
if(window.ResizeObserver){ new ResizeObserver(setBarHeight).observe(top); } else { window.addEventListener("resize",setBarHeight); }

/* ---------- hero ---------- */
var prev=null,next=null;
for(var i=idx-1;i>=0;i--){ if(MOD.topics[i].file){prev=MOD.topics[i];break;} }
for(var j=idx+1;j<MOD.topics.length;j++){ if(MOD.topics[j].file){next=MOD.topics[j];break;} }
var hero=el("header",{class:"hero"});
hero.innerHTML='<div class="wrap"><div class="eyebrow">Module '+MOD.n+' · '+esc(MOD.title)+' · '+esc(T.session)+'</div>'+
 '<h1>'+esc(T.title)+'</h1><p class="lede">'+T.lede+'</p>'+(T.coursePlan?'<p class="cp"><b>Course plan:</b> '+T.coursePlan+'</p>':'')+
 '<div class="legend">'+
  '<div class="tier"><span class="tierchip t1">Tier 1 · '+byTier(1).length+'</span><b>Primary reading</b><p>'+esc(T.tierText[0])+'</p></div>'+
  '<div class="tier l2"><span class="tierchip t2">Tier 2 · '+byTier(2).length+'</span><b>Adjacent reading</b><p>'+esc(T.tierText[1])+'</p></div>'+
  '<div class="tier l3"><span class="tierchip t3">Tier 3 · '+byTier(3).length+'</span><b>Outside the syllabus</b><p>'+esc(T.tierText[2])+'</p></div>'+
 '</div><div class="pager">'+
  (prev?'<a href="'+prev.file+'">← '+esc(prev.s)+' · '+esc(prev.title)+'</a>':'')+
  '<a href="index.html#'+MOD.id+'">All modules</a>'+
  (next?'<a href="'+next.file+'">'+esc(next.s)+' · '+esc(next.title)+' →</a>':'')+
 '</div></div>';
app.appendChild(hero);
var main=el("main",{}); app.appendChild(main);
function section(id,eyebrow,title,intro){
  var s=el("section",{class:"block",id:id});
  s.innerHTML='<div class="wrap"><header><div class="eyebrow">'+eyebrow+'</div><h2>'+esc(title)+'</h2>'+(intro?'<p>'+intro+'</p>':'')+'</header></div>';
  main.appendChild(s); return s.firstChild;
}

/* ---------- skim totals ---------- */
var SK=T.skim||[];

/* ---------- skim pages <-> Tier 1 readings ----------
   A Tier 1 reading from a book that has a skim guide is linked to the skim pages inside its page range.
   It counts as read when all of those pages are ticked, and ticking it in the reading list ticks those pages.
   Readings with no skim pages (other books, Tier 2 and 3) are ticked on their own. */
function pageNums(str){ var out=[]; String(str).replace(/(\d+)\s*[\u2013-]\s*(\d+)|(\d+)/g,function(m,a,b,c){ if(c) out.push(+c); else for(var i=+a;i<=+b;i++) out.push(i); return m; }); return out; }
var COVER={}, LABEL={};
R.forEach(function(r){
  if(r.tier!==1) return;
  var bk=T.books[r.book], B=(bk && bk.skim)?SK.filter(function(x){return x.key===bk.skim;})[0]:null;
  if(!B) return;
  var want=pageNums(r.pages), keys=[];
  B.pages.forEach(function(pg){
    if(pageNums(pg.pl||pg.p).some(function(n){return want.indexOf(n)>-1;})){ var k="skim-"+B.key+"-"+pg.p; keys.push(k); LABEL[k]=pg.pl||("p. "+pg.p); }
  });
  if(keys.length) COVER[r.id]=keys;
});
/* ---------- skim parts: one tick for every Read, Skim or Glance part ----------
   Skip parts have no tick. A page is done when all of its parts are ticked.
   A page with only Skip parts has nothing to tick and counts as done. */
var PAGE={};
SK.forEach(function(B){ B.pages.forEach(function(pg){
  var parts=[], fast=[];
  pg.b.forEach(function(b,i){ if(b.a!=="skip"){ var k="skimb-"+B.key+"-"+pg.p+"-"+i; parts.push(k); if(b.f) fast.push(k); } });
  PAGE["skim-"+B.key+"-"+pg.p]={parts:parts,fast:fast};
}); });
function pageTicked(k){ var P=PAGE[k]; return P ? P.parts.filter(function(x){return done[x];}).length : 0; }
function pageTotal(k){ var P=PAGE[k]; return P ? P.parts.length : 0; }
function pageDone(k){ return pageTicked(k)===pageTotal(k); }
function setParts(list,on){ list.forEach(function(x){ if(on) done[x]=1; else delete done[x]; }); }
function bookCounts(B){
  var c={p:0,pt:0,f:0,ft:0,pg:0,pgt:0};
  B.pages.forEach(function(pg){ var P=PAGE["skim-"+B.key+"-"+pg.p];
    c.pt+=P.parts.length; c.p+=P.parts.filter(function(x){return done[x];}).length;
    c.ft+=P.fast.length; c.f+=P.fast.filter(function(x){return done[x];}).length;
    if(P.parts.length){ c.pgt++; if(pageDone("skim-"+B.key+"-"+pg.p)) c.pg++; } });
  return c;
}
/* older ticks carry over: a tick on a linked reading becomes ticks on its pages, and a page tick becomes ticks on all its parts */
(function(){ var moved=false;
  Object.keys(COVER).forEach(function(id){ if(done[id]){ COVER[id].forEach(function(k){ done[k]=1; }); delete done[id]; moved=true; } });
  Object.keys(PAGE).forEach(function(k){ if(done[k]){ setParts(PAGE[k].parts,true); delete done[k]; moved=true; } });
  if(moved){ try{ localStorage.setItem(KEY,JSON.stringify(done)); }catch(e){} }
})();
function isRead(r){ var c=COVER[r.id]; return c ? c.every(pageDone) : !!done[r.id]; }
function partsTicked(r){ var c=COVER[r.id]; return c ? c.reduce(function(s,k){return s+pageTicked(k);},0) : 0; }
function partsTotal(r){ var c=COVER[r.id]; return c ? c.reduce(function(s,k){return s+pageTotal(k);},0) : 0; }
function coverText(r){
  var c=COVER[r.id], d=partsTicked(r), t=partsTotal(r), pd=c.filter(pageDone).length;
  var parts=d+" of "+t+" part"+(t===1?"":"s")+" ticked";
  if(c.length===1) return "Linked to skim page "+LABEL[c[0]]+" · "+parts;
  return "Linked to the skim guide · "+parts+", "+pd+" of "+c.length+" pages done";
}
var skimEls={}, listEls={};
function syncAll(){
  Object.keys(skimEls).forEach(function(k){
    var e=skimEls[k], vis=e.visible, n=vis.filter(function(x){return done[x];}).length;
    if(e.input){ e.input.checked=vis.length>0 && n===vis.length; e.input.indeterminate=n>0 && n<vis.length; }
    e.row.classList.toggle("donepage",pageDone(k));
    Object.keys(e.parts).forEach(function(x){ var pi=e.parts[x]; pi.checked=!!done[x]; pi.closest("li").classList.toggle("pdone",!!done[x]); });
  });
  Object.keys(listEls).forEach(function(id){
    var e=listEls[id], r=e.r, d=isRead(r), part=!d && partsTicked(r)>0;
    e.input.checked=d; e.input.indeterminate=part; e.li.classList.toggle("done",d); e.li.classList.toggle("part",part);
    if(e.cov) e.cov.textContent=coverText(r);
  });
  if(typeof progress!=="undefined" && progress) updateProgress();
  if(typeof skimSum!=="undefined" && skimSum) updateSkimSum();
  updateReadbar();
}
function totalMin(book,fast){ return Math.round(book.pages.reduce(function(s,pg){return s+pg.b.reduce(function(t,b){return t+((!fast||b.f)?(b.m!=null?b.m:MIN[b.a]):0);},0);},0)); }
var TOT={};
SK.forEach(function(b){ TOT[b.key]=totalMin(b,false); TOT[b.key+"-fast"]=totalMin(b,true); });
TOT.fast=SK.reduce(function(s,b){return s+TOT[b.key+"-fast"];},0);
function fillTotals(txt){ return String(txt).replace(/\{min:([a-z0-9-]+)\}/g,function(_,k){return TOT[k]!=null?TOT[k]:"?";}); }

/* ---------- Road map ---------- */
var rw=section("route","Road map · the essential topics",T.routeTitle,T.routeIntro);
var ol=el("ol",{class:"route"});
STOPS.forEach(function(t){
  var counts=[1,2,3].map(function(n){return R.filter(function(r){return r.tier===n && r.st.indexOf(t.id)>-1;}).length;});
  var li=el("li",{class:"stop",id:"stop-"+t.id});
  var learn=t.learn.map(function(l){return "<li>"+esc(l[0])+(l[1]?" <span class=\"ref acc\">"+esc(l[1])+"</span>":"")+"</li>";}).join("");
  li.innerHTML='<div class="dot" aria-hidden="true">'+t.id+'</div><div class="card"><div class="eyebrow">Stop '+t.id+' of '+N+'</div><h3>'+esc(t.name)+'</h3>'+
    '<p class="plain">'+esc(t.plain)+'</p><div class="cols"><ul class="learn">'+learn+'</ul><div class="side">'+
    '<div class="box"><div class="eyebrow">Be ready to answer</div><p>'+esc(t.ask)+'</p></div>'+
    '<div class="box"><div class="eyebrow">Readings for this stop</div><div class="tiercount"><span class="tierchip t1">Tier 1 · '+counts[0]+'</span><span class="tierchip t2">Tier 2 · '+counts[1]+'</span><span class="tierchip t3">Tier 3 · '+counts[2]+'</span></div>'+
    '<div class="linkrow"><button class="linkish" type="button" data-act="skim" data-stop="'+t.id+'">Skim guide</button><button class="linkish" type="button" data-act="map" data-stop="'+t.id+'">Tier map</button><button class="linkish" type="button" data-act="list" data-stop="'+t.id+'">Reading lists</button></div></div></div></div></div>';
  ol.appendChild(li);
});
rw.appendChild(ol);
if(T.plan&&T.plan.length){
  var plan=el("div",{class:"plan","aria-label":"Suggested study plan"});
  T.plan.forEach(function(p){ plan.appendChild(el("div",{class:"s p"+p.tier},'<div class="eyebrow">'+esc(fillTotals(p.when))+'</div><p>'+fillTotals(p.text)+'</p>')); });
  rw.appendChild(plan);
  rw.appendChild(el("p",{class:"muted",style:"font-size:.88rem;margin-top:10px"},"Times are rough guides, worked out from the skim guide below."));
}

/* ---------- Skim guide ---------- */
var sw=section("skim","Tier 1 skim guide · page by page",T.skimTitle||"What to read, skim and skip",T.skimIntro);
sw.appendChild(el("div",{class:"skimkey","aria-label":"How to read the marks"},
  '<span><b class="act read">Read</b> Definitions, lists and models. Read every line.</span>'+
  '<span><b class="act skim">Skim</b> Examples and stories. First and last line of each paragraph.</span>'+
  '<span><b class="act glance">Glance</b> Figures and tables. Look for the shape.</span>'+
  '<span><b class="act skip">Skip</b> Old data, notes, side topics.</span>'+
  '<span><b class="fast">Fast route</b> The minimum to teach the hour.</span>'+
  '<span class="tickhint"><span class="tickbox" aria-hidden="true">\u2713</span> Tick each part when you finish it. “All done” ticks every part shown on that page; with the fast route on, only the fast-route parts.</span>'));
var skimBar=el("div",{class:"skimbar"});
var seg=el("div",{class:"seg",role:"group","aria-label":"Choose a book"});
SK.forEach(function(b,i){ seg.appendChild(el("button",{type:"button","data-book":b.key,"aria-pressed":String(i===0)},esc(b.tab))); });
skimBar.appendChild(seg);
skimBar.appendChild(el("label",{class:"fasttoggle"},'<input type="checkbox" id="fastOnly-'+T.id+'"> Show the fast route only'));
sw.appendChild(skimBar);
var skimBanner=el("div",{class:"filterbanner"}); skimBanner.hidden=true; sw.appendChild(skimBanner);
var skimSum=el("p",{class:"skimsum"}); sw.appendChild(skimSum);
var skimList=el("div",{}); sw.appendChild(skimList);
if(T.skimNote) sw.appendChild(el("p",{class:"skimnote"},T.skimNote));
var skimBook=SK.length?SK[0].key:null, fastOnly=false, skimStop=0;
function bookByKey(k){return SK.filter(function(b){return b.key===k;})[0];}
function blockStops(pg,b){ return b.s||pg.s||[]; }
function skimDoneCount(B){ return bookCounts(B).pg; }
function renderSkim(){
  var B=bookByKey(skimBook); skimList.innerHTML=""; skimEls={}; if(!B) return;
  skimList.appendChild(el("div",{class:"booklabel"},esc(B.label)+' <small>'+esc(B.note)+'</small>'));
  var wrap=el("div",{}), shown=0;
  B.pages.forEach(function(pg){
    var blocks=pg.b.filter(function(b){ if(fastOnly && !b.f) return false; if(skimStop){ return blockStops(pg,b).indexOf(skimStop)>-1; } return true; });
    if(!blocks.length) return;
    shown++;
    var key="skim-"+B.key+"-"+pg.p;
    var row=el("div",{class:"skimrow",id:"skim-"+B.key+"-"+String(pg.p).replace(/[^0-9a-z]/gi,"-")});
    if(pageDone(key) && pageTotal(key)) row.classList.add("donepage");
    var visible=[];
    var items=blocks.map(function(b){
      var bi=pg.b.indexOf(b), pk=(b.a!=="skip")?"skimb-"+B.key+"-"+pg.p+"-"+bi:null;
      if(pk) visible.push(pk);
      var tick=pk?'<input type="checkbox" class="pt" data-k="'+pk+'"'+(done[pk]?' checked':'')+' aria-label="Done: '+esc(b.w)+'">':'<span class="pt-none" title="Skip: nothing to tick" aria-hidden="true">–</span>';
      var tags="";
      if(b.f) tags+='<span class="fast">Fast route</span>';
      var st=blockStops(pg,b); if(st.length && st.length<N && !skimStop) tags+='<span class="tag-stop">Stop '+st.join(", ")+'</span>';
      if(b.d) tags+='<span class="tag-deck">In your deck: '+esc(b.d)+'</span>';
      if(b.o) tags+='<span class="tag-old">Dated: '+esc(b.o)+'</span>';
      return '<li'+(pk&&done[pk]?' class="pdone"':'')+'>'+tick+'<span class="act '+b.a+'">'+ACT[b.a]+'</span><div><div class="what">'+esc(b.w)+'</div>'+(b.t?'<p class="take">'+esc(b.t)+'</p>':'')+(tags?'<div class="tags">'+tags+'</div>':'')+'</div></li>';
    }).join("");
    var allTicked=visible.length>0 && visible.every(function(x){return done[x];});
    var pageTick=visible.length?'<label title="Ticks every part shown on this page"><input type="checkbox" class="pg-all"'+(allTicked?' checked':'')+'> '+(fastOnly?'Fast route done':'All done')+'</label>':'<span class="pg-skip">Nothing to tick</span>';
    row.innerHTML='<div class="pn"><b>'+esc(pg.pl||("p. "+pg.p))+'</b>'+pageTick+'</div><div><h4>'+esc(pg.h)+'</h4><ul>'+items+'</ul></div>';
    var inp=row.querySelector("input.pg-all"), partEls={};
    Array.prototype.forEach.call(row.querySelectorAll("input.pt"),function(pi){
      partEls[pi.getAttribute("data-k")]=pi;
      pi.addEventListener("change",function(e){ if(e.target.checked) done[pi.getAttribute("data-k")]=1; else delete done[pi.getAttribute("data-k")]; saveDone(); });
    });
    skimEls[key]={row:row,input:inp,visible:visible,parts:partEls};
    if(inp){
      var some=visible.some(function(x){return done[x];}); inp.indeterminate=some && !allTicked;
      inp.addEventListener("change",function(e){ setParts(visible,e.target.checked); saveDone(); });
    }
    wrap.appendChild(row);
  });
  if(!shown){
    var custom=skimStop && T.skimEmpty && T.skimEmpty[skimStop];
    wrap.appendChild(el("p",{class:"empty"},custom?custom+' <button class="linkish" type="button" data-act="tier" data-tier="3" data-stop="'+skimStop+'">Tier 3 list for this stop</button>':"Nothing in this book for stop "+skimStop+". Try the other book, or show all stops."));
  }
  skimList.appendChild(wrap);
  skimBanner.hidden=!skimStop;
  if(skimStop) skimBanner.innerHTML='Showing only the parts for <b>Stop '+skimStop+' · '+esc(stop(skimStop).name)+'</b><button class="linkish" type="button" data-clear="skim">Show every page</button><button class="linkish" type="button" data-act="list" data-stop="'+skimStop+'">Tier 1 list for this stop</button>';
  updateSkimSum();
}
function updateSkimSum(){
  var B=bookByKey(skimBook); if(!B){skimSum.textContent="";return;}
  var c=bookCounts(B);
  skimSum.textContent="Full skim about "+TOT[B.key]+" min · fast route about "+TOT[B.key+"-fast"]+" min · parts ticked: "+c.p+" of "+c.pt+(c.ft?" (fast route: "+c.f+" of "+c.ft+")":"")+" · pages done: "+c.pg+" of "+c.pgt+".";
}
function setSkimBook(k){ skimBook=k; Array.prototype.forEach.call(seg.querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",String(b.getAttribute("data-book")===k));}); renderSkim(); }
function setSkimStop(id){
  skimStop=id||0;
  /* switch to a book that has parts for this stop, if the current one has none */
  if(skimStop){
    var has=function(B){return B.pages.some(function(pg){return pg.b.some(function(b){return blockStops(pg,b).indexOf(skimStop)>-1;});});};
    var cur=bookByKey(skimBook);
    if(cur && !has(cur)){ var alt=SK.filter(has)[0]; if(alt){ setSkimBook(alt.key); return; } }
  }
  renderSkim();
}
seg.addEventListener("click",function(e){ var b=e.target.closest("button"); if(b) setSkimBook(b.getAttribute("data-book")); });
skimBar.querySelector("input").addEventListener("change",function(e){ fastOnly=e.target.checked; renderSkim(); });

/* ---------- Tier map ---------- */
var mw=section("map","Tier map · how it all connects",T.mapTitle||"One topic in the middle, three rings of reading around it",
  "Each spoke is one stop. Moving outwards, the rings go from the syllabus books (Tier 1) to other books (Tier 2) to outside material (Tier 3). Tap a stop's name above the map to open the Tier 1 skim guide for that stop. Tap a stop's circle to see its readings below the map. Tap a ring box to jump straight there: Tier 1 opens the skim guide for that stop, Tier 2 and Tier 3 open their reading lists.");
var topicbar=el("div",{class:"topicbar",role:"group","aria-label":"Choose a stop"});
mw.appendChild(topicbar);
var mg=el("div",{class:"mapgrid"}); mw.appendChild(mg);
var mapCol=el("div",{}); mg.appendChild(mapCol);
var mapbox=el("div",{class:"mapbox"}); mapCol.appendChild(mapbox);
mapCol.appendChild(el("p",{class:"maphint"},"On a phone, swipe sideways to see the whole map."));
mapCol.appendChild(el("div",{class:"mapkey"},
 '<span><svg width="34" height="10" aria-hidden="true"><line x1="1" y1="5" x2="26" y2="5" stroke="currentColor" stroke-width="2.2"/><path d="M26 1 L33 5 L26 9 Z" fill="currentColor"/></svg>'+esc(T.flowLabel||"Order of the stops")+'</span>'+
 (T.links.some(function(l){return l.loop;})?'<span><svg width="34" height="10" aria-hidden="true"><line x1="1" y1="5" x2="26" y2="5" stroke="var(--a)" stroke-width="2.6"/><path d="M26 1 L33 5 L26 9 Z" fill="var(--a)"/></svg>'+esc(T.loopLabel||"Feedback loop")+'</span>':'')+
 '<span><svg width="34" height="10" aria-hidden="true"><line x1="1" y1="5" x2="33" y2="5" stroke="currentColor" stroke-width="1.6" stroke-dasharray="5 4"/></svg>Cross-link between stops</span>'+
 '<span><span class="tierchip t1">Tier 1</span><span class="tierchip t2">Tier 2</span><span class="tierchip t3">Tier 3</span></span>'));
var detail=el("aside",{class:"detail","aria-live":"polite"}); mg.appendChild(detail);

var NS="http://www.w3.org/2000/svg";
function sv(tag,attrs,text){var e=document.createElementNS(NS,tag); for(var k in attrs) e.setAttribute(k,attrs[k]); if(text!=null) e.textContent=text; return e;}
var CX=0, CY=0, RT=170, RN=54, BW=152, BH=52;
var STEP=(N===5)?170:120;
var RR=[315,315+STEP,315+2*STEP];
var START=(N===4)?-45:-90;
var ANG={}; STOPS.forEach(function(t,i){ ANG[t.id]=START+i*360/N; });
function pt(r,deg){var a=deg*Math.PI/180; return [CX+r*Math.cos(a), CY+r*Math.sin(a)];}
var svg=sv("svg",{role:"img","aria-label":"Tier map for "+T.title+": "+N+" stops around the centre, each with Tier 1, Tier 2 and Tier 3 readings on rings."});
mapbox.appendChild(svg);
var defs=sv("defs",{});
var m1=sv("marker",{id:"ah-"+T.id,viewBox:"0 0 10 10",refX:"8",refY:"5",markerWidth:"7",markerHeight:"7",orient:"auto-start-reverse"}); m1.appendChild(sv("path",{d:"M0 0 L10 5 L0 10 Z","class":"arrowhead"}));
var m2=sv("marker",{id:"ahA-"+T.id,viewBox:"0 0 10 10",refX:"8",refY:"5",markerWidth:"7",markerHeight:"7",orient:"auto-start-reverse"}); m2.appendChild(sv("path",{d:"M0 0 L10 5 L0 10 Z","class":"arrowhead acc"}));
defs.appendChild(m1); defs.appendChild(m2); svg.appendChild(defs);
RR.forEach(function(r,i){ svg.appendChild(sv("circle",{cx:CX,cy:CY,r:r,"class":"ring r"+(i+1)})); });
/* ring labels go in the gap between spokes closest to the lower right */
var gaps=STOPS.map(function(t,i){ return START+(i+0.5)*360/N; });
var best=gaps.slice().sort(function(a,b){ function d(x){var v=((x-60)%360+540)%360-180; return Math.abs(v);} return d(a)-d(b); })[0];
["TIER 1 · PRIMARY","TIER 2 · ADJACENT","TIER 3 · OUTSIDE"].forEach(function(lbl,i){ var p=pt(RR[i],best); svg.appendChild(sv("text",{x:p[0].toFixed(1),y:(p[1]+4).toFixed(1),"text-anchor":"middle","class":"ringlabel"},lbl)); });
var linkLayer=sv("g",{}); svg.appendChild(linkLayer);
var gapDeg=Math.asin((RN+8)/RT)*180/Math.PI+2;
for(var k=0;k<N-1;k++){
  var a0=ANG[STOPS[k].id]+gapDeg, a1=ANG[STOPS[k+1].id]-gapDeg;
  var q0=pt(RT,a0), q1=pt(RT,a1);
  var fl=sv("path",{d:"M"+q0[0].toFixed(1)+" "+q0[1].toFixed(1)+" A"+RT+" "+RT+" 0 0 1 "+q1[0].toFixed(1)+" "+q1[1].toFixed(1),"class":"flow","marker-end":"url(#ah-"+T.id+")"});
  fl.appendChild(sv("title",{},"Stop "+STOPS[k].id+" to stop "+STOPS[k+1].id));
  linkLayer.appendChild(fl);
}
var chordEls=[];
(T.links||[]).forEach(function(L){
  var pa=pt(RT,ANG[L.a]), pb=pt(RT,ANG[L.b]);
  var dx=pb[0]-pa[0], dy=pb[1]-pa[1], len=Math.sqrt(dx*dx+dy*dy), ux=dx/len, uy=dy/len;
  var trim=RN+6, extra=L.loop?4:0;
  var sx=pa[0]+ux*trim, sy=pa[1]+uy*trim, ex=pb[0]-ux*(trim+extra), ey=pb[1]-uy*(trim+extra);
  var mx=(pa[0]+pb[0])/2, my=(pa[1]+pb[1])/2, dm=Math.sqrt(mx*mx+my*my);
  var safe=RN+24, dctrl=Math.max(2*safe-dm, dm*0.75);
  var vx,vy; if(dm<1){ vx=-uy; vy=ux; } else { vx=mx/dm; vy=my/dm; }
  var qx=vx*dctrl, qy=vy*dctrl;
  var attrs={d:"M"+sx.toFixed(1)+" "+sy.toFixed(1)+" Q"+qx.toFixed(1)+" "+qy.toFixed(1)+" "+ex.toFixed(1)+" "+ey.toFixed(1),"class":L.loop?"loop":"cross"};
  if(L.loop) attrs["marker-end"]="url(#ahA-"+T.id+")";
  var p=sv("path",attrs); p.appendChild(sv("title",{},L.text)); linkLayer.appendChild(p);
  chordEls.push({el:p,L:L});
});
svg.appendChild(sv("circle",{cx:CX,cy:CY,r:RN+2,"class":"centre"}));
var cl=T.centre||["SMM","topic"];
svg.appendChild(sv("text",{x:CX,y:CY-3,"text-anchor":"middle","class":"centretext"},cl[0]));
svg.appendChild(sv("text",{x:CX,y:CY+17,"text-anchor":"middle","class":"centretext"},cl[1]));
var spoke={}, nodes=[];
var minX=-RN-10,maxX=RN+10,minY=-RN-10,maxY=RN+10;
function grow(x,y,w,h){ minX=Math.min(minX,x-w/2); maxX=Math.max(maxX,x+w/2); minY=Math.min(minY,y-h/2); maxY=Math.max(maxY,y+h/2); }
STOPS.forEach(function(t){
  var g=sv("g",{"class":"spokegroup"});
  var pa=pt(RT+RN,ANG[t.id]), pb=pt(RR[2],ANG[t.id]);
  g.appendChild(sv("line",{x1:pa[0].toFixed(1),y1:pa[1].toFixed(1),x2:pb[0].toFixed(1),y2:pb[1].toFixed(1),"class":"spoke"}));
  ["t1","t2","t3"].forEach(function(key,ix){
    var c=pt(RR[ix],ANG[t.id]); grow(c[0],c[1],BW,BH);
    var lines=t.map[key];
    var sat=sv("g",{"class":"sat s"+(ix+1),tabindex:"0",role:"button","aria-label":"Stop "+t.id+", "+TIERNAME[ix]+": "+lines.join(", ")+". Go to "+(ix===0?"the skim guide":"the Tier "+(ix+1)+" list")});
    sat.appendChild(sv("rect",{x:(c[0]-BW/2).toFixed(1),y:(c[1]-BH/2).toFixed(1),width:BW,height:BH,rx:7}));
    sat.appendChild(sv("text",{x:c[0].toFixed(1),y:(c[1]-12).toFixed(1),"text-anchor":"middle","class":"txt"},lines[0]));
    sat.appendChild(sv("text",{x:c[0].toFixed(1),y:(c[1]+6).toFixed(1),"text-anchor":"middle","class":"txt"},lines[1]));
    sat.appendChild(sv("text",{x:c[0].toFixed(1),y:(c[1]+21).toFixed(1),"text-anchor":"middle","class":"tag"},["TIER 1 → SKIM","TIER 2 → LIST","TIER 3 → LIST"][ix]));
    sat.appendChild(sv("title",{},t.name+" · "+TIERNAME[ix]+": "+lines.join(", ")));
    var act=function(){ jumpTier(t.id,ix+1); };
    sat.addEventListener("click",act);
    sat.addEventListener("keydown",function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); act(); } });
    g.appendChild(sat);
  });
  svg.appendChild(g);
  var c=pt(RT,ANG[t.id]);
  var node=sv("g",{"class":"tnode",tabindex:"0",role:"button","aria-label":"Stop "+t.id+": "+t.name});
  node.appendChild(sv("circle",{cx:c[0].toFixed(1),cy:c[1].toFixed(1),r:RN}));
  node.appendChild(sv("text",{x:c[0].toFixed(1),y:(c[1]-18).toFixed(1),"text-anchor":"middle","class":"num"},String(t.id)));
  node.appendChild(sv("text",{x:c[0].toFixed(1),y:(c[1]+2).toFixed(1),"text-anchor":"middle","class":"lab"},t.short[0]));
  node.appendChild(sv("text",{x:c[0].toFixed(1),y:(c[1]+20).toFixed(1),"text-anchor":"middle","class":"lab"},t.short[1]||""));
  node.addEventListener("click",function(){select(t.id);});
  node.addEventListener("keydown",function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); select(t.id);} });
  nodes.push(node);
  spoke[t.id]={g:g,node:node};
});
nodes.forEach(function(n){ svg.appendChild(n); });
var pad=16;
svg.setAttribute("viewBox",[(minX-pad).toFixed(0),(minY-pad).toFixed(0),(maxX-minX+2*pad).toFixed(0),(maxY-minY+2*pad).toFixed(0)].join(" "));

STOPS.forEach(function(t){
  var b=el("button",{type:"button","aria-pressed":"false","data-stop":t.id,title:"Open the Tier 1 skim guide for this stop"},t.id+" · "+esc(t.name)+'<span class="go-skim" aria-hidden="true"> \u2191</span>');
  b.setAttribute("aria-label","Stop "+t.id+": "+t.name+". Open the Tier 1 skim guide for this stop.");
  b.addEventListener("click",function(){ jumpTier(t.id,1); });
  topicbar.appendChild(b);
});
function readingLine(r){
  if(r.tier===3){
    var head=r.url?'<a class="out" href="'+esc(r.url)+'" target="_blank" rel="noopener">'+esc(r.title)+'</a>':'<b>'+esc(r.title)+'</b>';
    return head+' <span class="src">· '+esc(r.src)+' · '+esc(r.date)+'</span>';
  }
  var b=T.books[r.book];
  return '<span class="src">'+esc(b.short)+' · '+esc(r.where)+' ·</span> '+esc(r.title)+' <span class="ref">'+esc(r.pages)+'</span>';
}
var current=1;
function renderDetail(id){
  var t=stop(id);
  var html='<div class="eyebrow">Stop '+t.id+' of '+N+' · readings on this spoke</div><h3>'+esc(t.name)+'</h3><p class="plain">'+esc(t.plain)+'</p>'+
    '<div class="go"><button type="button" data-act="skim" data-stop="'+id+'"><span class="tierchip t1">Tier 1</span>Skim guide for this stop</button>'+
    '<button type="button" data-act="tier" data-tier="1" data-stop="'+id+'"><span class="tierchip t1">Tier 1</span>List</button>'+
    '<button type="button" data-act="tier" data-tier="2" data-stop="'+id+'"><span class="tierchip t2">Tier 2</span>List</button>'+
    '<button type="button" data-act="tier" data-tier="3" data-stop="'+id+'"><span class="tierchip t3">Tier 3</span>List</button></div><div class="tgs">';
  [1,2,3].forEach(function(n){
    var items=R.filter(function(r){return r.tier===n && r.st.indexOf(id)>-1 && !r.hideInDetail;});
    html+='<div class="tg g'+n+'"><h4><span class="tierchip t'+n+'">'+TIERNAME[n-1]+'</span></h4><ul>'+(items.length?items.map(function(r){return "<li>"+readingLine(r)+"</li>";}).join(""):'<li class="muted">Nothing in this tier for this stop.</li>')+'</ul></div>';
  });
  html+='</div>';
  var rel=(T.links||[]).filter(function(L){return L.a===id||L.b===id;});
  var pos=STOPS.map(function(s){return s.id;}).indexOf(id);
  var prev=pos>0?'<li>Comes after stop '+STOPS[pos-1].id+': '+esc(STOPS[pos-1].name)+'.</li>':'';
  var next=pos<N-1?'<li>Leads to stop '+STOPS[pos+1].id+': '+esc(STOPS[pos+1].name)+'.</li>':'';
  html+='<div class="links"><b>Connects to</b><ul>'+prev+next+rel.map(function(L){var o=L.a===id?L.b:L.a; return '<li>Stop '+o+' ('+esc(stop(o).name)+'): '+esc(L.text)+'</li>';}).join("")+(t.elsewhere?'<li>'+t.elsewhere+'</li>':'')+'</ul></div>';
  detail.innerHTML=html;
}
function select(id){
  current=id;
  STOPS.forEach(function(t){ var on=t.id===id; spoke[t.id].g.classList.toggle("dim",!on); spoke[t.id].node.classList.toggle("sel",on); });
  chordEls.forEach(function(c){ c.el.classList.toggle("crosssel", !c.L.loop && (c.L.a===id||c.L.b===id)); });
  Array.prototype.forEach.call(topicbar.querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",String(Number(b.getAttribute("data-stop"))===id));});
  renderDetail(id);
}

/* ---------- Reading lists ---------- */
var lw=section("lists","Reading lists · book, section and page","Everything to read, by tier","Tick items off as you go; the ticks stay in this browser only. Use the buttons to show one stop at a time.");
var filters=el("div",{class:"filters",role:"group","aria-label":"Filter by stop"},'<span class="lbl">Show:</span>'); lw.appendChild(filters);
var progress=el("p",{class:"progress"}); lw.appendChild(progress);
var listBoxes={};
[1,2,3].forEach(function(n){
  var blk=el("div",{class:"tierblock b"+n,id:"tier"+n});
  blk.innerHTML='<div class="th"><h3>'+TIERNAME[n-1]+'</h3><span class="count"></span><p>'+esc(T.tierIntro[n-1])+'</p></div>';
  var box=el("div",{}); blk.appendChild(box); lw.appendChild(blk);
  listBoxes[n]={box:box,count:blk.querySelector(".count")};
});
var filter=0;
[{id:0,name:"All stops"}].concat(STOPS).forEach(function(t){
  var b=el("button",{type:"button","aria-pressed":String(t.id===0),"data-f":t.id}, t.id===0?"All stops":(t.id+" · "+esc(t.name)));
  b.addEventListener("click",function(){setFilter(t.id);});
  filters.appendChild(b);
});
function itemHTML(r){
  var chk='<input type="checkbox" aria-label="Mark as read"'+(isRead(r)?' checked':'')+'>';
  var tags='<div class="meta">'+r.st.map(function(id){return '<span>'+id+' · '+esc(stop(id).short.join(" "))+'</span>';}).join("")+'</div>';
  if(r.tier===3){
    var title=r.url?'<a class="out" href="'+esc(r.url)+'" target="_blank" rel="noopener">'+esc(r.title)+'</a>':esc(r.title);
    return chk+'<div class="main"><div class="where">'+esc(r.src)+'</div><div class="title">'+title+'</div><p class="why">'+esc(r.why)+'</p>'+tags+'</div><span class="pg">'+esc(r.date)+'</span>';
  }
  return chk+'<div class="main"><div class="where">'+esc(r.where)+'</div><div class="title">'+esc(r.title)+'</div><p class="why">'+esc(r.why)+'</p>'+tags+(COVER[r.id]?'<div class="cov"></div>':'')+'</div><span class="pg'+(r.unv?' unv':'')+'">'+esc(r.pages)+'</span>';
}
function renderLists(){
  [1,2,3].forEach(function(n){
    var box=listBoxes[n].box; box.innerHTML="";
    if(n===1) listEls={};
    var items=byTier(n).filter(function(r){return filter===0 || r.st.indexOf(filter)>-1;});
    listBoxes[n].count.textContent=items.length+(filter===0?" items":" for stop "+filter);
    if(!items.length){ box.appendChild(el("p",{class:"empty"},"Nothing in this tier for this stop.")); return; }
    var groups=[], keyOf=function(r){return n===3?r.group:r.book;};
    items.forEach(function(r){var k=keyOf(r); var g=groups.filter(function(x){return x.k===k;})[0]; if(!g){g={k:k,items:[]};groups.push(g);} g.items.push(r);});
    groups.forEach(function(g){
      var lab;
      if(n===3){ lab=el("div",{class:"booklabel"},esc(g.k)); }
      else {
        var b=T.books[g.k];
        var sk=(n===1 && b.skim)?b.skim:"";
        lab=el("div",{class:"booklabel"},esc(b.label)+' <small>'+esc(b.sub)+(sk?' · <button class="linkish" type="button" data-skimbook="'+sk+'">page-by-page skim guide</button>':'')+'</small>');
      }
      box.appendChild(lab);
      var ul=el("ul",{class:"items"});
      g.items.forEach(function(r){
        var li=el("li",{},itemHTML(r)), inp=li.querySelector("input");
        listEls[r.id]={r:r,li:li,input:inp,cov:li.querySelector(".cov")};
        inp.addEventListener("change",function(e){
          var c=COVER[r.id];
          if(c) c.forEach(function(k){ setParts(PAGE[k].parts,e.target.checked); });
          else { if(e.target.checked) done[r.id]=1; else delete done[r.id]; }
          saveDone();
        });
        ul.appendChild(li);
      });
      box.appendChild(ul);
    });
  });
  syncAll();
}
function updateProgress(){
  var c=[1,2,3].map(function(n){var all=byTier(n); return all.filter(isRead).length+" of "+all.length;});
  progress.textContent="Read so far: Tier 1 "+c[0]+" · Tier 2 "+c[1]+" · Tier 3 "+c[2]+".";
}
function setFilter(id){
  filter=id;
  Array.prototype.forEach.call(filters.querySelectorAll("button"),function(b){b.setAttribute("aria-pressed",String(Number(b.getAttribute("data-f"))===id));});
  renderLists();
}

/* ---------- Extras and notes ---------- */
(T.extras||[]).forEach(function(x){ var w=section(x.id,x.eyebrow,x.title,x.intro); w.appendChild(el("div",{},x.html)); });
if(window.SMMGlossary){
  var gsec=section("glossary","Glossary · Module "+MOD.n,"Module "+MOD.n+" glossary","Key terms from this module's topic pages, A to Z. Tap a letter to open its terms; each one links to the topic and stop where it is taught.");
  var gbox=el("div",{}); gsec.appendChild(gbox);
  SMMGlossary.render(gbox,MOD,T.file.replace(/\.html$/,""),{noTitle:true});
}
var nw=section("notes","Notes on editions and page numbers","What was checked, and what was not");
nw.appendChild(el("div",{class:"notes"},T.notes.map(function(p){return "<p>"+p+"</p>";}).join("")));
app.appendChild(el("footer",{},'<div class="wrap">'+T.footer+'</div>'));

/* ---------- Jumps from the map, road map and panels ---------- */
function jumpTier(id,tier){
  select(id);
  if(tier===1){ setSkimStop(id); go("skim"); }
  else { setFilter(id); go("tier"+tier); }
}
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-act],[data-clear],[data-skimbook]"); if(!b) return;
  if(b.hasAttribute("data-skimbook")){ setSkimStop(0); setSkimBook(b.getAttribute("data-skimbook")); go("skim"); return; }
  if(b.getAttribute("data-clear")==="skim"){ setSkimStop(0); return; }
  var id=Number(b.getAttribute("data-stop")), a=b.getAttribute("data-act");
  if(a==="skim"){ select(id); setSkimStop(id); go("skim"); }
  else if(a==="map"){ select(id); go("map"); }
  else if(a==="list"){ setFilter(id); go("tier1"); }
  else if(a==="tier"){ setFilter(id); go("tier"+b.getAttribute("data-tier")); }
});

renderSkim();
select(1);
renderLists();
updateReadbar();
/* links such as m2-planning.html#stop-4 (from a glossary) land on that stop and highlight it */
function goHash(){
  var h=(location.hash||"").slice(1), m=/^stop-(\d+)$/.exec(h); if(!m) return;
  var target=document.getElementById(h); if(!target) return;
  select(Number(m[1]));
  setTimeout(function(){ target.scrollIntoView({block:"start"}); target.classList.add("flash"); setTimeout(function(){ target.classList.remove("flash"); },2400); },60);
}
goHash();
window.addEventListener("hashchange",goHash);
})();
