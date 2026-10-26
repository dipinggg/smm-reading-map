/* "Ask a doubt" on topic pages.
   Point at something (a stop, a skim page, a reading, a glossary term, or any text you select),
   type the doubt, and send it to Claude with that part of the guide attached as context.
   Every doubt goes to ONE ongoing chat:
   - Your doubts chat on claude.ai: start it once and link its address. After that each doubt is
     copied and that same chat opens, ready to paste. (A link can't type into a chat that exists.)
   - "Ask here" (Claude-hosted version only): answers inside the page, in one running chat shared
     by all topic pages and saved in this browser.
   Doubts are also listed per page so they can be revisited. Needs window.TOPIC, window.CATALOG. */
(function(){
"use strict";
var T=window.TOPIC, C=window.CATALOG; if(!T) return;
var MOD=C.modules.filter(function(m){return m.id===T.module;})[0];
var LOGKEY="smm-rm-ask-"+T.id, PROJKEY="smm-rm-ask-project", CHATKEY="smm-rm-ask-chat",
    COPYKEY="smm-rm-ask-copyonly", THREADKEY="smm-rm-ask-thread";
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

/* ---------- the messages sent to Claude ---------- */
var INTRO="I teach 22MDM32 Social Media Marketing (MBA) and I'm preparing my lectures from my reading guide.";
var HOW="Please answer in simple, plain language. If the answer is in the book pages my guide lists, point me to the page, but don't invent page numbers. Give an Indian example if it helps.";
/* the standing instructions at the top of a doubts chat */
var RULES=INTRO+" I'll ask my doubts one by one in this chat as I read. Each doubt says the topic, the part of the guide I'm on, and what my guide says there.\n\n"+HOW+" Keep each answer fairly short unless I ask for more.";
/* one doubt, with the part of the guide it points at */
function doubtText(ctx,quote,q,short){
  var lineCap=short?180:400, maxLines=short?5:14;
  var lines=ctx.lines.filter(Boolean).slice(0,maxLines).map(function(l){return "- "+clip(l,lineCap);});
  var parts=["Topic: "+T.session+" · "+T.title+" (Module "+MOD.n+": "+MOD.title+")", "Where I'm reading: "+ctx.label];
  if(lines.length) parts.push("What my guide says there:\n"+lines.join("\n"));
  if(quote) parts.push("The text I selected:\n“"+clip(quote,short?400:1200)+"”");
  parts.push("My doubt: "+(q||"(please explain this part)"));
  return parts.join("\n\n");
}
/* a stand-alone message for any chat (the Copy button) */
function buildPrompt(ctx,quote,q,short){ return [INTRO, doubtText(ctx,quote,q,short), HOW].join("\n\n"); }
/* the first message of a new doubts chat */
function startPrompt(ctx,quote,q,short){ return RULES+"\n\nMy first doubt:\n\n"+doubtText(ctx,quote,q,short); }
/* every later message in the same chat */
function nextPrompt(ctx,quote,q){ return "Next doubt.\n\n"+doubtText(ctx,quote,q,false); }
function claudeUrl(prompt){ return "https://claude.ai/new?q="+encodeURIComponent(prompt); }
function urlPrompt(ctx,quote,q){
  var p=startPrompt(ctx,quote,q,false); if(p.length<=1800) return p;
  p=startPrompt(ctx,quote,q,true); return p.length<=1800?p:p.slice(0,1790)+"…";
}

/* ---------- copying ---------- */
function legacyCopy(s){
  var ta=el("textarea",{"aria-hidden":"true",style:"position:fixed;left:-9999px;top:0"}); ta.value=s; document.body.appendChild(ta); ta.select();
  var ok=false; try{ ok=document.execCommand("copy"); }catch(e){ ok=false; } ta.remove(); return ok;
}
function apiCopy(s){
  if(navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(s).then(function(){return true;},function(){return false;});
  return Promise.resolve(false);
}
/* Copy button: the clipboard API first, the old way if it fails */
function copyText(s){ return apiCopy(s).then(function(ok){ return ok || legacyCopy(s); }); }
/* links that open a new tab: copy right away, before the tab takes focus */
function copyNow(s){ return legacyCopy(s) ? Promise.resolve(true) : apiCopy(s); }

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
   '<button type="button" class="ask-btn ask-here" hidden>Ask here</button>'+
   '<a class="ask-btn primary ask-open" target="_blank" rel="noopener" href="https://claude.ai/new">Start my doubts chat ↗</a>'+
   '<button type="button" class="ask-btn ask-copy">Copy</button>'+
  '</div>'+
  '<p class="ask-status" aria-live="polite"></p>'+
  '<div class="ask-chat">'+
   '<p class="ask-chat-msg"></p>'+
   '<div class="ask-chatset" hidden><input type="url" inputmode="url" placeholder="https://claude.ai/chat/…" aria-label="Your doubts chat address"><button type="button" class="ask-btn ask-chatsave">Link this chat</button></div>'+
   '<label class="ask-copyonly" hidden><input type="checkbox"> <span>Just copy each doubt, don’t open a new tab (I keep the chat open)</span></label>'+
  '</div>'+
  '<div class="ask-answer" hidden><div class="ask-ans-head"><span class="eyebrow">Your chat on this site</span><span class="ask-ans-tools"><button type="button" class="linkish ask-stop" hidden>Stop</button><button type="button" class="linkish ask-new" hidden>New chat</button></span></div><div class="ask-thread"></div>'+
   '<div class="ask-follow"><textarea rows="2" placeholder="Ask a follow-up…" aria-label="Follow-up question"></textarea><button type="button" class="ask-btn primary ask-send">Send</button></div></div>'+
  '<details class="ask-help"><summary>How this works</summary>'+
   '<p><b>One chat for all your doubts.</b> Tap <b>Start my doubts chat</b> once: a new Claude chat opens with your doubt filled in. Copy that chat’s address from the browser’s address bar and link it here. After that, <b>Send to my doubts chat</b> copies each new doubt, with the part of the guide you are on, and opens that same chat. Paste and send. A link can’t type into a chat that already exists, so the paste step stays.</p>'+
   '<p>Each send opens the chat in a new tab. If you keep the chat open, tick <b>Just copy</b> and switch to it yourself.</p>'+
   '<p>The link is saved on this site in this browser only, so link the chat once on each device. On a phone, claude.ai links may open the Claude app, where the address is hard to copy: link it once in the browser.</p>'+
   '<p><b>For answers from your own book copies</b>, start the doubts chat inside your Claude project that holds the books. Save the project’s link here, and <b>Start my doubts chat</b> opens the project instead (the doubt is copied). Start a new chat there, paste, then link that chat.</p>'+
   '<div class="ask-projset"><input type="url" placeholder="https://claude.ai/project/…" aria-label="Your Claude project link"><button type="button" class="ask-btn ask-projsave">Save link</button></div>'+
   '<p class="ask-heretip" hidden><b>Ask here</b> answers inside this page, using your Claude account. It keeps one running chat for all the topic pages, saved in this browser; <b>New chat</b> clears it. The first time, Claude asks you to allow it. It sees only what this page sends, not your books.</p>'+
  '</details>'+
  '<details class="ask-log"><summary>Your earlier doubts on this page <span class="ask-logn"></span></summary><ul></ul></details>'+
 '</div>';
document.body.appendChild(panel);

var $=function(sel){return panel.querySelector(sel);};
var qBox=$("#ask-q"), whereEl=$(".ask-where"), quoteEl=$(".ask-quote"), status=$(".ask-status");
var openA=$(".ask-open"), hereBtn=$(".ask-here"), answer=$(".ask-answer"), thread=$(".ask-thread"), stopBtn=$(".ask-stop"), newBtn=$(".ask-new");
var fBox=$(".ask-follow textarea"), sendBtn=$(".ask-send");
var chatBox=$(".ask-chat"), chatMsg=$(".ask-chat-msg"), chatSet=$(".ask-chatset"), chatIn=$(".ask-chatset input"), copyOnlyBox=$(".ask-copyonly input");
var cur={ctx:ctxTopic(),quote:null}, opener=null, sample=null, ctl=null, busy=false, changing=false;

/* ---------- the linked doubts chat on claude.ai ---------- */
function chatLink(){ return load(CHATKEY,""); }
function refreshLinks(){
  var link=chatLink(), proj=load(PROJKEY,"");
  openA.href=link||proj||claudeUrl(urlPrompt(cur.ctx,cur.quote,qBox.value.trim()));
}
function refreshChat(){
  var link=chatLink(), proj=load(PROJKEY,""), copyOnly=!!load(COPYKEY,false);
  if(link){
    openA.textContent=copyOnly?"Copy for my doubts chat":"Send to my doubts chat ↗";
    chatMsg.innerHTML='Every doubt goes to <b>your doubts chat</b>. <a class="ask-chat-open" href="'+esc(link)+'" target="_blank" rel="noopener">Open it ↗</a> · <button type="button" class="linkish ask-chat-change">'+(changing?'Cancel':'Change')+'</button> · <button type="button" class="linkish ask-chat-unlink">Unlink</button>';
  } else {
    openA.textContent=proj?"Start my doubts chat in my project ↗":"Start my doubts chat ↗";
    chatMsg.innerHTML='<b>Keep all your doubts in one chat.</b> Tap <b>'+(proj?'Start my doubts chat in my project':'Start my doubts chat')+'</b> once. When the chat opens, copy its address from the address bar (it starts with https://claude.ai/chat/) and paste it here. Every later doubt then goes to that same chat.';
  }
  chatBox.classList.toggle("on",!!link);
  chatSet.hidden=!!link && !changing;
  $(".ask-copyonly").hidden=!link;
  copyOnlyBox.checked=copyOnly;
  var here=!!sample;
  hereBtn.classList.toggle("primary",here); openA.classList.toggle("primary",!here);
  refreshLinks();
}
function saveChat(){
  var v=chatIn.value.trim();
  if(!v){ status.textContent="Paste the chat’s address first."; chatIn.focus(); return; }
  if(/^claude\.ai\//i.test(v)) v="https://"+v;
  if(/^https:\/\/claude\.ai\/share\//i.test(v)){ status.textContent="That’s a share link (a public copy of the chat). Use the chat’s own address instead: it starts with https://claude.ai/chat/"; chatIn.focus(); return; }
  if(!/^https:\/\/claude\.ai\/(?:[^?#\s]*\/)?chat\/[A-Za-z0-9-]{8,}/i.test(v)){ status.textContent="That isn’t a chat address. Open the chat in your browser and copy the address bar: it starts with https://claude.ai/chat/"; chatIn.focus(); return; }
  v=v.split(/[?#\s]/)[0];
  store(CHATKEY,v); changing=false; chatIn.value=""; chatBox.classList.remove("nudge"); refreshChat();
  status.textContent="Linked. From now on, “Send to my doubts chat” copies each doubt and opens this same chat: paste and send.";
}
chatBox.addEventListener("click",function(e){
  var b=e.target.closest("button"); if(!b) return;
  if(b.classList.contains("ask-chatsave")) saveChat();
  else if(b.classList.contains("ask-chat-change")){
    changing=!changing; refreshChat();
    if(changing){ chatIn.value=chatLink(); chatIn.focus(); chatIn.select(); }
  }
  else if(b.classList.contains("ask-chat-unlink")){
    store(CHATKEY,""); changing=false; refreshChat();
    status.textContent="Unlinked. Start a new doubts chat whenever you like.";
  }
});
chatIn.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); saveChat(); } });
copyOnlyBox.addEventListener("change",function(){ store(COPYKEY,copyOnlyBox.checked); refreshChat(); });

/* ---------- the running chat on this site ("Ask here") ---------- */
function loadThread(){
  var t=load(THREADKEY,[]);
  return Array.isArray(t)?t.filter(function(x){ return x && (x.r==="user"||x.r==="assistant") && x.c; }):[];
}
var th=loadThread();
function saveThread(){
  var keep=th.slice(-60);
  while(keep.length && keep[0].r!=="user") keep.shift();   /* always start on a question */
  th=keep; store(THREADKEY,th);
}
function turnHTML(t){
  if(t.r==="assistant") return '<div class="ask-md ask-claude">'+md(t.c)+'</div>';
  return '<div class="ask-you">'+(t.k==="doubt"&&t.w?'<span class="ask-you-w">'+esc((t.s?t.s+" · ":"")+t.w)+'</span>':'')+esc(t.q||t.c)+'</div>';
}
function renderThread(){
  answer.hidden=!(sample && (th.length || busy));
  newBtn.hidden=!th.length || busy;
  var groups=[];
  th.forEach(function(t){ if(!groups.length || (t.r==="user" && t.k==="doubt")) groups.push([]); groups[groups.length-1].push(t); });
  var older=groups.slice(0,-1), last=groups[groups.length-1]||[], n=older.length;
  thread.innerHTML=(n?'<details class="ask-older"><summary>Earlier in this chat · '+n+' doubt'+(n>1?'s':'')+'</summary><div class="ask-thread">'+
      older.map(function(g){ return g.map(turnHTML).join(""); }).join("")+'</div></details>':'')+
    last.map(turnHTML).join("");
}
/* what Claude reads: the standing instructions, then the latest turns (oldest dropped first) */
function windowTurns(){
  var out=[], size=0;
  for(var i=th.length-1;i>=0 && out.length<40;i--){
    size+=th[i].c.length; if(out.length && size>60000) break;
    out.unshift({role:th[i].r,content:th[i].c});
  }
  return [{role:"user",content:RULES}].concat(out);
}

/* ---------- opening and closing ---------- */
function openAsk(ctx,quote,from){
  cur={ctx:ctx||ctxTopic(),quote:quote||null};
  opener=from||document.activeElement;
  whereEl.textContent=cur.ctx.label;
  $(".ask-widen").hidden=cur.ctx.label==="The whole topic" && !cur.quote;
  quoteEl.hidden=!cur.quote; quoteEl.textContent=cur.quote?"“"+clip(cur.quote,500)+"”":"";
  status.textContent="";
  if(!busy) th=loadThread();   /* pick up doubts asked on other topic pages */
  panel.hidden=false; document.body.classList.add("asking");
  changing=false; refreshChat(); renderThread(); renderLog();
  setTimeout(function(){ qBox.focus(); },30);
}
function closeAsk(){
  if(ctl) ctl.abort();
  panel.hidden=true; document.body.classList.remove("asking");
  if(opener && opener.focus) opener.focus();
}

/* save each doubt in this browser */
function logDoubt(q,a,where){
  var log=load(LOGKEY,[]);
  log.unshift({w:where||cur.ctx.label,q:q,a:a||"",t:Date.now()});
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
  var q=qBox.value.trim(), link=chatLink(), proj=load(PROJKEY,""), copyOnly=!!load(COPYKEY,false);
  if(link && copyOnly) e.preventDefault();
  copyNow(link?nextPrompt(cur.ctx,cur.quote,q):startPrompt(cur.ctx,cur.quote,q,false)).then(function(ok){
    if(link) status.textContent=ok?(copyOnly?"Copied. Go to your doubts chat, paste and send.":"Opening your doubts chat. Your doubt is copied: paste it there and send."):"Copy didn’t work here. Use the Copy button, then paste in your doubts chat.";
    else if(proj) status.textContent=ok?"Copied. In your project, start a new chat and paste. Then link that chat below, so later doubts go to it.":"Copy didn’t work here. Use the Copy button, then paste in your project.";
    else status.textContent="Opening a new chat with your doubt filled in"+(ok?" (also copied, in case it opens empty)":"")+". Next, link that chat below, so later doubts go to it.";
  });
  if(!link){ chatBox.classList.remove("nudge"); void chatBox.offsetWidth; chatBox.classList.add("nudge"); }
  logDoubt(q,"",cur.ctx.label);
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
  store(PROJKEY,v); refreshChat();
  status.textContent=v?"Saved. “Start my doubts chat” now opens your project.":"Project link removed.";
});
$(".ask-projset input").value=load(PROJKEY,"");
$(".ask-log").addEventListener("click",function(e){
  var a=e.target.closest("[data-again]"), d=e.target.closest("[data-del]"), log=load(LOGKEY,[]);
  if(a){ var it=log[Number(a.getAttribute("data-again"))]; if(it){ qBox.value=it.q; refreshLinks(); qBox.focus(); } }
  if(d){ log.splice(Number(d.getAttribute("data-del")),1); store(LOGKEY,log); renderLog(); }
});

/* ---------- answering inside the page (Claude-hosted version only) ---------- */
var CODES={not_granted:"Claude isn’t allowed to answer inside this page. Use your doubts chat instead.",sampling_disabled:"Claude can’t answer inside this page for this account. Use your doubts chat instead.",rate_limited:"Too many questions just now. Wait a little, or use your doubts chat.",session_expired:"Please sign in to Claude again.",refused:"Claude didn’t answer this one. Try rewording it.",prompt_too_large:"That was too long to send. Select less text, or start a new chat."};
function hideHere(msg){ hereBtn.hidden=true; $(".ask-heretip").hidden=true; sample=null; refreshChat(); renderThread(); if(msg) status.textContent=msg; }
function ask(kind,content,shown){
  if(!sample || busy) return;
  th=loadThread();
  th.push({r:"user",c:content,k:kind,q:shown,w:kind==="doubt"?cur.ctx.label:"",s:T.session,t:Date.now()});
  saveThread(); busy=true; renderThread();
  var where=cur.ctx.label;
  var bubble=el("div",{class:"ask-md ask-claude"},'<p class="muted">Thinking…</p>'); thread.appendChild(bubble);
  if(bubble.scrollIntoView) bubble.scrollIntoView({block:"nearest"});
  ctl=new AbortController(); stopBtn.hidden=false; hereBtn.disabled=true; sendBtn.disabled=true;
  sample(windowTurns(),{cache:false,signal:ctl.signal,onText:function(u){ bubble.innerHTML=md(u.text); }}).then(function(r){
    th.push({r:"assistant",c:r.text+(r.truncated?"\n\n(Cut short. Ask for less at a time.)":""),t:Date.now()}); saveThread();
    if(kind==="doubt") logDoubt(shown,r.text,where);
  },function(e){
    var code=e&&e.code;
    if(e && e.text){ th.push({r:"assistant",c:e.text+(code==="cancelled"?"\n\n(Stopped.)":""),t:Date.now()}); }
    else { th.pop(); var box=kind==="doubt"?qBox:fBox; if(!box.value.trim()) box.value=shown; }
    saveThread();
    if(code==="cancelled") return;
    if(["not_granted","sampling_disabled","not_declared","capability_disabled","capability_removed"].indexOf(code)>-1) hideHere(CODES[code]||CODES.not_granted);
    else status.textContent=CODES[code]||"Something went wrong. Try again, or use your doubts chat.";
  }).then(function(){
    busy=false; ctl=null; stopBtn.hidden=true; hereBtn.disabled=false; sendBtn.disabled=false;
    renderThread(); refreshLinks();
    var lastC=thread.lastElementChild; if(lastC && lastC.scrollIntoView) lastC.scrollIntoView({block:"nearest"});
  });
}
hereBtn.addEventListener("click",function(){
  if(needQuestion()) return;
  var q=qBox.value.trim(); status.textContent="";
  qBox.value="";
  ask("doubt",doubtText(cur.ctx,cur.quote,q,false),q);
});
function sendFollow(){ var v=fBox.value.trim(); if(!v || !sample || busy) return; fBox.value=""; ask("follow",v,v); }
sendBtn.addEventListener("click",sendFollow);
fBox.addEventListener("keydown",function(e){ if(e.key==="Enter" && (e.ctrlKey||e.metaKey)){ e.preventDefault(); sendFollow(); } });
qBox.addEventListener("keydown",function(e){ if(e.key==="Enter" && (e.ctrlKey||e.metaKey)){ e.preventDefault(); if(sample) hereBtn.click(); else openA.click(); } });
newBtn.addEventListener("click",function(){
  if(busy) return;
  th=[]; saveThread(); renderThread();
  status.textContent="Started a new chat. Your earlier doubts are still listed at the bottom.";
  qBox.focus();
});
stopBtn.addEventListener("click",function(){ if(ctl) ctl.abort(); });
if(window.claude && typeof window.claude.use==="function"){
  window.claude.use("sample").then(function(s){
    if(!s) return;
    sample=s; hereBtn.hidden=false; $(".ask-heretip").hidden=false;
    refreshChat(); if(!panel.hidden) renderThread();
  },function(){});
}
/* keep pages open in other tabs in step */
window.addEventListener("storage",function(e){
  if(e.key===THREADKEY && !busy){ th=loadThread(); if(!panel.hidden) renderThread(); }
  if(e.key===CHATKEY || e.key===COPYKEY || e.key===PROJKEY){ if(!panel.hidden) refreshChat(); }
});

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
refreshChat();
window.SMMAsk={open:openAsk,ctxStop:ctxStop,ctxSkim:ctxSkim,buildPrompt:buildPrompt,startPrompt:startPrompt,nextPrompt:nextPrompt};
})();
