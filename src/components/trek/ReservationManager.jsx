/**
 * ReservationManager.jsx
 * 16 種通用預訂管理中心與雙軌票券匯入視窗：
 * - 支援 16 種標準預訂類型分類篩選
 * - 支援拖曳 / 點選上傳 PKPass、PDF、EML、HTML、TXT 自動結構化辨識
 * - 支援手動新增與編輯預訂
 * - 支援確認代碼一鍵複製與狀態管理
 */

import React, { useState } from 'react';
import { 
    Plus, 
    UploadCloud, 
    Copy, 
    Check, 
    Trash2, 
    Calendar, 
    FileText, 
    Loader2, 
    Plane, 
    Hotel, 
    Train, 
    Car, 
    Utensils, 
    Ticket, 
    Sparkles,
    Tag
} from 'lucide-react';
import { toast } from 'sonner';
import { useTrek } from '../../contexts/TrekContext';
import { reservationRepo } from '../../services/db';
import { RESERVATION_TYPES, RESERVATION_TYPE_CONFIG, RESERVATION_STATUS } from '../../constants/reservationTypes';
import { importBookingFile } from '../../services/import';

export default function ReservationManager() {
    const { activeTrip, reservations, refreshTrips } = useTrek();
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isUploading, setIsUploading] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // 新增表單狀態
    const [formData, setFormData] = useState({
        type: 'flight',
        title: '',
        confirmationCode: '',
        status: 'confirmed',
        cost: '',
        currency: 'TWD',
        startDate: '',
        endDate: '',
        notes: '',
        // Flight
        flightNumber: '',
        airline: '',
        from: '',
        to: '',
        // Accommodation
        hotelName: '',
        checkInDate: '',
        checkOutDate: '',
        address: ''
    });

    if (!activeTrip) return null;

    // 篩選預訂項目
    const filteredReservations = reservations.filter(r => {
        if (selectedCategory === 'all') return true;
        return r.type === selectedCategory;
    });

    // ── 複製確認碼 ────────────────────────────────────────────────────────
    const handleCopyCode = (code, id) => {
        if (!code) return;
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        toast.success(`已複製確認代碼：${code}`);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // ── 檔案自動辨識匯入 ──────────────────────────────────────────────────
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        toast.info(`正在解析 ${file.name}...`);

        try {
            const result = await importBookingFile(file);
            if (!result || !result.success) {
                toast.error(result?.error || '票券辨識失敗');
                return;
            }

            // 檢查是否已存在相同確認代碼或航班之預訂 (防重放/冪等性檢查)
            if (result.confirmationCode) {
                const existing = reservations.find(r => 
                    r.confirmationCode && r.confirmationCode.toUpperCase() === result.confirmationCode.toUpperCase()
                );
                if (existing) {
                    toast.warning(`此憑證確認代碼 (${result.confirmationCode}) 已存在於「${existing.title}」，已略過重複匯入`);
                    return;
                }
            }

            const newReservation = {
                id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                tripId: activeTrip.id,
                type: result.type || 'flight',
                status: 'confirmed',
                title: result.title || file.name,
                confirmationCode: result.confirmationCode || '',
                cost: 0,
                currency: activeTrip.baseCurrency || 'TWD',
                travellers: result.travellers || [],
                flightDetails: result.flightDetails || null,
                accommodationDetails: result.accommodationDetails || null,
                activityDetails: result.activityDetails || null,
                trainDetails: result.trainDetails || null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            await reservationRepo.save(newReservation);
            await refreshTrips(activeTrip.id);
            toast.success(`✨ 成功自動匯入預訂：${newReservation.title}`);
        } catch (err) {
            toast.error(`匯入過程發生錯誤: ${err.message}`);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    // ── 刪除預訂 ──────────────────────────────────────────────────────────
    const handleDeleteReservation = async (id, title) => {
        if (confirm(`確定要刪除預訂項目「${title || '此項目'}」嗎？`)) {
            await reservationRepo.delete(id);
            await refreshTrips(activeTrip.id);
            toast.info('預訂已刪除');
        }
    };

    // ── 手動新增預訂提交 ──────────────────────────────────────────────────
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        let flightDetails = null;
        let accommodationDetails = null;

        if (formData.type === 'flight') {
            flightDetails = {
                airline: formData.airline,
                flightNumber: formData.flightNumber,
                from: formData.from,
                to: formData.to,
                departureTime: formData.startDate
            };
        } else if (formData.type === 'accommodation') {
            accommodationDetails = {
                name: formData.hotelName || formData.title,
                checkInDate: formData.checkInDate || formData.startDate,
                checkOutDate: formData.checkOutDate || formData.endDate,
                address: formData.address
            };
        }

        const newRes = {
            id,
            tripId: activeTrip.id,
            type: formData.type,
            title: formData.title || (formData.type === 'flight' ? `${formData.flightNumber} (${formData.from} → ${formData.to})` : formData.hotelName) || '預訂項目',
            confirmationCode: formData.confirmationCode,
            status: formData.status,
            cost: Number(formData.cost) || 0,
            currency: formData.currency,
            notes: formData.notes,
            flightDetails,
            accommodationDetails,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await reservationRepo.save(newRes);
        await refreshTrips(activeTrip.id);
        toast.success(`已新增預訂：${newRes.title}`);
        setIsAddModalOpen(false);
    };

    return (
        <div className="space-y-4">
            {/* 1. 拖曳/上傳票券自動辨識橫幅 */}
            <div className="relative border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50/80 rounded-2xl p-6 text-center transition-all cursor-pointer">
                <input
                    type="file"
                    accept=".pkpass,.pdf,.eml,.html,.txt"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                        {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                        {isUploading ? '正在結構化辨識票券...' : '點擊或拖曳票券至此自動辨識匯入'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        支援 Apple Wallet <code className="bg-white px-1.5 py-0.5 rounded border text-indigo-600 font-bold">.pkpass</code>、電子機票與飯店憑證 <code className="bg-white px-1.5 py-0.5 rounded border text-indigo-600 font-bold">.pdf</code>、確認郵件 <code className="bg-white px-1.5 py-0.5 rounded border text-indigo-600 font-bold">.eml / .html</code>
                    </p>
                </div>
            </div>

            {/* 2. 16 種分類篩選標籤 */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none max-w-full">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                            selectedCategory === 'all'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'
                        }`}
                    >
                        全部 ({reservations.length})
                    </button>
                    {Object.entries(RESERVATION_TYPE_CONFIG).map(([typeKey, cfg]) => {
                        const count = reservations.filter(r => r.type === typeKey).length;
                        return (
                            <button
                                key={typeKey}
                                onClick={() => setSelectedCategory(typeKey)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 whitespace-nowrap ${
                                    selectedCategory === typeKey
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'
                                }`}
                            >
                                <span>{cfg.emoji}</span>
                                <span>{cfg.shortLabel}</span>
                                {count > 0 && <span className="opacity-80 text-[10px]">({count})</span>}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1 shrink-0"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span>手動新增預訂</span>
                </button>
            </div>

            {/* 3. 預訂清單卡片 */}
            <div className="space-y-3">
                {filteredReservations.length === 0 ? (
                    <div className="bg-white rounded-xl p-10 text-center text-slate-400 border border-gray-200">
                        <Tag className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-semibold">此分類尚無預訂項目</p>
                        <p className="text-xs text-slate-400 mt-1">請上傳票券檔案或手動新增預訂</p>
                    </div>
                ) : (
                    filteredReservations.map(res => {
                        const cfg = RESERVATION_TYPE_CONFIG[res.type] || RESERVATION_TYPE_CONFIG.other;
                        const statusObj = RESERVATION_STATUS[res.status?.toUpperCase()] || RESERVATION_STATUS.CONFIRMED;

                        return (
                            <div
                                key={res.id}
                                className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                            >
                                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
                                        {cfg.emoji}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeColor}`}>
                                                {cfg.label}
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusObj.color}`}>
                                                {statusObj.label}
                                            </span>
                                            <h4 className="font-bold text-sm text-slate-900 truncate">
                                                {res.title}
                                            </h4>
                                        </div>

                                        {/* 細節資訊 */}
                                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                                            {res.confirmationCode && (
                                                <button
                                                    onClick={() => handleCopyCode(res.confirmationCode, res.id)}
                                                    className="flex items-center gap-1 font-mono text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition"
                                                    title="點擊複製確認碼"
                                                >
                                                    <span>代碼: {res.confirmationCode}</span>
                                                    {copiedId === res.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                </button>
                                            )}

                                            {res.flightDetails?.departureTime && (
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <Calendar className="w-3 h-3" />
                                                    出發: {res.flightDetails.departureTime}
                                                </span>
                                            )}

                                            {res.accommodationDetails?.checkInDate && (
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <Calendar className="w-3 h-3" />
                                                    入住: {res.accommodationDetails.checkInDate} ~ {res.accommodationDetails.checkOutDate}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 右側金額與操作 */}
                                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                                    <div className="text-left sm:text-right">
                                        <div className="font-bold text-base text-slate-900">
                                            ${res.cost?.toLocaleString() || 0}
                                            <span className="text-xs font-normal text-slate-400 ml-1">{res.currency || 'TWD'}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteReservation(res.id, res.title)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="刪除預訂"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* 4. 手動新增預訂 Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Plus className="w-5 h-5 text-indigo-600" /> 手動新增行程預訂
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>

                        <form onSubmit={handleFormSubmit} className="space-y-3.5">
                            {/* 16 種型態切換 */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">預訂類型 (16 種)</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                >
                                    {Object.entries(RESERVATION_TYPE_CONFIG).map(([k, cfg]) => (
                                        <option key={k} value={k}>{cfg.emoji} {cfg.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">名稱 / 描述</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="例如：中華航空 CI100 或 東京新宿王子大飯店"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">訂位代碼 (PNR)</label>
                                    <input
                                        type="text"
                                        placeholder="例如：WF89KJ"
                                        value={formData.confirmationCode}
                                        onChange={(e) => setFormData({ ...formData, confirmationCode: e.target.value })}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">狀態</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="confirmed">已確認</option>
                                        <option value="tentative">暫定</option>
                                        <option value="cancelled">已取消</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">金額</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={formData.cost}
                                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">幣別</label>
                                    <select
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="TWD">TWD</option>
                                        <option value="JPY">JPY</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-md transition"
                                >
                                    儲存預訂
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
