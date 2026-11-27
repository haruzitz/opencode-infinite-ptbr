const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { SourceTextModule } = require("node:vm");

const [sourcePath, targetPath, mode] = process.argv.slice(2);
if (!sourcePath || !targetPath || path.resolve(sourcePath) === path.resolve(targetPath)) {
  throw new Error("Informe os caminhos de origem e destino do ASAR.");
}

const source = fs.readFileSync(sourcePath);
const dataOffset = 8 + source.readUInt32LE(4);
const entries = JSON.parse(source.subarray(16, 16 + source.readUInt32LE(12)).toString("utf8"));
const targets = new Map([
  ["out/main/index.js", content => {
    content = replaceOnce(content, "P&&g.setPath(`documents`,T.join(r,`documents`))", "portableDocuments(r)");
    content = replaceOnce(content, "process.env.XDG_STATE_HOME=T.join(e,`state`)", "process.env.XDG_STATE_HOME=T.join(e,`home`,`.local`,`state`)");
    return 'import { execFile as portableGitExec } from "node:child_process";\n'
      + 'import portableGitPath from "node:path";\n'
      + 'import { ipcMain as portableGithubIpc } from "electron";\n'
      + readPatch("desktop-github-main.js") + "\n" + packSkills() + "\n" + readPatch("desktop-catalog-main.js") + "\n" + readPatch("desktop-warp-install.js") + "\nportableGithubRegister();\n" + readPatch("desktop-library-main.js") + "\n" + readPatch("desktop-update-main.js") + "\n" + readPatch("desktop-voice-main.js") + "\n" + readPatch("desktop-voicestudio-main.js") + "\n" + readPatch("desktop-voicestudio-install.js") + "\n" + readPatch("desktop-live-main.js") + "\n" + content
      + '\nfunction portableDocuments(root){if(!P){try{if(ae(g.getPath("documents")))return}catch(error){console.warn("[portable-documents]",error)}}g.setPath("documents",T.join(root,"documents"))}\n';
  }],
  ["out/preload/index.cjs", content => {
    return patchCatalogPreload(patchLibraryPreload(replaceOnce(content, "getPathForFile:t=>e.webUtils.getPathForFile(t)",
      'portableGithub:{openWeb:(repo,signIn,systemBrowser)=>e.ipcRenderer.invoke("portable:github-web",repo,signIn,systemBrowser),status:directory=>e.ipcRenderer.invoke("portable:github-status",directory),login:()=>e.ipcRenderer.invoke("portable:github-login"),cancelLogin:()=>e.ipcRenderer.invoke("portable:github-cancel-login"),configureReader:()=>e.ipcRenderer.invoke("portable:github-reader")},getPathForFile:t=>e.webUtils.getPathForFile(t)')));
  }],
  ["out/main/desktop-Bu-SLvc7.js", content => {
    content = replaceOnce(content, "t?.XDG_STATE_HOME||delete process.env.XDG_STATE_HOME", "t?.XDG_STATE_HOME||process.env.OPENCODE_DESKTOP_TEST_ROOT||delete process.env.XDG_STATE_HOME");
    content = replaceOnce(content, "auto:e.auto===!0,country:", "auto:!1,warpPort:portableNetworkPort(e.warpPort)?e.warpPort:void 0,country:");
    content = replaceOnce(content, 'if(e===`WARP`)return Sv;if(e===`TOR`)',
      'if(e===`WARP`)return `http://127.0.0.1:${$().warpPort??xv}`;if(e===`TOR`)');
    content = replaceOnce(content, 'c=e=>s(w(function*(){return yield*i,yield*N(()=>zv(e)),yield*o(()=>_y(e))}))',
      'c=e=>s(w(function*(){const target=yield*N(()=>portablePrepareNetworkMode(e,e===`PROXY`?Mv($().custom??``):void 0));if(target&&!target.ok)return{ok:!1,message:target.message};yield*i;if(target){yield*N(()=>{if(e===`WARP`)$().warpPort=target.port;else $().proxy=target.proxy;return zv(e)});yield*a;return{ok:!0,message:target.message}}yield*N(()=>zv(e));return yield*o(()=>_y(e))}))');
    content = replaceOnce(content, 'InfiniteCheckIp:()=>A(by)', 'InfiniteCheckIp:()=>A(()=>portableSelectedProxyStatus(Rv()))');
    content = replaceOnce(content, "InfiniteResetLimit:l,InfiniteRestoreSession:u,InfiniteAutoRotate:({sessionID:e})=>E(()=>f(`limit reached`,e))",
      "InfiniteResetLimit:()=>E(()=>({ok:!1,message:`Confira os limites de uso informados pelo provedor.`})),InfiniteRestoreSession:u,InfiniteAutoRotate:()=>E(()=>void 0)");
    content = replaceOnce(content, "InfiniteSetOptions:e=>A(()=>Iv(e).then(jv))", "InfiniteSetOptions:e=>A(()=>Iv({...e,auto:!1}).then(jv))");
    content = replaceOnce(content, "d=yield*Lh(u),f=(e,t)=>{let r=t.filter(e=>e.startsWith(`opencode://`));",
      "d=yield*Lh(u),f=(e,t)=>{const local=portableProjectLinks(t);if(local.length)d.receive(local);let r=t.filter(e=>e.startsWith(`opencode://`));");
    content = replaceOnce(content, "return I.on(`second-instance`,f),I.on(`open-url`,p)",
      "return d.receive(portableProjectLinks(process.argv)),I.on(`second-instance`,f),I.on(`open-url`,p)");
    return 'import { statSync as portableProjectStat } from "node:fs";\n'
      + 'import { isAbsolute as portableProjectIsAbsolute } from "node:path";\n'
      + readPatch("desktop-project-main.js") + "\n" + readPatch("desktop-network.js") + "\n" + content;
  }],
  ["out/renderer/assets/main-DtumKGhc.js", content => {
    content = patchUsageLimits(content);
    content = replaceOnce(content,
      "editText(e,t,n){O.editAssistant(e,t,e=>{let t=e.content.findLast(e=>e.type===`text`);t&&n(t)})}",
      "editText(e,t,n,done){O.editAssistant(e,t,message=>{const index=message.content.findLastIndex(part=>part.type===`text`);if(index<0)return;const part=message.content[index];n(part);const notify=window.portableVoiceText;if(!notify)return;const turn=o.session.message[e]?.slice(0,ae(e).get(t)).findLast(item=>item.type===`user`)?.id;if(turn){const text=part.text;queueMicrotask(()=>notify(e,turn,t,index,text,done))}})}");
    content = replaceOnce(content,
      "case`session.text.ended`:O.editText(n.data.sessionID,n.data.assistantMessageID,e=>{e.text=n.data.text});",
      "case`session.text.ended`:O.editText(n.data.sessionID,n.data.assistantMessageID,e=>{e.text=n.data.text},true);");
    content = replaceOnce(content, "tabLayout:`horizontal`", "tabLayout:`vertical`");
    content = replaceOnce(content, "sidebarOrganize:`list`", "sidebarOrganize:`projects`");
    content = replaceOnce(content, "function Eyn(e){let t=xi(),n=PX(),r=VK(),i=dJ(),a=AB(),o=Pr(),s=fq(),c=NB(),l=WW(),u=Mn(",
      readPatch("desktop-project-renderer.js") + "\n"
      + "function Eyn(e){let t=xi(),n=PX(),r=VK(),i=dJ(),a=AB(),o=Pr(),s=fq(),c=NB(),l=WW(),portableProjectHandler=portableProjectInstall(s,c,l),u=Mn(");
    content = replaceOnce(content, "function _an(){let e=Mn(`(max-width: 767px)`),t=k5t(),n=P7t(t),",
      "const portableHomeCategoryStyles=" + JSON.stringify(readPatch("desktop-home-categories.css")) + ";\n"
      + readPatch("desktop-custom-cards.js") + "\n"
      + readPatch("desktop-library.js") + "\n"
      + readPatch("desktop-home-categories.js") + "\n"
      + "function _an(){let e=Mn(`(max-width: 767px)`),t=k5t(),portableCategories=portableHomeCategoryPanel(t,WW(),xi(),Pr()),n=P7t(t),");
    content = replaceOnce(content, "get children(){var t=han();return V(t,I(R,{get when(){return!e()},get children(){return I(xnn,{projects:n,scroll:a})}}),null),V(t,I(pan,{sessions:r,search:i,scroll:a}),null),t}}),o)",
      "get children(){var t=han(),tools=document.createElement('aside');return tools.append(portableHomeTools(Pr())),V(tools,I(R,{get when(){return!e()},get children(){return I(xnn,{projects:n,scroll:a})}}),null),V(t,tools,null),V(t,I(pan,{sessions:r,search:i,scroll:a}),null),[portableCategories,t]}}),o)");
    content = replaceOnce(content, "function nvn(e){let t=xi(),n=dJ(),r=AB(),i=VK(),",
      "const portableGithubStyles=" + JSON.stringify(readPatch("desktop-github.css")) + ";\n"
      + readPatch("desktop-github-renderer.js") + "\nfunction nvn(e){let t=xi(),n=dJ(),r=AB(),i=VK(),");
    content = patchLibraryHost(patchSidebar(content));
    return replaceOnce(content, "V(a,I(R,{get when(){return!e.verticalTabs},get children(){var e=M_n();return V(e,I(u_n,{items:C})),e}}),null),j(t=>",
      "V(a,portableGithubInstall(d,_,v,T,E,NB(),Pr()),null),V(a,I(R,{get when(){return!e.verticalTabs},get children(){var e=M_n();return V(e,I(u_n,{items:C})),e}}),null),j(t=>");
  }],
  ["out/renderer/assets/route-BgcWNkHn.js", content => {
    const wordmark = "j(h,P(da,{ref:u,state:s,onEvent:d,play:!0,get sound(){return a.sounds.interfaceEnabled}}),g)";
    const credit = 'j(h,b(`<p data-portable-credit style="text-align:center;margin:8px 0 -10px;font-size:13px;font-weight:500;color:var(--v2-text-text-faint)">Personalização por Haruzitz</p>`)(),g)';
    return replaceOnce(content, wordmark, wordmark + "," + credit);
  }],
  ["out/renderer/assets/br-BXn-8ckh.js", content => {
    const extra = '"command.sidebar.toggle":`Alternar barra lateral`,' +
      '"command.sidebar.toggle.unread":`Alternar barra lateral, sessões não lidas`,' +
      '"command.session.search":`Buscar sessões`,' +
      '"command.session.previous":`Sessão anterior`,' +
      '"command.session.next":`Próxima sessão`,' +
      '"command.session.previous.unseen":`Sessão anterior não lida`,' +
      '"command.commands.search":`Buscar comandos`,' +
      '"sidebar.organize.projects":`Projetos`,' +
      '"sidebar.organize.openTab":`Abrir aba`,' +
      '"sidebar.organize.showMore":`Mostrar mais`,' +
      '"sidebar.organize.showLess":`Mostrar menos`,' +
      '"sidebar.organize.empty":`Nenhuma sessão ainda`,' +
      '"settings.experimental.row.sidebarOrganize.title":`Organizar barra lateral vertical`,' +
      '"settings.experimental.row.sidebarOrganize.description":`Agrupe as abas laterais por projeto ou mostre uma lista única. Aplica-se apenas às abas laterais.`,' +
      '"settings.experimental.sidebarOrganize.projects":`Projetos`,' +
      '"settings.experimental.sidebarOrganize.list":`Lista única`,';
    return replaceOnce(content, "var e={", "var e={" + extra);
  }],
]);

