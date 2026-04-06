/**
 * HotelForm.jsx ── 新增/修改飯店住宿表單
 *
 * 設計語彙仿照 TicketForm，支援：
 *   - TWD / JPY / USD 多幣別 + 自動換算
 *   - 自動計算晚數
 *   - 編輯模式（editingHotel 不為 null 時）
 *
 * Props:
 *   onSaveHotel     {Function}  (hotel) => void
 *   editingHotel    {Object|null}
 *   onCancelEdit    {Function}
 *   exchangeRates   {Object}    { JPY, USD } → TWD 換算率
 */
import React, { useState, useEffect } from 'react';
import { Building2, CalendarDays, Banknote, Hash, MapPin, FileText, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { convertToTWD } from '../../../utils/currency';
import { ERRORS } from '../../../constants/errors';
import { useHotelDataContext, useSystemDataContext } from '../../../contexts/DataContext';

const EMPTY = {
    name: '', address: '', checkIn: '', checkOut: '',
    currency: 'TWD', priceTotal: '', priceTWD: 0,
    confirmationNo: '', notes: '',
};



function calcNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return null;
    const diff = new Date(checkOut) - new Date(checkIn);
    return diff > 0 ? Math.round(diff / 86400000) : null;
}

export default function HotelForm() {
    const { handleSaveHotel: onSaveHotel, editingHotel, handleCancelEditHotel: onCancelEdit } = useHotelDataContext();
    const { exchangeRates } = useSystemDataContext();
    const [form, setForm] = useState(EMPTY);
    const [isFormExpanded, setIsFormExpanded] = useState(false);

    useEffect(() => {
        if (editingHotel) {
            setForm({
                ...EMPTY,
                ...editingHotel,
                priceTotal: editingHotel.priceTotal ?? '',
            });
            setIsFormExpanded(true);
        } else {
            setForm(EMPTY);
        }
    }, [editingHotel]);

    const set = (key, val) => setForm(f => {
        const next = { ...f, [key]: val };
        // 幣別或金額改變時自動重算 priceTWD
        if (key === 'priceTotal' || key === 'currency') {
            next.priceTWD = convertToTWD(
                key === 'priceTotal' ? val : f.priceTotal,
                key === 'currency'    ? val : f.currency,
                exchangeRates
            );
        }
        return next;
    });

    const nights = calcNights(form.checkIn, form.checkOut);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name || !form.checkIn || !form.checkOut) {
            toast.error(ERRORS.HOTEL_MISSING_FIELDS);
            return;
        }

        const price = parseFloat(form.priceTotal);
        if (form.priceTotal && (isNaN(price) || price < 0)) {
            toast.error(ERRORS.HOTEL_NEGATIVE_PRICE);
            return;
        }

        if (nights === null || nights <= 0) {
            toast.error(ERRORS.HOTEL_INVALID_NIGHTS);
            return;
        }
        const hotel = {
            ...form,
            priceTotal: parseFloat(form.priceTotal) || 0,
            priceTWD: form.priceTWD || 0,
            id: editingHotel?.id ?? `hotel-${Date.now()}`,
        };
        onSaveHotel(hotel);
        setForm(EMPTY);
        setIsFormExpanded(false);
    };

    const isEditing = Boolean(editingHotel);

    return (
        <div className={`bg-white rounded-2xl shadow-md border mb-8 transition-all duration-300 overflow-hidden
            ${isEditing ? 'border-teal-400 ring-2 ring-teal-200' : 'border-teal-200'}`}>
            
            {/* Header / Toggle Button */}
            <button 
                type="button"
                onClick={() => setIsFormExpanded(!isFormExpanded)}
                className="w-full p-4 sm:p-6 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors focus:outline-none"
            >
                <div className="flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-teal-500" />
                    <h2 className="text-xl font-extrabold text-slate-800">
                        {isEditing ? '✏️ 修改住宿資訊' : '🏨 新增住宿'}
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    {isEditing && (
                        <div onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded border border-gray-200 hover:border-red-200 cursor-pointer">
                            <X className="w-4 h-4" /> 取消修改
                        </div>
                    )}
                    <div className={`p-2 rounded-full ${isFormExpanded ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-500'}`}>
                        {isFormExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                </div>
            </button>

            {/* Collapsible Form Area */}
            {isFormExpanded && (
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 pt-0 border-t border-slate-100 bg-slate-50/30">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 飯店名稱 */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        飯店 / 旅宿名稱 *
                    </label>
                    <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                        placeholder="例：Conrad Tokyo / 東橫イン新宿歌舞伎町"
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>

                {/* 入住 / 退房 */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <CalendarDays className="w-3 h-3 inline mr-1" />入住日期 (Check-in) *
                    </label>
                    <input type="date" value={form.checkIn} onChange={e => set('checkIn', e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <CalendarDays className="w-3 h-3 inline mr-1" />退房日期 (Check-out) *
                        {nights !== null && nights > 0 && (
                            <span className="ml-2 text-teal-600 normal-case font-bold">▸ {nights} 晚</span>
                        )}
                    </label>
                    <input type="date" value={form.checkOut} onChange={e => set('checkOut', e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>

                {/* 幣別 + 總金額 */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <Banknote className="w-3 h-3 inline mr-1" />幣別
                    </label>
                    <select value={form.currency} onChange={e => set('currency', e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                        <option value="TWD">TWD 新台幣</option>
                        <option value="JPY">JPY 日圓</option>
                        <option value="USD">USD 美金</option>
                        <option value="KRW">KRW 韓元</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        住宿總金額（{form.currency}）
                        {form.currency !== 'TWD' && form.priceTWD > 0 && (
                            <span className="ml-2 text-teal-600 normal-case font-bold">
                                ≈ NT$ {form.priceTWD.toLocaleString()}
                            </span>
                        )}
                    </label>
                    <input type="number" min="0" step="1"
                        value={form.priceTotal}
                        onChange={e => set('priceTotal', e.target.value)}
                        placeholder="0"
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>

                {/* 地址 */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <MapPin className="w-3 h-3 inline mr-1" />地址（選填）
                    </label>
                    <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
                        placeholder="例：1-1-1 Uchisaiwaicho, Chiyoda, Tokyo"
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>

                {/* 確認碼 */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <Hash className="w-3 h-3 inline mr-1" />訂單確認碼（選填）
                    </label>
                    <input type="text" value={form.confirmationNo} onChange={e => set('confirmationNo', e.target.value)}
                        placeholder="例：HXXXX1234 / Booking Ref"
                        className="w-full p-3 border border-gray-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>

                {/* 備註 */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        <FileText className="w-3 h-3 inline mr-1" />備註（選填）
                    </label>
                    <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
                        placeholder="例：含早餐 / 機場接送"
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>
            </div>

            {/* 送出 */}
            <div className="flex justify-end mt-5">
                <button type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-md transition-colors w-full sm:w-auto justify-center">
                    <Check className="w-4 h-4" />
                    {isEditing ? '儲存修改' : '新增住宿'}
                </button>
            </div>
            </form>
            )}
        </div>
    );
}
