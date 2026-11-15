import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/**
 * Emits sw.js with a precache list of every built file and public asset, so
 * the app works offline after its first load.
 */
function serviceWorker(): Plugin {
  return {
    name: 'familiar-place-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicDir = join(process.cwd(), 'public');
      const publicFiles = listFiles(publicDir).map((f) => relative(publicDir, f).split(sep).join('/'));
      const files = ['./', 'index.html', ...Object.keys(bundle), ...publicFiles]
        .filter((f) => !f.endsWith('.map'))
        .map((f) => (f === './' ? f : `./${f}`));
      const unique = Array.from(new Set(files)).sort();
      const template = readFileSync(join(process.cwd(), 'sw-template.js'), 'utf8');
      // Built files are already content-hashed; public files and the worker's
      // own code are hashed here so any change produces a new cache version.
      const hash = createHash('sha256').update(unique.join('\n')).update(template);
      for (const f of listFiles(publicDir)) hash.update(readFileSync(f));
      const version = hash.digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(unique, null, 2)),
      });
    },
  };
}

/**
 * `npm run dev:phone` serves over https on the home network, so a phone can
 * open the app. Phones only allow the microphone and PIN encryption on https.
 * The certificate is self-signed (see README), so the phone shows a warning once.
 */
function phoneServer() {
  const key = '.cert/key.pem';
  const cert = '.cert/cert.pem';
  if (!existsSync(key) || !existsSync(cert)) {
    throw new Error('No dev certificate in .cert/. Create one with the openssl command in README.md, then try again.');
  }
  return { host: true, port: 5174, strictPort: true, https: { key: readFileSync(key), cert: readFileSync(cert) } };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), serviceWorker()],
  server:
    mode === 'phone'
      ? phoneServer()
      : {
          port: 5173,
          strictPort: true,
        },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Whole-app flows tap the keypad dozens of times and hash real PINs.
    testTimeout: 20_000,
  },
}));
