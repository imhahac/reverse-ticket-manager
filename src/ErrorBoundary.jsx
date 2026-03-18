import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen p-8 flex items-center justify-center bg-slate-50" style={{ fontFamily: 'sans-serif' }}>
            <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-xl border border-red-100 text-center" style={{ boxSizing: 'border-box' }}>
                <div className="text-5xl mb-4">😵</div>
                <h1 className="text-xl font-bold text-slate-800 mb-2" style={{ color: '#1e293b' }}>畫面渲染失敗</h1>
                <p className="text-sm text-slate-500 mb-6" style={{ color: '#64748b' }}>
                    發生了無法預期的渲染錯誤。這通常是特定行程資料格式不完整導致。
                </p>
                <div className="bg-red-50 p-3 rounded-lg mb-6 text-left max-h-40 overflow-y-auto" style={{ backgroundColor: '#fef2f2', padding: '12px' }}>
                    <p className="text-xs font-mono text-red-600 break-all leading-tight">
                        {this.state.error && this.state.error.toString()}
                    </p>
                    {this.state.errorInfo && (
                        <pre className="text-[10px] text-red-400 mt-2 whitespace-pre-wrap">
                            {this.state.errorInfo.componentStack}
                        </pre>
                    )}
                </div>
                <div className="flex flex-col gap-3" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition"
                        style={{ padding: '12px', backgroundColor: '#4f46e5', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                    >
                        重新整理網頁
                    </button>
                    <button 
                        onClick={() => {
                            if (confirm('確定要清除所有本地資料嗎？這將無法復原（除非有雲端備份）。')) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }} 
                        className="w-full py-3 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition"
                        style={{ padding: '12px', backgroundColor: 'white', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        ⚠️ 強制清除資料並重設
                    </button>
                </div>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}
