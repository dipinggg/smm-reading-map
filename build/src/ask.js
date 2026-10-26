/* "Ask a doubt" on topic pages.
   Point at something (a stop, a skim page, a reading, a glossary term, or any text you select),
   type the doubt, and send it to Claude with that part of the guide attached as context.
   - Everywhere: "Open in Claude" starts a new Claude chat with the doubt filled in (and copies it).
   - Inside the Claude-hosted version, when the page may use Claude: "Ask here" answers in the panel.
   Doubts are saved in this browser so they can be revisited. Needs window.TOPIC, window.CATALOG. */
(function(){
"use strict";
var T=window.TOPIC, C=window.CATALOG; if(!T) return;
var MOD=C.modules.filter(function(m){return m.id===T.module;})[0];
var LOGKEY="smm-rm-ask-"+T.id, PROJKEY="smm-rm-ask-project";
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function el(tag,attrs,html){var e=document.createElement(tag); if(attrs){for(var k in attrs){ if(k==="class") e.className=attrs[k]; else e.setAttribute(k,attrs[k]); }} if(html!=null) e.innerHTML=html; return e;}
function load(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)||"null"); return v==null?d:v; }catch(e){ return d; } }
function store(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function clip(s,n){ s=String(s).replace(/\s+/g," ").trim(); return s.length>n?s.slice(0,n-1)+"…":s; }

/* ---------- what each kind of pointer tells Claude ---------- */
function stopById(id){ return T.stops.filter(function(s){return s.id===Number(id);})[0]; }
function ctxTopic(){
  return {label:"The whole topic", lines:[T.lede.replace(/<[^>]+>/g,""), "Stops: "+T.stops.map(function(s){return s.id+". "+s.name;}).join("; ")]};
}
function ctxStop(id){
  var s=stopById(id); if(!s) return ctxTopic();
  return {label:"Stop "+s.id+" · "+s.name, lines:[s.plain].concat(s.learn.map(function(l){return l[0]+(l[1] && l[0].indexOf(l[1])<0?" ("+l[1]+")":"");})).concat(["Likely exam question: "+s.ask])};
}
function ctxSkim(key){
  var found=null;
  (T.skim||[]).forEach(function(B){ B.pages.forEach(function(pg){ if("skim-"+B.key+"-"+pg.p===key) found={B:B,pg:pg}; }); });
  if(!found) return ctxTopic();
  var B=found.B, pg=found.pg, book=(B.label||"").split(" · ")[0];
  var ACT={read:"Read",skim:"Skim",glance:"Glance",skip:"Skip"};
  return {label:"Skim guide · "+book+" · "+(pg.pl||"p. "+pg.p)+" · "+pg.h,
          lines:pg.b.map(function(b){return ACT[b.a]+": "+b.w+(b.t?" — "+b.t:"");}).concat([B.note||""])};
}
function ctxReading(id){
  var r=T.readings.filter(function(x){return x.id===id;})[0]; if(!r) return ctxTopic();
  if(r.tier===3) return {label:"Tier 3 reading · "+r.title, lines:[r.src+", "+r.date, r.why, r.url||""]};
  var b=T.books[r.book]||{};
  return {label:"Tier "+r.tier+" reading · "+(b.short||"")+" · "+r.where+" · "+r.pages, lines:[r.title, r.why, (b.label||"")+(r.unv?" (page numbers not checked)":"")]};
}
function ctxTerm(name){
  var t=((window.GLOSSARY||{})[T.module]||[]).filter(function(x){return x.t===name;})[0];
  if(!t) return ctxTopic();
  return {label:"Glossary · "+t.t, lines:[t.d, "Source: "+t.src]};
}
function ctxSection(sec){
  var h=sec.querySelector("h2"), ey=sec.querySelector(".eyebrow");
  return {label:(ey?ey.textContent+" · ":"")+(h?h.textContent:"This section"), lines:[]};
}
function ctxFromNode(node){
  if(!node || !node.closest) return ctxTopic();
  var n;
  if((n=node.closest(".stop"))) return ctxStop(n.id.replace("stop-",""));
  if((n=node.closest(".skimrow"))) return ctxSkim(n.getAttribute("data-key"));
  if((n=node.closest("ul.items li[data-rid]"))) return ctxReading(n.getAttribute("data-rid"));
  if((n=node.closest(".gl-item[data-term]"))) return ctxTerm(n.getAttribute("data-term"));
  if((n=node.closest(".detail"))){ var sel=document.querySelector('.topicbar button[aria-pressed="true"]'); if(sel) return ctxStop(sel.getAttribute("data-stop")); }
  if((n=node.closest("section.block"))) return ctxSection(n);
  return ctxTopic();
}

/* ---------- the message sent to Claude ---------- */
function buildPrompt(ctx,quote,q,short){
  var lineCap=short?180:400, maxLines=short?5:14;
  var lines=ctx.lines.filter(Boolean).slice(0,maxLines).map(function(l){return "- "+clip(l,lineCap);});
  var parts=[
    "I teach 22MDM32 Social Media Marketing (MBA) and I'm preparing this topic from my reading guide.",
    "Topic: "+T.session+" · "+T.title+" (Module "+MOD.n+": "+MOD.title+")",
    "Where I'm reading: "+ctx.label
  ];
  if(lines.length) parts.push("What my guide says there:\n"+lines.join("\n"));
  if(quote) parts.push("The text I selected:\n“"+clip(quote,short?400:1200)+"”");
  parts.push("My doubt: "+(q||"(please explain this part)"));
  parts.push("Please answer in simple, plain language. If the answer is in the book pages listed above, point me to the page, but don't invent page numbers. Give an Indian example if it helps.");
  return parts.join("\n\n");
}
function claudeUrl(prompt){ return "https://claude.ai/new?q="+encodeURIComponent(prompt); }
function urlPrompt(ctx,quote,q){
  var p=buildPrompt(ctx,quote,q,false); if(p.length<=1800) return p;
  p=buildPrompt(ctx,quote,q,true); return p.length<=1800?p:p.slice(0,1790)+"…";
}

/* ---------- copying ---------- */
function copyText(s){
  if(navigator.clipboard && window.isSecureContext){ return navigator.clipboard.writeText(s).then(function(){return true;},function(){ return legacyCopy(s); }); }
  return Promise.resolve(legacyCopy(s));
}
function legacyCopy(s){
  var ta=el("textarea",{"aria-hidden":"true",style:"position:fixed;left:-9999px;top:0"}); ta.value=s; document.body.appendChild(ta); ta.select();
  var ok=false; try{ ok=document.execCommand("copy"); }catch(e){ ok=false; } ta.remove(); return ok;
}

/* ---------- a little Markdown for Claude's answers (escaped first) ---------- */
function md(src){
  var out=[], list=null;
  esc(src).split(/\n/).forEach(function(line){
    var b=line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    var h=line.match(/^\s*#{1,4}\s+(.*)$/);
    function inline(t){ return t.replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*/g,"$1<i>$2</i>").replace(/`([^`]+)`/g,"<code>$1</code>"); }
    if(b){ if(!list){ list=[]; } list.push("<li>"+inline(b[1])+"</li>"); return; }
    if(list){ out.push("<ul>"+list.join("")+"</ul>"); list=null; }
    if(h) out.push("<p><b>"+inline(h[1])+"</b></p>");
    else if(line.trim()) out.push("<p>"+inline(line)+"</p>");
  });
  if(list) out.push("<ul>"+list.join("")+"</ul>");
  return out.join("");
}

/* ---------- floating button and panel ---------- */
var fab=el("button",{type:"button",class:"ask-fab","aria-haspopup":"dialog"},'<span class="q" aria-hidden="true">?</span><span class="lab">Ask a doubt</span>');
document.body.appendChild(fab);
var panel=el("div",{class:"ask-panel",role:"dialog","aria-modal":"false","aria-labelledby":"ask-title"});
panel.hidden=true;
panel.innerHTML=
 '<div class="ask-top"><h2 id="ask-title">Ask a doubt</h2><button type="button" class="ask-x" aria-label="Close">×</button></div>'+
 '<div class="ask-body">'+
  '<div class="ask-ctx"><div class="ask-ctx-l"><span class="eyebrow">About</span><b class="ask-where"></b></div><button type="button" class="linkish ask-widen">Ask about the whole topic</button></div>'+
  '<blockquote class="ask-quote" hidden></blockquote>'+
  '<label class="ask-lab" for="ask-q">Your doubt</label>'+
  '<textarea id="ask-q" rows="4" placeholder="Type your doubt. For example: what is the difference between these two ideas, and which one matters more?"></textarea>'+
  '<div class="ask-chips" role="group" aria-label="Quick prompts">'+
   ['Explain this in simple words','Give me an Indian example','How do I explain this in class?','What could the exam ask, with a model answer?','How is this different from a related idea?'].map(function(c){return '<button type="button" class="ask-chip">'+c+'</button>';}).join("")+
  '</div>'+
  '<div class="ask-actions">'+
   '<button type="button" class="ask-btn primary ask-here" hidden>Ask here</button>'+
   '<a class="ask-btn ask-open" target="_blank" rel="noopener" href="https://claude.ai/new">Open in Claude ↗</a>'+
   '<a class="ask-btn ask-proj" target="_blank" rel="noopener" href="#" hidden>Open in my project ↗</a>'+
   '<button type="button" class="ask-btn ask-copy">Copy</button>'+
  '</div>'+
  '<p class="ask-status" aria-live="polite"></p>'+
  '<div class="ask-answer" hidden><div class="ask-ans-head"><span class="eyebrow">Claude’s answer</span><button type="button" class="linkish ask-stop" hidden>Stop</button></div><div class="ask-thread"></div>'+
   '<div class="ask-follow"><textarea rows="2" placeholder="Ask a follow-up…" aria-label="Follow-up question"></textarea><button type="button" class="ask-btn primary ask-send">Send</button></div></div>'+
  '<details class="ask-help"><summary>How this works</summary>'+
   '<p><b>Open in Claude</b> starts a new Claude chat with your doubt and this part of the guide already filled in. It also copies the same text, in case the chat opens empty: then just paste.</p>'+
   '<p><b>For answers from your own book copies</b>, ask inside your Claude project that holds the books: paste your project’s link below once, and an <b>Open in my project</b> button appears. It copies the doubt and opens the project; paste it there.</p>'+
   '<div class="ask-projset"><input type="url" placeholder="https://claude.ai/project/…" aria-label="Your Claude project link"><button type="button" class="ask-btn ask-projsave">Save link</button></div>'+
   '<p class="ask-heretip" hidden><b>Ask here</b> answers inside this page using your Claude account. The first time, Claude asks you to allow it. It sees only what this page sends, not your books.</p>'+
  '</details>'+
  '<details class="ask-log"><summary>Your earlier doubts on this page <span class="ask-logn"></span></summary><ul></ul></details>'+
 '</div>';
document.body.appendChild(panel);

var $=function(sel){return panel.querySelector(sel);};
var qBox=$("#ask-q"), whereEl=$(".ask-where"), quoteEl=$(".ask-quote"), status=$(".ask-status");
var openA=$(".ask-open"), projA=$(".ask-proj"), hereBtn=$(".ask-here"), answer=$(".ask-answer"), thread=$(".ask-thread"), stopBtn=$(".ask-stop");
var cur={ctx:ctxTopic(),quote:null}, opener=null, sample=null, turns=[], ctl=null;

function refreshLinks(){
  var p=urlPrompt(cur.ctx,cur.quote,qBox.value.trim());
  openA.href=claudeUrl(p);
  var proj=load(PROJKEY,"");
  projA.hidden=!proj; if(proj) projA.href=proj;
}
function openAsk(ctx,quote,from){
  cur={ctx:ctx||ctxTopic(),quote:quote||null};
  opener=from||document.activeElement;
  whereEl.textContent=cur.ctx.label;
  $(".ask-widen").hidden=cur.ctx.label==="The whole topic" && !cur.quote;
  quoteEl.hidden=!cur.quote; quoteEl.textContent=cur.quote?"“"+clip(cur.quote,500)+"”":"";
  status.textContent=""; turns=[]; thread.innerHTML=""; answer.hidden=true;
  panel.hidden=false; document.body.classList.add("asking");
  refreshLinks(); renderLog();
  setTimeout(function(){ qBox.focus(); },30);
}
function closeAsk(){
  if(ctl) ctl.abort();
  panel.hidden=true; document.body.classList.remove("asking");
  if(opener && opener.focus) opener.focus();
}

/* save each doubt in this browser */
function logDoubt(q,a){
  var log=load(LOGKEY,[]);
  log.unshift({w:cur.ctx.label,q:q,a:a||"",t:Date.now()});
  store(LOGKEY,log.slice(0,50)); renderLog();
}
function renderLog(){
  var log=load(LOGKEY,[]), ul=$(".ask-log ul");
  $(".ask-logn").textContent=log.length?"("+log.length+")":"";
  $(".ask-log").hidden=!log.length;
  ul.innerHTML=log.map(function(d,i){
    var when=new Date(d.t);
    return '<li><div class="ask-logw">'+esc(d.w)+' · '+when.toLocaleDateString()+'</div><div class="ask-logq">'+esc(d.q)+'</div>'+
      (d.a?'<details><summary>Answer</summary><div class="ask-md">'+md(d.a)+'</div></details>':'')+
      '<div class="ask-logb"><button type="button" class="linkish" data-again="'+i+'">Ask again</button><button type="button" class="linkish" data-del="'+i+'">Delete</button></div></li>';
  }).join("");
}

/* ---------- actions ---------- */
qBox.addEventListener("input",refreshLinks);
$(".ask-chips").addEventListener("click",function(e){
  var b=e.target.closest(".ask-chip"); if(!b) return;
  var v=qBox.value.trim(); qBox.value=v?(v+" "+b.textContent+"."):b.textContent+"."; qBox.focus(); refreshLinks();
});
$(".ask-widen").addEventListener("click",function(){ openAsk(ctxTopic(),null,opener); });
$(".ask-x").addEventListener("click",closeAsk);
document.addEventListener("keydown",function(e){ if(e.key==="Escape" && !panel.hidden) closeAsk(); });
function needQuestion(){ if(qBox.value.trim()) return false; status.textContent="Type your doubt first, or tap one of the quick prompts."; qBox.focus(); return true; }
openA.addEventListener("click",function(e){
  if(needQuestion()){ e.preventDefault(); return; }
  var full=buildPrompt(cur.ctx,cur.quote,qBox.value.trim(),false);
  copyText(full).then(function(ok){ status.textContent=ok?"Opening Claude. The doubt is also copied: paste it if the chat opens empty.":"Opening Claude. If the chat opens empty, use Copy and paste."; });
  logDoubt(qBox.value.trim());
});
projA.addEventListener("click",function(e){
  if(needQuestion()){ e.preventDefault(); return; }
  var full=buildPrompt(cur.ctx,cur.quote,qBox.value.trim(),false);
  copyText(full).then(function(ok){ status.textContent=ok?"Copied. In your project, start a chat and paste.":"Copy didn’t work here: use the Copy button, then paste in your project."; });
  logDoubt(qBox.value.trim());
});
$(".ask-copy").addEventListener("click",function(){
  if(needQuestion()) return;
  var full=buildPrompt(cur.ctx,cur.quote,qBox.value.trim(),false);
  copyText(full).then(function(ok){
    if(ok){ status.textContent="Copied. Paste it into any Claude chat."; }
    else { status.innerHTML="Copy is blocked here. Select the text below and copy it yourself."; var pre=el("textarea",{class:"ask-manual",rows:"6"}); pre.value=full; status.appendChild(pre); pre.select(); }
  });
});
$(".ask-projsave").addEventListener("click",function(){
  var v=$(".ask-projset input").value.trim();
  if(v && !/^https:\/\/claude\.ai\//.test(v)){ status.textContent="That doesn’t look like a claude.ai link. It should start with https://claude.ai/"; return; }
  store(PROJKEY,v); refreshLinks();
  status.textContent=v?"Saved. Use “Open in my project” to ask with your books.":"Project link removed.";
});
$(".ask-projset input").value=load(PROJKEY,"");
$(".ask-log").addEventListener("click",function(e){
  var a=e.target.closest("[data-again]"), d=e.target.closest("[data-del]"), log=load(LOGKEY,[]);
  if(a){ var it=log[Number(a.getAttribute("data-again"))]; if(it){ qBox.value=it.q; refreshLinks(); qBox.focus(); } }
  if(d){ log.splice(Number(d.getAttribute("data-del")),1); store(LOGKEY,log); renderLog(); }
});

/* ---------- answering inside the page (Claude-hosted version only) ---------- */
var CODES={not_granted:"Claude isn’t allowed to answer inside this page. Use Open in Claude instead.",sampling_disabled:"Claude can’t answer inside this page for this account. Use Open in Claude instead.",rate_limited:"Too many questions just now. Wait a little, or use Open in Claude.",session_expired:"Please sign in to Claude again.",refused:"Claude didn’t answer this one. Try rewording it.",prompt_too_large:"That was too long to send. Select less text."};
function hideHere(msg){ hereBtn.hidden=true; $(".ask-heretip").hidden=true; sample=null; if(msg) status.textContent=msg; }
function ask(content,isFollow){
  if(!sample) return;
  turns.push({role:"user",content:content});
  answer.hidden=false;
  if(isFollow){ thread.appendChild(el("div",{class:"ask-you"},esc(content))); }
  var bubble=el("div",{class:"ask-md ask-claude"},'<p class="muted">Thinking…</p>'); thread.appendChild(bubble);
  ctl=new AbortController(); stopBtn.hidden=false; hereBtn.disabled=true; $(".ask-send").disabled=true;
  sample(turns.slice(-12),{cache:false,signal:ctl.signal,onText:function(u){ bubble.innerHTML=md(u.text); }}).then(function(r){
    bubble.innerHTML=md(r.text); turns.push({role:"assistant",content:r.text});
    if(r.truncated) bubble.appendChild(el("p",{class:"muted"},"(Cut short. Ask for less at a time.)"));
    if(!isFollow) logDoubt(qBox.value.trim(),r.text);
  },function(e){
    turns.pop();
    if(e && e.text){ bubble.innerHTML=md(e.text); } else bubble.remove();
    var code=e&&e.code;
    if(code==="cancelled") return;
    if(["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].indexOf(code)>-1) hideHere(CODES[code]||CODES.not_granted);
    else status.textContent=CODES[code]||"Something went wrong. Try again, or use Open in Claude.";
  }).then(function(){ stopBtn.hidden=true; hereBtn.disabled=false; $(".ask-send").disabled=false; ctl=null; });
}
hereBtn.addEventListener("click",function(){
  if(needQuestion()) return;
  status.textContent=""; turns=[]; thread.innerHTML="";
  ask(buildPrompt(cur.ctx,cur.quote,qBox.value.trim(),false),false);
});
$(".ask-send").addEventListener("click",function(){
  var ta=$(".ask-follow textarea"), v=ta.value.trim(); if(!v || !sample) return;
  ta.value=""; ask(v,true);
});
stopBtn.addEventListener("click",function(){ if(ctl) ctl.abort(); });
if(window.claude && typeof window.claude.use==="function"){
  window.claude.use("sample").then(function(s){
    if(!s) return;
    sample=s; hereBtn.hidden=false; $(".ask-heretip").hidden=false;
  },function(){});
}

/* ---------- pointing: buttons, and selected text ---------- */
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-ask]"); if(!b) return;
  var k=b.getAttribute("data-ask"), id=b.getAttribute("data-id");
  var ctx=k==="stop"?ctxStop(id):k==="skim"?ctxSkim(id):k==="reading"?ctxReading(id):k==="term"?ctxTerm(id):ctxTopic();
  openAsk(ctx,null,b);
});
var lastSel=null, appEl=document.getElementById("app");
document.addEventListener("selectionchange",function(){
  var s=window.getSelection(), txt=s?String(s).trim():"";
  if(txt.length>2 && s.anchorNode && appEl && appEl.contains(s.anchorNode)){
    lastSel={text:txt,node:s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement};
    fab.classList.add("sel"); fab.querySelector(".lab").textContent="Ask about the selected text";
  } else if(!txt){
    lastSel=null; fab.classList.remove("sel"); fab.querySelector(".lab").textContent="Ask a doubt";
  }
});
fab.addEventListener("pointerdown",function(e){ e.preventDefault(); });   /* keep the selection */
fab.addEventListener("click",function(){
  if(lastSel) openAsk(ctxFromNode(lastSel.node),lastSel.text,fab);
  else openAsk(ctxTopic(),null,fab);
});
window.SMMAsk={open:openAsk,ctxStop:ctxStop,ctxSkim:ctxSkim,buildPrompt:buildPrompt};
})();
