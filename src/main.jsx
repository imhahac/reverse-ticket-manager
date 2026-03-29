import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Toaster, toast } from 'sonner'
import App from './App.jsx'
import './index.css'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
    onNeedRefresh() {
        toast('有新版本的 PWA 可用！', {
            action: { label: '更新', onClick: () => updateSW(true) },
            duration: Infinity
        });
    },
    onOfflineReady() {
        toast.success('App 已可於離線狀態下使用');
    },
});

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy_client_id.apps.googleusercontent.com';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={clientId}>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
            <Toaster position="top-right" richColors closeButton duration={4000} />
        </GoogleOAuthProvider>
    </React.StrictMode>,
)
