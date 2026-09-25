import { defineConfig } from 'vite';
// Relative base so the build works from any folder or static host.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1500 } });
