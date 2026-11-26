import { realpathSync as portableLibraryRealPath, statSync as portableLibraryStat } from "node:fs";
import { shell as portableLibraryShell } from "electron";
async function portableLibraryDatabase(run) {
  const { DatabaseSync } = await import("node:sqlite");
  const root = portableGitPath.resolve(process.resourcesPath, "..", "..", "..");
  const database = new DatabaseSync(portableGitPath.join(root, "profile", "data", "opencode", "opencode.db"), { readOnly: true });
  try { return run(database); } finally { database.close(); }
}

function portableLibraryRegister() {
  const handle = (channel, run) => portableGithubIpc.handle(channel, (event, ...args) => {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame || frame.url.split(/[?#]/)[0] !== "oc://renderer/index.html") return null;
    return portableLibraryDatabase(database => run(database, ...args));
  });

  handle("portable:library-list", database => database.prepare(
    "SELECT b.hash, b.mime, b.bytes, s.title, s.id AS sessionId, m.id AS messageId, (SELECT u.id FROM session_message u WHERE u.session_id=s.id AND u.type='user' AND u.seq<=m.seq ORDER BY u.seq DESC LIMIT 1) AS turnId, m.time_created AS saved, m.data " +
    "FROM blob_ref r JOIN blob b ON b.hash=r.hash JOIN session_v2 s ON s.id=r.session_id " +
    "JOIN session_message m ON m.id=r.message_id ORDER BY saved DESC"
  ).all().map(({data, ...record}) => {
    const message = JSON.parse(data);
    const parts = [...(message.files ?? []), ...(message.content ?? []).flatMap(part => part.state?.content ?? [part])];
    const attachment = parts.find(part => part.uri === "media:" + record.hash);
    const tool = message.content?.find(part => part.type === "tool" && part.state?.content?.some(file => file.uri === "media:" + record.hash));
    return { ...record, messageId: record.turnId ?? record.messageId, partId: tool?.id, name: attachment?.name ? portableGitPath.basename(attachment.name) : record.hash.slice(0, 12) + "." + record.mime.split("/")[1] };
  }));

  const files = database => {
    const found = new Map();
    const rows = database.prepare(
      "SELECT m.data, s.id AS sessionId, m.id AS messageId, (SELECT u.id FROM session_message u WHERE u.session_id=s.id AND u.type='user' AND u.seq<=m.seq ORDER BY u.seq DESC LIMIT 1) AS turnId, m.time_created AS saved, s.title, s.directory FROM session_message m " +
      "JOIN session_v2 s ON s.id=m.session_id WHERE m.type='assistant' AND m.data LIKE '%\"write\"%' ORDER BY saved DESC"
    ).iterate();
    for (const row of rows) {
      for (const part of JSON.parse(row.data).content ?? []) {
        if (part.type !== "tool" || part.name !== "write" || part.state?.status !== "completed") continue;
        const path = part.state.input?.path;
        if (typeof path !== "string") continue;
        try {
          const directory = portableLibraryRealPath(row.directory);
          const target = portableLibraryRealPath(portableGitPath.resolve(directory, path));
          const relative = portableGitPath.relative(directory, target);
          if (!relative || relative.startsWith("..") || portableGitPath.isAbsolute(relative) ||
              relative.split(portableGitPath.sep).some(segment => segment.startsWith(".")) ||
              found.has(target) || !portableLibraryStat(target).isFile()) continue;
          found.set(target, { path: target, name: portableGitPath.basename(target), saved: row.saved, title: row.title, sessionId: row.sessionId, messageId: row.turnId ?? row.messageId, partId: part.id });
        } catch {}
      }
    }
    return found;
  };
  handle("portable:library-files", database => [...files(database).values()]);
  handle("portable:library-reveal", (database, path) => {
    if (typeof path !== "string" || !files(database).has(path)) return false;
    portableLibraryShell.showItemInFolder(path);
    return true;
  });

  handle("portable:library-blob", (database, hash) => {
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) return null;
    return database.prepare("SELECT data FROM blob WHERE hash=? AND bytes<=? AND EXISTS (SELECT 1 FROM blob_ref WHERE hash=?)")
      .get(hash, 128 * 1024 * 1024, hash)?.data ?? null;
  });
}

portableLibraryRegister();
