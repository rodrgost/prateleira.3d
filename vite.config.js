import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api/tripo': {
                target: 'https://openapi.tripo3d.ai',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/tripo/, '/v3'),
            },
            '/api/tripo-v2': {
                target: 'https://openapi.tripo3d.ai',
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api\/tripo-v2/, '/v2/openapi'),
            },
        },
    },
});
