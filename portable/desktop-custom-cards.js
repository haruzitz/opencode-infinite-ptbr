const portableCardsKey = "opencode.portable.custom-cards.v1";

function portableReadCards() {
  try {
    const records = JSON.parse(localStorage.getItem(portableCardsKey) ?? "[]");
    if (!Array.isArray(records)) return [];
    return records.filter(card => typeof card?.id === "string" && typeof card.title === "string" &&
      typeof card.modelName === "string" && typeof card.model?.providerID === "string" &&
      typeof card.model?.modelID === "string");
  } catch {
    return [];
  }
}

async function portableCardCatalog(home) {
  const connection = home.server.focused() ?? home.server.list()[0];
  const project = home.project.newSession();
  const api = connection && home.server.context(connection)?.sdk.api;
  if (!api) throw new Error("Servidor do OpenCode indisponível.");
  const input = project ? { location: { directory: project.worktree } } : undefined;
  const { data } = await api.model.list(input, { signal: AbortSignal.timeout(10000) });
  return data
    .filter(model => model.type === "chat")
    .sort((a, b) => a.providerID.localeCompare(b.providerID) || a.name.localeCompare(b.name, "pt-BR"));
}

function portableCardEditor(home, dialog, existing, onSaved) {
  const dialogId = "portable-custom-card";
  const form = document.createElement("form");
  form.className = "portable-card-form";

  const title = document.createElement("h2");
  title.textContent = existing ? "Editar cartão personalizado" : "Criar Card personalizado";
  const name = document.createElement("input");
  name.type = "text";
  name.maxLength = 70;
  name.required = true;
  name.value = existing?.title ?? "";
  name.placeholder = "Ex.: Revisar código";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Buscar por modelo ou provedor";
  const select = document.createElement("select");
  select.required = true;
  select.size = 6;
  select.disabled = true;
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = "Carregando modelos disponíveis…";

  function field(text, control) {
    const label = document.createElement("label");
    label.append(text, control);
    return label;
  }

  const buttons = document.createElement("div");
  buttons.className = "portable-card-form-actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.textContent = existing ? "Salvar alterações" : "Criar cartão";
  save.disabled = true;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancelar";
  cancel.addEventListener("click", () => dialog.close(dialogId));
  let catalog = [];
  let selected = existing && JSON.stringify([existing.model.providerID, existing.model.modelID]);

  function key(model) {
    return JSON.stringify([model.providerID, model.id]);
  }

  function renderModels() {
    const normalize = value => value.normalize("NFD").replace(/\p{M}/gu, "")
      .toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const query = normalize(search.value);
    const results = catalog.filter(model =>
      normalize([model.name, model.providerID, model.id].join(" ")).includes(query));
    const groups = new Map();
    select.replaceChildren();
    for (const model of results) {
      let group = groups.get(model.providerID);
      if (!group) {
        group = document.createElement("optgroup");
        group.label = model.providerID;
        groups.set(model.providerID, group);
        select.append(group);
      }
      const option = document.createElement("option");
      option.value = key(model);
      option.textContent = model.name;
      group.append(option);
    }
    select.value = selected ?? "";
    select.disabled = !results.length;
    save.disabled = !select.value;
    status.textContent = !results.length ? "Nenhum modelo encontrado." : "";
  }

  function persist(records) {
    try {
      localStorage.setItem(portableCardsKey, JSON.stringify(records));
    } catch {
      status.textContent = "Não foi possível salvar os cartões neste perfil.";
      return;
    }
    onSaved();
    dialog.close(dialogId);
  }

  search.addEventListener("input", renderModels);
  select.addEventListener("change", () => {
    selected = select.value;
    save.disabled = !selected;
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const model = catalog.find(item => key(item) === select.value);
    const cardName = name.value.trim();
    if (!model || !cardName) {
      status.textContent = "Preencha o nome e selecione um modelo.";
      return;
    }
    const all = portableReadCards();
    if ([...portableHomeCategories, ...all].some(card =>
      card.id !== existing?.id && card.title.toLocaleLowerCase("pt-BR") === cardName.toLocaleLowerCase("pt-BR"))) {
      status.textContent = "Já existe um cartão com esse nome.";
      return;
    }
    const card = {
      id: existing?.id ?? crypto.randomUUID(),
      title: cardName,
      modelName: model.name,
      model: { providerID: model.providerID, modelID: model.id },
    };
    persist(existing ? all.map(item => item.id === existing.id ? card : item) : [...all, card]);
  });
  if (existing) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remover cartão";
    remove.addEventListener("click", () => {
      if (remove.dataset.confirm === "true") {
        persist(portableReadCards().filter(card => card.id !== existing.id));
      } else {
        remove.dataset.confirm = "true";
        remove.textContent = "Confirmar remoção";
        status.textContent = "As conversas já abertas serão mantidas.";
      }
    });
    buttons.append(remove);
  }

  buttons.append(cancel, save);
  form.append(title, field("Nome do cartão", name), field("Buscar modelo", search), field("Modelo padrão", select), status, buttons);
  void dialog.show(() => I(OV, { fit: true, children: form }), undefined, dialogId);
  void portableCardCatalog(home).then(models => {
    catalog = models;
    renderModels();
    if (existing && !select.value) status.textContent = "O modelo salvo está indisponível. Selecione outro.";
  }).catch(() => {
    status.textContent = "Não foi possível carregar o catálogo. Feche e tente novamente.";
  });
}
