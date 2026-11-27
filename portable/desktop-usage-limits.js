let portableProviderLimit;

document.addEventListener("portable-provider-limit", event => {
  const delay = event.detail?.retryAfterMs;
  const retryAt = Number.isFinite(delay) && delay >= 0 && delay <= 45 * 86400000 ? Date.now() + delay : undefined;
  portableProviderLimit = {retryAt};
});

function portableResetLocalLimit(dialog) {
  if (portableProviderLimit?.retryAt > Date.now()) {
    portableShowUsageLimits(dialog, "Ainda há um prazo ativo informado pelo provedor.");
    return;
  }
  const message = portableProviderLimit ? "Aviso local de limite limpo." : "Nenhum aviso local para limpar.";
  portableProviderLimit = undefined;
  portableShowUsageLimits(dialog, message);
}

function portableShowUsageLimits(dialog, message) {
  const panel = document.createElement("div");
  panel.style.cssText = "padding:0 16px 16px;max-width:440px;display:grid;gap:10px;line-height:1.55";
  if (message) {
    const feedback = document.createElement("p");
    feedback.setAttribute("role", "status");
    feedback.textContent = message;
    panel.append(feedback);
  }
  const description = document.createElement("p");
  description.textContent = "Os provedores definem as cotas dos modelos gratuitos. Confira o aviso na conversa para ver o prazo informado pelo provedor.";
  panel.append(description);
  if (portableProviderLimit) {
    const status = document.createElement("p");
    const {retryAt} = portableProviderLimit;
    if (retryAt === undefined) {
      status.textContent = "O último aviso de limite veio sem um horário de nova tentativa.";
    } else {
      const formatted = new Intl.DateTimeFormat("pt-BR", {dateStyle: "short", timeStyle: "short"}).format(retryAt);
      status.textContent = retryAt > Date.now()
        ? "Último prazo informado pelo provedor · " + formatted
        : "O horário informado já passou. Você pode tentar enviar uma nova mensagem.";
    }
    panel.append(status);
  }
  void dialog.show(() => I(OV, {title: "Limites de uso", fit: true, children: panel}));
}
