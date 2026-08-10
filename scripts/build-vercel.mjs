import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

/**
 * Produces .vercel/output directly, rather than letting Vercel's own Node builder work
 * out how to package the functions.
 *
 * That builder compiles the entry file and then traces its imports with @vercel/nft to
 * decide what else to ship. It cannot parse our entry files at all: they are TypeScript,
 * and the trace stops at the first `import type` with "Unexpected token (1:12)". The
 * function reached production carrying none of the code it imports, and every request
 * died with ERR_MODULE_NOT_FOUND on apps/collector/src/api/handlers.ts.
 *
 * esbuild reads TypeScript correctly and inlines everything each function needs, so
 * there is nothing left to trace. The repo keeps its no-build-step stack: this bundles
 * for the serverless runtime only, and nothing else in the project goes through it.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, '.vercel/output');

/** Vercel's own runtime, matching what the platform reports at /api/health. */
const RUNTIME = 'nodejs24.x';

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

/**
 * The sources live in server/ rather than api/ because a top-level api/ directory is
 * detected by Vercel's zero-config builders, which then package those files themselves
 * and override what this script produced. The route each one serves is still /api/...
 */
const functionsDir = join(root, 'server');

/** Every .ts file under server/ is one function, at the path its name spells out. */
function findFunctions(dir = functionsDir) {
  const found = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findFunctions(path));
    else if (entry.name.endsWith('.ts')) found.push(path);
  }

  return found;
}

async function buildFunction(source) {
  // server/offers/[id].ts becomes functions/api/offers/[id].func
  const route = join('api', relative(functionsDir, source).replace(/\.ts$/, ''));
  const funcDir = join(outputDir, 'functions', `${route}.func`);
  mkdirSync(funcDir, { recursive: true });

  await build({
    entryPoints: [source],
    outfile: join(funcDir, 'index.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    // Types only, erased before anything is emitted.
    external: ['@vercel/node'],
    logLevel: 'warning',
  });

  writeFileSync(
    join(funcDir, '.vc-config.json'),
    `${JSON.stringify(
      {
        runtime: RUNTIME,
        handler: 'index.mjs',
        launcherType: 'Nodejs',
        // Gives the handler request.query, request.body and response.json.
        shouldAddHelpers: true,
      },
      null,
      2,
    )}\n`,
  );

  return route;
}

rmSync(outputDir, { recursive: true, force: true });

run('pnpm', ['--filter', '@flatradar/web', 'build']);
cpSync(join(root, 'apps/web/dist'), join(outputDir, 'static'), { recursive: true });

const routes = [];
for (const source of findFunctions()) routes.push(await buildFunction(source));

writeFileSync(
  join(outputDir, 'config.json'),
  `${JSON.stringify(
    {
      version: 3,
      routes: [
        // Static files and the functions whose path is spelled out exactly.
        { handle: 'filesystem' },
        // The one route with a segment in it, which no file name can match on its own.
        { src: '^/api/offers/([^/]+)$', dest: '/api/offers/[id]?id=$1' },
        // An unknown /api path is a missing endpoint, not the dashboard.
        { src: '^/api/.*', status: 404 },
        // Everything else is the single page app.
        { src: '/.*', dest: '/index.html' },
      ],
    },
    null,
    2,
  )}\n`,
);

console.log(`Built ${routes.length} functions: ${routes.join(', ')}`);
