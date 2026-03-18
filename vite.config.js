import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    // 記得將 'reverse-ticket-manager' 換成你實際的 GitHub Repository 名稱
    base: '/reverse-ticket-manager/',
    build: {
        target: 'es2015',
    }
})