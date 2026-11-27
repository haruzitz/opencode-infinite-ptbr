const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "desktop-diagnostics.js"), "utf8")
  .replace(/^import .*;\r?$/gm, "");
const context = vm.createContext({
  portableDiagnosticsIpc: {on() {}},
  portableDiagnosticsDialog: {async showSaveDialog() { return {canceled: true}; }},
});
vm.runInContext(source, context);

test("relatório emite categorias fixas mesmo com segredos desconhecidos no log", () => {
  const lines = [
    "ERROR 2026-11-27T20:00:00Z HTTP 429 Authorization: Bearer segredo-original",
    '[2026-11-27 17:00:01.023] [error] ECONNREFUSED https://teste.example/?access_token=token-de-teste',
    "WARN 2026-11-27T20:00:02Z pedido do usuário: conversa privada 123",
    "Cookie: sid=um-cookie; usuário@example.test",
  ];
  const output = context.portableSummarizeDiagnosticLog(lines.join("\n")).join("\n");
  assert.match(output, /HTTP 429/);
  assert.match(output, /ECONNREFUSED/);
  assert.match(output, /Evento sem classificação/);
  for (const secret of ["segredo-original", "token-de-teste", "conversa privada", "um-cookie", "example"]) {
    assert.ok(!output.includes(secret));
  }
});

test("exporta no máximo 25 ocorrências de cada log", () => {
  const lines = Array.from({length: 35}, () => "ERROR 2026-11-27T20:00:00Z ECONNREFUSED");
  assert.equal(context.portableSummarizeDiagnosticLog(lines.join("\n")).length, 25);
});

test("cancelar a janela não coleta nem grava o relatório", async () => {
  assert.equal(await context.portableExportDiagnostics(), "");
});
