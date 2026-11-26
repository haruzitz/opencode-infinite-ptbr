const portableHomeCategories = [
  {
    id: "image",
    icon: "▧",
    title: "Geração de imagem",
    description: "Crie um prompt ou use uma imagem como referência.",
    modelName: "Nemotron Super VL Free",
    model: { providerID: "opencode", modelID: "nemotron-3.5-super-vl-free" },
    prompt: "Quero criar uma imagem no Bing Image Creator. Ajude a escrever o prompt com assunto, estilo e enquadramento. Minha ideia: ",
    service: { name: "Bing Image Creator", url: "https://www.bing.com/images/create/ai-image-generator" },
  },
  {
    id: "video",
    icon: "▷",
    title: "Geração de vídeo",
    description: "Planeje cenas, movimento de câmera e duração.",
    modelName: "Nemotron 3 Ultra Free",
    model: { providerID: "openrouter", modelID: "nvidia/nemotron-3-ultra-550b-a55b:free" },
    prompt: "Quero criar um vídeo no Runway. Ajude a montar um roteiro curto e um prompt por cena, com ação e movimento de câmera. Minha ideia: ",
    service: { name: "Runway", url: "https://app.runwayml.com/" },
  },
  {
    id: "code",
    icon: "‹/›",
    title: "Programação",
    description: "Crie uma função, corrija um erro ou escreva testes.",
    modelName: "DeepSeek V4.1 Flash Free",
    model: { providerID: "opencode", modelID: "deepseek-v4.1-flash-free" },
    prompt: "Quero trabalhar no projeto selecionado. Meu objetivo é: ",
  },
];

function portableHomeCategoryPanel(home, tabs, platform, dialog) {
  const panel = document.createElement("section");
  panel.className = "portable-home-categories";
  panel.setAttribute("aria-labelledby", "portable-home-title");

  const heading = document.createElement("h1");
  heading.id = "portable-home-title";
  heading.textContent = "O que vamos fazer hoje?";

  const grid = document.createElement("div");
  grid.className = "portable-category-grid";
  const status = document.createElement("p");
  status.className = "portable-category-status";
  status.setAttribute("role", "status");
  status.hidden = true;
  let opening = false;

  function renderCategory(category, custom) {
    const card = document.createElement("article");
    card.className = "portable-category";
    card.dataset.category = custom ? "custom" : category.id;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "portable-category-button";

    const icon = document.createElement("span");
    icon.className = "portable-category-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = category.icon ?? "◇";

    const title = document.createElement("span");
    title.className = "portable-category-title";
    title.textContent = category.title;

    const description = document.createElement("span");
    description.className = "portable-category-description";
    description.textContent = category.description ?? "";

    const model = document.createElement("span");
    model.className = "portable-category-model";
    model.textContent = category.modelName;
    button.append(icon, title);
    if (category.description) button.append(description);
    button.append(model);
    card.append(button);

    button.addEventListener("click", async () => {
      if (opening) return;
      const connection = home.server.focused();
      const project = home.project.newSession();
      if (!connection || !project) {
        status.textContent = "Escolha ou adicione um projeto para começar.";
        status.hidden = false;
        return;
      }

      opening = true;
      status.hidden = true;
      button.disabled = true;
      try {
        if (custom) {
          const catalog = await portableCardCatalog(home);
          if (!catalog.some(item => item.providerID === category.model.providerID && item.id === category.model.modelID)) {
            status.textContent = "O modelo deste cartão está indisponível. Edite o cartão para escolher outro.";
            status.hidden = false;
            return;
          }
        }
        home.server.context(connection)?.projects.touch(project.worktree);
        await tabs.newDraft(
          { server: MB.key(connection), directory: project.worktree },
          category.prompt,
          category.model,
        );
      } catch (error) {
        console.error("[portable-home]", error);
        status.textContent = "Não foi possível abrir a conversa. Tente de novo.";
        status.hidden = false;
      } finally {
        opening = false;
        button.disabled = false;
      }
    });

    if (category.service) {
      const link = document.createElement("a");
      link.className = "portable-category-link";
      link.href = category.service.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Abrir " + category.service.name + " ↗";
      link.addEventListener("click", event => {
        event.preventDefault();
        platform.openExternal(category.service.url);
      });
      card.append(link);
    }
    if (custom) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "portable-category-link";
      edit.textContent = "Editar";
      edit.setAttribute("aria-label", "Editar cartão " + category.title);
      edit.addEventListener("click", () => portableCardEditor(home, dialog, category, render));
      card.append(edit);
    }
    return card;
  }

  const add = document.createElement("button");
  add.type = "button";
  add.className = "portable-category portable-category-add";
  const plus = document.createElement("span");
  plus.textContent = "+";
  plus.setAttribute("aria-hidden", "true");
  const addLabel = document.createElement("span");
  addLabel.textContent = "Criar Card personalizado";
  add.append(plus, addLabel);
  add.addEventListener("click", () => portableCardEditor(home, dialog, undefined, render));

  function render() {
    grid.replaceChildren(
      ...portableHomeCategories.map(category => renderCategory(category, false)),
      ...portableReadCards().map(category => renderCategory(category, true)),
      add,
    );
  }
  function sync(event) {
    if (event.key === portableCardsKey || event.key === null) render();
  }
  window.addEventListener("storage", sync);
  F(() => window.removeEventListener("storage", sync));
  render();

  const style = document.createElement("style");
  style.textContent = portableHomeCategoryStyles;
  panel.append(style, heading, grid, status);
  return panel;
}
