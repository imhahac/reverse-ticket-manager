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

import { CONFIG } from './constants/config.js'
import { validateEnv } from './config/env.js'
import { AlertCircle, Terminal, HelpCircle } from 'lucide-react'

/** 
 * 啟動前環境驗證 
 * 返還結果對象 { valid: boolean, errors: string[] }
 */
const envStatus = validateEnv();

/** 
 * 緊急配置錯誤畫面 (Blocking UI) 
 * 當核心環境變數缺失時，阻止應用程式啟動以確保安全性。
 */
const ConfigErrorScreen = ({ errors }) => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="max-w-2xl w-full bg-slate-800 border border-red-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <AlertCircle size={120} className="text-red-500" />
            </div>
            
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-red-500/20 rounded-2xl">
                        <AlertCircle className="text-red-500 w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">啟動攔截：環境配置錯誤</h1>
                        <p className="text-slate-400 text-sm">Environment Configuration Failed</p>
                    </div>
                </div>

                <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700 mb-8">
                    <div className="flex items-center gap-2 mb-4 text-slate-300 font-bold text-xs uppercase tracking-widest">
                        <Terminal size={14} /> 偵測到的問題項目
                    </div>
                    <ul className="space-y-3">
                        {errors.map((err, i) => (
                            <li key={i} className="flex items-start gap-3 text-red-400 text-sm leading-relaxed">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                {err}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="space-y-4">
                    <p className="text-slate-300 text-sm leading-relaxed">
                        本應用程式為 100% Client-Side 運作，所有功能皆需在編譯期注入正確的 API 金鑰。請檢查您的 <code className="bg-slate-700 px-1.5 py-0.5 rounded text-indigo-300">.env</code> 檔案或 GitHub Secrets 設定。
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <a 
                            href="https://github.com/imhahac/reverse-ticket-manager#deployment" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                        >
                            <HelpCircle size={18} /> 查看部署指南 (README)
                        </a>
                        <button 
                            onClick={() => window.location.reload()}
                            className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 px-6 rounded-xl transition-all"
                        >
                            重新整理頁面
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

const clientId = CONFIG.googleClientId;

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {!envStatus.valid ? (
            <ConfigErrorScreen errors={envStatus.errors} />
        ) : (
            <GoogleOAuthProvider clientId={clientId}>
                <ErrorBoundary>
                    <App />
                </ErrorBoundary>
                <Toaster position="top-right" richColors closeButton duration={4000} />
            </GoogleOAuthProvider>
        )}
    </React.StrictMode>,
)
