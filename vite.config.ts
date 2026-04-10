import path from 'path';
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/main.tsx'],
            refresh: true,
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
                // OAuth (Socialite) phải là full navigation tới Laravel — không được serve shell SPA.
                navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
        },
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    server: {
        origin: 'http://localhost:5173',
        strictPort: true,
    },
});