function patchSidebar(content) {
  content = replaceOnce(content, "function Eyn(e){let t=xi(),n=PX(),r=VK(),",
    packCatalogLogos() + "\n" + readPatch("desktop-voice-settings.js") + "\n" + readPatch("desktop-addons.js") + "\n" + readPatch("desktop-catalog-renderer.js") + "\n" + readPatch("desktop-plugins.js") + "\n" + readPatch("desktop-sidebar.js") + "\nfunction Eyn(e){let t=xi(),n=PX(),r=VK(),portableSidebarReady=portableSidebarPreferences(r),");
  content = replaceOnce(content, "get keybind(){return n.keybindParts(`tab.new`)}}),null),e})(),U_n()",
    "get keybind(){return n.keybindParts(`tab.new`)}}),null),V(e,portableSidebarNavigation(Pr(),t),null),e})(),U_n()");
  content = replaceOnce(content, "f=()=>o.showAll?d():d().slice(0,7);",
    "f=()=>o.showAll?d():d().slice(0,7).concat(d().slice(7).filter(portableCurrentProject));");
  content = replaceOnce(content, "h=N(()=>Map.groupBy(m(),e=>Rz(e.project.worktree)));return",
    "h=N(()=>Map.groupBy(m(),e=>Rz(e.project.worktree))),portableCurrentProject=project=>{const tab=e.currentTab;if(!tab||tab.server!==u())return false;const sessions=h().get(Rz(project.worktree));return tab.type===`session`&&!!sessions?.some(item=>item.session.id===tab.sessionId)};return");
  content = replaceOnce(content, "get expanded(){return!!e.state.expanded[l()]},onToggle:()=>{e.state.expanded[l()]&&s(`sessionLimits`,l(),5),e.onExpand(l())}",
    "get expanded(){return e.state.expanded[l()]??portableCurrentProject(r())},onToggle:()=>{portableDismissToolPage();const expanded=e.state.expanded[l()]??portableCurrentProject(r());if(expanded)s(`sessionLimits`,l(),5);e.onExpand(l(),!expanded)}");
  content = replaceOnce(content, "onExpand:e=>u(`expanded`,e,e=>!e)",
    "onExpand:(e,expanded)=>u(`expanded`,e,expanded)");
  content = replaceOnce(content, "var t=Dhn();return V(t,()=>e.children),t",
    "var t=Dhn();return Object.assign(t.style,{marginInlineStart:\"16px\",paddingInlineStart:\"8px\",borderInlineStart:\"1px solid var(--v2-border-border-muted)\"}),V(t,()=>e.children),t");
  return replaceOnce(content, "V(u,I(rG,{get icon(){return I(SV,{name:`edit`})},variant:`ghost-muted`,size:`small`,get\"aria-label\"(){return t.t(`command.session.new`)},onClick:()=>e.actions.openNewSession(e.server,e.project.worktree)}),null)",
    "o.insertBefore(portableProjectNewChat(()=>e.actions,()=>e.server,()=>e.project),u)");

}

