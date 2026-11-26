function portableLibrary(dialog) {
  const panel = document.createElement("section");
  panel.className = "portable-library";
  const heading = document.createElement("h2");
  heading.textContent = "Biblioteca";
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
    gallery.replaceChildren();
    for (const record of records.sort((a, b) => b.saved - a.saved)) {
      const tile = document.createElement("article");
      const url = URL.createObjectURL(record.file);
      urls.push(url);
      const type = record.file.type.split("/")[0];
      if (["image", "video", "audio"].includes(type)) {
        const preview = document.createElement(type === "image" ? "img" : type);
        preview.src = url;
        if (type === "image") { preview.alt = record.file.name; preview.loading = "lazy"; }
        else { preview.controls = true; preview.preload = "none"; }
        tile.append(preview);
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = record.file.name;
      link.textContent = record.file.name;
      tile.append(link);
      gallery.append(tile);
    }
    status.textContent = records.length ? "" : "Importe imagens, vídeos, áudios e documentos que você salvou.";
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
  panel.append(heading, add, input, status, gallery);
  void dialog.show(() => I(OV, { size: "wide", children: panel }), () => {
    closed = true;
    release();
    void db.then(database => database.close(), () => {});
  }, "portable-library");
  void load().catch(failure);
}

function portableHomeTools(dialog) {
  const tools = document.createElement("div");
  tools.className = "portable-home-tools";
  const library = document.createElement("button");
  library.type = "button";
  library.textContent = "▦ Biblioteca";
  library.addEventListener("click", () => portableLibrary(dialog));
  tools.append(library);
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
