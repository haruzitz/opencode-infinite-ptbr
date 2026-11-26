// Itens extras da barra lateral: Biblioteca e atualização.
const portableVersion = "0.2.0";

// Ancora no header da sidebar (contém "Nova sessão", sempre visível).
function portableSidebarAnchor() {
  const nova = [...document.querySelectorAll("button")].find(
    (b) => (b.innerText || "").trim() === "Nova sessão",
  );
  return nova ? nova.parentElement : null;
}

function portableVersionNewer(a, b) {
  const num = (v) => {
    const m = String(v || "").replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  };
  const A = num(a);
  const B = num(b);
  for (let i = 0; i < 3; i++) {
    if (A[i] !== B[i]) return A[i] > B[i] ? 1 : -1;
  }
  return 0;
}

function portableSidebarItem(container, ref, label, dataset, onClick) {
  const model = [...container.querySelectorAll("button")].find(
    (b) => (b.innerText || "").trim() === ref,
  );
  if (!model) return false;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset[dataset] = "";
  btn.className = model.className;
  btn.innerHTML = '<span class="min-w-0 truncate">' + label + "</span>";
  btn.addEventListener("click", onClick);
  container.insertBefore(btn, model.nextSibling);
  return true;
}

function portableSidebarTools(dialog) {
  const mount = () => {
    const anchor = portableSidebarAnchor();
    if (!anchor || anchor.querySelector("[data-portable-library-btn]")) return;
    portableSidebarItem(anchor, "Nova sessão", "▦ Biblioteca", "portableLibraryBtn",
      () => portableLibrary(dialog));
  };
  const observer = new MutationObserver(mount);
  observer.observe(document.body, { childList: true, subtree: true });
  mount();
  return () => observer.disconnect();
}

function portableUpdater(platform) {
  const mount = (update) => {
    const anchor = portableSidebarAnchor();
    if (!anchor || anchor.querySelector("[data-portable-update-btn]")) return;
    portableSidebarItem(anchor, "▦ Biblioteca", "↻ Atualização", "portableUpdateBtn",
      () => platform.openExternal(update.url));
  };

  const check = async () => {
    try {
      const res = await fetch(
        "https://api.github.com/repos/haruzitz/opencode-infinite-ptbr/releases",
        { signal: AbortSignal.timeout(15000) },
      );
      if (!res.ok) return null;
      const releases = await res.json();
      if (!Array.isArray(releases) || !releases.length) return null;
      const latest = releases.find((r) => !r.draft && r.author?.login === "haruzitz");
      if (!latest) return null;
      const tag = latest.tag_name || "";
      if (portableVersionNewer(tag, portableVersion) > 0) {
        return { tag, url: latest.html_url };
      }
    } catch {}
    return null;
  };

  check().then((update) => {
    if (!update) return;
    const tryMount = () => {
      if (portableSidebarAnchor()) {
        mount(update);
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(tryMount);
    observer.observe(document.body, { childList: true, subtree: true });
    tryMount();
  });
}