function patchUsageLimits(content) {
  content = replaceOnce(content, 'aria-label=Connection></div>', 'aria-label=Conexão></div>');
  content = replaceOnce(content,
    '>Reset limit</button><label class="flex items-center gap-1.5"title="Rotates the IP when a limit error shows up or the connection drops. Keeps your session."><input type=checkbox>Auto-rotate</label>',
    '>Resetar limite local</button><button type=button class="px-2.5 py-1 rounded-md text-v2-text-text-base bg-v2-background-bg-layer-02 hover:bg-v2-overlay-simple-overlay-hover">Limites de uso</button>');
  content = replaceOnce(content, '>Settings</button><span class="ms-auto flex items-center gap-1.5 min-w-0"',
    '>Configurações</button><span class="ms-auto flex items-center gap-1.5 min-w-0"');
  content = replaceOnce(content, '{id:`NONE`,label:`None`}', '{id:`NONE`,label:`Nenhum`}');
  content = replaceOnce(content, 'n?.getOptions().then(e=>eyn(e.auto)),', '');
  content = replaceOnce(content, 't.$$click=()=>{i(e.id),u(`Switching to ${e.label}…`,()=>n.setMode(e.id))}',
    't.$$click=()=>void u(`Verificando ${e.label}…`,async()=>{const result=await n.setMode(e.id);i(await n.getMode());return result})');
  content = replaceOnce(content, 'let l=e=>{eyn(e),n?.getOptions().then(t=>n.setOptions({...t,auto:e}))},u=async(e,t)=>', 'let u=async(e,t)=>');
  content = replaceOnce(content, 'd=c.nextSibling,f=d.firstChild,p=d.nextSibling,m=p.nextSibling.firstChild',
    'd=c.nextSibling,p=d.nextSibling,m=p.nextSibling.firstChild');
  content = replaceOnce(content, 'c.$$click=()=>void u(`Resetting limit…`,()=>n.resetLimit()),f.addEventListener(`change`,e=>l(e.currentTarget.checked)),',
    'c.$$click=()=>portableResetLocalLimit(t),d.$$click=()=>portableShowUsageLimits(t),');
  content = replaceOnce(content, ',j(()=>f.checked=$vn()),e}})}', ',e}})}');
  return readPatch("desktop-usage-limits.js") + "\n" + content;
}

