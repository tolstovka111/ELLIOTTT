/* ============================================================
   LINUX DOJO — interactive terminal engine
   A tiny in-memory UNIX-ish shell for teaching real commands.
   Supports: a live virtual filesystem, pipes (|), redirects
   (> >>), command history, tab-completion, and ~40 commands.
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
    "welcome.txt": file("Привет! Ты в учебном терминале LINUX DOJO.\nНабери `help`, чтобы увидеть список команд.\nНабери `mission` — начнём пошаговые уроки.\n"),
    "notes.txt":   file("todo:\n- выучить навигацию (cd, ls, pwd)\n- разобраться с правами (chmod)\n- освоить пакетный менеджер\n"),
    projects: dir({
      "hello.sh": file("#!/bin/bash\necho \"Hello, Linux!\"\n"),
      website:    dir({ "index.html": file("<h1>my first site</h1>\n") })
    }),
    ".bashrc": file("export PS1='\\u@dojo:\\w$ '\nalias ll='ls -la'\n")
  })}),
  etc: dir({ "os-release": file("NAME=\"Dojo Linux\"\nVERSION=\"1.0 (Penguin)\"\n"), hostname: file("dojo\n") }),
  var: dir({ log: dir({ "syslog": file("system booted OK\n") }) }),
  bin: dir({}), usr: dir({ bin: dir({}) }), tmp: dir({})
});

var cwd = ["home","tux"];         // current path as array
var USER = "tux", HOST = "dojo";

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

/* ---------------- output ---------------- */
var out, inp, form;
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function line(html, cls){
  var d=document.createElement("div");
  d.className="tl"+(cls?" "+cls:"");
  d.innerHTML=html;
  out.appendChild(d);
  out.scrollTop=out.scrollHeight;
  return d;
}
function echoCmd(raw){
  line('<span class="pr">'+esc(USER)+'@'+esc(HOST)+':'+esc(prettyCwd())+'$</span> '+esc(raw));
}
function print(text, cls){
  // multiline plain text -> preserve
  line(esc(text).replace(/\n/g,"<br>"), cls);
}

/* ---------------- command table ---------------- */
var HIST=[];
var CMD={};

function ok(s){ return {out:s, cls:"ok"}; }
function err(s){ return {out:s, cls:"err"}; }

