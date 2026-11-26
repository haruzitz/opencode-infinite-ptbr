function portableLibrary() {
  const host = document.querySelector("[data-portable-library-host]");
  if (!host) return;
  const existing = host.querySelector("[data-portable-library-page]");
  if (existing) { existing.querySelector("h2").focus(); return; }
  const panel = document.createElement("section");
  panel.className = "portable-library";
  panel.dataset.portableLibraryPage = "";
  panel.setAttribute("aria-label", "Biblioteca");
  const stylesheet = document.createElement("style");
  stylesheet.textContent = `
    [data-portable-library-host] { position: relative; }
    [data-portable-library-page].portable-library { position: absolute; inset: 0; z-index: 10; max-height: none; padding: clamp(18px, 4vw, 48px); background: var(--v2-surface-surface-base, #171922); color: var(--v2-text-text-base, #f1f2f8); }
    [data-portable-library-page] header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    [data-portable-library-page] h2 { font-size: 28px; margin: 0; }
    [data-portable-library-page] { overflow: auto; }
    [data-portable-library-page] header { margin-bottom: 16px; }
    [data-portable-library-page] dialog::backdrop { background: rgba(8,10,17,.72); }
    [data-portable-library-page] nav, [data-portable-library-page] footer, [data-portable-library-page] .library-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
    [data-portable-library-page] nav { padding-bottom:12px; border-bottom:1px solid var(--v2-border-border-muted,#46495d); margin-bottom:18px; }
    [data-portable-library-page] footer { justify-content:center; margin-top:20px; }
    [data-portable-library-page] button, [data-portable-library-page] article a { padding:7px 11px; border:1px solid var(--v2-border-border-muted,#46495d); border-radius:7px; cursor:pointer; }
    [data-portable-library-page] button:hover:not(:disabled), [data-portable-library-page] article a:hover, [data-portable-library-page] article:hover { background:#30364e; border-color:#8899d2; color:#fff; }
    [data-portable-library-page] button:focus-visible, [data-portable-library-page] a:focus-visible { outline:2px solid #9daefa; outline-offset:2px; }
    [data-portable-library-page] button[aria-pressed="true"] { background:#3c4874; color:#fff; border-color:#8298ef; }
    [data-portable-library-page] button:disabled { opacity:.45; cursor:default; }
    [data-portable-library-page] .portable-library-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,180px),1fr)); gap:12px; }
    [data-portable-library-page] article { min-width:0; display:flex; flex-direction:column; gap:8px; padding:10px; border:1px solid var(--v2-border-border-muted,#46495d); border-radius:9px; background:var(--v2-surface-surface-raised,#202330); }
    [data-portable-library-page] article button, [data-portable-library-page] article a { text-align:start; overflow-wrap:anywhere; }
    [data-portable-library-page] article img, [data-portable-library-page] article video { width:100%; height:auto; aspect-ratio:4/3; object-fit:contain; border-radius:5px; background:#10121a; }
    [data-portable-library-page] article audio { width:100%; }
    [data-portable-library-page] small { opacity:.75; overflow-wrap:anywhere; }
    [data-portable-library-page] .library-empty { grid-column:1/-1; padding:16px 0; }
  `;
  const header = document.createElement("header");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Voltar à conversa";
  const heading = document.createElement("h2");
  heading.textContent = "Biblioteca";
  heading.tabIndex = -1;
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = "image/*,video/*,audio/*,.pdf,.txt,.docx,.xlsx";
  input.hidden = true;
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "Importar arquivos";
  add.addEventListener("click", () => input.click());
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const gallery = document.createElement("div");
  gallery.className = "portable-library-grid";
  const categories = { image: "Imagens", document: "Documentos", video: "Vídeos", audio: "Áudios" };
  const extensions = {
    image: /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico)$/i,
    video: /\.(mp4|webm|mov|mkv|avi)$/i,
    audio: /\.(mp3|wav|ogg|flac|m4a|aac)$/i,
  };
  const kind = (mime, name) => {
    const type = mime?.split("/")[0];
    if (Object.hasOwn(extensions, type)) return type;
    return Object.keys(extensions).find(key => extensions[key].test(name)) ?? "document";
  };
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Categorias da Biblioteca");
  const footer = document.createElement("footer");
  const pageLabel = document.createElement("span");
  pageLabel.setAttribute("aria-live", "polite");
  const previous = document.createElement("button");
  const next = document.createElement("button");
  previous.type = next.type = "button";
  previous.textContent = "Anterior";
  next.textContent = "Próxima";
  footer.append(previous, pageLabel, next);
  const viewer = document.createElement("dialog");
  viewer.setAttribute("aria-label", "Visualizador de imagem");
  viewer.style.cssText = "position:fixed;inset:0;margin:auto;width:min(1120px,94vw);height:fit-content;max-height:92vh;overflow:auto;-webkit-app-region:no-drag;padding:16px;border:1px solid #616985;border-radius:12px;background:#171922;color:#fff;";
  const viewerHeader = document.createElement("header");
  const viewerName = document.createElement("strong");
  const viewerClose = document.createElement("button");
  viewerClose.type = "button";
  viewerClose.autofocus = true;
  viewerClose.style.cssText = "min-height:48px;min-width:150px;padding:10px 16px;-webkit-app-region:no-drag;pointer-events:auto;touch-action:manipulation;";
  viewerClose.textContent = "Fechar visualizador";
  viewerClose.addEventListener("click", () => viewer.close());
  viewer.addEventListener("click", event => {
    if (event.target !== viewer) return;
    const bounds = viewer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
  });
  const viewerImage = document.createElement("img");
  viewerImage.style.cssText = "display:block;width:100%;max-height:76vh;object-fit:contain;";
  viewerHeader.append(viewerName, viewerClose);
  viewer.append(viewerHeader, viewerImage);
  viewer.addEventListener("close", () => viewerImage.removeAttribute("src"));
  function viewImage(tile, image, name, getUrl) {
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Visualizar imagem";
    open.addEventListener("click", async () => {
      try {
        const url = await getUrl();
        if (closed) return;
        viewerName.textContent = viewerImage.alt = name;
        viewerImage.src = url;
        if (!viewer.open) viewer.showModal();
      } catch { failure(); }
    });
    image.style.cursor = "zoom-in";
    image.addEventListener("click", () => open.click());
    tile.append(open);
  }
  function showInConversation(record) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Mostrar na conversa";
    button.addEventListener("click", () => {
      if (host.portableOpenMessage?.(record.sessionId, record.messageId, record.partId)) leave(false);
      else status.textContent = "Não foi possível acessar a conversa de origem.";
    });
    return button;
  }

  const historyCards = [];
  const importedCards = [];
  const tabs = new Map();
  const pageSize = 12;
  let selected = "image";
  let page = 0;
  function render() {
    const records = [...historyCards, ...importedCards].filter(entry => entry.category === selected)
      .sort((a, b) => b.saved - a.saved);
    const pages = Math.max(1, Math.ceil(records.length / pageSize));
    page = Math.min(page, pages - 1);
    gallery.replaceChildren(...records.slice(page * pageSize, (page + 1) * pageSize).map(entry => entry.tile));
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "library-empty";
      empty.textContent = "Nenhum arquivo nesta categoria.";
      gallery.append(empty);
    }
    previous.disabled = page === 0;
    next.disabled = page >= pages - 1;
    footer.style.display = pages > 1 ? "" : "none";
    pageLabel.textContent = "Página " + (page + 1) + " de " + pages;
    for (const [key, tab] of tabs) tab.setAttribute("aria-pressed", String(key === selected));
  }
  for (const [key, label] of Object.entries(categories)) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = label;
    tab.addEventListener("click", () => { selected = key; page = 0; render(); panel.scrollTop = 0; });
    nav.append(tab);
    tabs.set(key, tab);
  }
  previous.addEventListener("click", () => { page--; render(); panel.scrollTop = 0; });
  next.addEventListener("click", () => { page++; render(); panel.scrollTop = 0; });
  const urls = [];
  const release = () => urls.splice(0).forEach(url => URL.revokeObjectURL(url));
  let closed = false;
  const db = new Promise((resolve, reject) => {
    const request = indexedDB.open("opencode-portable-library", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  async function load() {
    const database = await db;
    const records = await new Promise((resolve, reject) => {
      const request = database.transaction("files").objectStore("files").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (closed) return;
    release();
    importedCards.length = 0;
    for (const record of records.sort((a, b) => b.saved - a.saved)) {
      const tile = document.createElement("article");
      const url = URL.createObjectURL(record.file);
      urls.push(url);
      const type = kind(record.file.type, record.file.name);
      if (["image", "video", "audio"].includes(type)) {
        const preview = document.createElement(type === "image" ? "img" : type);
        preview.src = url;
        if (type === "image") { preview.alt = record.file.name; preview.loading = "lazy"; }
        else { preview.controls = true; preview.preload = "none"; }
        tile.append(preview);
        if (type === "image") viewImage(tile, preview, record.file.name, () => url);
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = record.file.name;
      link.textContent = record.file.name;
      const name = document.createElement("small");
      name.textContent = record.file.name + " · Importado";
      link.textContent = "Baixar";
      tile.append(name, link);
      importedCards.push({ category: type, saved: record.saved, tile });
    }
    render();
  }
  const failure = () => { if (!closed) status.textContent = "Não foi possível acessar a biblioteca. Confira o espaço em disco."; };
  input.addEventListener("change", async () => {
    const files = [...input.files];
    input.value = "";
    if (!files.length) return;
    add.disabled = true;
    try {
      const database = await db;
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("files", "readwrite");
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
        for (const file of files) {
          transaction.objectStore("files").add({ id: crypto.randomUUID(), saved: Date.now(), file });
        }
      });
      await load();
    } catch { failure(); }
    finally { add.disabled = false; }
  });
  const api = window.electron?.portableLibrary;
  async function history() {
    if (!api) throw new Error("Integração da biblioteca indisponível.");
    const [items, files] = await Promise.all([api.list(), api.files()]);
    if (closed) return;
    for (const file of files ?? []) {
      const tile = document.createElement("article");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Mostrar na pasta ↗";
      button.setAttribute("aria-label", "Mostrar " + file.name + " na pasta");
      const name = document.createElement("strong");
      name.textContent = file.name;
      button.addEventListener("click", () => api.reveal(file.path).catch(failure));
      const origin = document.createElement("small");
      origin.textContent = file.title || "Conversa do OpenCode";
      tile.append(name, origin, button, showInConversation(file));
      historyCards.push({ category: kind(null, file.name), saved: file.saved, tile });
    }
    const seen = new Set();
    for (const item of items ?? []) {
      if (seen.has(item.hash)) continue;
      seen.add(item.hash);
      const tile = document.createElement("article");
      const action = document.createElement("button");
      action.type = "button";
      action.textContent = "Baixar";
      action.setAttribute("aria-label", "Baixar " + item.name);
      const name = document.createElement("strong");
      name.textContent = item.name;
      const origin = document.createElement("small");
      origin.textContent = item.title || "Conversa do OpenCode";
      let pending;
      const objectUrl = () => pending ??= api.blob(item.hash).then(bytes => {
        if (!bytes || closed) throw new Error("Arquivo indisponível.");
        const url = URL.createObjectURL(new Blob([bytes], {type: item.mime}));
        historyUrls.push(url);
        return url;
      });
      if (/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(item.mime)) {
        const image = document.createElement("img");
        image.alt = item.name;
        tile.append(image);
        viewImage(tile, image, item.name, objectUrl);
        previews.observe(image);
        image.addEventListener("portable-preview", () => {
          void objectUrl().then(url => { image.src = url; }).catch(() => { image.remove(); });
        }, {once: true});
      }
      action.addEventListener("click", async () => {
        try {
          const link = document.createElement("a");
          link.href = await objectUrl();
          link.download = item.name;
          link.click();
        } catch { failure(); }
      });
      tile.append(name, origin, action, showInConversation(item));
      historyCards.push({ category: kind(item.mime, item.name), saved: item.saved, tile });
    }
    render();
  }

  const historyUrls = [];
  const previews = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      previews.unobserve(entry.target);
      entry.target.dispatchEvent(new Event("portable-preview"));
    }
  }, {root: panel});
  const previousFocus = document.activeElement;
  const leave = (restoreFocus = true) => {
    closed = true;
    previews.disconnect();
    release();
    historyUrls.forEach(url => URL.revokeObjectURL(url));
    void db.then(database => database.close(), () => {});
    panel.remove();
    if (restoreFocus) previousFocus?.focus();
  };
  close.addEventListener("click", leave);
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape" && !viewer.open) { event.stopPropagation(); leave(); }
  });
  const actions = document.createElement("div");
  actions.className = "library-actions";
  actions.append(add, close);
  header.append(heading, actions);
  panel.append(stylesheet, header, input, nav, status, gallery, footer, viewer);
  render();
  host.append(panel);
  heading.focus();
  void history().catch(() => { status.textContent = "Não foi possível ler o histórico local."; });
  void load().catch(failure);
}

function portableHomeTools(dialog) {
  const tools = document.createElement("div");
  tools.className = "portable-home-tools";
  if (!localStorage.getItem("opencode.portable.first-steps")) {
    const guide = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Primeiros passos";
    const instructions = document.createElement("p");
    instructions.textContent = "Adicione uma pasta em Projetos. Escolha um cartão ou modelo. Use o ícone do GitHub para conectar sua conta.";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Ocultar guia";
    dismiss.addEventListener("click", () => { localStorage.setItem("opencode.portable.first-steps", "done"); guide.remove(); });
    guide.append(summary, instructions, dismiss);
    tools.append(guide);
  }
  return tools;
}