if (mode === "--sidebar-only") {
  targets.clear();
  targets.set("out/renderer/assets/main-DtumKGhc.js", content => {
    const start = content.indexOf("// Itens extras da barra lateral:");
    const end = content.indexOf("function Eyn(e)", start);
    if (start < 0 || end < 0) throw new Error("Personalização anterior da barra lateral não encontrada.");
    content = content.slice(0, start) + content.slice(end);
    content = replaceOnce(content, "portableSidebarCleanup=portableSidebarTools(o),portableUpdaterRun=portableUpdater(t),", "");
    return patchSidebar(content);
  });
}

function patchLibraryPreload(content) {
  return replaceOnce(content, "getPathForFile:t=>e.webUtils.getPathForFile(t)",
    'portableVoice:{studioEnsure:port=>e.ipcRenderer.invoke("portable:voicestudio-ensure",port),studioStatus:()=>e.ipcRenderer.invoke("portable:voicestudio-status"),studioOpen:()=>e.ipcRenderer.invoke("portable:voicestudio-open"),studioInstall:()=>e.ipcRenderer.invoke("portable:voicestudio-install"),studioVoices:port=>e.ipcRenderer.invoke("portable:voicestudio-voices",port),studioProgress:fn=>{const listener=(_event,value)=>fn(value);e.ipcRenderer.on("portable:voicestudio-progress",listener);return ()=>e.ipcRenderer.removeListener("portable:voicestudio-progress",listener)},liveAnswer:(id,accepted)=>e.ipcRenderer.send("portable:live-answer",id,accepted),liveSpeak:(text,revision)=>e.ipcRenderer.invoke("portable:live-speak",text,revision),liveAudioEnd:()=>e.ipcRenderer.send("portable:live-audio-end"),liveInterrupt:speaking=>e.ipcRenderer.send("portable:live-interrupt",speaking),liveBaseline:id=>e.ipcRenderer.invoke("portable:live-chat-baseline",id),liveChatReply:(id,prompt,after,since,turn)=>e.ipcRenderer.invoke("portable:live-chat-reply",id,prompt,after,since,turn),localCheck:port=>e.ipcRenderer.invoke("portable:voicestudio-check",port),localDemo:(port,voice)=>e.ipcRenderer.invoke("portable:voicestudio-demo",port,voice),localTranscribe:(port,bytes,mime)=>e.ipcRenderer.invoke("portable:voicestudio-transcribe",port,bytes,mime),liveStart:local=>e.ipcRenderer.invoke("portable:live-start",local),liveStop:()=>e.ipcRenderer.send("portable:live-stop"),liveAudio:pcm=>e.ipcRenderer.send("portable:live-audio",pcm),liveEvents:fn=>{const listener=(_event,type,value)=>fn(type,value);e.ipcRenderer.on("portable:live-event",listener);return ()=>e.ipcRenderer.removeListener("portable:live-event",listener)},geminiConfigured:()=>e.ipcRenderer.invoke("portable:voice-gemini-configured"),geminiConfigure:key=>e.ipcRenderer.invoke("portable:voice-gemini-configure",key),configured:()=>e.ipcRenderer.invoke("portable:voice-configured"),configure:key=>e.ipcRenderer.invoke("portable:voice-configure",key),transcribe:(bytes,mime)=>e.ipcRenderer.invoke("portable:voice-transcribe",bytes,mime)},portableUpdater:{check:()=>e.ipcRenderer.invoke("portable:update-check"),download:()=>e.ipcRenderer.invoke("portable:update-download")},portableLibrary:{list:()=>e.ipcRenderer.invoke("portable:library-list"),files:()=>e.ipcRenderer.invoke("portable:library-files"),blob:hash=>e.ipcRenderer.invoke("portable:library-blob",hash),reveal:path=>e.ipcRenderer.invoke("portable:library-reveal",path)},getPathForFile:t=>e.webUtils.getPathForFile(t)');
}

