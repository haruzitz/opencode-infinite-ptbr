const fs = require('node:fs');
const buffer = fs.readFileSync(process.argv[2]);
const tree = JSON.parse(buffer.subarray(16, 16 + buffer.readUInt32LE(12)).toString());
const start = 8 + buffer.readUInt32LE(4);
function read(filename) {
  let entry = tree;
  for (const name of filename.split('/')) entry = entry.files[name];
  return buffer.subarray(start + Number(entry.offset), start + Number(entry.offset) + entry.size).toString();
}
const main = read('out/main/index.js');
const rendererFiles = tree.files.out.files.renderer.files.assets.files;
const name = Object.keys(rendererFiles).find(name => /^main-.*\.js$/.test(name));
const renderer = read('out/renderer/assets/' + name);
for (const marker of ['portableHomeCategoryPanel', 'portableGithubButton']) {
  if (!renderer.includes(marker)) throw new Error('Personalização ausente: ' + marker);
}
if (!renderer.includes('portableSidebarTools') && !renderer.includes('portableSidebarNavigation')) throw new Error('Barra lateral personalizada ausente');
if (!main.includes('portableGithubRegister')) throw new Error('Integração GitHub ausente');
console.log('Aplicativo personalizado validado.');
