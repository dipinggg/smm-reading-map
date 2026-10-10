/* Hub: modules expand to show their topics; ready topics link to their own page. */
(function(){
"use strict";
var C=window.CATALOG;
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
var KEY="smm-rm-hub-open";
var open={};
try{ open=JSON.parse(localStorage.getItem(KEY)||"null"); }catch(e){ open=null; }
if(!open){ open={}; C.modules.forEach(function(m){ if(m.topics.some(function(t){return t.file;})) open[m.id]=1; }); }
var hash=(location.hash||"").replace("#","");
if(/^m[1-5]$/.test(hash)) open[hash]=1;
function save(){ try{ localStorage.setItem(KEY,JSON.stringify(open)); }catch(e){} }

/* reading progress saved by each topic page (ticked readings / all readings) */
function progressHTML(file){
  var p=null; try{ p=JSON.parse(localStorage.getItem("smm-rm-sum-"+file)||"null"); }catch(e){ p=null; }
  if(!p || !p.t || !p.d) return "";
  var pct=Math.floor(p.d*100/p.t), full=p.d>=p.t;
  return '<span class="tprog'+(full?' full':'')+'"><span class="tbar" aria-hidden="true"><i style="width:'+Math.min(100,p.d*100/p.t)+'%"></i></span>'+
    (full?'All '+p.t+' readings done':pct+'% read · '+p.d+' of '+p.t)+'</span>';
}

var total=0, readyN=0;
C.modules.forEach(function(m){ total+=m.topics.length; readyN+=m.topics.filter(function(t){return t.file;}).length; });
document.getElementById("statReady").textContent=readyN;
document.getElementById("statTotal").textContent=total;

var list=document.getElementById("modules");
C.modules.forEach(function(m){
  var r=m.topics.filter(function(t){return t.file;}).length;
  var li=document.createElement("li");
  li.className="module "+m.id+(open[m.id]?" open":"");
  li.id=m.id;
  var tid="topics-"+m.id;
  var rows=m.topics.map(function(t){
    if(t.file) return '<li class="ready"><span class="sn">'+esc(t.s)+'</span><span class="tn"><a href="'+t.file+'">'+esc(t.title)+'</a>'+progressHTML(t.file)+'</span><span class="st">Ready</span></li>';
    return '<li class="soon"><span class="sn">'+esc(t.s)+'</span><span class="tn">'+esc(t.title)+'</span><span class="st">Coming</span></li>';
  }).join("");
  li.innerHTML='<button type="button" aria-expanded="'+(open[m.id]?"true":"false")+'" aria-controls="'+tid+'">'+
    '<span class="mnum">'+m.n+'</span><span><span class="mtitle">'+esc(m.title)+'</span><span class="mmeta"><span>'+m.hours+' hours · '+m.topics.length+' topics · '+esc(m.topics[0].s)+'–'+esc(m.topics[m.topics.length-1].s)+'</span>'+(r?'<span class="ready">'+r+' ready</span>':'<span>none ready yet</span>')+'</span></span>'+
    '<span class="chev" aria-hidden="true"></span></button><ul class="topics" id="'+tid+'">'+rows+'</ul>';
  var ul=li.querySelector(".topics"); ul.hidden=!open[m.id];
  li.querySelector("button").addEventListener("click",function(){
    var on=!li.classList.contains("open");
    li.classList.toggle("open",on); ul.hidden=!on;
    this.setAttribute("aria-expanded",String(on));
    if(on) open[m.id]=1; else delete open[m.id];
    save();
  });
  list.appendChild(li);
});
if(/^m[1-5]$/.test(hash)){ var t=document.getElementById(hash); if(t) setTimeout(function(){ t.scrollIntoView({block:"start"}); },0); }
})();