function patchLibraryHost(content) {
  content = replaceOnce(content, 'function Eyn(e){let t=xi()', 'function Eyn(e){let portableLibraryNavigate=$r(),portableToolLayout=NW(),t=xi()');
  content = replaceOnce(content, "var n=wvn(),r=n.firstChild;return V(r,()=>e.children)",
    "var n=wvn(),r=n.firstChild;return n.dataset.portableNativePage='',V(r,()=>e.children)");
  return replaceOnce(content, "V(o,I(Evn,{get children(){return I(Pt,{get children(){return e.children}})}}))",
    "o.dataset.portableLibraryHost='',portableInstallToolHost(o,portableToolLayout),o.portableOpenMessage=(sessionId,messageId,partId)=>{const local=c.ownUrl(),server=local&&s.servers.list().find(server=>MB.local(server,local));if(!server||!sessionId||!messageId)return false;const path=PB(MB.key(server),encodeURIComponent(sessionId));const hash='#message-'+encodeURIComponent(messageId)+(partId?'~'+encodeURIComponent(partId):'')+(partId?'~':'~~')+Date.now();portableLibraryNavigate(path+hash,{scroll:false});return true},V(o,I(Evn,{get children(){return I(Pt,{get children(){return e.children}})}}))");
}

function patchLibraryTimeline(content) {
  content = replaceOnce(content, "if(t)return t[1]},$x=", "if(t)return t[1].split('~')[0]},$x=");
  content = replaceOnce(content, "return i!==r.e&&V(n,`id`,r.e=i),a!==r.t&&V(n,`data-message-id`",
    "return U(t.row,`AssistantPart`)&&V(n,`data-portable-library-parts`,(t.row.group.type===`part`?[t.row.group.ref]:t.row.group.refs).map(ref=>ref.partID).join(' ')),i!==r.e&&V(n,`id`,r.e=i),a!==r.t&&V(n,`data-message-id`");
  content = replaceOnce(content, "U(e,`AssistantPart`)&&e.group.type===`part`&&e.group.ref.partID===r",
    "U(e,`AssistantPart`)&&(e.group.type===`part`?e.group.ref.partID===r:e.group.refs.some(ref=>ref.partID===r))");
  content = replaceOnce(content, "anchor:w,revealMessage:e=>d(e),", "anchor:w,revealMessage:(e,t)=>d(e,t),");
  content = replaceOnce(content, "function OS(e){let t=it(),n=hi(),", "function OS(e){let t=it(),n=hi(),g=()=>t.hash.split('~')[1],");
  return replaceOnce(content, "let r=n?document.getElementById(e.anchor(t.messageID)):null;r||e.revealMessage(t.messageID);let i=r??document.getElementById(e.anchor(t.messageID));",
    "const part=g();const find=()=>part?e.scroller()?.querySelector('[data-portable-library-parts~='+CSS.escape(decodeURIComponent(part))+']'):document.getElementById(e.anchor(t.messageID));let r=n?find():null;r||e.revealMessage(t.messageID,part?decodeURIComponent(part):void 0);let i=r??find();");
}