CMD.help=function(){
  return "Доступные команды — набери `man <команда>` для подробностей:\n\n"+
"  НАВИГАЦИЯ   pwd  ls  cd  tree  find\n"+
"  ФАЙЛЫ       cat  touch  mkdir  rm  rmdir  cp  mv  echo  head  tail  wc\n"+
"  СИСТЕМА     whoami  id  uname  hostname  date  uptime  free  df  du  ps  top\n"+
"  ПРАВА       chmod  sudo\n"+
"  ПОИСК       grep  which  history\n"+
"  ПАКЕТЫ      apt  pacman  dnf   (пакетные менеджеры разных дистрибутивов)\n"+
"  СЕТЬ        ping  curl\n"+
"  ВЕСЕЛЬЕ     neofetch  cowsay  matrix  play\n"+
"  УРОКИ       mission        (пошаговое обучение)\n"+
"  ДИСТРИБУТИВЫ distros       (перейти на страницу дистрибутивов)\n"+
"  ПРОЧЕЕ      clear  help  man\n\n"+
"Совет: используй Tab для автодополнения, ↑/↓ — история команд.\n"+
"Приёмы: `|` конвейер, `>` запись в файл, `>>` дозапись.  Пример: ls -la | grep txt";
};
CMD.pwd=function(){ return pathStr(cwd)==="" ? "/" : pathStr(cwd); };
CMD.whoami=function(){ return USER; };
CMD.id=function(){ return "uid=1000("+USER+") gid=1000("+USER+") groups=1000("+USER+"),27(sudo)"; };
CMD.hostname=function(){ return HOST; };
CMD.date=function(){ return new Date().toString(); };
CMD.uptime=function(){ return " "+new Date().toLocaleTimeString()+" up 3:14, 1 user, load average: 0.08, 0.03, 0.01"; };
CMD.uname=function(a){
  if(a.indexOf("-a")>-1||a.indexOf("--all")>-1)
    return "Linux dojo 6.9.0-dojo #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux";
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
CMD.df=function(a){
  return "Filesystem      Size  Used Avail Use% Mounted on\n"+
         "/dev/sda2        98G   23G   70G  25% /\n"+
         "tmpfs           3.9G     0  3.9G   0% /dev/shm\n"+
         "/dev/sda1       511M  6.1M  505M   2% /boot/efi";
};
CMD.du=function(){ return "8.0K\t./projects/website\n16K\t./projects\n28K\t."; };
CMD.ps=function(){
  return "    PID TTY          TIME CMD\n"+
         "   1024 pts/0    00:00:00 bash\n"+
         "   2048 pts/0    00:00:01 node\n"+
         "   4096 pts/0    00:00:00 ps";
};
CMD.top=function(){
  return "top - "+new Date().toLocaleTimeString()+" up 3:14,  1 user,  load average: 0.08\n"+
         "Tasks: 142 total,   1 running, 141 sleeping\n"+
         "%Cpu(s):  3.1 us,  1.2 sy,  0.0 ni, 95.4 id\n"+
         "MiB Mem :   7850.1 total,   3993.4 free,   2150.5 used\n\n"+
         "  PID USER   %CPU %MEM COMMAND\n"+
         " 2048 tux     4.0  2.1 node\n"+
         " 1337 tux     1.5  0.9 firefox\n"+
         " 1024 tux     0.3  0.2 bash\n\n"+
         "(в настоящем top нажми `q` чтобы выйти)";
};
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
      return {html: perm+"  "+USER+"  "+USER+"  "+String(size).padStart(5)+"  "+
              '<span class="'+col+'">'+esc(k)+(d&&!isDot?"/":"")+"</span>"};
    });
    return {html: rows.map(function(r){return r.html;}).join("<br>")};
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
  var dstP=resolve(t[1]), dstNode=nodeAt(dstP), name;
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
CMD.head=function(a){ return firstLast(a,true); };
CMD.tail=function(a){ return firstLast(a,false); };
function firstLast(a,head){
  var t=a.filter(function(x){return x.charAt(0)!=="-";});
  var nArg=a.find(function(x){return /^-n?\d+$/.test(x)||/^-n$/.test(x);});
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
      var disp=start+pathStr(path).slice(pathStr(base).length);
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
  return matched.map(function(l){ return l.replace(re,function(m){return "\u0001"+m+"\u0002";}); }).join("\n");
};
CMD.which=function(a){
  var known={ls:"/bin/ls",cat:"/bin/cat",bash:"/bin/bash",node:"/usr/bin/node",python3:"/usr/bin/python3",git:"/usr/bin/git"};
  return known[a[0]]||(a[0]?a[0]+" not found":"which: не указана команда");
};
CMD.history=function(){ return HIST.map(function(c,i){return String(i+1).padStart(4)+"  "+c;}).join("\n"); };
CMD.chmod=function(a){
  var mode=a[0], f=a[1];
  if(!mode||!f) return err("chmod: пропущен операнд.  Пример: chmod +x hello.sh  или  chmod 755 file");
  var n=nodeAt(resolve(f));
  if(!n) return err("chmod: доступ к '"+f+"' невозможен: Нет такого файла");
  return "chmod: права '"+f+"' изменены на "+mode+"  (в учебной ФС это демонстрация)";
};
CMD.sudo=function(a){
  if(!a.length) return err("usage: sudo <команда>");
  if(a[0]==="rm") return err("[sudo] пароль для tux: ********\ntux не в списке sudoers. Этот инцидент будет зарегистрирован. (шутка!)");
  return "[sudo] пароль для tux: ********\n"+run(a.join(" "), true);
};
CMD.apt=function(a){ return pkg("apt","Debian / Ubuntu / Mint",a); };
CMD.pacman=function(a){ return pkg("pacman","Arch / Manjaro",a); };
CMD.dnf=function(a){ return pkg("dnf","Fedora / RHEL",a); };
function pkg(mgr,fam,a){
  var sub=a[0]||"";
  var pkgName=a.filter(function(x){return x[0]!=="-";})[1]||"htop";
  var install = mgr==="pacman" ? "-S" : "install";
  if(sub==="install"||sub==="-S"||sub==="-Syu"||sub==="update"||sub==="-Sy"||sub==="upgrade"){
    return "» "+mgr+" для семейства: "+fam+"\n"+
           "Чтение списков пакетов... Готово\n"+
           "Разрешение зависимостей... Готово\n"+
           "Установка "+pkgName+" (1 пакет, 2.4 MB)...\n"+
           "[####################] 100%\n"+
           pkgName+" успешно установлен ✔\n\n"+
           "Шпаргалка:\n"+
           "  Debian/Ubuntu/Mint : sudo apt "+install.replace("-S","install")+" "+pkgName+"\n"+
           "  Arch/Manjaro       : sudo pacman -S "+pkgName+"\n"+
           "  Fedora             : sudo dnf install "+pkgName;
  }
  if(sub==="remove"||sub==="-R") return "Удаление "+pkgName+"...\n"+pkgName+" удалён ✔";
  if(sub==="search"||sub==="-Ss") return pkgName+"  — описание пакета (учебная заглушка)";
  return "Использование: "+mgr+" <install|remove|search|update> <пакет>\n"+
         mgr+" — пакетный менеджер для "+fam+".";
}
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
    chmod2:"",
    man:"man — руководство по команде.  man ls"
  };
  var t=a[0];
  if(!t) return "Что за man? Укажи команду, напр.: man ls";
  return m[t]||(CMD[t]? "Справка по `"+t+"`: базовая учебная команда. Просто попробуй её запустить!" : "Нет справки по '"+t+"'.");
};
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
    '<b class="ok">OS</b>: Dojo Linux 1.0 x86_64',
    '<b class="ok">Kernel</b>: 6.9.0-dojo',
    '<b class="ok">Shell</b>: dojo-sh 1.0',
    '<b class="ok">DE</b>: browser',
    '<b class="ok">Terminal</b>: LINUX DOJO',
    '<b class="ok">CPU</b>: Pixel Core i8 (8) @ 3.6GHz',
    '<b class="ok">Memory</b>: 2150MiB / 7850MiB',
    '<span class="sw">████████</span>'
  ];
  var rows=[]; var max=Math.max(tux.length,info.length);
  for(var i=0;i<max;i++){
    rows.push((tux[i]||"                ")+"   "+(info[i]||""));
  }
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
CMD.matrix=function(){ if(DOJO.terminal&&DOJO.terminal.matrix) DOJO.terminal.matrix(); return {out:"Входим в матрицу... (клик по экрану, чтобы выйти)",cls:"ok"}; };
CMD.play=function(a){
  if(!DOJO.player) return err("плеер не готов");
  if(a[0]==="next"){ DOJO.player.next(); return "▶ следующий трек"; }
  if(a[0]==="prev"){ DOJO.player.prev(); return "▶ предыдущий трек"; }
  DOJO.player.play(); return "♪ играет чиптюн. Управление — в плеере справа снизу.";
};
CMD.distros=function(){
  print("Загружаю энциклопедию дистрибутивов...", "ok");
  setTimeout(function(){ DOJO.go("distros.html"); }, 500);
  return null;
};
CMD.mission=function(){ if(DOJO.missions) DOJO.missions.open(); return {out:"Открываю панель уроков слева. Выполняй шаги — они отмечаются автоматически.",cls:"ok"}; };
CMD.exit=function(){ return {out:"Выйти из браузерного терминала нельзя ;) Но ты молодец. Набери `help`.",cls:"ok"}; };
// aliases
CMD.ll=function(a){ return CMD.ls(["-la"].concat(a)); };
CMD.la=function(a){ return CMD.ls(["-a"].concat(a)); };
CMD.clr=CMD.clear;

