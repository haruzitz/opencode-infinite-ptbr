const portableProjectBridge = {
  pending: [],
  listener: false,
  running: false,
  open: undefined,
};

function portableProjectInstall(global, serverRegistry, tabs) {
  const bridge = portableProjectBridge;
  bridge.open = async directory => {
    const localUrl = serverRegistry.ownUrl();
    if (!localUrl) return false;
    const connection = global.servers.list().find(server => MB.local(server, localUrl));
    if (!connection) return false;
    const key = MB.key(connection);
    const context = global.serverCtx(key);
    if (!context) return false;

    await context.projects.add(directory);
    context.projects.touch(directory);
    await tabs.newDraft({ server: key, directory });
    return true;
  };

  async function flush() {
    if (bridge.running) return;
    bridge.running = true;
    try {
      while (bridge.pending.length) {
        const directory = bridge.pending.shift();
        let opened = false;
        for (let attempt = 0; attempt < 40 && !opened; attempt++) {
          opened = await bridge.open(directory);
          if (!opened) await new Promise(resolve => setTimeout(resolve, 250));
        }
        if (!opened) throw new Error("O servidor local do OpenCode não está disponível.");
      }
    } catch (error) {
      console.error("[portable-project]", error);
    } finally {
      bridge.running = false;
      if (bridge.pending.length) void flush();
    }
  }

  function receive() {
    const state = window.__OPENCODE__;
    if (!state?.deepLinks?.length) return;
    const prefix = "portable-project:";
    const messages = state.deepLinks.filter(link => link.startsWith(prefix));
    state.deepLinks = state.deepLinks.filter(link => !link.startsWith(prefix));
    for (const message of messages) {
      bridge.pending.push(decodeURIComponent(message.slice(prefix.length)));
    }
    if (messages.length) void flush();
  }

  if (!bridge.listener) {
    window.addEventListener("opencode:deep-link", receive);
    bridge.listener = true;
  }
  receive();
}