targets.set("out/renderer/assets/dropzone-B6PhoypJ.js", content => {
  content = replaceOnce(content, "function id(e){let t=T()",
    "function id(e){const portablePath=portableVoiceLocation(), portableTabs=kt(), portableServer=Je(), portableDirectory=Jt();let t=T()");
  content = replaceOnce(content, "async function ms(e,t,n){let r=await hs(e,t),i=",
    "async function ms(e,t,n){let r=await hs(e,t);if(portableVoiceSubmission?.prompt===r.text)t={...t,delivery:`steer`};let i=");
  content = replaceOnce(content, "delivery:t.delivery,text:r.text,files:r.files",
    "delivery:t.delivery,text:portableVoicePrompt(r.text,t.id,e.id),files:r.files");
  return 'import {Rh as portableVoiceLocation} from "./main-DtumKGhc.js";\n'
    + readPatch("desktop-voice-settings.js") + "\n" + readPatch("desktop-voice-setup.js") + "\n" + readPatch("desktop-voice-renderer.js") + "\n" + replaceOnce(content,
    "N=M.firstChild;v.addEventListener(`change`",
    "N=M.firstChild;x.append(portableVoiceControls(x,k,()=>!e.disabled&&!r.draftOnly&&E()===`normal`,()=>portablePath.pathname,prompt=>portableTabs.newDraft({server:portableServer.key,directory:portableDirectory().directory},prompt)));v.addEventListener(`change`");
});
targets.set("out/renderer/assets/route-Oq3PA11J.js", content => patchLibraryTimeline(replaceOnce(content,
  'if(Ue()&&e.data.error.type===`provider.free-limit`&&r.infinite?.autoRotate(e.data.sessionID),e.data.sessionID!==a.id||n.active)return;let t=e.data.error;if(t.type===`provider.free-limit`)return Ue()?void 0:h(m,e);',
  'if(e.data.sessionID!==a.id)return;let t=e.data.error;if(t.type===`provider.free-limit`){document.dispatchEvent(new CustomEvent("portable-provider-limit",{detail:{retryAfterMs:t.retryAfterMs}}));if(!n.active)return h(m,e);return}if(n.active)return;')));

