let portableProviderLimit;

document.addEventListener("portable-provider-limit", event => {
  const delay = event.detail?.retryAfterMs;
  const retryAt = Number.isFinite(delay) && delay >= 0 && delay <= 45 * 86400000 ? Date.now() + delay : undefined;
  window.electron?.portableDiagnostics?.noteLimit(retryAt === undefined ? undefined : delay);
  portableProviderLimit = {retryAt, notice: true};
  document.dispatchEvent(new Event("portable-limit-notice-changed"));
});

function portableMountLimitNotice(button) {
  const indicator = document.createElement("span");
  indicator.textContent = " •";
  indicator.setAttribute("aria-hidden", "true");
  button.append(indicator);
  function update() {
    const notice = !!portableProviderLimit?.notice;
    indicator.hidden = !notice;
    button.setAttribute("aria-label", notice ? "Limpar aviso de limite recebido" : "Limpar aviso de limite");
  }
  update();
  document.addEventListener("portable-limit-notice-changed", update);
  F(() => document.removeEventListener("portable-limit-notice-changed", update));
}

function portableResetLocalLimit(dialog) {
  const message = portableProviderLimit?.notice ? "Aviso local limpo." : "Nenhum aviso local para limpar.";
  if (portableProviderLimit) {
    portableProviderLimit.notice = false;
    document.dispatchEvent(new Event("portable-limit-notice-changed"));
  }
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
  description.textContent = "O provedor define a cota e o horário de renovação. O WARP atua na conexão de rede.";
  panel.append(description);
  if (portableProviderLimit) {
    const status = document.createElement("p");
    const {retryAt} = portableProviderLimit;
    if (retryAt === undefined) {
      status.textContent = "O último aviso do provedor veio sem um horário de nova tentativa.";
    } else {
      const formatted = new Intl.DateTimeFormat("pt-BR", {dateStyle: "short", timeStyle: "short"}).format(retryAt);
      status.textContent = retryAt > Date.now()
        ? "Horário de renovação informado pelo provedor · " + formatted
        : "O horário informado já passou. Você pode tentar enviar uma nova mensagem.";
    }
    panel.append(status);
  }
  void dialog.show(() => I(OV, {title: "Limites de uso", fit: true, children: panel}));
}
