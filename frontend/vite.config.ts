import path from 'path';
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const backendRoot = path.resolve(__dirname, '../backend');

export default defineConfig({
    envDir: backendRoot,
    css: {
        postcss: path.resolve(__dirname, 'postcss.config.cjs'),
    },
    plugins: [
        laravel({
            input: [path.join(__dirname, 'src/main.tsx')],
            // Plugin strips leading "/" — must be relative to frontend/ (Vite cwd).
            publicDirectory: '../backend/public',
            buildDirectory: 'build',
            refresh: [
                path.join(backendRoot, 'routes/**'),
                path.join(backendRoot, 'resources/views/**'),
            ],
        }),
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
                'placeholder.svg',
                'robots.txt',
                'pwa-192x192.png',
                'pwa-512x512.png',
            ],
            devOptions: {
                enabled: true,
            },
            manifest: {
                id: '/',
                name: 'SignalFeed',
                short_name: 'SignalFeed',
                description: 'Curated signal digest from trusted sources.',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait-primary',
                start_url: '/',
                scope: '/',
                lang: 'en',
                icons: [
                    {
                        src: '/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
                navigateFallback: '/',
                navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    server: {
        origin: 'http://localhost:5173',
        strictPort: true,
        fs: {
            allow: [backendRoot, path.resolve(__dirname)],
        },
    },
});