if (mode === "--library-only") {

  targets.clear();
  targets.set("out/renderer/assets/route-Oq3PA11J.js", patchLibraryTimeline);
  targets.set("out/main/index.js", content => replaceOnce(content, "portableGithubRegister();",
    "portableGithubRegister();\n" + readPatch("desktop-library-main.js")));
  targets.set("out/preload/index.cjs", patchLibraryPreload);
  targets.set("out/renderer/assets/main-DtumKGhc.js", content => {
    const start = content.indexOf("function portableLibrary(dialog)");
    const boundary = content.indexOf("\nconst ", content.indexOf("function portableHomeTools", start));
    if (start < 0 || boundary < 0) throw new Error("Biblioteca anterior não encontrada.");
    return patchLibraryHost(content.slice(0, start) + readPatch("desktop-library.js") + content.slice(boundary));
  });
}

function readPatch(file) {
  return fs.readFileSync(path.join(__dirname, file), "utf8");
}

function packCatalogLogos() {
  const files = {github: "github.svg", supabase: "supabase.svg", voicestudio: "voicestudio.png", cloudflare: "cloudflare.png",
    playwright: "playwright.svg", "microsoft-learn": "microsoft-learn.png"};
  const urls = Object.fromEntries(Object.entries(files).map(([name, file]) => {
    const mime = file.endsWith(".svg") ? "image/svg+xml" : "image/png";
    const data = fs.readFileSync(path.join(__dirname, "catalogo-logos", file)).toString("base64");
    return [name, "data:" + mime + ";base64," + data];
  }));
  return "const portableCatalogLogos = " + JSON.stringify(urls) + ";";
}

function patchCatalogPreload(content) {
  return replaceOnce(content, "getPathForFile:t=>e.webUtils.getPathForFile(t)",
    'portableCatalog:{mcpStatuses:()=>e.ipcRenderer.invoke("portable:mcp-statuses"),skills:()=>e.ipcRenderer.invoke("portable:skills-list"),installSkill:id=>e.ipcRenderer.invoke("portable:skills-install",id),warpStatus:()=>e.ipcRenderer.invoke("portable:warp-status"),warpAction:action=>e.ipcRenderer.invoke("portable:warp-action",action),warpProgress:fn=>{const listener=(_event,value)=>fn(value);e.ipcRenderer.on("portable:warp-progress",listener);return ()=>e.ipcRenderer.removeListener("portable:warp-progress",listener)},supabaseStatus:()=>e.ipcRenderer.invoke("portable:supabase-status"),supabaseConnect:ref=>e.ipcRenderer.invoke("portable:supabase-connect",ref),supabaseCancel:()=>e.ipcRenderer.invoke("portable:supabase-cancel"),supabaseLogout:()=>e.ipcRenderer.invoke("portable:supabase-logout")},getPathForFile:t=>e.webUtils.getPathForFile(t)');
}