/* ---------------- parser + executor ---------------- */
function tokenize(str){
  var m=str.match(/"[^"]*"|'[^']*'|\S+/g);
  return m||[];
}
function execOne(name,args,stdin,silentUnknown){
  if(!CMD[name]){
    return silentUnknown? "" : err("bash: "+name+": команда не найдена. Набери `help`.");
  }
  var r=CMD[name](args, stdin);
  return r;
}
function normalize(r){
  if(r===null) return {out:null,cls:null,html:null};
  if(typeof r==="string") return {out:r,cls:null,html:null};
  if(r&&r.html!==undefined) return {out:null,cls:r.cls||null,html:r.html};
  return {out:r.out,cls:r.cls||null,html:null};
}

function run(raw, fromSudo){
  // handle redirects first (only simple `cmd > file` / `>>`)
  var redirect=null, redirFile=null;
  var rm=raw.match(/(.*?)\s(>>|>)\s*(\S+)\s*$/);
  var work=raw;
  if(rm){ work=rm[1]; redirect=rm[2]; redirFile=rm[3]; }

  // pipes
  var stages=work.split("|").map(function(s){return s.trim();}).filter(Boolean);
  var stdin=null, final=null;
  for(var s=0;s<stages.length;s++){
    var toks=tokenize(stages[s]);
    var name=toks[0]; var args=toks.slice(1);
    if(name===undefined) continue;
    var res=normalize(execOne(name,args,stdin, false));
    // convert to a plain-text stdin for the next stage
    var asText = res.html!=null ? res.html.replace(/<[^>]+>/g,"").replace(/&nbsp;/g,"  ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&") : (res.out||"");
    stdin = asText;
    final = res;
  }
  if(final===null) return "";

  // redirect to file
  if(redirect && final){
    var text = final.html!=null ? final.html.replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ") : (final.out||"");
    var path=resolve(redirFile), pn=parentOf(path), existing=nodeAt(path);
    if(pn.parent&&pn.parent.type==="dir"){
      if(existing&&existing.type==="file"){ existing.content = redirect===">>" ? existing.content+text+"\n" : text+"\n"; }
      else pn.parent.children[pn.name]=file(text+"\n");
    }
    return fromSudo? "" : (function(){ return ""; })();
  }
  if(fromSudo){ // return text for sudo wrapper
    return final.html!=null ? final.html.replace(/<[^>]+>/g,"") : (final.out||"");
  }
  // print
  if(final.html!=null) line(final.html, final.cls);
  else if(final.out!=null){
    // grep highlight markers -> spans
    var h=esc(final.out).replace(/\u0001/g,'<span class="hl">').replace(/\u0002/g,'</span>').replace(/\n/g,"<br>");
    line(h, final.cls);
  }
  return "";
}

