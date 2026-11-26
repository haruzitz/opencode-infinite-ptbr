function portableSidebarNavigation(dialog, platform) {
  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Ferramentas do OpenCode");
  nav.className = "flex flex-col gap-1 border-b border-v2-border-border-muted pb-2";
  const add = (icon, label, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "flex h-8 items-center gap-2 rounded-md px-2 text-start text-[13px] text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline";
    const symbol = document.createElement("span");
    symbol.setAttribute("aria-hidden", "true");
    symbol.className = "w-4 text-center text-v2-text-text-muted";
    symbol.textContent = icon;
    button.append(symbol, document.createTextNode(label));
    button.addEventListener("click", action);
    nav.append(button);
    return button;
  };
  add("▦", "Biblioteca", () => portableLibrary(dialog));
  portableMountUpdater(nav, add);
  return nav;
}

function portableMountUpdater(nav, add) {
  const api = window.electron?.portableUpdater;
  if (!api) return;
  const status = document.createElement("small");
  status.className = "px-2 text-v2-text-text-muted";
  status.setAttribute("role", "status");
  let available = null;
  const button = add("↻", "Verificar atualizações", async () => {
    button.disabled = true;
    try {
      if (available) {
        status.textContent = "Preparando download…";
        const result = await api.download();
        status.textContent = result === "saved" ? "Instalador salvo e verificado." :
          result === "installing" ? "Instalando atualização…" : result === "cancelled" ? "" : result === "busy" ? "O download já está em andamento." : "Atualização indisponível.";
      } else await check(true);
    } catch {
      status.textContent = "Não foi possível concluir a atualização. Tente novamente.";
    } finally { button.disabled = false; }
  });
  nav.append(status);
  async function check(manual) {
    try {
      const update = await api.check();
      available = update?.available ?? null;
      button.lastChild.textContent = available ? "Baixar atualização " + available : "Verificar atualizações";
      button.classList.toggle("font-semibold", !!available);
      if (manual) status.textContent = available ? "Atualização disponível." : "Você está na versão " + update.installed + ".";
    } catch {
      if (manual) status.textContent = "Não foi possível consultar o GitHub.";
    }
  }
  void check(false);
}

function portableProjectNewChat(actions, server, project) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "+";
  button.title = "Nova conversa neste projeto";
  button.setAttribute("aria-label", button.title);
  button.dataset.projectAction = "";
  button.className = "grid size-6 shrink-0 place-items-center rounded text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover hover:text-v2-text-text-base focus-visible:outline";
  button.addEventListener("click", () => actions().openNewSession(server(), project().worktree));
  return button;
}

function portableSidebarPreferences(settings) {
  const key = "opencode.portable.project-sidebar.v1";
  if (localStorage.getItem(key)) return;
  settings.appearance.setTabLayout("vertical");
  settings.general.setSidebarOrganize("projects");
  settings.appearance.setSidebarOpen(true);
  localStorage.setItem(key, "1");
}
