/* ============================================================
   LINUX UGUIDE — interactive terminal engine
   A tiny in-memory UNIX-ish shell for teaching real commands.
   Supports: a live virtual filesystem, pipes (|), redirects
   (> >>), aliases, command history, tab-completion, a nano/vim
   editor simulator, and a very large command set.
   ============================================================ */
(function(){
"use strict";
window.DOJO = window.DOJO || {};

/* ---------------- virtual filesystem ---------------- */
// node: {type:'dir', children:{}} | {type:'file', content:'...'}
function dir(children){ return {type:"dir", children:children||{}}; }
function file(content){ return {type:"file", content:content||""}; }

var FS = dir({
  home: dir({ tux: dir({
    "welcome.txt": file("Привет! Ты в учебном терминале LINUX UGUIDE.\nНабери `help`, чтобы увидеть список команд.\nНабери `mission` — начнём пошаговые уроки.\nНабери `faq` — часто задаваемые вопросы про Linux.\n"),
    "notes.txt":   file("todo:\n- выучить навигацию (cd, ls, pwd)\n- разобраться с правами (chmod)\n- освоить пакетный менеджер\n- попробовать nano и vim\n"),
    projects: dir({
      "hello.sh": file("#!/bin/bash\necho \"Hello, Linux!\"\n"),
      website:    dir({ "index.html": file("<h1>my first site</h1>\n") })
    }),
    ".bashrc": file("export PS1='\\u@uguide:\\w$ '\nalias ll='ls -la'\n")
  })}),
  etc: dir({
    "os-release": file("NAME=\"UGuide Linux\"\nVERSION=\"1.0 (Penguin)\"\n"),
    hostname: file("uguide\n"),
    sudoers: file("root ALL=(ALL:ALL) ALL\ntux  ALL=(ALL:ALL) ALL\n")
  }),
  var: dir({ log: dir({ "syslog": file("system booted OK\n") }) }),
  bin: dir({}), usr: dir({ bin: dir({}) }), tmp: dir({})
});

var cwd = ["home","tux"];         // current path as array
var USER = "tux", HOST = "uguide";

/* ---------------- path helpers ---------------- */
function clone(path){ return path.slice(); }
function resolve(path){
  var parts, abs;
  if(path === undefined || path === "") return clone(cwd);
  if(path === "~") return ["home","tux"];
  if(path.charAt(0) === "~") path = "/home/tux" + path.slice(1);
  if(path.charAt(0) === "/"){ abs=[]; parts=path.split("/"); }
  else{ abs=clone(cwd); parts=path.split("/"); }
  for(var i=0;i<parts.length;i++){
    var p=parts[i];
    if(p===""||p===".") continue;
    if(p===".."){ if(abs.length) abs.pop(); }
    else abs.push(p);
  }
  return abs;
}
function nodeAt(path){
  var n=FS;
  for(var i=0;i<path.length;i++){
    if(n.type!=="dir" || !n.children[path[i]]) return null;
    n=n.children[path[i]];
  }
  return n;
}
function parentOf(path){ return { parent:nodeAt(path.slice(0,-1)), name:path[path.length-1] }; }
function pathStr(path){ return "/"+path.join("/"); }
function prettyCwd(){
  var s=pathStr(cwd);
  if(s.indexOf("/home/tux")===0) s="~"+s.slice(9);
  return s===""?"/":s;
}

/* ---------------- output + typewriter ---------------- */
var out, inp, form;
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function tokenizeHtml(html){
  var tokens=[], i=0, len=html.length;
  while(i<len){
    var ch=html.charAt(i);
    if(ch==="<"){
      var close=html.indexOf(">", i);
      if(close===-1) close=len-1;
      tokens.push({type:"tag", raw:html.slice(i, close+1)});
      i=close+1;
    }else if(ch==="&"){
      var m=/^&[#a-zA-Z0-9]+;/.exec(html.slice(i, i+12));
      if(m){ tokens.push({type:"char", raw:m[0]}); i+=m[0].length; }
      else { tokens.push({type:"char", raw:ch}); i++; }
    }else{
      tokens.push({type:"char", raw:ch}); i++;
    }
  }
  return tokens;
}

var TYPING={ active:false, cancel:null };
function flushTyping(){ if(TYPING.active && TYPING.cancel) TYPING.cancel(); }

function typeInto(el, html){
  var tokens=tokenizeHtml(html);
  var visCount=tokens.filter(function(t){return t.type==="char"&&t.raw.trim()!=="";}).length;
  var delay=Math.max(1, Math.min(16, 2200/Math.max(visCount,1)));
  var i=0, cancelled=false;
  TYPING.active=true;
  TYPING.cancel=function(){
    if(cancelled) return;
    cancelled=true; TYPING.active=false;
    el.innerHTML=html;
    out.scrollTop=out.scrollHeight;
  };
  (function step(){
    if(cancelled) return;
    if(i>=tokens.length){ TYPING.active=false; out.scrollTop=out.scrollHeight; return; }
    var t=tokens[i++];
    el.innerHTML+=t.raw;
    if(t.type==="char" && t.raw.trim()!=="" && DOJO.sfx) DOJO.sfx.tick();
    out.scrollTop=out.scrollHeight;
    setTimeout(step, t.type==="char" ? delay : 0);
  })();
}

function line(html, cls, opts){
  var d=document.createElement("div");
  d.className="tl"+(cls?" "+cls:"");
  out.appendChild(d);
  if(DOJO.reduced || (opts&&opts.instant)){
    d.innerHTML=html;
    out.scrollTop=out.scrollHeight;
  }else{
    flushTyping();
    typeInto(d, html);
  }
  if(cls==="err" && DOJO.sfx) DOJO.sfx.error();
  else if(cls==="ok" && DOJO.sfx) DOJO.sfx.success();
  return d;
}
function echoCmd(raw){
  var d=document.createElement("div");
  d.className="tl";
  d.innerHTML='<span class="pr">'+esc(USER)+'@'+esc(HOST)+':'+esc(prettyCwd())+'$</span> '+esc(raw);
  out.appendChild(d);
  out.scrollTop=out.scrollHeight;
}
function print(text, cls){
  line(esc(text).replace(//g,'<span class="hl">').replace(//g,"</span>").replace(/\n/g,"<br>"), cls);
}

/* ---------------- command table ---------------- */
var HIST=[];
var CMD={};
var ALIASES={};
var ENV={ HOME:"/home/tux", USER:"tux", SHELL:"/bin/bash", PATH:"/usr/local/bin:/usr/bin:/bin", LANG:"ru_RU.UTF-8", EDITOR:"nano" };

function err(s){ return {out:s, cls:"err"}; }

var SERVICES={ sshd:"active", nginx:"inactive", docker:"active", cron:"active", bluetooth:"inactive", NetworkManager:"active" };
var PROC_LIST=[
  {pid:1024,user:"tux",cmd:"bash",cpu:"0.3",mem:"0.2"},
  {pid:2048,user:"tux",cmd:"node",cpu:"4.0",mem:"2.1"},
  {pid:3210,user:"tux",cmd:"firefox",cpu:"1.5",mem:"0.9"},
  {pid:4477,user:"root",cmd:"systemd",cpu:"0.1",mem:"0.1"}
];

/* ===== NAVIGATION ===== */
CMD.pwd=function(){ return pathStr(cwd)==="" ? "/" : pathStr(cwd); };
CMD.ls=function(a){
  var flags=a.filter(function(x){return x.charAt(0)==="-";}).join("");
  var targets=a.filter(function(x){return x.charAt(0)!=="-";});
  var showAll=/a/.test(flags), long=/l/.test(flags);
  var path=targets.length?resolve(targets[0]):clone(cwd);
  var n=nodeAt(path);
  if(!n) return err("ls: невозможно получить доступ к '"+targets[0]+"': Нет такого файла или каталога");
  if(n.type==="file") return targets[0];
  var names=Object.keys(n.children).filter(function(k){ return showAll || k.charAt(0)!=="."; });
  if(showAll) names=[".",".."].concat(names);
  names.sort();
  if(!names.length) return "";
  if(long){
    var rows=names.map(function(k){
      var isDot=(k==="."||k===".."), c=isDot?n:n.children[k];
      var d=(k==="."||k===".."||c.type==="dir");
      var perm=d?"drwxr-xr-x":"-rw-r--r--";
      var size=d?"4096":String((c.content||"").length);
      var col=d?"dir":(/\.sh$/.test(k)?"exe":"file");
      return perm+"  "+USER+"  "+USER+"  "+String(size).padStart(5)+"  "+
              '<span class="'+col+'">'+esc(k)+(d&&!isDot?"/":"")+"</span>";
    });
    return {html: rows.join("<br>")};
  }
  var html=names.map(function(k){
    var isDot=(k==="."||k===".."), c=isDot?null:n.children[k];
    var d=isDot||c.type==="dir";
    var col=d?"dir":(/\.sh$/.test(k)?"exe":"file");
    return '<span class="'+col+'">'+esc(k)+(d&&!isDot?"/":"")+"</span>";
  }).join("&nbsp;&nbsp;");
  return {html:html};
};
CMD.cd=function(a){
  var t=a[0]||"~";
  var path=resolve(t), n=nodeAt(path);
  if(!n) return err("cd: "+t+": Нет такого файла или каталога");
  if(n.type!=="dir") return err("cd: "+t+": Не является каталогом");
  cwd=path; return "";
};
CMD.tree=function(){
  var lines=[];
  (function walk(node,prefix){
    var keys=Object.keys(node.children).filter(function(k){return k[0]!==".";}).sort();
    keys.forEach(function(k,idx){
      var last=idx===keys.length-1, c=node.children[k];
      var isdir=c.type==="dir";
      lines.push(prefix+(last?"└── ":"├── ")+'<span class="'+(isdir?"dir":"file")+'">'+esc(k)+(isdir?"/":"")+"</span>");
      if(isdir) walk(c, prefix+(last?"    ":"│   "));
    });
  })(nodeAt(cwd),"");
  return {html: '<span class="dir">.</span><br>'+lines.join("<br>")};
};
CMD.find=function(a){
  var start=a.filter(function(x){return x[0]!=="-";})[0]||".";
  var nameM=(a.join(" ").match(/-name\s+["']?([^"'\s]+)["']?/));
  var pat=nameM?new RegExp("^"+nameM[1].replace(/\./g,"\\.").replace(/\*/g,".*")+"$"):null;
  var base=resolve(start), res=[];
  (function walk(node,path){
    if(node.type==="dir"){
      Object.keys(node.children).forEach(function(k){
        var childPath=path.concat([k]), c=node.children[k];
        var rel=start.replace(/\/$/,"")+"/"+pathStr(childPath).slice(pathStr(base).length+1);
        if(!pat||pat.test(k)) res.push(rel);
        if(c.type==="dir") walk(c,childPath);
      });
    }
  })(nodeAt(base),base);
  return res.length?res.join("\n"):"";
};
CMD.ll=function(a){ return CMD.ls(["-la"].concat(a)); };
CMD.la=function(a){ return CMD.ls(["-a"].concat(a)); };

/* ===== FILES ===== */
CMD.mkdir=function(a){
  if(!a.length) return err("mkdir: пропущен операнд");
  var msgs=[];
  a.filter(function(x){return x.charAt(0)!=="-";}).forEach(function(t){
    var path=resolve(t), pn=parentOf(path);
    if(!pn.parent||pn.parent.type!=="dir"){ msgs.push("mkdir: невозможно создать '"+t+"': нет пути"); return; }
    if(pn.parent.children[pn.name]){ msgs.push("mkdir: невозможно создать каталог '"+t+"': Файл существует"); return; }
    pn.parent.children[pn.name]=dir();
  });
  return msgs.length?err(msgs.join("\n")):"";
};
CMD.touch=function(a){
  if(!a.length) return err("touch: пропущен операнд");
  a.forEach(function(t){
    var path=resolve(t), pn=parentOf(path);
    if(pn.parent&&pn.parent.type==="dir"&&!pn.parent.children[pn.name]) pn.parent.children[pn.name]=file("");
  });
  return "";
};
CMD.rmdir=function(a){
  var t=a[0]; if(!t) return err("rmdir: пропущен операнд");
  var path=resolve(t), pn=parentOf(path), n=nodeAt(path);
  if(!n) return err("rmdir: '"+t+"': Нет такого файла или каталога");
  if(n.type!=="dir") return err("rmdir: '"+t+"': Не является каталогом");
  if(Object.keys(n.children).length) return err("rmdir: '"+t+"': Каталог не пуст (используй `rm -r`)");
  delete pn.parent.children[pn.name]; return "";
};
CMD.rm=function(a){
  var rec=a.some(function(x){return /r/.test(x)&&x.charAt(0)==="-";});
  var targets=a.filter(function(x){return x.charAt(0)!=="-";});
  if(!targets.length) return err("rm: пропущен операнд");
  var msgs=[];
  targets.forEach(function(t){
    var path=resolve(t), pn=parentOf(path), n=nodeAt(path);
    if(!n){ msgs.push("rm: невозможно удалить '"+t+"': Нет такого файла или каталога"); return; }
    if(n.type==="dir"&&!rec){ msgs.push("rm: невозможно удалить '"+t+"': Это каталог (используй -r)"); return; }
    if(pathStr(path)==="/home/tux"){ msgs.push("rm: так не пойдёт — не будем сносить домашний каталог :)"); return; }
    delete pn.parent.children[pn.name];
  });
  return msgs.length?err(msgs.join("\n")):"";
};
function copyMove(a,move){
  var t=a.filter(function(x){return x.charAt(0)!=="-";});
  if(t.length<2) return err((move?"mv":"cp")+": пропущен операнд назначения");
  var srcP=resolve(t[0]), src=nodeAt(srcP);
  if(!src) return err((move?"mv":"cp")+": '"+t[0]+"': Нет такого файла или каталога");
  var dstP=resolve(t[1]), dstNode=nodeAt(dstP);
  if(dstNode&&dstNode.type==="dir"){ dstP=dstP.concat([srcP[srcP.length-1]]); }
  var pn=parentOf(dstP);
  if(!pn.parent||pn.parent.type!=="dir") return err((move?"mv":"cp")+": нет пути назначения");
  var copy=JSON.parse(JSON.stringify(src));
  pn.parent.children[pn.name]=copy;
  if(move){ var sp=parentOf(srcP); delete sp.parent.children[sp.name]; }
  return "";
}
CMD.cp=function(a){ return copyMove(a,false); };
CMD.mv=function(a){ return copyMove(a,true); };
CMD.ln=function(a){
  var t=a.filter(function(x){return x[0]!=="-";});
  if(t.length<2) return err("ln: укажи источник и имя ссылки");
  var src=nodeAt(resolve(t[0]));
  if(!src) return err("ln: '"+t[0]+"': Нет такого файла");
  var pn=parentOf(resolve(t[1]));
  if(pn.parent) pn.parent.children[pn.name]=file("symlink -> "+t[0]);
  return "";
};
CMD.cat=function(a){
  var t=a.filter(function(x){return x.charAt(0)!=="-";});
  if(!t.length) return err("cat: пропущен операнд");
  var res=[];
  for(var i=0;i<t.length;i++){
    var n=nodeAt(resolve(t[i]));
    if(!n) return err("cat: "+t[i]+": Нет такого файла или каталога");
    if(n.type==="dir") return err("cat: "+t[i]+": Это каталог");
    res.push(n.content);
  }
  return res.join("").replace(/\n$/,"");
};
CMD.less=function(a){ var r=CMD.cat(a); if(r&&r.out!=null) r.out+="\n\n(less: постранично не нужно — весь файл уже перед тобой. 'q' в реальном терминале выходит из просмотра)"; return r; };
CMD.more=CMD.less;
CMD.head=function(a){ return firstLast(a,true); };
CMD.tail=function(a){ return firstLast(a,false); };
function firstLast(a,head){
  var t=a.filter(function(x){return x.charAt(0)!=="-";});
  var count=10, m=(a.join(" ").match(/-n?\s*(\d+)/)); if(m) count=+m[1];
  var n=nodeAt(resolve(t[0])); if(!n||n.type!=="file") return err((head?"head":"tail")+": нет такого файла");
  var lines=n.content.replace(/\n$/,"").split("\n");
  return (head?lines.slice(0,count):lines.slice(-count)).join("\n");
}
CMD.wc=function(a,stdin){
  var text = stdin!=null ? stdin : (function(){ var n=nodeAt(resolve(a.filter(function(x){return x[0]!=="-";})[0]||"")); return n&&n.type==="file"?n.content:""; })();
  var lines=text.split("\n").length-1, words=(text.match(/\S+/g)||[]).length, chars=text.length;
  return "  "+lines+"  "+words+"  "+chars+(a[0]&&a[0][0]!=="-"?" "+a[0]:"");
};
CMD.echo=function(a){ return a.join(" ").replace(/^["']|["']$/g,""); };
CMD.stat=function(a){
  var t=a[0]; var n=nodeAt(resolve(t));
  if(!n) return err("stat: невозможно получить статистику '"+t+"': Нет такого файла");
  return "  File: "+t+"\n  Size: "+((n.content||"").length)+"\t Blocks: 8\t"+(n.type==="dir"?"directory":"regular file")+
         "\nAccess: (0644/-rw-r--r--)  Uid: (1000/"+USER+")   Gid: (1000/"+USER+")\nModify: "+new Date().toString();
};
CMD.file=function(a){
  var t=a[0]; var n=nodeAt(resolve(t));
  if(!n) return err("file: "+t+": Нет такого файла");
  if(n.type==="dir") return t+": directory";
  if(/\.sh$/.test(t)) return t+": Bourne-Again shell script, ASCII text executable";
  if(/\.(jpg|jpeg|png)$/.test(t)) return t+": image data";
  if(/\.html?$/.test(t)) return t+": HTML document, ASCII text";
  return t+": ASCII text";
};
CMD.diff=function(a){
  var t=a.filter(function(x){return x[0]!=="-";});
  if(t.length<2) return err("diff: нужно два файла");
  var n1=nodeAt(resolve(t[0])), n2=nodeAt(resolve(t[1]));
  if(!n1||!n2) return err("diff: файл не найден");
  if(n1.content===n2.content) return "";
  var l1=n1.content.split("\n"), l2=n2.content.split("\n"), res=[];
  var max=Math.max(l1.length,l2.length);
  for(var i=0;i<max;i++){
    if(l1[i]!==l2[i]){
      if(l1[i]!==undefined) res.push("< "+l1[i]);
      if(l2[i]!==undefined) res.push("> "+l2[i]);
    }
  }
  return res.join("\n")||"файлы идентичны";
};
CMD.sort=function(a,stdin){
  var t=a.filter(function(x){return x[0]!=="-";});
  var text=stdin!=null?stdin:(function(){var n=nodeAt(resolve(t[0])); return n&&n.type==="file"?n.content:"";})();
  var lines=text.replace(/\n$/,"").split("\n").filter(Boolean);
  lines.sort();
  if(a.indexOf("-r")>-1) lines.reverse();
  return lines.join("\n");
};
CMD.uniq=function(a,stdin){
  var t=a.filter(function(x){return x[0]!=="-";});
  var text=stdin!=null?stdin:(function(){var n=nodeAt(resolve(t[0])); return n&&n.type==="file"?n.content:"";})();
  var lines=text.replace(/\n$/,"").split("\n"), res=[];
  lines.forEach(function(l){ if(!res.length||res[res.length-1]!==l) res.push(l); });
  return res.join("\n");
};
CMD.cut=function(a,stdin){
  var joined=a.join(" ");
  var dArg=joined.match(/-d\s*["']?(.)["']?/), fArg=joined.match(/-f\s*(\d+)/);
  var delim=dArg?dArg[1]:"\t", field=fArg?+fArg[1]:1;
  var t=a.filter(function(x){return x[0]!=="-"&&x!==dArg&&x!==fArg;});
  var text=stdin!=null?stdin:(function(){var n=nodeAt(resolve(t[t.length-1]||"")); return n&&n.type==="file"?n.content:"";})();
  return text.replace(/\n$/,"").split("\n").map(function(l){ return l.split(delim)[field-1]||""; }).join("\n");
};
CMD.tr=function(a,stdin){
  var from=a[0],to=a[1]; var text=stdin!=null?stdin:"";
  if(!from) return err("tr: нужны наборы символов. Пример: echo привет | tr а-я А-Я");
  var out2="";
  for(var i=0;i<text.length;i++){
    var idx=from.indexOf(text[i]);
    out2 += (idx>-1 && to) ? (to[idx]||"") : text[i];
  }
  return out2;
};
CMD.xargs=function(a,stdin){
  var cmdName=a[0]||"echo";
  var items=(stdin||"").trim().split(/\s+/).filter(Boolean);
  if(!items.length) return "";
  var r=normalize(execOne(cmdName, a.slice(1).concat(items)));
  return r.html!=null ? {html:r.html} : (r.out||"");
};

/* ===== EDITORS (nano / vim simulator) ===== */
function openEditor(filename, mode){
  if(!filename) return err("использование: "+mode+" <файл>");
  var path=resolve(filename);
  var existing=nodeAt(path);
  var content=existing && existing.type==="file" ? existing.content : "";
  var overlay=document.createElement("div");
  overlay.className="editor-overlay";
  overlay.innerHTML=
    '<div class="editor-win">'+
      '<div class="editor-title">'+(mode==="vim"?"vim":"GNU nano 7.2")+" — "+esc(filename)+'</div>'+
      '<textarea class="editor-area" spellcheck="false" autocomplete="off"></textarea>'+
      (mode==="vim"
        ? '<div class="editor-vimbar"><span class="mode">-- INSERT --</span><input class="editor-cmdline" placeholder=":wq сохранить и выйти  •  :q! выйти без сохранения  •  :w сохранить"></div>'
        : '<div class="editor-hint"><span>^O</span>Записать<span>^X</span>Выход<span>Esc</span>Отмена</div>')+
    "</div>";
  document.body.appendChild(overlay);
  var ta=overlay.querySelector(".editor-area");
  ta.value=content;
  setTimeout(function(){ ta.focus(); },10);
  DOJO.sfx && DOJO.sfx.open();

  function save(){
    var pn=parentOf(path);
    if(pn.parent && pn.parent.type==="dir"){
      if(existing && existing.type==="file"){ existing.content=ta.value; }
      else{ pn.parent.children[pn.name]=file(ta.value); existing=pn.parent.children[pn.name]; }
    }
  }
  function close(msg){
    overlay.remove();
    DOJO.sfx && DOJO.sfx.close();
    if(msg) print(msg, "ok");
    inp && inp.focus({preventScroll:true});
  }
  if(mode==="nano"){
    ta.addEventListener("keydown",function(e){
      if(e.ctrlKey && (e.key==="o"||e.key==="O")){ e.preventDefault(); save(); print("[ Записано "+ta.value.split("\n").length+" строк ]","ok"); }
      else if(e.ctrlKey && (e.key==="x"||e.key==="X")){ e.preventDefault(); save(); close("«"+filename+"» сохранён."); }
      else if(e.key==="Escape"){ close(); }
    });
  }else{
    var cmdline=overlay.querySelector(".editor-cmdline");
    ta.addEventListener("keydown",function(e){ if(e.key==="Escape") cmdline.focus(); });
    cmdline.addEventListener("keydown",function(e){
      if(e.key==="Enter"){
        var v=cmdline.value.trim().replace(/^:/,"");
        if(v==="wq"||v==="x"){ save(); close("«"+filename+"» записан, vim закрыт."); }
        else if(v==="q"||v==="q!"){ close(); }
        else if(v==="w"){ save(); cmdline.value=""; print("«"+filename+"» записан.","ok"); }
        else{ print("E492: не редакторская команда: "+v,"err"); cmdline.value=""; }
      }else if(e.key==="Escape"){ ta.focus(); }
    });
  }
  overlay.addEventListener("click",function(e){ if(e.target===overlay) close(); });
}
CMD.nano=function(a){ return openEditor(a[0],"nano"); };
CMD.vim=function(a){ return openEditor(a[0],"vim"); };
CMD.vi=CMD.vim;

/* ===== TEXT SEARCH / SHELL ===== */
CMD.grep=function(a,stdin){
  var flags=a.filter(function(x){return x[0]==="-";}).join("");
  var rest=a.filter(function(x){return x[0]!=="-";});
  var pat=rest[0]; if(pat===undefined) return err("grep: не задан шаблон");
  pat=pat.replace(/^["']|["']$/g,"");
  var ci=/i/.test(flags);
  var re=new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), ci?"i":"");
  var text;
  if(stdin!=null) text=stdin;
  else{ var n=nodeAt(resolve(rest[1]||"")); if(!n||n.type!=="file") return err("grep: "+(rest[1]||"")+": нет такого файла"); text=n.content; }
  var matched=text.replace(/\n$/,"").split("\n").filter(function(l){return re.test(l);});
  return matched.map(function(l){ return l.replace(re,function(m){return ""+m+"";}); }).join("\n");
};
CMD.which=function(a){
  var known={ls:"/bin/ls",cat:"/bin/cat",bash:"/bin/bash",node:"/usr/bin/node",python3:"/usr/bin/python3",git:"/usr/bin/git",nano:"/usr/bin/nano",vim:"/usr/bin/vim"};
  return known[a[0]]||(a[0]?a[0]+" not found":"which: не указана команда");
};
CMD.type=function(a){
  var n=a[0]; if(!n) return err("type: укажи команду");
  if(ALIASES[n]) return n+" is aliased to `"+ALIASES[n]+"'";
  if(CMD[n]) return n+" is a shell builtin";
  return err(n+": not found");
};
CMD.history=function(){ return HIST.map(function(c,i){return String(i+1).padStart(4)+"  "+c;}).join("\n"); };
CMD.alias=function(a){
  var joined=a.join(" ");
  if(!joined){
    var ks=Object.keys(ALIASES);
    return ks.length?ks.map(function(k){return "alias "+k+"='"+ALIASES[k]+"'";}).join("\n"):"нет пользовательских алиасов";
  }
  var m=/^([\w-]+)=(.+)$/.exec(joined);
  if(!m) return err("alias: используй  alias имя='команда'");
  ALIASES[m[1]]=m[2].replace(/^["']|["']$/g,"");
  return "";
};
CMD.unalias=function(a){ delete ALIASES[a[0]]; return ""; };
CMD.export=function(a){
  var m=/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(a.join(" "));
  if(!m) return err("export: используй  export ИМЯ=значение");
  ENV[m[1]]=m[2].replace(/^["']|["']$/g,"");
  return "";
};
CMD.env=function(){ return Object.keys(ENV).map(function(k){return k+"="+ENV[k];}).join("\n"); };
CMD.printenv=function(a){ return a[0] ? (ENV[a[0]]||""): CMD.env(); };
CMD.source=function(a){ return a[0]?"файл «"+a[0]+"» загружен в текущую сессию оболочки.":err("source: укажи файл"); };
CMD.apropos=function(a){
  var q=a[0]; if(!q) return err("apropos: укажи слово для поиска");
  var hits=Object.keys(CMD).filter(function(k){return k.indexOf(q)>-1;});
  return hits.length?hits.map(function(k){return k+" (1)     — учебная команда LINUX UGUIDE";}).join("\n"):"ничего не найдено";
};
CMD.whatis=CMD.apropos;

/* ===== SYSTEM INFO ===== */
CMD.whoami=function(){ return USER; };
CMD.id=function(){ return "uid=1000("+USER+") gid=1000("+USER+") groups=1000("+USER+"),27(sudo)"; };
CMD.hostname=function(){ return HOST; };
CMD.date=function(){ return new Date().toString(); };
CMD.uptime=function(){ return " "+new Date().toLocaleTimeString()+" up 3:14, 1 user, load average: 0.08, 0.03, 0.01"; };
CMD.uname=function(a){
  if(a.indexOf("-a")>-1||a.indexOf("--all")>-1)
    return "Linux "+HOST+" 6.9.0-uguide #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux";
  return "Linux";
};
CMD.free=function(a){
  var h=a.indexOf("-h")>-1;
  return "               total        used        free      shared  buff/cache   available\n"+
         (h?
         "Mem:            7.7Gi       2.1Gi       3.9Gi       210Mi       1.7Gi       5.1Gi\n"+
         "Swap:           2.0Gi          0B       2.0Gi":
         "Mem:         8038112     2201540     4093220      215040     1743352     5320180\n"+
         "Swap:        2097148           0     2097148");
};
CMD.df=function(){
  return "Filesystem      Size  Used Avail Use% Mounted on\n"+
         "/dev/sda2        98G   23G   70G  25% /\n"+
         "tmpfs           3.9G     0  3.9G   0% /dev/shm\n"+
         "/dev/sda1       511M  6.1M  505M   2% /boot/efi";
};
CMD.du=function(){ return "8.0K\t./projects/website\n16K\t./projects\n28K\t."; };
CMD.lscpu=function(){ return "Architecture:        x86_64\nCPU(s):               8\nModel name:           Pixel Core i8\nThread(s) per core:   2\nCPU MHz:               3600.000"; };
CMD.lsblk=function(){ return "NAME   SIZE TYPE MOUNTPOINT\nsda     98G disk\n├─sda1 511M part /boot/efi\n└─sda2  97G part /"; };
CMD.lsusb=function(){ return "Bus 001 Device 002: ID 046d:c52b Logitech USB Receiver\nBus 001 Device 003: ID 0781:5581 SanDisk Cruzer"; };
CMD.lspci=function(){ return "00:02.0 VGA compatible controller: Pixel Graphics Inc.\n00:1f.3 Audio device: UGuide Sound Core"; };
CMD.dmesg=function(){ return "[    0.000000] Linux version 6.9.0-uguide\n[    0.412000] ACPI: OK\n[    1.204000] usb 1-1: new high-speed USB device\n[    2.001000] Welcome to UGuide Linux"; };

/* ===== PROCESSES ===== */
CMD.ps=function(){
  var rows=PROC_LIST.map(function(p){ return String(p.pid).padStart(7)+" pts/0    00:00:0"+(p.pid%6)+" "+p.cmd; }).join("\n");
  return "    PID TTY          TIME CMD\n"+rows;
};
CMD.top=function(){
  var rows=PROC_LIST.slice().sort(function(x,y){return y.cpu-x.cpu;}).map(function(p){
    return String(p.pid).padStart(5)+" "+p.user.padEnd(7)+p.cpu.padStart(5)+" "+p.mem.padStart(5)+" "+p.cmd;
  }).join("\n");
  return "top - "+new Date().toLocaleTimeString()+" up 3:14,  1 user,  load average: 0.08\n"+
         "Tasks: "+PROC_LIST.length+" total,   1 running, "+(PROC_LIST.length-1)+" sleeping\n"+
         "%Cpu(s):  3.1 us,  1.2 sy,  0.0 ni, 95.4 id\n"+
         "MiB Mem :   7850.1 total,   3993.4 free,   2150.5 used\n\n"+
         "  PID USER   %CPU %MEM COMMAND\n"+rows+"\n\n"+
         "(в настоящем top нажми `q` чтобы выйти; здесь просто набери другую команду)";
};
CMD.htop=function(){ return "htop — как top, но красивее (цветные полоски, мышь).\n\n"+CMD.top(); };
CMD.kill=function(a){
  var pid=+a[a.length-1];
  var idx=PROC_LIST.findIndex(function(p){return p.pid===pid;});
  if(idx===-1) return err("kill: ("+(a[a.length-1]||"")+"): Нет такого процесса");
  var name=PROC_LIST[idx].cmd;
  PROC_LIST.splice(idx,1);
  return "процесс "+pid+" ("+name+") завершён.";
};
CMD.killall=function(a){
  var name=a[a.length-1];
  var before=PROC_LIST.length;
  PROC_LIST=PROC_LIST.filter(function(p){return p.cmd!==name;});
  var killed=before-PROC_LIST.length;
  return killed? "завершено процессов: "+killed+" ("+name+")" : "killall: "+name+": процесс не найден";
};
CMD.jobs=function(){ return "[1]+  Running    node server.js &"; };
CMD.bg=function(){ return "[1]+ node server.js &"; };
CMD.fg=function(){ return "node server.js"; };
CMD.nice=function(a){ return "nice: приоритет процесса установлен ("+(a.join(" ")||"по умолчанию")+")"; };
CMD.time=function(a){
  if(!a.length) return err("time: укажи команду для замера");
  var start=(window.performance||Date).now();
  var res=normalize(execOne(a[0],a.slice(1)));
  var ms=((window.performance||Date).now()-start).toFixed(2);
  var body=res.html!=null?res.html:esc(res.out||"").replace(/\n/g,"<br>");
  return {html:(body?body+"<br><br>":"")+"real\t0m0."+String(Math.floor(Math.random()*90)).padStart(2,"0")+"s"};
};
CMD.watch=function(a){
  var cmdStr=a.join(" "); if(!cmdStr) return err("watch: укажи команду");
  var res=normalize(execOne(a[0],a.slice(1)));
  var body=res.html!=null?res.html:esc(res.out||"");
  return {html:"Каждые 2.0s: "+esc(cmdStr)+"<br><br>"+body};
};
CMD.lsof=function(){ return "COMMAND   PID USER   FD   TYPE NAME\nbash     1024  tux  cwd   DIR  /home/tux\nnode     2048  tux    3u  IPv4 *:3000 (LISTEN)"; };

/* ===== PERMISSIONS / USERS ===== */
CMD.chmod=function(a){
  var mode=a[0], f=a[1];
  if(!mode||!f) return err("chmod: пропущен операнд.  Пример: chmod +x hello.sh  или  chmod 755 file");
  var n=nodeAt(resolve(f));
  if(!n) return err("chmod: доступ к '"+f+"' невозможен: Нет такого файла");
  return "chmod: права '"+f+"' изменены на "+mode+"  (в учебной ФС это демонстрация)";
};
CMD.chown=function(a){
  var f=a[1]; if(!f) return err("chown: пропущен операнд");
  var n=nodeAt(resolve(f));
  if(!n) return err("chown: '"+f+"': Нет такого файла");
  return "chown: владелец '"+f+"' изменён на "+a[0];
};
CMD.umask=function(a){ return a[0] ? "umask установлена: "+a[0] : "0022"; };
CMD.su=function(a){ var u=a[0]||"root"; return "Password: ********\nsu: в учебном терминале переключение пользователя — просто демонстрация ("+u+")."; };
CMD.useradd=function(a){ var u=a[a.length-1]; if(!u) return err("useradd: укажи имя пользователя"); return "Пользователь «"+u+"» создан (в реальной системе нужен sudo)."; };
CMD.passwd=function(){ return "Изменение пароля для "+USER+".\nНовый пароль: ********\nПовтор пароля: ********\npasswd: пароль успешно обновлён."; };
CMD.groups=function(){ return USER+" : "+USER+" sudo docker"; };
CMD.w=function(){ return "USER   TTY   FROM       LOGIN@   IDLE  WHAT\n"+USER+"    pts/0 :0         09:12    0.00s bash"; };
CMD.who=CMD.w;
CMD.last=function(){ return USER+"   pts/0   :0    "+new Date().toDateString()+"   всё ещё в системе"; };
CMD.visudo=function(){ return openEditor("/etc/sudoers","nano"); };
CMD.sudo=function(a){
  if(!a.length) return err("usage: sudo <команда>");
  if(a[0]==="make" && a.slice(1).join(" ")==="me a sandwich") return "[sudo] пароль для "+USER+": ********\nОкей.";
  return "[sudo] пароль для "+USER+": ********\n"+run(a.join(" "), true);
};

/* ===== PACKAGE MANAGERS ===== */
function pkg(mgr,fam,a){
  var sub=a[0]||"";
  var pkgName=a.filter(function(x){return x[0]!=="-";})[1]||"htop";
  if(["install","-S","-Syu","update","-Sy","upgrade","in"].indexOf(sub)>-1){
    return "» "+mgr+" — пакетный менеджер для: "+fam+"\n"+
           "Чтение списков пакетов... Готово\n"+
           "Разрешение зависимостей... Готово\n"+
           "Установка "+pkgName+" (1 пакет, 2.4 MB)...\n"+
           "[####################] 100%\n"+
           pkgName+" успешно установлен.\n\n"+
           "Шпаргалка по всем менеджерам:\n"+
           "  Debian/Ubuntu/Mint : sudo apt install "+pkgName+"\n"+
           "  Arch/Manjaro       : sudo pacman -S "+pkgName+"\n"+
           "  Fedora             : sudo dnf install "+pkgName+"\n"+
           "  openSUSE           : sudo zypper install "+pkgName+"\n"+
           "  универсально       : sudo snap install "+pkgName+"   /   flatpak install "+pkgName;
  }
  if(sub==="remove"||sub==="-R"||sub==="rm") return "Удаление "+pkgName+"...\n"+pkgName+" удалён.";
  if(sub==="search"||sub==="-Ss") return pkgName+"  — описание пакета (учебная заглушка)";
  return "Использование: "+mgr+" <install|remove|search|update> <пакет>\n"+mgr+" — пакетный менеджер для "+fam+".";
}
CMD.apt=function(a){ return pkg("apt","Debian / Ubuntu / Mint",a); };
CMD.pacman=function(a){ return pkg("pacman","Arch / Manjaro",a); };
CMD.dnf=function(a){ return pkg("dnf","Fedora / RHEL",a); };
CMD.zypper=function(a){ return pkg("zypper","openSUSE",a); };
CMD.yay=function(a){ return pkg("yay","Arch (AUR-хелпер)",a); };
CMD.snap=function(a){
  if(a[0]==="install") return "снап-пакет «"+(a[1]||"htop")+"» установлен (универсально для любого дистрибутива).";
  return "snap — универсальный пакетный менеджер Canonical. snap install <пакет>";
};
CMD.flatpak=function(a){
  if(a[0]==="install") return "flatpak-приложение «"+(a[2]||a[1]||"app")+"» установлено (песочница, работает на любом дистрибутиве).";
  return "flatpak — универсальный менеджер приложений в песочнице. flatpak install <приложение>";
};

/* ===== ARCHIVES ===== */
CMD.tar=function(a){
  var flags=a.filter(function(x){return x[0]==="-";}).join("");
  var rest=a.filter(function(x){return x[0]!=="-";});
  if(/c/.test(flags)){
    var arcName=rest[0], src=rest[1]||".";
    var n=nodeAt(resolve(src));
    if(!n) return err("tar: "+src+": Нет такого файла или каталога");
    var pn=parentOf(resolve(arcName||"archive.tar.gz"));
    if(pn.parent) pn.parent.children[pn.name]=file("[архив tar: "+src+"]");
    return "создан архив "+(arcName||"archive.tar.gz");
  }
  if(/x/.test(flags)){
    var arc=rest[0];
    if(!nodeAt(resolve(arc))) return err("tar: "+arc+": Нет такого файла или каталога");
    return "архив «"+arc+"» распакован в текущий каталог (учебная имитация).";
  }
  if(/t/.test(flags)) return "содержимое архива (учебная имитация).";
  return "использование: tar -czf архив.tar.gz файл_или_папка   |   tar -xzf архив.tar.gz";
};
CMD.zip=function(a){
  var t=a.filter(function(x){return x[0]!=="-";});
  var outName=t[0]||"archive.zip";
  var pn=parentOf(resolve(outName));
  if(pn.parent) pn.parent.children[pn.name]=file("[zip архив]");
  return "создан "+outName;
};
CMD.unzip=function(a){ return "Archive:  "+(a[0]||"archive.zip")+"\n  распаковка... готово (учебная имитация)"; };
CMD.gzip=function(a){
  var t=a[0]; if(!t) return err("gzip: укажи файл");
  var n=nodeAt(resolve(t)); if(!n) return err("gzip: "+t+": нет такого файла");
  var pn=parentOf(resolve(t));
  pn.parent.children[t+".gz"]=file("[gzip: "+t+"]");
  delete pn.parent.children[pn.name];
  return "";
};
CMD.gunzip=function(a){ return "распаковано: "+(a[0]||""); };

/* ===== HASH / ENCODING ===== */
function fnvHash(str, seed){
  var h=seed||0x811c9dc5;
  for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=(h*0x01000193)>>>0; }
  return ("00000000"+h.toString(16)).slice(-8);
}
CMD.md5sum=function(a){
  var t=a[0];
  var n=t?nodeAt(resolve(t)):null;
  var content=n&&n.type==="file"?n.content:a.join(" ");
  if(!content) return err("md5sum: укажи файл. Пример: md5sum welcome.txt");
  var h=fnvHash(content)+fnvHash(content.split("").reverse().join(""), 0x5bd1e995);
  return h+"  "+(t||"-")+"   (учебная имитация, не настоящий MD5)";
};
CMD.sha256sum=function(a){
  var t=a[0];
  var n=nodeAt(resolve(t));
  if(!n||n.type!=="file") return err("sha256sum: "+t+": Нет такого файла");
  var content=n.content;
  if(window.crypto && window.crypto.subtle){
    window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)).then(function(digest){
      var hex=Array.prototype.map.call(new Uint8Array(digest), function(b){ return ("0"+b.toString(16)).slice(-2); }).join("");
      print(hex+"  "+t, "ok");
    }).catch(function(){ print("sha256sum: ошибка вычисления","err"); });
    return "вычисляю настоящий SHA-256 через Web Crypto API...";
  }
  return err("sha256sum: Web Crypto недоступен в этом браузере");
};
CMD.base64=function(a){
  var t=a.filter(function(x){return x[0]!=="-";});
  var decode=a.indexOf("-d")>-1||a.indexOf("--decode")>-1;
  var text=t.join(" ");
  if(!text) return err("base64: укажи текст. Пример: base64 привет");
  try{
    return decode ? decodeURIComponent(escape(atob(text))) : btoa(unescape(encodeURIComponent(text)));
  }catch(e){ return err("base64: некорректные входные данные для декодирования"); }
};

/* ===== NETWORK ===== */
CMD.ping=function(a){
  var host=a.filter(function(x){return x[0]!=="-";})[0]||"linux.org";
  var l=["PING "+host+" (93.184.216.34): 56 data bytes"];
  for(var i=0;i<4;i++) l.push("64 bytes from "+host+": icmp_seq="+i+" ttl=56 time="+(10+Math.random()*8).toFixed(1)+" ms");
  l.push("--- "+host+" ping statistics ---","4 packets transmitted, 4 received, 0% packet loss");
  return l.join("\n");
};
CMD.curl=function(a){
  var url=a.filter(function(x){return x[0]!=="-";})[0]||"";
  if(!url) return err("curl: попробуй: curl https://linux.org");
  return "<!doctype html>\n<html><head><title>"+esc(url)+"</title></head>\n<body>200 OK — (учебная заглушка ответа сервера)</body></html>";
};
CMD.wget=function(a){
  var url=a[a.length-1]; if(!url) return err("wget: укажи URL");
  var name=url.split("/").pop()||"index.html";
  var pn=parentOf(resolve(name));
  if(pn.parent) pn.parent.children[pn.name]=file("<!-- скачано с "+url+" -->");
  return "--"+new Date().toISOString()+"--  "+url+"\nСохранено: «"+name+"»  [учебная имитация]";
};
CMD.ifconfig=function(){ return "eth0: flags=4163  mtu 1500\n        inet 192.168.1.42  netmask 255.255.255.0\n        ether 02:42:ac:11:00:02\n\nlo: flags=73  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0"; };
CMD.ip=function(a){ if(a[0]==="a"||a[0]==="addr"||!a.length) return CMD.ifconfig(); return "использование: ip a"; };
CMD.netstat=function(){ return "Proto Local Address       Foreign Address    State\ntcp   0.0.0.0:22          0.0.0.0:*          LISTEN\ntcp   0.0.0.0:80          0.0.0.0:*          LISTEN"; };
CMD.ss=CMD.netstat;
CMD.nslookup=function(a){ var h=a[0]||"linux.org"; return "Server:  127.0.0.53\nAddress: 127.0.0.53#53\n\nNon-authoritative answer:\nName: "+h+"\nAddress: 93.184.216.34"; };
CMD.dig=CMD.nslookup;
CMD.traceroute=function(a){
  var h=a[0]||"linux.org";
  var lines=["traceroute to "+h+" (93.184.216.34), 30 hops max"];
  for(var i=1;i<=5;i++) lines.push(" "+i+"  10.0.0."+i+"  "+(5+i*4)+"."+i+" ms");
  return lines.join("\n");
};
CMD.ssh=function(a){
  var h=a[0]||"user@host";
  return "ssh: подключение к "+h+" ...\nThe authenticity of host can't be established.\nAre you sure you want to continue connecting (yes/no)? yes\nPermission denied (publickey).  (учебная имитация — попробуй сначала ssh-keygen)";
};
CMD.scp=function(a){ return a.length? a.join(" ")+"\n100%   защищённое копирование завершено (учебная имитация)" : err("scp: укажи источник и назначение"); };
CMD["ssh-keygen"]=function(){
  var pn=parentOf(resolve("~/.ssh/id_rsa"));
  if(pn.parent) pn.parent.children[pn.name]=file("-----BEGIN OPENSSH PRIVATE KEY-----\n[учебный ключ]\n-----END OPENSSH PRIVATE KEY-----\n");
  return "Generating public/private rsa key pair.\nYour identification has been saved in ~/.ssh/id_rsa\nYour public key has been saved in ~/.ssh/id_rsa.pub\nThe key fingerprint is:\nSHA256:"+Math.random().toString(36).slice(2,18)+" "+USER+"@"+HOST;
};
CMD["xdg-open"]=function(a){ return "Открываю «"+(a[0]||".")+"» в приложении по умолчанию (учебная имитация)."; };
CMD.open=CMD["xdg-open"];

/* ===== SYSTEMD / LOGS / CRON ===== */
CMD.systemctl=function(a){
  var sub=a[0], svc=a[1];
  if(sub==="list-units"||sub==="--type=service"||!sub){
    return Object.keys(SERVICES).map(function(n){ return n.padEnd(18)+(SERVICES[n]==="active"?"active   running":"inactive dead"); }).join("\n");
  }
  if(!svc) return err("systemctl: нужно указать сервис. Пример: systemctl status sshd");
  if(!(svc in SERVICES)) return err("Unit "+svc+".service could not be found.");
  if(sub==="status") return svc+".service — "+svc+"\n   Loaded: loaded\n   Active: "+SERVICES[svc]+(SERVICES[svc]==="active"?" (running)":" (dead)");
  if(sub==="start"){ SERVICES[svc]="active"; return ""; }
  if(sub==="stop"){ SERVICES[svc]="inactive"; return ""; }
  if(sub==="restart"){ SERVICES[svc]="active"; return "перезапущен."; }
  if(sub==="enable") return "Created symlink /etc/systemd/system/multi-user.target.wants/"+svc+".service.";
  if(sub==="disable") return "Removed symlink /etc/systemd/system/multi-user.target.wants/"+svc+".service.";
  return err("systemctl: неизвестная подкоманда "+sub);
};
CMD.journalctl=function(a){
  var l=[
    "systemd[1]: Started UGuide Linux.",
    "sshd[512]: Server listening on 0.0.0.0 port 22.",
    "NetworkManager[600]: Ethernet connection activated",
    "kernel: uguide: всё работает штатно"
  ];
  return l.join("\n")+(a.indexOf("-f")>-1?"\n(имитация: обычно журнал обновляется в реальном времени)":"");
};
CMD.crontab=function(a){
  if(a[0]==="-l") return "0 3 * * * /home/tux/backup.sh\n*/15 * * * * /usr/bin/sync-notes";
  return "crontab: используй -l для просмотра расписания задач (cron — планировщик заданий по времени).";
};

/* ===== POWER / MISC ===== */
CMD.reboot=function(){ return {out:"Система перезагружается... (шутка, это же браузер — ничего не перезагрузится)","cls":"ok"}; };
CMD.shutdown=CMD.reboot;
CMD.poweroff=CMD.reboot;
CMD.man=function(a){
  var m={
    ls:"ls — вывести содержимое каталога.\n  -l  подробный список (права, размер)\n  -a  показать скрытые файлы (начинаются с .)\nПример: ls -la /home",
    cd:"cd — сменить текущий каталог.\n  cd ..      на уровень вверх\n  cd ~       домой\n  cd /etc    по абсолютному пути",
    pwd:"pwd — показать путь к текущему каталогу (print working directory).",
    mkdir:"mkdir — создать каталог.  Пример: mkdir myfolder",
    rm:"rm — удалить файл.  -r удаляет каталог рекурсивно.  ОСТОРОЖНО: без корзины!",
    cp:"cp — копировать.  cp что куда.  Для каталогов: cp -r src dst",
    mv:"mv — переместить или переименовать.  mv old.txt new.txt",
    cat:"cat — вывести содержимое файла целиком.  cat file.txt",
    chmod:"chmod — изменить права доступа.\n  chmod +x script.sh   сделать исполняемым\n  chmod 755 file       rwx r-x r-x",
    grep:"grep — искать строки по шаблону.\n  grep слово файл\n  ls | grep txt   (через конвейер)",
    sudo:"sudo — выполнить команду от имени суперпользователя (root).  sudo apt update",
    tar:"tar — архиватор.\n  tar -czf архив.tar.gz папка   создать\n  tar -xzf архив.tar.gz         распаковать",
    systemctl:"systemctl — управление службами systemd.\n  systemctl status sshd\n  systemctl start|stop|restart|enable|disable <служба>",
    kill:"kill — завершить процесс по PID.  Сначала посмотри PID командой ps или top.",
    ssh:"ssh — подключение к удалённому серверу по защищённому протоколу.  ssh user@host",
    ping:"ping — проверить, доступен ли узел в сети.  ping linux.org",
    find:"find — искать файлы.  find . -name \"*.txt\"",
    top:"top — монитор процессов и нагрузки в реальном времени.",
    ps:"ps — список текущих процессов.",
    nano:"nano — простой текстовый редактор. ^O — записать, ^X — выйти.",
    vim:"vim — модальный текстовый редактор. :wq — сохранить и выйти, :q! — выйти без сохранения.",
    alias:"alias — создать короткое имя для команды.  alias ll='ls -la'",
    export:"export — задать переменную окружения.  export EDITOR=nano",
    history:"history — показать историю введённых команд.",
    diff:"diff — сравнить два файла построчно.  diff a.txt b.txt",
    sort:"sort — отсортировать строки файла или вывода.",
    man:"man — руководство по команде.  man ls"
  };
  var t=a[0];
  if(!t) return "Что за man? Укажи команду, напр.: man ls";
  return m[t]||(CMD[t]? "Справка по «"+t+"»: учебная команда LINUX UGUIDE. Просто попробуй её запустить — или набери `apropos "+t+"`." : "Нет справки по «"+t+"».");
};
CMD.info=function(a){ return CMD.man(a); };

/* ===== FUN / SITE NAVIGATION ===== */
var TIPS=[
  "Используй Tab для автодополнения команд и путей — экономит кучу времени.",
  "`cd -` возвращает тебя в предыдущий каталог, где ты был до этого.",
  "Стрелка вверх ↑ листает историю команд.",
  "`sudo !!` в настоящем баше повторяет последнюю команду с правами root.",
  "Ctrl+C прерывает выполнение, Ctrl+L очищает экран (работает и здесь!).",
  "`man <команда>` — твой лучший друг, когда забыл синтаксис.",
  "Символ `~` — это всегда твоя домашняя папка, где бы ты ни был.",
  "`.` значит текущий каталог, `..` — на уровень выше.",
  "В именах файлов Linux регистр важен: file.txt и File.txt — разные файлы.",
  "Почти всё в Linux — это файл, даже устройства в /dev.",
  "GRUB — это загрузчик, который запускает ядро Linux при включении компьютера.",
  "systemd управляет тем, какие службы стартуют при загрузке системы."
];
CMD.tip=function(){ return TIPS[Math.floor(Math.random()*TIPS.length)]; };
CMD.neofetch=function(){
  var tux=[
    '        <span class="ok">.--.</span>',
    '       <span class="ok">|o_o |</span>',
    '       <span class="ok">|:_/ |</span>',
    '      <span class="ok">//   \\ \\</span>',
    '     <span class="ok">(|     | )</span>',
    '    <span class="ok">/\'\\_   _/`\\</span>',
    '    <span class="ok">\\___)=(___/</span>'
  ];
  var info=[
    '<b class="ok">'+USER+'@'+HOST+'</b>',
    '-----------',
    '<b class="ok">OS</b>: UGuide Linux 1.0 x86_64',
    '<b class="ok">Kernel</b>: 6.9.0-uguide',
    '<b class="ok">Shell</b>: uguide-sh 1.0',
    '<b class="ok">DE</b>: browser',
    '<b class="ok">Terminal</b>: LINUX UGUIDE',
    '<b class="ok">CPU</b>: Pixel Core i8 (8) @ 3.6GHz',
    '<b class="ok">Memory</b>: 2150MiB / 7850MiB',
    '<span class="sw">████████</span>'
  ];
  var rows=[]; var max=Math.max(tux.length,info.length);
  for(var i=0;i<max;i++) rows.push((tux[i]||"                ")+"   "+(info[i]||""));
  return {html:rows.join("<br>")};
};
CMD.cowsay=function(a){
  var msg=a.join(" ").replace(/^["']|["']$/g,"")||"Linux — это свобода!";
  var top=" "+"_".repeat(msg.length+2);
  var bot=" "+"-".repeat(msg.length+2);
  return {html: esc(top)+"<br>"+esc("< "+msg+" >")+"<br>"+esc(bot)+"<br>"+
    esc("        \\   ^__^")+"<br>"+esc("         \\  (oo)\\_______")+"<br>"+
    esc("            (__)\\       )\\/\\")+"<br>"+esc("                ||----w |")+"<br>"+esc("                ||     ||")};
};
CMD.clear=function(){ out.innerHTML=""; return null; };
CMD.clr=CMD.clear;
CMD.matrix=function(){ if(DOJO.terminal&&DOJO.terminal.matrix) DOJO.terminal.matrix(); return {out:"Входим в матрицу... (клик по экрану, чтобы выйти)",cls:"ok"}; };
CMD.play=function(a){
  if(!DOJO.player) return err("плеер не готов");
  if(a[0]==="next"){ DOJO.player.next(); return "▶ следующий трек"; }
  if(a[0]==="prev"){ DOJO.player.prev(); return "▶ предыдущий трек"; }
  DOJO.player.play(); return "♪ играет чиптюн. Управление — в плеере справа снизу.";
};
CMD.distros=function(){ print("Загружаю энциклопедию дистрибутивов...","ok"); setTimeout(function(){ DOJO.go("distros.html"); },500); return null; };
CMD.faq=function(){ print("Открываю FAQ по Linux...","ok"); setTimeout(function(){ DOJO.go("faq.html"); },500); return null; };
CMD.mission=function(){ if(DOJO.missions) DOJO.missions.open(); return {out:"Открываю панель уроков слева. Выполняй шаги — они отмечаются автоматически.",cls:"ok"}; };
CMD.exit=function(){ return {out:"Выйти из браузерного терминала нельзя ;) Но ты молодец. Набери `help` или `faq`.",cls:"ok"}; };

/* ===== GIT (полноценная симуляция с подкомандами) ===== */
var GIT={ init:false, branch:"main", branches:["main"], staged:[], commits:[], remotes:{} };
function shortHash(){ return Math.random().toString(16).slice(2,9); }
CMD.git=function(a){
  var sub=a[0];
  if(!sub) return "usage: git <command> [<args>]\n\nосновные команды: init status add commit log branch checkout diff push pull clone remote stash merge";
  if(sub==="init"){ GIT.init=true; GIT.commits=[]; GIT.staged=[]; GIT.branch="main"; GIT.branches=["main"]; return "Initialized empty Git repository in "+pathStr(cwd)+"/.git/"; }
  if(!GIT.init) return err("fatal: not a git repository (or any of the parent directories): .git\nПодсказка: сначала `git init`");
  if(sub==="status"){
    var st=GIT.staged.length
      ? "Изменения, подготовленные к коммиту:\n"+GIT.staged.map(function(f){return "  new file:   "+f;}).join("\n")
      : "рабочий каталог чист, коммитить нечего.";
    return "На ветке "+GIT.branch+"\n\n"+st;
  }
  if(sub==="add"){
    var files=a.slice(1);
    if(!files.length) return err("Nothing specified, nothing added.");
    if(files[0]==="."){ GIT.staged.push("."); return ""; }
    files.forEach(function(f){ if(GIT.staged.indexOf(f)===-1) GIT.staged.push(f); });
    return "";
  }
  if(sub==="commit"){
    var mIdx=a.indexOf("-m");
    var msg=mIdx>-1 ? a.slice(mIdx+1).join(" ").replace(/^["']|["']$/g,"") : null;
    if(!msg) return err("Aborting commit due to empty commit message.\nПодсказка: git commit -m \"текст\"");
    if(!GIT.staged.length) return err("nothing to commit, working tree clean\nПодсказка: сначала git add <файл>");
    var hash=shortHash();
    GIT.commits.unshift({hash:hash, msg:msg, files:GIT.staged.slice()});
    var n=GIT.staged.length; GIT.staged=[];
    return "["+GIT.branch+" "+hash+"] "+msg+"\n "+n+" file(s) changed";
  }
  if(sub==="log"){
    if(!GIT.commits.length) return err("fatal: your current branch '"+GIT.branch+"' does not have any commits yet");
    return GIT.commits.map(function(c){ return "commit "+c.hash+"\nAuthor: "+USER+" <"+USER+"@"+HOST+">\n\n    "+c.msg+"\n"; }).join("\n");
  }
  if(sub==="branch"){
    if(a[1]){ if(GIT.branches.indexOf(a[1])===-1) GIT.branches.push(a[1]); return ""; }
    return GIT.branches.map(function(b){ return (b===GIT.branch?"* ":"  ")+b; }).join("\n");
  }
  if(sub==="checkout"){
    var bname=a[1];
    if(a[1]==="-b"){ bname=a[2]; if(!bname) return err("git checkout: укажи имя новой ветки"); if(GIT.branches.indexOf(bname)===-1) GIT.branches.push(bname); GIT.branch=bname; return "Switched to a new branch '"+bname+"'"; }
    if(!bname) return err("git checkout: укажи ветку");
    if(GIT.branches.indexOf(bname)===-1) return err("error: pathspec '"+bname+"' did not match any file(s) known to git");
    GIT.branch=bname; return "Switched to branch '"+bname+"'";
  }
  if(sub==="diff") return GIT.staged.length? "diff --git a/"+GIT.staged[0]+" b/"+GIT.staged[0]+"\n+ (учебная имитация построчных изменений)" : "";
  if(sub==="remote"){
    if(a[1]==="-v") return Object.keys(GIT.remotes).map(function(r){return r+"\t"+GIT.remotes[r]+" (fetch)\n"+r+"\t"+GIT.remotes[r]+" (push)";}).join("\n")||"";
    if(a[1]==="add"){ GIT.remotes[a[2]]=a[3]||"origin-url"; return ""; }
    return Object.keys(GIT.remotes).join("\n");
  }
  if(sub==="push"){ var rs=Object.keys(GIT.remotes); if(!rs.length) return err("fatal: No configured push destination.\nПодсказка: git remote add origin <url>"); return "To "+GIT.remotes[rs[0]]+"\n   "+shortHash().slice(0,7)+".."+shortHash().slice(0,7)+"  "+GIT.branch+" -> "+GIT.branch; }
  if(sub==="pull") return "Already up to date.";
  if(sub==="clone") return "Cloning into '"+(a[1]?a[1].split("/").pop().replace(/\.git$/,""):"repo")+"'...\nremote: Enumerating objects... done.\nReceiving objects: 100% (учебная имитация)";
  if(sub==="stash") return a[1]==="pop" ? "Изменения из стэша восстановлены." : "Сохранено во временный стэш: WIP on "+GIT.branch;
  if(sub==="merge"){ var b=a[1]; if(!b) return err("git merge: укажи ветку"); return "Merge made by the 'ort' strategy.\n(учебная имитация слияния "+b+" в "+GIT.branch+")"; }
  return err("git: '"+sub+"' is not a git command. Смотри `git help`.");
};

/* ===== DOCKER (симуляция с подкомандами) ===== */
var CONTAINERS=[];
var IMAGES=["ubuntu:22.04","nginx:latest","node:20","python:3.12","alpine:latest"];
function shortId(){ return Math.random().toString(16).slice(2,14); }
CMD.docker=function(a){
  var sub=a[0];
  if(!sub) return "Usage: docker [OPTIONS] COMMAND\n\nосновные команды: run ps images pull build stop rm exec logs";
  if(sub==="ps"){
    var showAll=a.indexOf("-a")>-1;
    var list=showAll?CONTAINERS:CONTAINERS.filter(function(c){return c.status==="Up";});
    if(!list.length) return "CONTAINER ID   IMAGE             STATUS       NAMES";
    var rows=list.map(function(c){ return c.id.slice(0,12)+"   "+c.image.padEnd(16)+c.status.padEnd(12)+c.name; });
    return "CONTAINER ID   IMAGE             STATUS       NAMES\n"+rows.join("\n");
  }
  if(sub==="images") return "REPOSITORY   TAG      IMAGE ID\n"+IMAGES.map(function(i){ var p=i.split(":"); return p[0].padEnd(12)+(p[1]||"latest").padEnd(9)+shortId().slice(0,12); }).join("\n");
  if(sub==="pull"){ var img=a[1]||"ubuntu:latest"; if(IMAGES.indexOf(img)===-1) IMAGES.push(img); return img+": Pulling from library\nDigest: sha256:"+shortId()+shortId()+"\nStatus: Downloaded newer image for "+img; }
  if(sub==="run"){ var img2=a[a.length-1]||"ubuntu:latest"; var id=shortId(); var name="container_"+CONTAINERS.length; CONTAINERS.push({id:id, image:img2, status:"Up", name:name}); return id; }
  if(sub==="stop"){ var t=a[1]; var c=CONTAINERS.filter(function(x){return x.id.indexOf(t)===0||x.name===t;})[0]; if(!c) return err("Error: No such container: "+t); c.status="Exited"; return t; }
  if(sub==="rm"){ var t2=a[1]; var i2=-1; CONTAINERS.forEach(function(x,idx){ if(x.id.indexOf(t2)===0||x.name===t2) i2=idx; }); if(i2===-1) return err("Error: No such container: "+t2); CONTAINERS.splice(i2,1); return t2; }
  if(sub==="exec") return "root@"+(a[a.length-1]||"container")+":/# (учебная имитация — интерактивная оболочка внутри контейнера)";
  if(sub==="logs") return "[app] сервер запущен на порту 3000\n[app] всё работает штатно (учебная имитация)";
  if(sub==="build") return "Sending build context...\nStep 1/5 : FROM ubuntu:22.04\nSuccessfully built "+shortId().slice(0,12);
  return err("docker: '"+sub+"' is not a docker command.");
};

/* ===== ДОПОЛНИТЕЛЬНЫЕ ПАКЕТНЫЕ МЕНЕДЖЕРЫ ===== */
CMD["apt-get"]=function(a){ return CMD.apt(a); };
CMD["apt-cache"]=function(a){ return a[0]==="search" ? (a[1]||"pkg")+" - учебное описание пакета" : "использование: apt-cache search <пакет>"; };
CMD.dpkg=function(a){
  if(a[0]==="-l") return "ii  bash           5.2.15   основная оболочка\nii  coreutils      9.4      базовые утилиты\nii  curl           8.5.0    HTTP-клиент";
  if(a[0]==="-i") return "Selecting previously unselected package "+(a[1]||"pkg")+".\n(учебная имитация установки .deb)";
  return "использование: dpkg -l   |   dpkg -i <файл.deb>";
};
CMD.rpm=function(a){ return a[0]==="-qa" ? "bash-5.2.15\ncoreutils-9.4\ncurl-8.5.0" : "использование: rpm -qa   (список установленных пакетов)"; };

/* ===== ЕЩЁ COREUTILS (настоящая логика) ===== */
CMD.seq=function(a){
  var nums=a.map(Number), start=1, step=1, end;
  if(nums.length===1) end=nums[0];
  else if(nums.length===2){ start=nums[0]; end=nums[1]; }
  else if(nums.length===3){ start=nums[0]; step=nums[1]; end=nums[2]; }
  else return err("seq: укажи число(а). Пример: seq 5   |   seq 2 10   |   seq 1 2 10");
  if(isNaN(start)||isNaN(end)||isNaN(step)) return err("seq: некорректный аргумент");
  var res=[];
  if(step>0) for(var i=start;i<=end;i+=step) res.push(i);
  else if(step<0) for(var j=start;j>=end;j+=step) res.push(j);
  return res.join("\n");
};
CMD.yes=function(a){
  var s=a.join(" ")||"y", lines=[];
  for(var i=0;i<12;i++) lines.push(s);
  return lines.join("\n")+"\n... (в настоящем терминале печатает бесконечно; здесь остановлено — Ctrl+C)";
};
CMD.cal=function(){
  var d=new Date(), y=d.getFullYear(), m=d.getMonth();
  var first=new Date(y,m,1), daysInMonth=new Date(y,m+1,0).getDate();
  var startDow=(first.getDay()+6)%7;
  var names=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  var title=names[m]+" "+y, pad=Math.max(0,Math.floor((20-title.length)/2));
  var lines=[" ".repeat(pad)+title,"Пн Вт Ср Чт Пт Сб Вс"], row=" ".repeat(startDow*3);
  for(var day=1; day<=daysInMonth; day++){
    row+=String(day).padStart(2," ")+" ";
    if((startDow+day)%7===0){ lines.push(row.replace(/\s+$/,"")); row=""; }
  }
  if(row.trim()) lines.push(row.replace(/\s+$/,""));
  return lines.join("\n");
};
function safeCalc(expr){
  if(!expr||!/^[\d\s+\-*/().]+$/.test(expr)) return null;
  try{ return Function('"use strict";return ('+expr+')')(); }catch(e){ return null; }
}
CMD.bc=function(a,stdin){ var r=safeCalc(a.join(" ")||stdin||""); return r===null?err("bc: синтаксическая ошибка"):String(r); };
CMD.expr=function(a){ var r=safeCalc(a.join(" ")); return r===null?err("expr: синтаксическая ошибка"):String(r); };
CMD.printf=function(a){
  var fmt=(a[0]||"").replace(/^["']|["']$/g,""); var args=a.slice(1), i=0;
  return fmt.replace(/%[sd%]/g,function(m){ if(m==="%%") return "%"; return args[i++]!==undefined?args[i-1]:""; }).replace(/\\n/g,"\n").replace(/\\t/g,"\t");
};
CMD.basename=function(a){
  var p=(a[0]||"").replace(/\/+$/,""); var b=p.split("/").pop();
  if(a[1]) b=b.replace(new RegExp(a[1].replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"$"),"");
  return b;
};
CMD.dirname=function(a){ var p=(a[0]||".").replace(/\/+$/,""); var parts=p.split("/"); parts.pop(); return parts.join("/")||(p.charAt(0)==="/"?"/":"."); };
CMD.realpath=function(a){ return pathStr(resolve(a[0]||"")); };
CMD.readlink=function(a){
  var n=nodeAt(resolve(a[0])); if(!n) return err("readlink: "+a[0]+": Нет такого файла");
  return (n.type==="file"&&/^symlink ->/.test(n.content)) ? n.content.replace("symlink -> ","") : pathStr(resolve(a[0]));
};
CMD.rev=function(a,stdin){ var text=stdin!=null?stdin:(function(){var n=nodeAt(resolve(a[0])); return n?n.content:"";})(); return text.replace(/\n$/,"").split("\n").map(function(l){return l.split("").reverse().join("");}).join("\n"); };
CMD.tac=function(a,stdin){ var text=stdin!=null?stdin:(function(){var n=nodeAt(resolve(a[0])); return n?n.content:"";})(); return text.replace(/\n$/,"").split("\n").reverse().join("\n"); };
CMD.nl=function(a,stdin){ var text=stdin!=null?stdin:(function(){var n=nodeAt(resolve(a[0])); return n?n.content:"";})(); return text.replace(/\n$/,"").split("\n").map(function(l,i){return String(i+1).padStart(6)+"\t"+l;}).join("\n"); };
CMD.fold=function(a,stdin){
  var w=8, m=a.join(" ").match(/-w\s*(\d+)/); if(m) w=+m[1];
  var text=stdin!=null?stdin:(function(){var n=nodeAt(resolve(a[a.length-1])); return n?n.content:"";})();
  var out2=[]; text.split("\n").forEach(function(line){ for(var i=0;i<line.length;i+=w) out2.push(line.slice(i,i+w)); });
  return out2.join("\n");
};
CMD.tee=function(a,stdin){
  var text=stdin||"";
  a.filter(function(x){return x[0]!=="-";}).forEach(function(t){
    var path=resolve(t), pn=parentOf(path), existing=nodeAt(path);
    if(pn.parent){ if(existing&&existing.type==="file") existing.content=text; else pn.parent.children[pn.name]=file(text); }
  });
  return text;
};
CMD.mktemp=function(){ var name="tmp."+Math.random().toString(36).slice(2,10); var pn=parentOf(resolve("/tmp/"+name)); if(pn.parent) pn.parent.children[pn.name]=file(""); return "/tmp/"+name; };
CMD.truncate=function(a){
  var sizeArg=(a.join(" ").match(/-s\s*(\d+)/)||[])[1]; var t=a[a.length-1];
  var n=nodeAt(resolve(t)); if(!n) return err("truncate: "+t+": Нет такого файла");
  n.content=(n.content||"").slice(0, sizeArg?+sizeArg:0); return "";
};
function hexDump(text){
  var bytes=[]; for(var i=0;i<text.length;i++) bytes.push(text.charCodeAt(i)&0xff);
  var lines=[];
  for(var o=0;o<bytes.length;o+=16){
    var chunk=bytes.slice(o,o+16);
    var hex=chunk.map(function(b){return b.toString(16).padStart(2,"0");}).join(" ");
    var ascii=chunk.map(function(b){return (b>=32&&b<127)?String.fromCharCode(b):".";}).join("");
    lines.push(o.toString(16).padStart(8,"0")+"  "+hex.padEnd(47)+"  "+ascii);
  }
  return lines.join("\n")||"(пусто)";
}
CMD.xxd=function(a){ var n=nodeAt(resolve(a[0])); if(!n) return err("xxd: "+a[0]+": Нет такого файла"); return hexDump(n.content); };
CMD.hexdump=CMD.xxd;
CMD.od=function(a){ var n=nodeAt(resolve(a[a.length-1])); if(!n) return err("od: нет такого файла"); return hexDump(n.content); };
CMD.nproc=function(){ return "8"; };
CMD.arch=function(){ return "x86_64"; };

/* ===== СИСТЕМА+ ===== */
CMD.hostnamectl=function(){ return "Static hostname: "+HOST+"\nIcon name: computer-laptop\nOperating System: UGuide Linux 1.0\nKernel: Linux 6.9.0-uguide\nArchitecture: x86-64"; };
CMD.timedatectl=function(){ return "Local time: "+new Date().toString()+"\nUniversal time: "+new Date().toUTCString()+"\nTime zone: Europe/Moscow\nNTP service: active"; };
CMD.localectl=function(){ return "System Locale: LANG="+ENV.LANG+"\nVC Keymap: us\nX11 Layout: us,ru"; };
CMD.vmstat=function(){ return "procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----\n r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id\n 1  0      0 4093220 210120 1743352    0    0     2     8   45   90  3  1 96"; };
CMD.iostat=function(){ return "Device            r/s     w/s     rkB/s     wkB/s\nsda              0.42    1.15     12.30     58.20"; };
CMD.mpstat=function(){ return "CPU    %usr   %sys  %idle\nall    3.10   1.20  95.70"; };
CMD.sensors=function(){ return "coretemp-isa-0000\nPackage id 0:  +42.0°C\nCore 0:        +40.0°C\nCore 1:        +41.0°C"; };

/* ===== ПРОЦЕССЫ+ ===== */
CMD.pgrep=function(a){ var q=a[a.length-1]; return PROC_LIST.filter(function(p){return p.cmd.indexOf(q)>-1;}).map(function(p){return p.pid;}).join("\n"); };
CMD.pkill=function(a){ var q=a[a.length-1]; var before=PROC_LIST.length; PROC_LIST=PROC_LIST.filter(function(p){return p.cmd.indexOf(q)===-1;}); return before!==PROC_LIST.length?"":err("pkill: процесс не найден"); };
CMD.pstree=function(){ return "systemd─┬─bash───node\n        ├─bash───firefox\n        └─sshd"; };
CMD.fuser=function(a){ return (a[0]||"")+":  1024  2048"; };
CMD.strace=function(a){ return "execve(\""+(a[0]||"/bin/ls")+"\", ...) = 0\nbrk(NULL) = 0x55f2\nopenat(AT_FDCWD, ...) = 3\n... (учебная имитация трассировки системных вызовов)"; };
CMD.ltrace=CMD.strace;

/* ===== СЕТЬ+ ===== */
CMD.route=function(){ return "Destination   Gateway       Genmask         Iface\ndefault       192.168.1.1   0.0.0.0         eth0\n192.168.1.0   0.0.0.0       255.255.255.0   eth0"; };
CMD.arp=function(){ return "Address          HWtype  HWaddress           Iface\n192.168.1.1      ether   aa:bb:cc:dd:ee:ff   eth0"; };
CMD.host=function(a){ return (a[0]||"linux.org")+" has address 93.184.216.34"; };
CMD.whois=function(a){ return "Domain Name: "+(a[0]||"linux.org").toUpperCase()+"\nRegistrar: (учебная заглушка)\nCreation Date: 1996-01-01"; };
CMD.nc=function(a){ return "nc: подключение к "+(a[0]||"host")+":"+(a[1]||"80")+" ... (учебная имитация netcat)"; };
CMD.netcat=CMD.nc;
CMD.telnet=function(a){
  if(a[0] && a[0].indexOf("towel")>-1) return "Trying...\nConnected.\n\nЛегендарная пасхалка: telnet towel.blue/starwarstel показывает Star Wars ASCII-мультфильм целиком!\n(в этом браузерном терминале — просто напоминание, что такое чудо существует)";
  return "telnet: подключение к "+(a[0]||"host")+" ... Connection refused (учебная имитация — в браузере реальных сетевых подключений нет)";
};

/* ===== МЕМЫ И ПАСХАЛКИ ===== */
CMD.sl=function(){
  return {html:
    "      ====        ________                ___________ <br>"+
    "  _D _|  |_______/        \\__I_I_____===__|_________| <br>"+
    "   |(_)---  |   H\\________/ |   |        =|___ ___|      _________________ <br>"+
    "   /     |  |   H  |  |     |   |         ||_| |_||     _|                \\_____A <br>"+
    "  |      |  |   H  |__--------------------| [___] |   =|                        | <br>"+
    "  | ________|___H__/__|_____/[][]~\\_______|       |   -|                        | <br>"+
    "  |/ |   |-----------I_____I [][] []  D   |=======|____|________________________|_ <br>"+
    '<span class="err">упс, ты хотел `ls`? паровозик уехал.</span>'};
};
var FORTUNES=[
  "«Talk is cheap. Show me the code.» — Линус Торвальдс",
  "«Unix is simple. It just takes a genius to understand its simplicity.» — Деннис Ритчи",
  "Всё в Linux — файл. Даже почти всё остальное тоже.",
  "Настоящие профи не читают документацию. Но иногда стоит.",
  "В начале был терминал, и терминал был чёрным, и был на нём зелёный текст.",
  "Компилируется — значит почти наверняка работает.",
  "«640K ought to be enough for anybody» — миф, приписываемый Биллу Гейтсу."
];
CMD.fortune=function(){ return FORTUNES[Math.floor(Math.random()*FORTUNES.length)]; };
CMD.figlet=function(a){
  var text=(a.join(" ")||"hi").toUpperCase().slice(0,14);
  return {html:'<span style="font-size:1.5em;letter-spacing:.2em">'+esc(text)+'</span><br>(учебная имитация figlet — крупный текст вместо настоящего ASCII-шрифта)'};
};
CMD.toilet=CMD.figlet;
CMD.banner=CMD.figlet;
CMD.nyancat=function(){
  return {html:
    "+      o     +              o   <br>"+
    "    +             o     +       <br>"+
    "o          +  __     +          <br>"+
    "     +      ⩊(=^-ω-^=)⊃━☆ﾟ.*  +  <br>"+
    "  +    。       +       。   +   <br>"+
    "     (учебная имитация nyancat)"};
};
CMD.parrot=function(){ return "(o&gt;  <span class=\"ok\">party parrot online</span> (учебная имитация ASCII-попугая)"; };
CMD.leet=function(a){
  var map={a:"4",e:"3",i:"1",o:"0",s:"5",t:"7",A:"4",E:"3",I:"1",O:"0",S:"5",T:"7"};
  return a.join(" ").split("").map(function(c){ return map[c]!==undefined?map[c]:c; }).join("");
};
CMD.xkcd=function(){ return "«Стандарты»: 14 конкурирующих стандартов — «нужен один универсальный, покрывающий все случаи»... итог: 15 конкурирующих стандартов. (вольный пересказ xkcd #927)"; };
CMD["42"]=function(){ return "Ответ на главный вопрос жизни, вселенной и всего такого."; };
CMD.make=function(a){ return a.join(" ")==="me a sandwich" ? err("Что? Сделай сам.") : err("make: не найден Makefile"); };
CMD[":(){"]=function(){
  return {out:"Хорошая попытка :) Это классическая fork-бомба bash.\nВ этом браузерном терминале все процессы не настоящие, поэтому ничего не сломается.\nНо в реальном Linux это выражение бесконечно клонирует само себя и вешает систему — никогда не запускай его без причины!", cls:"ok"};
};

CMD.help=function(a){
  var cat=a[0];
  var CATS={
    nav:"НАВИГАЦИЯ: pwd ls cd tree find ll la",
    files:"ФАЙЛЫ: cat touch mkdir rmdir rm cp mv ln echo head tail wc stat file diff sort uniq cut tr xargs less more",
    text:"ТЕКСТ+: seq yes cal bc expr printf basename dirname realpath readlink rev tac nl fold tee mktemp truncate xxd hexdump od nproc arch",
    edit:"РЕДАКТОРЫ: nano vim vi",
    shell:"ОБОЛОЧКА: history alias unalias export env printenv source type apropos which",
    sys:"СИСТЕМА: whoami id uname hostname date uptime free df du lscpu lsblk lsusb lspci dmesg hostnamectl timedatectl vmstat iostat mpstat sensors",
    proc:"ПРОЦЕССЫ: ps top htop kill killall jobs bg fg nice time watch lsof pgrep pkill pstree fuser strace",
    perm:"ПРАВА И ПОЛЬЗОВАТЕЛИ: chmod chown umask sudo su useradd passwd groups w who last visudo",
    pkg:"ПАКЕТЫ: apt apt-get dpkg pacman dnf zypper yay snap flatpak rpm",
    arc:"АРХИВЫ: tar zip unzip gzip gunzip",
    hash:"ХЕШИ: sha256sum md5sum base64",
    net:"СЕТЬ: ping curl wget ifconfig ip netstat nslookup dig traceroute ssh scp ssh-keygen route arp host whois nc telnet",
    systemd:"SYSTEMD: systemctl journalctl crontab",
    git:"GIT: git init status add commit log branch checkout diff push pull clone remote stash merge",
    docker:"DOCKER: docker ps images pull run stop rm exec logs build",
    fun:"ВЕСЕЛЬЕ: neofetch cowsay matrix play tip sl fortune figlet nyancat leet xkcd 42  ·  ☠ `sudo rm -rf /`",
    site:"САЙТ: mission distros faq exit clear"
  };
  if(cat && CATS[cat]) return CATS[cat];
  return "LINUX UGUIDE — учебный терминал. Команд много, вот категории (набери help <категория>):\n\n"+
    Object.keys(CATS).map(function(k){ return "  "+k.padEnd(8)+CATS[k]; }).join("\n")+"\n\n"+
    "Совет: используй Tab для автодополнения, ↑/↓ — история команд.\n"+
    "Приёмы: `|` конвейер, `>` запись в файл, `>>` дозапись.  Пример: ls -la | grep txt\n"+
    "Полный список с примерами — на странице «команды», а вопросы про сам Linux — на странице `faq`.";
};

/* ---------------- parser + executor ---------------- */
function tokenize(str){
  var m=str.match(/"[^"]*"|'[^']*'|\S+/g);
  return m||[];
}
function execOne(name,args,stdin,silentUnknown){
  if(ALIASES[name]){
    var exp=tokenize(ALIASES[name]);
    args=exp.slice(1).concat(args);
    name=exp[0];
  }
  if(!CMD[name]){
    return silentUnknown? "" : err("bash: "+name+": команда не найдена. Набери `help`.");
  }
  return CMD[name](args, stdin);
}
function normalize(r){
  if(r===null||r===undefined) return {out:null,cls:null,html:null};
  if(typeof r==="string") return {out:r,cls:null,html:null};
  if(r&&r.html!==undefined) return {out:null,cls:r.cls||null,html:r.html};
  return {out:r.out,cls:r.cls||null,html:null};
}

function isDestroy(raw){
  var t = raw.trim().replace(/\s+/g," ");
  if(!/(^|\s)rm\s/.test(t)) return false;
  var hasR = /\s-[a-z]*r/i.test(t);
  var hasF = /\s-[a-z]*f/i.test(t);
  var rootTarget = /\s\/\*?$/.test(t);        // ends with " /" or " /*"
  return hasR && hasF && rootTarget;
}
function run(raw, fromSudo){
  if(raw.replace(/\s+/g,"")===":(){:|:&};:"){
    var fb=normalize(CMD[":(){"]());
    if(fromSudo) return fb.out||"";
    print(fb.out, fb.cls);
    return "";
  }
  if(isDestroy(raw) && !fromSudo){
    DOJO.terminal.destroy(/^\s*sudo\b/.test(raw));
    return "";
  }
  var redirect=null, redirFile=null;
  var rm=raw.match(/(.*?)\s(>>|>)\s*(\S+)\s*$/);
  var work=raw;
  if(rm){ work=rm[1]; redirect=rm[2]; redirFile=rm[3]; }

  var stages=work.split("|").map(function(s){return s.trim();}).filter(Boolean);
  var stdin=null, final=null;
  for(var s=0;s<stages.length;s++){
    var toks=tokenize(stages[s]);
    var name=toks[0]; var args=toks.slice(1);
    if(name===undefined) continue;
    var res=normalize(execOne(name,args,stdin, false));
    var asText = res.html!=null ? res.html.replace(/<[^>]+>/g,"").replace(/&nbsp;/g,"  ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&") : (res.out||"");
    stdin = asText;
    final = res;
  }
  if(final===null) return "";

  if(redirect && final){
    var text = final.html!=null ? final.html.replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ") : (final.out||"");
    var path=resolve(redirFile), pn=parentOf(path), existing=nodeAt(path);
    if(pn.parent&&pn.parent.type==="dir"){
      if(existing&&existing.type==="file"){ existing.content = redirect===">>" ? existing.content+text+"\n" : text+"\n"; }
      else pn.parent.children[pn.name]=file(text+"\n");
    }
    return "";
  }
  if(fromSudo){
    return final.html!=null ? final.html.replace(/<[^>]+>/g,"") : (final.out||"");
  }
  if(final.html!=null) line(final.html, final.cls);
  else if(final.out!=null) print(final.out, final.cls);
  return "";
}

/* ---------------- public interface + input ---------------- */
DOJO.terminal={
  boot:function(sel){
    out=document.querySelector(sel.out);
    inp=document.querySelector(sel.in);
    form=document.querySelector(sel.form);
    var hi=-1, draft="";
    line('<span class="ok">LINUX UGUIDE — учебный терминал v2.0</span>', null, {instant:true});
    line('Виртуальная файловая система готова. Ты в '+prettyCwd()+' от имени <span class="ok">'+USER+'</span>.', null, {instant:true});
    line('Набери <span class="ok">help</span> — список команд, <span class="ok">mission</span> — уроки, <span class="ok">faq</span> — вопросы про Linux, <span class="ok">distros</span> — дистрибутивы.<br>', null, {instant:true});
    form.addEventListener("submit",function(e){
      e.preventDefault();
      var raw=inp.value; echoCmd(raw); inp.value="";
      var cmd=raw.trim();
      if(cmd){
        DOJO.sfx && DOJO.sfx.submit();
        HIST.push(cmd); hi=HIST.length; DOJO.emitCmd&&DOJO.emitCmd(cmd); run(cmd);
      }
    });
    inp.addEventListener("keydown",function(e){
      if(e.key==="ArrowUp"){ if(hi>0){ if(hi===HIST.length) draft=inp.value; hi--; inp.value=HIST[hi]; } e.preventDefault(); }
      else if(e.key==="ArrowDown"){ if(hi<HIST.length-1){ hi++; inp.value=HIST[hi]; } else { hi=HIST.length; inp.value=draft; } e.preventDefault(); }
      else if(e.key==="Tab"){ e.preventDefault(); complete(); }
      else if(e.ctrlKey && (e.key==="l"||e.key==="L")){ e.preventDefault(); out.innerHTML=""; }
      else if(e.key.length===1){ DOJO.sfx && DOJO.sfx.key(); }
      if(TYPING.active) flushTyping();
    });
    out.parentNode.addEventListener("click",function(){ if(window.getSelection().toString()==="") inp.focus(); });
    setTimeout(function(){ inp.focus({preventScroll:true}); },200);
  },
  runExternal:function(cmd){
    echoCmd(cmd); HIST.push(cmd); DOJO.sfx && DOJO.sfx.submit(); DOJO.emitCmd&&DOJO.emitCmd(cmd); run(cmd); inp&&inp.focus({preventScroll:true});
  },
  cwdName:function(){ return prettyCwd(); }
};

/* ============================================================
   self-destruct: sudo rm -rf /  ->  glitch -> panic -> reboot
   ============================================================ */
DOJO.terminal.destroy = function(withSudo){
  if(window.__uguideBusy) return;
  window.__uguideBusy = true;
  var snapshot = JSON.stringify(FS.children);
  var snapCwd = cwd.slice();
  var R = DOJO.reduced;
  var S = DOJO.sfx;
  if(S) S.init();
  if(inp){ inp.disabled = true; inp.blur(); }

  if(withSudo) line('<span class="pr">[sudo] пароль для '+esc(USER)+':</span> ********', null, {instant:true});
  line('<span class="err">rm: удаление корневого каталога «/» — --no-preserve-root принят. Поехали…</span>', null, {instant:true});

  var victims = ["/bin","/boot","/dev","/etc","/lib","/lib64","/opt","/proc","/root","/sbin","/srv","/sys","/tmp","/usr","/var",
                 "/etc/passwd","/etc/shadow","/boot/vmlinuz-6.9.0-uguide","/usr/bin","/home/tux"];
  var d = 0, stepDelay = R ? 10 : 70;
  victims.forEach(function(v){
    setTimeout(function(){
      line('<span class="err">rm: удаляю '+esc(v)+' …</span>', null, {instant:true});
      if(S) S.glitch();
    }, d);
    d += stepDelay;
  });
  setTimeout(function(){ FS.children = {}; }, d);
  d += R ? 80 : 350;
  setTimeout(glitchPhase, d);

  function glitchPhase(){
    var ov = document.createElement("div");
    ov.className = "destruct-overlay";
    document.body.appendChild(ov);
    document.body.classList.add("no-scroll");

    var canvas = document.createElement("canvas");
    canvas.className = "destruct-canvas";
    ov.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
    resize(); window.addEventListener("resize", resize);

    var words = ["SYSTEM FAILURE","KERNEL PANIC","0xDEADBEEF","SEGMENTATION FAULT","CORE DUMPED",
                 "/ IS GONE","FATAL ERROR","rm -rf /","☠ ☠ ☠","0x00000000","CRITICAL","NO ROOT FS"];
    var running = true, raf = 0;
    function draw(){
      if(!running) return;
      var w = canvas.width, h = canvas.height;
      ctx.fillStyle = "#05060a"; ctx.fillRect(0,0,w,h);
      var i;
      for(i=0;i<26;i++){
        var y = Math.random()*h, hh = Math.random()*22+2;
        ctx.fillStyle = "rgba("+(Math.random()*255|0)+","+(Math.random()*255|0)+","+(Math.random()*255|0)+","+(Math.random()*0.4+0.15)+")";
        ctx.fillRect(Math.random()*w-60, y, w*(Math.random()*0.7+0.3), hh);
      }
      for(i=0;i<50;i++){
        ctx.fillStyle = Math.random()>0.5 ? "#5bc873" : "#e05a4d";
        ctx.fillRect(Math.random()*w, Math.random()*h, Math.random()*32, Math.random()*4);
      }
      var word = words[Math.floor(Math.random()*words.length)];
      ctx.font = "bold " + Math.min(w/8, 84) + "px monospace";
      ctx.textAlign = "center";
      var cx = w/2 + (Math.random()*40-20), cy = h/2 + (Math.random()*40-20);
      ctx.fillStyle = "rgba(224,90,77,.85)"; ctx.fillText(word, cx-7, cy);
      ctx.fillStyle = "rgba(59,176,176,.85)"; ctx.fillText(word, cx+7, cy+3);
      ctx.fillStyle = "rgba(236,224,200,.95)"; ctx.fillText(word, cx, cy);
      raf = requestAnimationFrame(draw);
    }

    if(!R){
      ov.classList.add("shake");
      raf = requestAnimationFrame(draw);
    }else{
      ctx.fillStyle = "#05060a"; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = "#e05a4d"; ctx.font = "bold 40px monospace"; ctx.textAlign="center";
      ctx.fillText("SYSTEM FAILURE", canvas.width/2, canvas.height/2);
    }
    var gi = setInterval(function(){ if(S) S.glitch(); }, R?400:180);
    var ai = setInterval(function(){ if(S) S.alarm(); }, R?1000:750);

    setTimeout(function(){
      running = false; if(raf) cancelAnimationFrame(raf);
      clearInterval(gi); clearInterval(ai);
      ov.classList.remove("shake");
      if(S) S.crash();
      panicPhase(ov, resize);
    }, R ? 700 : 2600);
  }

  function panicPhase(ov, resize){
    var panic = document.createElement("div");
    panic.className = "panic-screen";
    panic.innerHTML =
      "[ 1337.424242] <span class='warn'>Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000009</span>\n"+
      "[ 1337.424243] CPU: 0 PID: 1 Comm: systemd Not tainted 6.9.0-uguide #1\n"+
      "[ 1337.424244] Hardware name: UGuide Pixel Core i8/UG-Board, BIOS 1.0\n"+
      "[ 1337.424245] Call Trace:\n"+
      "[ 1337.424246]  <TASK>\n"+
      "[ 1337.424247]  dump_stack_lvl+0x5c/0x78\n"+
      "[ 1337.424248]  panic+0x118/0x2a2\n"+
      "[ 1337.424249]  do_exit+0xa5b/0xa60\n"+
      "[ 1337.424250]  __x64_sys_exit_group+0x18/0x20\n"+
      "[ 1337.424251]  rm_rf_slash+0xff/0xff <span class='err'>[ты правда это сделал]</span>\n"+
      "[ 1337.424252]  </TASK>\n"+
      "[ 1337.424253] ---[ end Kernel panic - not syncing: Attempted to kill init! ]---\n\n"+
      "        .--.\n"+
      "       |x_x |    всё. корневой файловой системы больше нет.\n"+
      "       |:_/ |\n"+
      "      //   \\ \\\n"+
      "     (|     | )\n";
    ov.innerHTML = "";
    ov.appendChild(panic);
    setTimeout(function(){ powerOff(ov, resize); }, R ? 800 : 2100);
  }

  function powerOff(ov, resize){
    if(S) S.powerdown();
    ov.classList.add("crt-off");
    setTimeout(function(){
      ov.classList.remove("crt-off");
      ov.innerHTML = "";
      ov.style.transform = "none";
      ov.style.opacity = "1";
      ov.style.background = "#000";
      setTimeout(function(){ bootPhase(ov, resize); }, R ? 150 : 600);
    }, R ? 120 : 650);
  }

  function bootPhase(ov, resize){
    var scr = document.createElement("div");
    scr.className = "boot-screen";
    ov.appendChild(scr);
    var lines = [
      "UGuide BIOS v1.0  —  Power-On Self Test",
      "  CPU: Pixel Core i8 @ 3.6GHz  ...  <ok>OK</ok>",
      "  Memory Test: 8192 MB  ...  <ok>OK</ok>",
      "  Detecting drives: /dev/sda  ...  <ok>OK</ok>",
      "",
      "GRUB loading stage2 ...",
      "  <ok>*</ok> UGuide Linux 6.9.0-uguide",
      "     UGuide Linux 6.9.0-uguide (recovery mode)",
      "",
      "Booting UGuide Linux 6.9.0-uguide ...",
      "[    0.000000] Linux version 6.9.0-uguide",
      "[    1.204100] Freeing unused kernel image memory",
      "[  <ok>OK</ok>  ] Reached target Basic System.",
      "[  <ok>OK</ok>  ] Started Journal Service.",
      "[  <ok>OK</ok>  ] Mounted /home.",
      "[  <ok>OK</ok>  ] Started Network Manager.",
      "[  <ok>OK</ok>  ] <warn>Restoring filesystem from backup…</warn>",
      "[  <ok>OK</ok>  ] Reached target Graphical Interface.",
      "",
      "UGuide Linux 1.0  tty1",
      "uguide login: tux (автоматический вход)"
    ];
    var i = 0;
    if(S) S.bootbeep();
    function next(){
      if(i >= lines.length){ setTimeout(finish, R ? 250 : 700); return; }
      var raw = lines[i++];
      var html = raw.replace(/<ok>/g,'<span class="ok">').replace(/<\/ok>/g,'</span>')
                    .replace(/<warn>/g,'<span class="warn">').replace(/<\/warn>/g,'</span>');
      scr.innerHTML += html + "\n";
      if(raw.trim() && S) S.bootbeep();
      var wait = R ? 30 : (raw.indexOf("OK")>-1 ? 150 : 240);
      setTimeout(next, wait);
    }
    setTimeout(next, R ? 80 : 450);

    function finish(){
      window.removeEventListener("resize", resize);
      ov.remove();
      document.body.classList.remove("no-scroll");
      FS.children = JSON.parse(snapshot);
      cwd = snapCwd.slice();
      out.innerHTML = "";
      line('<span class="ok">UGuide Linux 1.0 — система перезагружена.</span>', null, {instant:true});
      line('Файловая система восстановлена из резервной копии. Обошлось!', null, {instant:true});
      line('<span class="err">Мораль:</span> `sudo rm -rf /` в реальной системе стирает вообще всё и без бэкапа не откатывается. Никогда не запускай это на настоящей машине.', null, {instant:true});
      line('Набери <span class="ok">help</span>, чтобы продолжить.<br>', null, {instant:true});
      if(inp){ inp.disabled = false; inp.focus({preventScroll:true}); }
      window.__uguideBusy = false;
    }
  }
};

/* tab completion for command names + aliases + files in cwd */
function complete(){
  var v=inp.value, parts=v.split(" ");
  var frag=parts[parts.length-1];
  var pool;
  if(parts.length===1){ pool=Object.keys(CMD).concat(Object.keys(ALIASES)); }
  else{
    var node=nodeAt(cwd); pool=node?Object.keys(node.children):[];
  }
  var hits=pool.filter(function(k){ return k.indexOf(frag)===0; });
  if(hits.length===1){ parts[parts.length-1]=hits[0]; inp.value=parts.join(" "); }
  else if(hits.length>1){
    var common=hits.reduce(function(acc,s){ var j=0; while(j<acc.length&&acc[j]===s[j]) j++; return acc.slice(0,j); });
    parts[parts.length-1]=common; inp.value=parts.join(" ");
    echoCmd(v); line(hits.join("&nbsp;&nbsp;"), null, {instant:true});
  }
}
})();
