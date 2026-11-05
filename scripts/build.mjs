// Build de Dovela v2: un único main.js (CJS) + styles.css concatenado desde src/styles.
import esbuild from 'esbuild';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const prod = process.argv[2] === 'production';

function buildCss() {
  const dir = 'src/styles';
  const files = readdirSync(dir).filter((f) => f.endsWith('.css')).sort();
  const css = files.map((f) => `/* ${f} */\n${readFileSync(join(dir, f), 'utf8')}`).join('\n');
  writeFileSync('styles.css', css);
}

const external = [
  'obsidian', 'electron',
  '@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands', '@codemirror/language',
  '@codemirror/lint', '@codemirror/search', '@codemirror/state', '@codemirror/view',
  '@lezer/common', '@lezer/highlight', '@lezer/lr',
];

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external,
  format: 'cjs',
  target: 'es2021',
  platform: 'browser',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  minify: prod,
  legalComments: 'none',
  outfile: 'main.js',
  define: { DOVELA_DEV: prod ? 'false' : 'true' },
});

buildCss();
if (prod) {
  await ctx.rebuild();
  await ctx.dispose();
  const size = statSync('main.js').size;
  console.log(`main.js: ${(size / 1024).toFixed(1)} KB`);
} else {
  await ctx.watch();
}
