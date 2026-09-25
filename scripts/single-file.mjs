// Builds Valkimsmor.html: the whole game in one file you can open by double-clicking (no server).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

let html = readFileSync('dist/index.html', 'utf8');
const assets = readdirSync('dist/assets');
for (const f of assets) {
  const code = readFileSync(`dist/assets/${f}`, 'utf8');
  if (f.endsWith('.js')) {
    const safe = code.replace(/<\/script/gi, '<\\/script');
    html = html.replace(new RegExp(`<script type="module" crossorigin src="\\./assets/${f.replace('.', '\\.')}"></script>`), () => '');
    // Run the game after the page's HTML exists.
    html = html.replace('</body>', () => `<script type="module">\n${safe}\n</script>\n</body>`);
  } else if (f.endsWith('.css')) {
    html = html.replace(new RegExp(`<link rel="stylesheet" crossorigin href="\\./assets/${f.replace('.', '\\.')}">`), () => `<style>\n${code}\n</style>`);
  }
}
if (/\.\/assets\//.test(html)) throw new Error('An asset was not inlined');
writeFileSync('Valkimsmor.html', html);
console.log(`Valkimsmor.html written (${(html.length / 1024).toFixed(0)} KB)`);
