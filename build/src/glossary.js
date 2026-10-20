/* Module glossary widget: a row of letter circles in the module colour.
   Tapping a letter opens that letter's terms, each with a short meaning, its source,
   and links to the topic page and stop where it is taught.
   Needs window.CATALOG, window.GLOSSARY and window.STOPNAMES (added by build.py). */
window.SMMGlossary = (function(){
"use strict";
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function letterOf(t){ var c=t.replace(/^[^A-Za-z0-9]+/,"").charAt(0).toUpperCase(); return /[A-Z]/.test(c)?c:"#"; }
var LETTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
function sessionOf(file){
  var C=window.CATALOG, s="";
  C.modules.forEach(function(m){ m.topics.forEach(function(t){ if(t.file===file+".html") s=t.s; }); });
  return s;
}
function linkFor(at,current){
  var file=at[0], stop=at[1], names=(window.STOPNAMES||{})[file]||{};
  var href=(current===file?"":file+".html")+"#stop-"+stop;
  var label=sessionOf(file)+" · "+(names[stop]||("Stop "+stop));
  return '<a class="gl-go" href="'+href+'">'+esc(label)+' <span aria-hidden="true">→</span></a>';
}
function render(box,mod,current,opts){
  opts=opts||{};
  var terms=((window.GLOSSARY||{})[mod.id]||[]).slice().sort(function(a,b){ return a.t.toLowerCase().localeCompare(b.t.toLowerCase()); });
  var uid="gl-"+mod.id+"-"+Math.random().toString(36).slice(2,7);
  if(!terms.length){
    box.innerHTML='<div class="gloss empty-gl"><div class="gl-head"><h3>Module '+mod.n+' glossary</h3></div><p class="muted">Terms will be added here as this module\'s topic pages are written.</p></div>';
    return;
  }
  var by={}; terms.forEach(function(t){ var L=letterOf(t.t); (by[L]=by[L]||[]).push(t); });
  var letters=LETTERS.map(function(L){
    var n=(by[L]||[]).length;
    return '<button type="button" class="gl-l" data-l="'+L+'"'+(n?' aria-expanded="false" aria-controls="'+uid+'-panel" title="'+n+' term'+(n>1?'s':'')+'"':' disabled title="No terms"')+'>'+L+'</button>';
  }).join("");
  box.innerHTML='<div class="gloss">'+
    '<div class="gl-head">'+(opts.noTitle?'':'<h3>Module '+mod.n+' glossary</h3>')+'<span class="gl-count">'+terms.length+' terms</span>'+
    '<button type="button" class="linkish gl-all" aria-expanded="false" aria-controls="'+uid+'-panel">Show all terms</button></div>'+
    (opts.noTitle?'':'<p class="gl-hint">Tap a letter to see its terms. Each term links to the topic and stop where it is taught.</p>')+
    '<div class="gl-letters" role="group" aria-label="Glossary letters">'+letters+'</div>'+
    '<div class="gl-panel" id="'+uid+'-panel" role="region" aria-live="polite" hidden></div></div>';
  var panel=box.querySelector(".gl-panel"), open=null;
  function itemHTML(t){
    var links=[], seen={};
    t.at.forEach(function(a){ var k=a[0]+"#"+a[1]; if(!seen[k]){ seen[k]=1; links.push(linkFor(a,current)); } });
    return '<div class="gl-item"><dt>'+esc(t.t)+'</dt><dd><p>'+esc(t.d)+'</p><div class="gl-meta"><span class="ref">'+esc(t.src)+'</span>'+
      '<span class="gl-links"><span class="gl-rm">Read more:</span> '+links.join(" ")+'</span></div></dd></div>';
  }
  function show(L){
    open=L;
    Array.prototype.forEach.call(box.querySelectorAll(".gl-l"),function(b){ if(!b.disabled) b.setAttribute("aria-expanded",String(b.getAttribute("data-l")===L)); });
    box.querySelector(".gl-all").setAttribute("aria-expanded",String(L==="*"));
    box.querySelector(".gl-all").textContent=L==="*"?"Hide all terms":"Show all terms";
    if(!L){ panel.hidden=true; panel.innerHTML=""; return; }
    var html="";
    if(L==="*"){
      LETTERS.forEach(function(x){ if(by[x]) html+='<div class="gl-group"><div class="gl-big" aria-hidden="true">'+x+'</div><dl>'+by[x].map(itemHTML).join("")+'</dl></div>'; });
    } else {
      html='<div class="gl-group"><div class="gl-big" aria-hidden="true">'+L+'</div><dl>'+by[L].map(itemHTML).join("")+'</dl></div>';
    }
    panel.innerHTML='<div class="gl-panelhead"><b>'+(L==="*"?"All "+terms.length+" terms":L+" · "+by[L].length+" term"+(by[L].length>1?"s":""))+'</b><button type="button" class="linkish gl-close">Close</button></div>'+html;
    panel.hidden=false;
  }
  box.addEventListener("click",function(e){
    var b=e.target.closest(".gl-l,.gl-all,.gl-close"); if(!b || b.disabled) return;
    if(b.classList.contains("gl-close")){ var was=open; show(null); var f=box.querySelector(was==="*"?".gl-all":'.gl-l[data-l="'+was+'"]'); if(f) f.focus(); return; }
    var L=b.classList.contains("gl-all")?"*":b.getAttribute("data-l");
    show(open===L?null:L);
  });
}
return {render:render};
})();
