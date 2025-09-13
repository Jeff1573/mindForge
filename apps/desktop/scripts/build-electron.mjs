import { context } from 'esbuild';
import path from 'node:path';

const outdir = path.resolve(process.cwd(), 'dist-electron');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  logLevel: 'info',
  external: ['electron'],
  format: 'esm',
  define: {
    'process.env.NODE_ENV': '"development"',
  },
};

async function main() {
  const ctxMain = await context({
    entryPoints: [path.resolve(process.cwd(), 'electron', 'main.ts')],
    outfile: path.join(outdir, 'main.mjs'),
    ...common,
  });
  const ctxPreload = await context({
    entryPoints: [path.resolve(process.cwd(), 'electron', 'preload.ts')],
    outfile: path.join(outdir, 'preload.mjs'),
    ...common,
  });

  await Promise.all([ctxMain.watch(), ctxPreload.watch()]);
  console.log('[esbuild] watching electron main & preload (esm)...');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
