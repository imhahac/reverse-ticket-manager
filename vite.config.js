import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            manifest: {
                name: 'Reverse Ticket Manager',
                short_name: 'Tickets',
                description: 'Flight and Hotel Itinerary Management',
                theme_color: '#4f46e5',
                background_color: '#ffffff',
                display: 'standalone',
                icons: [
                    // A placeholder icon requires to be placed in public folder manually later
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] }
                        }
                    }
                ]
            }
        })
    ],
    // 記得將 'reverse-ticket-manager' 換成你實際的 GitHub Repository 名稱
    base: '/reverse-ticket-manager/',
    build: {
        target: 'es2015',
    },
    test: {
        environment: 'jsdom',
        globals: true
    }
})