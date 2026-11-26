// Preserve the portable profile's state root through Desktop's Windows env init.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { SourceTextModule } = require('node:vm');
const [input, output] = process.argv.slice(2);
if (!input || !output || require('node:path').resolve(input) === require('node:path').resolve(output)) {
  throw new Error('Informe arquivos ASAR distintos de origem e destino.');
}
const source = fs.readFileSync(input);
const tree = JSON.parse(source.subarray(16, 16 + source.readUInt32LE(12)).toString());
const dataStart = 8 + source.readUInt32LE(4);
const original = 't?.XDG_STATE_HOME||delete process.env.XDG_STATE_HOME';
const replacement = 't?.XDG_STATE_HOME||process.env.OPENCODE_DESKTOP_TEST_ROOT||delete process.env.XDG_STATE_HOME';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function files(node, prefix = '') {
  return Object.entries(node.files).flatMap(([name, entry]) => entry.files
    ? files(entry, prefix + name + '/')
    : entry.offset === undefined ? [] : [{ name: prefix + name, entry }]);
}
let matched = 0, offset = 0;
const chunks = files(tree).sort((a, b) => Number(a.entry.offset) - Number(b.entry.offset)).map(({ name, entry }) => {
  let bytes = source.subarray(dataStart + Number(entry.offset), dataStart + Number(entry.offset) + entry.size);
  if (name === 'out/main/index.js') {
    const before = 'process.env.XDG_STATE_HOME=T.join(e,`state`)';
    const after = 'process.env.XDG_STATE_HOME=T.join(e,`home`,`.local`,`state`)';
    let text = bytes.toString();
    if (!text.includes(before) && !text.includes(after)) throw new Error('Raiz de estado portátil não reconhecida');
    if (text.includes(before)) {
      if (!entry.integrity || hash(bytes) !== entry.integrity.hash) throw new Error('Integridade inválida: ' + name);
      text = text.replace(before, after);
      new SourceTextModule(text);
      bytes = Buffer.from(text);
      const blockSize = entry.integrity.blockSize;
      const blocks = [];
      for (let i = 0; i < bytes.length; i += blockSize) blocks.push(hash(bytes.subarray(i, i + blockSize)));
      entry.integrity = { algorithm: 'SHA256', hash: hash(bytes), blockSize, blocks };
      entry.size = bytes.length;
    }
  }
  if (/^out\/main\/desktop-.*\.js$/.test(name)) {
    let text = bytes.toString();
    if (text.includes(original) || text.includes(replacement)) {
      matched++;
      if (!entry.integrity || hash(bytes) !== entry.integrity.hash) throw new Error('Integridade inválida: ' + name);
      if (text.includes(original)) {
        if (text.indexOf(original) !== text.lastIndexOf(original)) throw new Error('Trecho ambíguo');
        text = text.replace(original, replacement);
        new SourceTextModule(text);
        bytes = Buffer.from(text);
        const blockSize = entry.integrity.blockSize;
        const blocks = [];
        for (let i = 0; i < bytes.length; i += blockSize) blocks.push(hash(bytes.subarray(i, i + blockSize)));
        entry.integrity = { algorithm: 'SHA256', hash: hash(bytes), blockSize, blocks };
        entry.size = bytes.length;
      }
    }
  }
  entry.offset = String(offset);
  offset += bytes.length;
  return bytes;
});
if (matched !== 1) throw new Error('Inicialização de estado não encontrada ou ambígua.');
const json = Buffer.from(JSON.stringify(tree));
const padded = Math.ceil(json.length / 4) * 4;
const header = Buffer.alloc(16 + padded);
header.writeUInt32LE(4, 0);
header.writeUInt32LE(8 + padded, 4);
header.writeUInt32LE(4 + padded, 8);
header.writeUInt32LE(json.length, 12);
json.copy(header, 16);
const target = fs.openSync(output, 'wx');
try { for (const chunk of [header, ...chunks]) fs.writeFileSync(target, chunk); }
finally { fs.closeSync(target); }
console.log('Isolamento do serviço portátil corrigido.');