/* ---------------- public interface + input ---------------- */
DOJO.terminal={
  boot:function(sel){
    out=document.querySelector(sel.out);
    inp=document.querySelector(sel.in);
    form=document.querySelector(sel.form);
    var hi=-1, draft="";
    // banner
    line('<span class="ok">LINUX DOJO — учебный терминал v1.0</span>');
    line('Виртуальная файловая система готова. Ты в '+prettyCwd()+' от имени <span class="ok">'+USER+'</span>.');
    line('Набери <span class="ok">help</span> — список команд, <span class="ok">mission</span> — уроки, <span class="ok">distros</span> — дистрибутивы.<br>');
    form.addEventListener("submit",function(e){
      e.preventDefault();
      var raw=inp.value; echoCmd(raw); inp.value="";
      var cmd=raw.trim();
      if(cmd){ HIST.push(cmd); hi=HIST.length; DOJO.emitCmd&&DOJO.emitCmd(cmd); run(cmd); }
    });
    inp.addEventListener("keydown",function(e){
      if(e.key==="ArrowUp"){ if(hi>0){ if(hi===HIST.length) draft=inp.value; hi--; inp.value=HIST[hi]; } e.preventDefault(); }
      else if(e.key==="ArrowDown"){ if(hi<HIST.length-1){ hi++; inp.value=HIST[hi]; } else { hi=HIST.length; inp.value=draft; } e.preventDefault(); }
      else if(e.key==="Tab"){ e.preventDefault(); complete(); }
      else if(e.ctrlKey && (e.key==="l"||e.key==="L")){ e.preventDefault(); out.innerHTML=""; }
    });
    // click-to-focus
    out.parentNode.addEventListener("click",function(){ if(window.getSelection().toString()==="") inp.focus(); });
    // focus on load (without yanking the page down to the terminal)
    setTimeout(function(){ inp.focus({preventScroll:true}); },200);
  },
  runExternal:function(cmd){
    echoCmd(cmd); HIST.push(cmd); DOJO.emitCmd&&DOJO.emitCmd(cmd); run(cmd); inp&&inp.focus({preventScroll:true});
  },
  cwdName:function(){ return prettyCwd(); }
};

/* tab completion for command names + files in cwd */
function complete(){
  var v=inp.value, parts=v.split(" ");
  var frag=parts[parts.length-1];
  var pool;
  if(parts.length===1){ pool=Object.keys(CMD); }
  else{
    var node=nodeAt(cwd); pool=node?Object.keys(node.children):[];
  }
  var hits=pool.filter(function(k){ return k.indexOf(frag)===0; });
  if(hits.length===1){ parts[parts.length-1]=hits[0]; inp.value=parts.join(" "); }
  else if(hits.length>1){
    var common=hits.reduce(function(acc,s){ var j=0; while(j<acc.length&&acc[j]===s[j]) j++; return acc.slice(0,j); });
    parts[parts.length-1]=common; inp.value=parts.join(" ");
    echoCmd(v); line(hits.join("&nbsp;&nbsp;"));
  }
}
})();