function packSkills() {
  const readFiles = (root, prefix = "") => Object.fromEntries(
    fs.readdirSync(path.join(root, prefix), {withFileTypes: true}).flatMap(entry => {
      const file = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.isDirectory()) return Object.entries(readFiles(root, file));
      if (!entry.isFile()) throw new Error("Arquivo de skill inválido: " + file);
      return [[file, fs.readFileSync(path.join(root, file)).toString("base64")]];
    })
  );
  const packs = JSON.parse(readPatch("catalogo-skills.json")).map(pack => {
    const location = path.join(__dirname, "catalogo-skills", pack.id);
    const skills = path.join(location, "skills");
    const legal = readFiles(location, "legal");
    const files = Object.fromEntries(fs.readdirSync(skills).map(name => {
      if (!/^[a-z0-9-]+$/.test(name)) throw new Error("Nome de skill inválido: " + name);
      const contents = readFiles(path.join(skills, name));
      if (!contents["SKILL.md"]) throw new Error("SKILL.md ausente: " + name);
      return [name, {...contents, ...legal}];
    }));
    if (!Object.hasOwn(files, pack.entry)) throw new Error("Skill principal ausente: " + pack.entry);
    return {...pack, files};
  });
  return "const portableSkillPacks = " + JSON.stringify(packs) + ";";
}

function replaceOnce(content, original, updated) {
  const index = content.indexOf(original);
  if (index < 0 || content.indexOf(original, index + original.length) !== -1) {
    throw new Error("O pacote não tem a estrutura esperada do OpenCode Desktop 2.2.5.");
  }
  return content.slice(0, index) + updated + content.slice(index + original.length);
}

function packedFiles(tree, prefix = "") {
  return Object.entries(tree.files).flatMap(([name, entry]) => {
    const filename = prefix + name;
    if (entry.files) return packedFiles(entry, filename + "/");
    return entry.offset === undefined ? [] : [{ filename, entry }];
  });
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

let offset = 0;
const files = packedFiles(entries).sort((a, b) => Number(a.entry.offset) - Number(b.entry.offset));
const chunks = files.map(({ filename, entry }) => {
  const start = dataOffset + Number(entry.offset);
  let content = source.subarray(start, start + entry.size);
  const transform = targets.get(filename);
  if (transform) {
    if (!entry.integrity || sha256(content) !== entry.integrity.hash) {
      throw new Error("Falha de integridade no arquivo original " + filename);
    }
    const patched = transform(content.toString("utf8"));
    if (filename.endsWith(".cjs")) new (require("node:vm").Script)(patched);
    else new SourceTextModule(patched);
    content = Buffer.from(patched);
    const blockSize = entry.integrity.blockSize;
    const blocks = [];
    for (let index = 0; index < content.length; index += blockSize) {
      blocks.push(sha256(content.subarray(index, index + blockSize)));
    }
    entry.integrity = { algorithm: "SHA256", hash: sha256(content), blockSize, blocks };
    entry.size = content.length;
    targets.delete(filename);
  }
  entry.offset = String(offset);
  offset += content.length;
  return content;
});
if (targets.size) throw new Error("Arquivos não encontrados no pacote.");

const json = Buffer.from(JSON.stringify(entries));
const paddedLength = Math.ceil(json.length / 4) * 4;
const header = Buffer.alloc(16 + paddedLength);
header.writeUInt32LE(4, 0);
header.writeUInt32LE(8 + paddedLength, 4);
header.writeUInt32LE(4 + paddedLength, 8);
header.writeUInt32LE(json.length, 12);
json.copy(header, 16);
const output = fs.openSync(targetPath, "wx");
try {
  for (const chunk of [header, ...chunks]) fs.writeFileSync(output, chunk);
} finally {
  fs.closeSync(output);
}
