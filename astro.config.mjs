import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

// Server-side rendering: every page is complete HTML, readable without JavaScript.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 3000 },
  security: { checkOrigin: true },
  devToolbar: { enabled: false },
});
