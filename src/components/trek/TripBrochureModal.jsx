/**
 * TripBrochureModal.jsx
 * 專業旅行手冊 (Travel Brochure) 檢視與列印/PDF 匯出組件：
 * 支援原生 @media print 最佳化 A4 排版 (包含封面、交通憑證、住宿、每日詳細行程與行前檢查)
 * 可直接透過瀏覽器一鍵「列印」或「另存為高品質向量 PDF」，亦可一鍵複製 Markdown 手冊文字。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    Printer, 
    Copy, 
    X, 
    Plane, 
    Hotel, 
    MapPin, 
    Calendar, 
    Clock, 
    ShieldAlert, 
    CheckSquare,
    DollarSign,
    Ticket
} from 'lucide-react';
import { toast } from 'sonner';
import { placeItemRepo, dayPlanRepo } from '../../services/db';
import { assembleTripDays, normalizeReservations } from '../../services/trips/tripExportAssembler';

export default function TripBrochureModal({ 
    isOpen, 
    onClose, 
    trip, 
    dayPlans = [], 
    reservations = [], 
    places = null,
    packingItems = [], 
    expenses = [] 
}) {
    const [internalDays, setInternalDays] = useState(null);

    // 檢查外部是否已傳入自帶 places 的 dayPlans
    const hasExternalPlaces = useMemo(() => {
        return Array.isArray(dayPlans) && dayPlans.some(dp => Array.isArray(dp.places) && dp.places.length > 0);
    }, [dayPlans]);

    // 當 Modal 開啟且缺乏完整景點資料時，非同步載入 placeItemRepo 與 dayPlanRepo
    useEffect(() => {
        if (!isOpen || !trip) return;

        // 若外部已傳入 places 清單，直接進行組裝
        if (Array.isArray(places)) {
            const assembled = assembleTripDays({ trip, dayPlans, places });
            setInternalDays(assembled);
            return;
        }

        // 若外部 dayPlans 內已組裝好 places，直接採用
        if (hasExternalPlaces) {
            setInternalDays(dayPlans);
            return;
        }

        let isMounted = true;
        async function loadAndAssemble() {
            try {
                const [dbPlaces, dbDayPlans] = await Promise.all([
                    placeItemRepo.getByTrip(trip.id).catch(() => []),
                    dayPlanRepo.getByTrip(trip.id).catch(() => [])
                ]);
                if (!isMounted) return;
                const mergedPlans = dayPlans.length > 0 ? dayPlans : dbDayPlans;
                const assembled = assembleTripDays({ trip, dayPlans: mergedPlans, places: dbPlaces });
                setInternalDays(assembled);
            } catch {
                if (isMounted) {
                    setInternalDays(assembleTripDays({ trip, dayPlans, places: [] }));
                }
            }
        }

        loadAndAssemble();
        return () => { isMounted = false; };
    }, [isOpen, trip?.id, trip?.startDate, trip?.endDate, dayPlans, places, hasExternalPlaces]);

    // 取得最終有效的每日行程規劃清單
    const effectiveDayPlans = useMemo(() => {
        if (internalDays) return internalDays;
        if (hasExternalPlaces) return dayPlans;
        return assembleTripDays({ trip, dayPlans, places: [] });
    }, [internalDays, hasExternalPlaces, dayPlans, trip]);

    // 標準化預訂項目 (包含統一機票、住宿與其他活動)
    const { flights, hotels, others: otherReservations } = useMemo(() => {
        return normalizeReservations(reservations);
    }, [reservations]);

    if (!isOpen || !trip) return null;

    const totalExpense = expenses.reduce((sum, e) => sum + (Number(e.amountTwd) || Number(e.amount) || 0), 0);

    const handlePrint = () => {
        window.print();
    };

    const handleCopyMarkdown = () => {
        let md = `# 📖 ${trip.title}\n\n`;
        md += `**日期**：${trip.startDate || '未定'} ~ ${trip.endDate || '未定'}\n`;
        md += `**天數**：共 ${effectiveDayPlans.length} 天 | **幣別**：${trip.baseCurrency || 'TWD'} | **總費用**：約 $${totalExpense.toLocaleString()}\n\n`;

        if (flights.length > 0) {
            md += `## ✈️ 航班交通\n`;
            flights.forEach(f => {
                const route = (f.departureAirport || f.arrivalAirport) ? ` (${f.departureAirport || '-'} ➔ ${f.arrivalAirport || '-'})` : '';
                md += `- **${f.airline || ''} ${f.flightNumber || ''}**${route}\n`;
                md += `  起飛: ${f.departureTime || '-'} | 抵達: ${f.arrivalTime || '-'}\n`;
                md += `  PNR: \`${f.confirmationCode || '無'}\` | 座位: ${f.seatNumber || '未指定'}${f.departureTerminal ? ` | 航廈: ${f.departureTerminal}` : ''}\n`;
            });
            md += `\n`;
        }

        if (hotels.length > 0) {
            md += `## 🏨 住宿安排\n`;
            hotels.forEach(h => {
                md += `- **${h.title || h.hotelName}** (${h.checkInDate || '-'} ~ ${h.checkOutDate || '-'})\n`;
                if (h.address) md += `  地址: ${h.address}\n`;
                if (h.confirmationCode) md += `  確認代碼: \`${h.confirmationCode}\`\n`;
            });
            md += `\n`;
        }

        if (otherReservations.length > 0) {
            md += `## 🎟️ 其他票券與預訂\n`;
            otherReservations.forEach(r => {
                md += `- **${r.title || '票券預訂'}** (${r.type || '其他'})\n`;
                if (r.confirmationCode) md += `  確認代碼: \`${r.confirmationCode}\`\n`;
                if (r.notes) md += `  備註: ${r.notes}\n`;
            });
            md += `\n`;
        }

        md += `## 📍 每日行程\n`;
        effectiveDayPlans.forEach((plan, idx) => {
            md += `### Day ${idx + 1} (${plan.date || '未定日期'})${plan.theme ? ` - ${plan.theme}` : ''}\n`;
            if (plan.notes) md += `> 💡 ${plan.notes}\n\n`;
            const planPlaces = plan.places || [];
            if (planPlaces.length === 0) {
                md += `*今日自由安排活動*\n`;
            } else {
                planPlaces.forEach((p, pIdx) => {
                    md += `${pIdx + 1}. **${p.name}** ${p.address ? `(${p.address})` : ''}\n`;
                    if (p.notes) md += `   - 備忘: ${p.notes}\n`;
                });
            }
            md += `\n`;
        });

        if (packingItems.length > 0) {
            md += `## 🎒 重要行前檢查\n`;
            packingItems.forEach(item => {
                md += `- [ ] ${item.itemName}\n`;
            });
            md += `\n`;
        }

        navigator.clipboard.writeText(md);
        toast.success('已複製完整 Markdown 手冊內容至剪貼簿！');
    };

    const brochureContent = (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col my-auto border border-gray-200 print:border-none print:shadow-none print:w-full print:max-w-none">
                
                {/* 頂部操作列 (列印時隱藏) */}
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print sticky top-0 z-10 shadow-md">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                            A4 旅遊手冊排版
                        </span>
                        <span className="text-xs text-slate-400 hidden sm:inline">可直接列印或另存為向量 PDF</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyMarkdown}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            <span>複製 Markdown</span>
                        </button>
                        <button
                            onClick={handlePrint}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>列印 / 匯存 PDF</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition ml-2"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 手冊主要內容區域 (可捲動，列印時一頁頁呈現) */}
                <div className="p-8 sm:p-12 space-y-10 text-slate-800 font-sans print:p-6">
                    
                    {/* ── 1. 封面區塊 (Cover Page) ────────────────────────── */}
                    <div className="border-b-2 border-indigo-600 pb-8 print:page-break-after">
                        <div className="flex items-center justify-between text-xs text-slate-400 font-mono tracking-widest uppercase mb-3">
                            <span>TREK TRAVEL BROCHURE</span>
                            <span>OFFICIAL ITINERARY</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
                            {trip.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 font-medium">
                            <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg font-bold">
                                <Calendar className="w-4 h-4 text-indigo-600" />
                                {trip.startDate || '未定日期'} ~ {trip.endDate || '未定日期'}
                            </span>
                            <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
                                <Clock className="w-4 h-4 text-slate-500" />
                                共 {effectiveDayPlans.length} 天行程
                            </span>
                            <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
                                <DollarSign className="w-4 h-4 text-slate-500" />
                                基準幣別: {trip.baseCurrency || 'TWD'}
                            </span>
                        </div>

                        {/* 緊急聯絡資訊小卡 */}
                        <div className="mt-6 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
                            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold">重要提醒與緊急聯絡：</span>
                                <span> 外交部緊急聯絡專線 +886-800-085-095 · 海外急難救助電話：當地國碼撥外館聯絡電話 · 妥善保存護照與證件影本。</span>
                            </div>
                        </div>
                    </div>

                    {/* ── 2. 交通憑證 (航班與接駁) ────────────────────────── */}
                    {flights.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                                <Plane className="w-4 h-4 text-indigo-600" />
                                <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">航班與交通憑證</h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {flights.map((flight, idx) => (
                                    <div key={flight.id || idx} className="p-3.5 rounded-xl border border-gray-200 bg-slate-50/50 text-xs space-y-1.5">
                                        <div className="flex items-center justify-between font-bold">
                                            <span className="text-indigo-700">{flight.airline || ''} {flight.flightNumber || ''}</span>
                                            <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200">
                                                PNR: {flight.confirmationCode || '無'}
                                            </span>
                                        </div>
                                        {(flight.departureAirport || flight.arrivalAirport) && (
                                            <div className="text-slate-700 font-semibold flex items-center gap-2">
                                                <span>{flight.departureAirport || '-'}</span>
                                                <span>➔</span>
                                                <span>{flight.arrivalAirport || '-'}</span>
                                            </div>
                                        )}
                                        <div className="text-[11px] text-slate-500 flex justify-between">
                                            <span>起: {flight.departureTime || '-'}</span>
                                            <span>抵: {flight.arrivalTime || '-'}</span>
                                        </div>
                                        {(flight.seatNumber || flight.departureTerminal) && (
                                            <div className="text-[11px] text-slate-500">
                                                {flight.seatNumber && <>座位: <strong>{flight.seatNumber}</strong></>}
                                                {flight.seatNumber && flight.departureTerminal && ' | '}
                                                {flight.departureTerminal && <>航廈: {flight.departureTerminal}</>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── 3. 住宿資訊 ────────────────────────────────────────── */}
                    {hotels.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                                <Hotel className="w-4 h-4 text-indigo-600" />
                                <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">住宿安排</h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {hotels.map((hotel, idx) => (
                                    <div key={hotel.id || idx} className="p-3.5 rounded-xl border border-gray-200 bg-slate-50/50 text-xs space-y-1">
                                        <div className="flex items-center justify-between font-bold">
                                            <span className="text-slate-900">{hotel.title || hotel.hotelName}</span>
                                            <span className="font-mono text-slate-500 text-[10px]">
                                                代碼: {hotel.confirmationCode || '-'}
                                            </span>
                                        </div>
                                        <div className="text-slate-500 text-[11px]">
                                            入住: {hotel.checkInDate || '-'} ➔ 退房: {hotel.checkOutDate || '-'}
                                        </div>
                                        {hotel.address && (
                                            <div className="text-slate-500 text-[11px] truncate">
                                                地址: {hotel.address}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── 3.1 其他預訂憑證 ─────────────────────────────────── */}
                    {otherReservations.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                                <Ticket className="w-4 h-4 text-indigo-600" />
                                <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">活動與票券預訂</h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {otherReservations.map((res, idx) => (
                                    <div key={res.id || idx} className="p-3.5 rounded-xl border border-gray-200 bg-slate-50/50 text-xs space-y-1">
                                        <div className="flex items-center justify-between font-bold">
                                            <span className="text-slate-900">{res.title || '票券項目'}</span>
                                            {res.confirmationCode && (
                                                <span className="font-mono text-slate-500 text-[10px]">
                                                    代碼: {res.confirmationCode}
                                                </span>
                                            )}
                                        </div>
                                        {res.notes && (
                                            <div className="text-slate-500 text-[11px]">
                                                {res.notes}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── 4. 每日詳細行程時間軸 (Day-by-Day) ───────────────── */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                            <MapPin className="w-4 h-4 text-indigo-600" />
                            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">每日行程規劃</h2>
                        </div>

                        {effectiveDayPlans.map((plan, pIdx) => {
                            const planPlaces = plan.places || [];
                            return (
                                <div key={plan.id || pIdx} className="space-y-3 print:page-break-inside-avoid">
                                    <div className="bg-slate-100 p-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-slate-800">
                                        <span className="flex items-center gap-2">
                                            <span>Day {pIdx + 1} · {plan.date || '未排定'}</span>
                                            {plan.theme && (
                                                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-semibold">
                                                    {plan.theme}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-slate-500 font-normal">景點數量: {planPlaces.length} 個</span>
                                    </div>

                                    {plan.notes && (
                                        <p className="text-xs text-slate-600 bg-indigo-50/40 border border-indigo-100/60 rounded-xl p-2.5">
                                            💡 {plan.notes}
                                        </p>
                                    )}

                                    {planPlaces.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic pl-3">今日無指定景點，自由安排探索活動。</p>
                                    ) : (
                                        <div className="pl-3 border-l-2 border-indigo-200 space-y-3">
                                            {planPlaces.map((place, plIdx) => (
                                                <div key={place.id || plIdx} className="text-xs space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                                                            {plIdx + 1}
                                                        </span>
                                                        <span className="font-bold text-slate-900 text-sm">{place.name}</span>
                                                    </div>
                                                    {place.address && (
                                                        <p className="text-slate-500 pl-7 text-[11px]">{place.address}</p>
                                                    )}
                                                    {place.notes && (
                                                        <p className="text-indigo-700 bg-indigo-50/60 p-2 rounded-lg pl-7 text-[11px] mt-1">
                                                            備忘: {place.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* ── 5. 行李清單與重點待辦 ────────────────────────────── */}
                    {packingItems.length > 0 && (
                        <div className="space-y-3 print:page-break-inside-avoid">
                            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                                <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">重要行前檢查</h2>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                {packingItems.slice(0, 15).map(item => (
                                    <div key={item.id} className="flex items-center gap-2 p-1.5 rounded bg-slate-50">
                                        <span className="w-3.5 h-3.5 border border-slate-300 rounded inline-block" />
                                        <span className="truncate">{item.itemName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(brochureContent, document.body) : brochureContent;
}
