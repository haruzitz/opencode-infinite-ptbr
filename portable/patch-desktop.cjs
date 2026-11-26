const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { SourceTextModule } = require("node:vm");

const [sourcePath, targetPath] = process.argv.slice(2);
if (!sourcePath || !targetPath || path.resolve(sourcePath) === path.resolve(targetPath)) {
  throw new Error("Informe os caminhos de origem e destino do ASAR.");
}

const source = fs.readFileSync(sourcePath);
const dataOffset = 8 + source.readUInt32LE(4);
const entries = JSON.parse(source.subarray(16, 16 + source.readUInt32LE(12)).toString("utf8"));
const targets = new Map([
  ["out/main/index.js", content => {
    return 'import { execFile as portableGitExec } from "node:child_process";\n'
      + 'import portableGitPath from "node:path";\n'
      + 'import { ipcMain as portableGithubIpc } from "electron";\n'
      + readPatch("desktop-github-main.js") + "\nportableGithubRegister();\n" + content;
  }],
  ["out/preload/index.cjs", content => {
    return replaceOnce(content, "getPathForFile:t=>e.webUtils.getPathForFile(t)",
      'portableGithub:{status:directory=>e.ipcRenderer.invoke("portable:github-status",directory),login:()=>e.ipcRenderer.invoke("portable:github-login"),cancelLogin:()=>e.ipcRenderer.invoke("portable:github-cancel-login"),configureReader:()=>e.ipcRenderer.invoke("portable:github-reader")},getPathForFile:t=>e.webUtils.getPathForFile(t)');
  }],
  ["out/main/desktop-Bu-SLvc7.js", content => {
    content = replaceOnce(content, "d=yield*Lh(u),f=(e,t)=>{let r=t.filter(e=>e.startsWith(`opencode://`));",
      "d=yield*Lh(u),f=(e,t)=>{const local=portableProjectLinks(t);if(local.length)d.receive(local);let r=t.filter(e=>e.startsWith(`opencode://`));");
    content = replaceOnce(content, "return I.on(`second-instance`,f),I.on(`open-url`,p)",
      "return d.receive(portableProjectLinks(process.argv)),I.on(`second-instance`,f),I.on(`open-url`,p)");
    return 'import { statSync as portableProjectStat } from "node:fs";\n'
      + 'import { isAbsolute as portableProjectIsAbsolute } from "node:path";\n'
      + readPatch("desktop-project-main.js") + "\n" + content;
  }],
  ["out/renderer/assets/main-DtumKGhc.js", content => {
    content = replaceOnce(content, "tabLayout:`horizontal`", "tabLayout:`vertical`");
    content = replaceOnce(content, "sidebarOrganize:`list`", "sidebarOrganize:`projects`");
    content = replaceOnce(content, "function Eyn(e){let t=xi(),n=PX(),r=VK(),i=dJ(),a=AB(),o=Pr(),s=fq(),c=NB(),l=WW(),u=Mn(",
      readPatch("desktop-project-renderer.js") + "\n"
      + readPatch("desktop-sidebar.js") + "\n"
      + "function Eyn(e){let t=xi(),n=PX(),r=VK(),i=dJ(),a=AB(),o=Pr(),s=fq(),c=NB(),l=WW(),portableProjectHandler=portableProjectInstall(s,c,l),portableSidebarCleanup=portableSidebarTools(o),portableUpdaterRun=portableUpdater(t),u=Mn(");
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
    content = replaceOnce(content, "F(()=>s({type:`disposed`})),$B(N(e=>e||!!t.current(),!1),()=>s({type:`load.requested`}))",
      'portableGithubBrowse=(id,url)=>{const view=t.current(),browser=i();if(!view||view.id!==id||!browser?.available(view)||!browser.attached(view))return false;browser.openURL(view,url);return true},F(()=>{portableGithubBrowse=undefined;s({type:`disposed`})}),$B(N(e=>e||!!t.current(),!1),()=>s({type:`load.requested`}))');
    return replaceOnce(content, "V(a,I(R,{get when(){return!e.verticalTabs},get children(){var e=M_n();return V(e,I(u_n,{items:C})),e}}),null),j(t=>",
      "V(a,portableGithubButton(d,_,v,T,E,NB(),t,Pr()),null),V(a,I(R,{get when(){return!e.verticalTabs},get children(){var e=M_n();return V(e,I(u_n,{items:C})),e}}),null),j(t=>");
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

function readPatch(file) {
  return fs.readFileSync(path.join(__dirname, file), "utf8");
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
