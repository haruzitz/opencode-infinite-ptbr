// This marker is internal IPC. Only a local command-line argument can produce it.
const portableProjectArgument = "--portable-project=";
const portableProjectMessage = "portable-project:";

function portableProjectLinks(argv) {
  const argument = argv.find(value => value.startsWith(portableProjectArgument));
  if (!argument) return [];
  const payload = argument.slice(portableProjectArgument.length);
  if (!/^[A-Za-z0-9_-]{1,30000}$/.test(payload)) return [];

  try {
    const directory = Buffer.from(payload, "base64url").toString("utf8");
    if (!portableProjectIsAbsolute(directory)) return [];
    if (!portableProjectStat(directory, { throwIfNoEntry: false })?.isDirectory()) return [];
    return [portableProjectMessage + encodeURIComponent(directory)];
  } catch {
    return [];
  }
}
