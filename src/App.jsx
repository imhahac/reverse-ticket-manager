import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { Plane, Calendar, Trash2, ArrowRight, BookOpen, AlertCircle, CheckCircle2, ListFilter, Download, Upload, Cloud, CloudUpload, CloudDownload, LogOut, LogIn } from 'lucide-react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { syncToDrive, loadFromDrive, syncToCalendar } from './utils/googleSync';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTrips } from './hooks/useTrips';

import Instructions from './components/Instructions';
import TicketForm from './components/TicketForm';
import TicketList from './components/TicketList';
import TripTimeline from './components/TripTimeline';
import TripCalendar from './components/TripCalendar';

// 匯率 fallback（當 API 無法取用時使用）
const DEFAULT_RATES = { JPY: 0.21, USD: 32.5 };

function App() {
    const [tickets, setTickets] = useLocalStorage('reverse-tickets', []);
    const [tripLabels, setTripLabels] = useLocalStorage('reverse-trip-labels', {});
    const [accessToken, setAccessToken] = useLocalStorage('google-access-token', null);
    const [activeTab, setActiveTab] = useState('timeline');
    const [isSyncing, setIsSyncing] = useState(false);
    const [exchangeRates, setExchangeRates] = useState(DEFAULT_RATES);
    const fileInputRef = useRef(null);

    const [editingTicket, setEditingTicket] = useState(null);

    // Calculate smart groupings via custom hook
    const { segments, trips } = useTrips(tickets);

    // ── 動態即時匯率 ──────────────────────────────────────────────────
    useEffect(() => {
        fetch('https://api.exchangerate-api.com/v4/latest/TWD')
            .then(r => r.json())
            .then(data => {
                if (data?.rates) {
                    // data.rates.JPY = 幾 JPY 換 1 TWD → 1 JPY = 1/rates.JPY TWD
                    const jpyRate = data.rates.JPY ? parseFloat((1 / data.rates.JPY).toFixed(4)) : DEFAULT_RATES.JPY;
                    // data.rates.USD = 幾 USD 換 1 TWD → 1 USD = 1/rates.USD TWD
                    const usdRate = data.rates.USD ? parseFloat((1 / data.rates.USD).toFixed(2)) : DEFAULT_RATES.USD;
                    setExchangeRates({ JPY: jpyRate, USD: usdRate });
                }
            })
            .catch(() => {
                // silently fallback to defaults
            });
    }, []);
    // ──────────────────────────────────────────────────────────────────

    const handleSaveTicket = (ticket) => {
        if (editingTicket) {
            setTickets(tickets.map(t => t.id === ticket.id ? ticket : t));
            setEditingTicket(null);
        } else {
            setTickets([...tickets, ticket]);
        }
    };

    const handleEditTicket = (ticket) => {
        setEditingTicket(ticket);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingTicket(null);
    };

    const deleteTicket = (id) => {
        toast('確定要刪除這筆機票訂單嗎？', {
            description: '相關的趟次配對將會被移除。',
            action: {
                label: '確認刪除',
                onClick: () => setTickets(tickets.filter(t => t.id !== id)),
            },
            cancel: {
                label: '取消',
                onClick: () => {},
            },
            duration: 8000,
        });
    };

    const updateLabel = (comboKey, name) => {
        if (!name) {
            const newLabels = { ...tripLabels };
            delete newLabels[comboKey];
            setTripLabels(newLabels);
        } else {
            setTripLabels({ ...tripLabels, [comboKey]: name });
        }
    };

    const handleExport = () => {
        const dataToExport = { tickets, tripLabels };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reverse-tickets-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                let newTickets = [];
                let newLabels = {};

                if (Array.isArray(importedData)) {
                    newTickets = importedData;
                } else if (importedData.tickets && Array.isArray(importedData.tickets)) {
                    newTickets = importedData.tickets;
                    newLabels = importedData.tripLabels || {};
                } else {
                    throw new Error('Invalid format');
                }

                if (newTickets.length > 0 && !newTickets[0].id) {
                    throw new Error('Invalid format');
                }

                toast(`成功讀取 ${newTickets.length} 筆機票資料`, {
                    description: '確認後將覆寫目前所有訂單。',
                    action: {
                        label: '確認覆寫',
                        onClick: () => {
                            setTickets(newTickets);
                            setTripLabels(newLabels);
                            toast.success('匯入成功！');
                        },
                    },
                    cancel: {
                        label: '取消',
                        onClick: () => {},
                    },
                    duration: 10000,
                });
            } catch (err) {
                toast.error('匯入失敗', { description: '檔案格式錯誤或損毀，請確認 JSON 結構正確。' });
                console.error(err);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    const login = useGoogleLogin({
        onSuccess: (codeResponse) => {
            setAccessToken(codeResponse.access_token);
            toast.success('Google 登入成功！');
        },
        onError: (error) => {
            console.error('Login Failed:', error);
            toast.error('Google 登入失敗', {
                description: `錯誤訊息: ${error?.error_description || error?.error || '未知錯誤'}。請確認 Client ID 與已授權的 JavaScript 來源。`,
                duration: 8000,
            });
        },
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events'
    });

    const logout = () => {
        googleLogout();
        setAccessToken(null);
    };

    const handleSyncToDrive = async () => {
        if (!accessToken) return toast.error('請先登入 Google');
        setIsSyncing(true);
        const toastId = toast.loading('正在備份至 Google Drive…');
        const res = await syncToDrive(tickets, tripLabels, accessToken);
        setIsSyncing(false);
        if (res.success) {
            toast.success('雲端備份成功！', {
                id: toastId,
                description: `資料已備份至 Google Drive。(檔案 ID: ${res.fileId})`,
            });
        } else {
            if (res.expired) {
                toast.error('登入已過期，請重新登入 Google', { id: toastId });
                logout();
            } else {
                toast.error('雲端備份失敗', { id: toastId, description: res.error });
            }
        }
    };

    const handleLoadFromDrive = async () => {
        if (!accessToken) return toast.error('請先登入 Google');
        setIsSyncing(true);
        const toastId = toast.loading('正在從 Google Drive 載入…');
        const res = await loadFromDrive(accessToken);
        setIsSyncing(false);
        
        if (res.success) {
            toast.dismiss(toastId);
            toast(`雲端讀取成功，共 ${res.tickets.length} 筆趟次`, {
                description: `找到的檔案：${res.foundFilesLog}`,
                action: {
                    label: '確認覆寫',
                    onClick: () => {
                        setTickets(res.tickets);
                        setTripLabels(res.tripLabels || {});
                        toast.success('雲端資料載入成功！');
                    },
                },
                cancel: {
                    label: '取消',
                    onClick: () => {},
                },
                duration: 12000,
            });
        } else {
            if (res.expired) {
                toast.error('登入已過期，請重新登入 Google', { id: toastId });
                logout();
            } else {
                toast.error('雲端載入失敗', { id: toastId, description: res.error });
            }
        }
    };

    const handleSyncToCalendar = async () => {
        if (!accessToken) return toast.error('請先登入 Google');
        setIsSyncing(true);
        const toastId = toast.loading('正在同步至 Google Calendar…');
        const res = await syncToCalendar(tickets, accessToken);
        setIsSyncing(false);
        if (res.success) {
            if (res.updatedCalendarIds && Object.keys(res.updatedCalendarIds).length > 0) {
                const newTickets = tickets.map(t => {
                    if (res.updatedCalendarIds[t.id]) {
                        return { ...t, calendarIds: { ...(t.calendarIds || {}), ...res.updatedCalendarIds[t.id] } };
                    }
                    return t;
                });
                setTickets(newTickets);
            }
            const deletedNote = res.deletedCount > 0 ? `，已自動清除 ${res.deletedCount} 個廢棄事件` : '';
            toast.success('日曆同步成功！', {
                id: toastId,
                description: `共同步 ${res.count} 個航班事件${deletedNote}。${res.error ? `\n⚠️ 部分警告：${res.error}` : ''}`,
                duration: 6000,
            });
        } else {
            toast.error('日曆同步失敗', {
                id: toastId,
                description: res.error || 'Access Token 可能已過期，請重新登入。',
            });
            logout();
        }
    };

    const totalPriceTWD = tickets.reduce((sum, t) => sum + (t.priceTWD || t.price), 0);

    return (
        <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <div className="max-w-5xl mx-auto">

                <header className="mb-8 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight flex items-center">
                            <Plane className="w-8 h-8 mr-3 text-indigo-600" /> 航班反向票管理系統
                        </h1>
                        <p className="text-slate-500 text-lg">解決來回機票分段購買時，出發方向與日期混淆的問題。</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                        {accessToken ? (
                            <div className="flex flex-wrap gap-2 justify-end bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                                <span className="flex items-center text-xs font-bold text-indigo-600 w-full mb-1"><Cloud className="w-3 h-3 mr-1" /> 已連結 Google (Drive & Calendar)</span>
                                <button
                                    onClick={handleSyncToDrive} disabled={isSyncing}
                                    className="flex items-center px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-bold text-sm rounded shadow-sm hover:bg-indigo-50 transition min-w-[120px] justify-center disabled:opacity-50"
                                >
                                    <CloudUpload className="w-4 h-4 mr-1.5" /> 雲端備份
                                </button>
                                <button
                                    onClick={handleLoadFromDrive} disabled={isSyncing}
                                    className="flex items-center px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-bold text-sm rounded shadow-sm hover:bg-indigo-50 transition min-w-[120px] justify-center disabled:opacity-50"
                                >
                                    <CloudDownload className="w-4 h-4 mr-1.5" /> 雲端載入
                                </button>
                                <button
                                    onClick={handleSyncToCalendar} disabled={isSyncing}
                                    className="flex items-center px-3 py-1.5 bg-indigo-600 border border-indigo-700 text-white font-bold text-sm rounded shadow-sm hover:bg-indigo-700 transition min-w-[120px] justify-center disabled:opacity-50"
                                >
                                    <Calendar className="w-4 h-4 mr-1.5" /> 同步日曆
                                </button>
                                <button
                                    onClick={logout} disabled={isSyncing}
                                    className="flex items-center px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-600 font-bold text-sm rounded shadow-sm hover:bg-gray-200 transition"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 justify-end border p-2 rounded-lg bg-white border-gray-200 shadow-sm">
                                <button
                                    onClick={() => login()}
                                    className="flex items-center px-4 py-2 bg-indigo-600 text-white font-bold text-sm rounded hover:bg-indigo-700 transition"
                                >
                                    <LogIn className="w-4 h-4 mr-2" /> 登入 Google 啟用雲端功能
                                </button>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end mt-1">
                            <button
                                onClick={handleExport}
                                className="flex items-center px-3 py-1.5 bg-white border border-gray-200 text-gray-500 font-bold text-xs rounded hover:bg-gray-50 transition"
                            >
                                <Download className="w-3 h-3 mr-1" /> 本地匯出 JSON
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center px-3 py-1.5 bg-white border border-gray-200 text-gray-500 font-bold text-xs rounded hover:bg-gray-50 transition"
                            >
                                <Upload className="w-3 h-3 mr-1" /> 本地匯入 JSON
                            </button>
                            <input
                                type="file"
                                accept=".json"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleImport}
                            />
                        </div>
                    </div>
                </header>

                <Instructions />

                {/* Dashboard 統計 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-indigo-100 font-medium mb-1">購入機票總數</p>
                            <p className="text-3xl font-extrabold">{tickets.length} 套</p>
                        </div>
                        <ListFilter className="w-24 h-24 absolute -right-4 -bottom-4 text-white opacity-10" />
                    </div>
                    <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-emerald-50 font-medium mb-1">精算預測趟次</p>
                            <p className="text-3xl font-extrabold">{trips.length} 趟次</p>
                        </div>
                        <Plane className="w-24 h-24 absolute -right-4 -bottom-4 text-white opacity-10" />
                    </div>
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-slate-300 font-medium mb-1">總預算支出 (TWD)</p>
                            <p className="text-3xl font-extrabold">${totalPriceTWD.toLocaleString()}</p>
                        </div>
                        <div className="text-6xl font-black absolute -right-2 -bottom-6 text-white opacity-[0.03]">$</div>
                    </div>
                </div>

                <TicketForm 
                    onAddTicket={handleSaveTicket} 
                    editingTicket={editingTicket} 
                    onCancelEdit={handleCancelEdit}
                    exchangeRates={exchangeRates}
                />

                {/* 主視覺 Tab 切換區 */}
                <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="flex border-b border-gray-200 p-1 bg-slate-50/50">
                        <button
                            onClick={() => setActiveTab('timeline')}
                            className={`flex-1 py-3 px-4 font-bold text-sm sm:text-base rounded-t-lg transition-colors ${activeTab === 'timeline'
                                ? 'bg-white text-indigo-700 border-b-2 border-indigo-500 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                        >
                            📆 實際飛行配對 (Timeline)
                        </button>
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`flex-1 py-3 px-4 font-bold text-sm sm:text-base rounded-t-lg transition-colors ${activeTab === 'list'
                                ? 'bg-white text-indigo-700 border-b-2 border-indigo-500 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                        >
                            🎟️ 購買清單管理 (Purchases)
                        </button>
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`flex-1 py-3 px-2 sm:px-4 font-bold text-sm sm:text-base rounded-t-lg transition-colors ${activeTab === 'calendar'
                                ? 'bg-white text-indigo-700 border-b-2 border-indigo-500 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                        >
                            📅 月曆視角 (Calendar)
                        </button>
                    </div>

                    <div className="p-4 md:p-6 bg-white min-h-[400px]">
                        {activeTab === 'timeline' && <TripTimeline trips={trips} tripLabels={tripLabels} onUpdateLabel={(id, val) => setTripLabels(p => ({ ...p, [id]: val }))} />}
                        {activeTab === 'list' && <TicketList tickets={tickets} onDelete={deleteTicket} onEdit={handleEditTicket} />}
                        {activeTab === 'calendar' && <TripCalendar segments={segments} />}
                    </div>
                </div>

                <footer className="mt-12 text-center text-sm text-gray-400 pb-8">
                    &copy; {new Date().getFullYear()} Reverse Ticket Manager. Data stored locally.
                </footer>
            </div>
        </div>
    );
}

export default App;
