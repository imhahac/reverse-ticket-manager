/**
 * ExportImportModal.jsx
 * 外部資料匯入匯出、旅程日期平移與手冊中心：
 * 1. 景點匯入：GPX / KML / KMZ 檔案與 Google Maps / Naver Maps 連結解析
 * 2. 行事曆與航跡匯出：RFC 5545 .ics 與 GPX 1.1 .gpx 下載
 * 3. 旅程日期平移 (Move Trip Dates)：一鍵調整出發日期，級聯平移所有日程與預訂
 * 4. 專業旅遊手冊：A4 向量列印與 PDF 匯出
 */

import React, { useState } from 'react';
import { 
    X, 
    Upload, 
    Download, 
    Calendar, 
    BookOpen, 
    FileText, 
    MapPin, 
    Check, 
    ArrowRight, 
    Loader2, 
    Share2,
    Compass,
    Bug
} from 'lucide-react';
import { toast } from 'sonner';
import { useTrek } from '../../contexts/TrekContext';
import { parseGeoFile, parseMapLinks } from '../../services/import/geoImportService';
import { generateTripIcs, downloadIcsFile } from '../../services/export/icsExportService';
import { generateTripGpx, downloadGpxFile } from '../../services/export/gpxExportService';
import { shiftTripDates, calculateDayDifference } from '../../services/trips/tripShiftService';
import { placeItemRepo, dayPlanRepo, packingRepo, expenseRepo, todoRepo } from '../../services/db';
import { downloadDiagnosticDump } from '../../utils/diagnosticDump';
import TripBrochureModal from './TripBrochureModal';

export default function ExportImportModal({ isOpen, onClose }) {
    const { activeTrip, dayPlans, reservations, refreshTrips } = useTrek();

    const [activeTab, setActiveTab] = useState('import'); // 'import' | 'export' | 'shift' | 'brochure'
    const [isBrochureOpen, setIsBrochureOpen] = useState(false);

    // ── 景點匯入狀態 ────────────────────────────────────────────────────────
    const [pastedLinks, setPastedLinks] = useState('');
    const [parsedPlaces, setParsedPlaces] = useState([]);
    const [selectedTargetDay, setSelectedTargetDay] = useState(0); // 0 = 第一天
    const [isImporting, setIsImporting] = useState(false);

    // ── 日期平移狀態 ────────────────────────────────────────────────────────
    const [newStartDate, setNewStartDate] = useState(activeTrip?.startDate || '');
    const [isShifting, setIsShifting] = useState(false);

    // ── 手冊附加資料狀態 ───────────────────────────────────────────────────
    const [packingItems, setPackingItems] = useState([]);
    const [expenses, setExpenses] = useState([]);

    if (!isOpen || !activeTrip) return null;

    // 1. 處理檔案匯入 (GPX / KML / KMZ)
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const places = await parseGeoFile(file);
            if (places.length === 0) {
                toast.warning('檔案中未找到有效的航點或地標');
                return;
            }
            setParsedPlaces(places);
            toast.success(`成功解析 ${places.length} 個地點！請確認後匯入行程`);
        } catch (err) {
            toast.error(`解析失敗: ${err.message}`);
        } finally {
            e.target.value = '';
        }
    };

    // 2. 處理文字貼上連結解析 (Google / Naver / 座標)
    const handleParseLinks = () => {
        if (!pastedLinks.trim()) return;
        const places = parseMapLinks(pastedLinks);
        if (places.length === 0) {
            toast.warning('未能識別出有效的地圖連結或座標');
            return;
        }
        setParsedPlaces(places);
        toast.success(`成功解析 ${places.length} 個地標！`);
    };

    // 3. 確認匯入至指定日程
    const handleConfirmImport = async () => {
        if (parsedPlaces.length === 0) return;
        setIsImporting(true);

        try {
            const targetPlan = dayPlans[selectedTargetDay] || dayPlans[0];
            if (!targetPlan) {
                toast.error('目前旅程尚無有效日程，請先建立日程');
                return;
            }

            const newPlaces = parsedPlaces.map((p, idx) => ({
                id: `place_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
                tripId: activeTrip.id,
                dayPlanId: targetPlan.id,
                name: p.name,
                lat: p.lat,
                lng: p.lng,
                address: p.desc || p.originalUrl || '',
                notes: `從外部匯入 (${p.source || '外部'})`,
                createdAt: Date.now()
            }));

            // 儲存至 placeItemRepo
            await placeItemRepo.saveBatch(newPlaces);

            // 更新 dayPlan 的 places 陣列
            const updatedPlan = {
                ...targetPlan,
                places: [...(targetPlan.places || []), ...newPlaces],
                updatedAt: Date.now()
            };
            await dayPlanRepo.save(updatedPlan);

            toast.success(`✨ 已將 ${newPlaces.length} 個景點匯入至 Day ${selectedTargetDay + 1}！`);
            setParsedPlaces([]);
            setPastedLinks('');
            await refreshTrips(activeTrip.id);
            onClose();
        } catch (err) {
            toast.error(`匯入失敗: ${err.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    // 4. 匯出 ICS 行事曆
    const handleExportIcs = async () => {
        const todos = await todoRepo.getByTrip(activeTrip.id);
        const icsContent = generateTripIcs(activeTrip, dayPlans, reservations, todos);
        const fileName = `${activeTrip.title || 'trip'}_calendar.ics`;
        downloadIcsFile(fileName, icsContent);
        toast.success('已匯出 iCalendar 行事曆檔案 (.ics)！');
    };

    // 5. 匯出 GPX 航跡
    const handleExportGpx = () => {
        const gpxContent = generateTripGpx(activeTrip, dayPlans);
        const fileName = `${activeTrip.title || 'trip'}_route.gpx`;
        downloadGpxFile(fileName, gpxContent);
        toast.success('已匯出 GPX 航跡檔案 (.gpx)！');
    };

    // 5.1 匯出系統除錯診斷包 (Diagnostic Dump)
    const handleExportDiagnostic = async () => {
        try {
            await downloadDiagnosticDump();
            toast.success('已匯出系統除錯診斷包 (.json)！');
        } catch (err) {
            toast.error(`匯出診斷包失敗: ${err.message}`);
        }
    };

    // 6. 執行旅程日期平移
    const handleShiftDates = async () => {
        if (!newStartDate) return;
        const diff = calculateDayDifference(activeTrip.startDate, newStartDate);
        if (diff === 0) {
            toast.info('新出發日期與原日期相同，無需平移');
            return;
        }

        if (!confirm(`確定要將旅程出發日平移 ${diff > 0 ? `+${diff}` : diff} 天至 ${newStartDate} 嗎？\n所有行程日程、機票航班時間與住宿日期將同步重新錨定。`)) {
            return;
        }

        setIsShifting(true);
        try {
            const res = await shiftTripDates(activeTrip.id, newStartDate);
            toast.success(`🎉 旅程日期已成功平移 ${res.dayDiff > 0 ? `+${res.dayDiff}` : res.dayDiff} 天！已更新 ${res.shiftedPlansCount} 個日程與 ${res.shiftedReservationsCount} 筆預訂憑證。`);
            await refreshTrips(activeTrip.id);
            onClose();
        } catch (err) {
            toast.error(`平移失敗: ${err.message}`);
        } finally {
            setIsShifting(false);
        }
    };

    // 7. 開啟手冊預覽時讀取費用與行李資料
    const handleOpenBrochure = async () => {
        const pItems = await packingRepo.getByTrip(activeTrip.id);
        setPackingItems(pItems);
        const expItems = await expenseRepo.getByTrip(activeTrip.id);
        setExpenses(expItems);
        setIsBrochureOpen(true);
    };

    const dayDiff = calculateDayDifference(activeTrip.startDate, newStartDate);

    return (
        <>
            <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
                    
                    {/* Header */}
                    <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-md">
                                <Share2 className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold">匯入匯出與工具中心</h3>
                                <p className="text-[11px] text-slate-400 font-medium">{activeTrip.title}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg transition">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center border-b border-gray-200 bg-slate-50 px-4 pt-2 gap-1 overflow-x-auto scrollbar-none">
                        {[
                            { key: 'import', label: '📥 景點匯入', desc: 'GPX/KML/地圖' },
                            { key: 'export', label: '📤 資料匯出', desc: 'ICS/GPX' },
                            { key: 'shift', label: '🗓️ 日期平移', desc: '變更出發日' },
                            { key: 'brochure', label: '📖 旅遊手冊', desc: 'A4 列印/PDF' }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                                    activeTab === tab.key
                                        ? 'bg-white border-indigo-600 text-indigo-700 shadow-sm'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="p-5 overflow-y-auto space-y-4 flex-1">
                        
                        {/* ── Tab 1: 景點匯入 ────────────────────────────────────── */}
                        {activeTab === 'import' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* 檔案上傳框 */}
                                    <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-2xl p-4 text-center relative cursor-pointer transition">
                                        <input
                                            type="file"
                                            accept=".gpx,.kml,.kmz"
                                            onChange={handleFileUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        />
                                        <Upload className="w-6 h-6 text-indigo-600 mx-auto mb-1.5" />
                                        <p className="text-xs font-bold text-slate-800">上傳 GPX / KML / KMZ 檔案</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">自動抽取航點、景點與經緯度</p>
                                    </div>

                                    {/* 地圖連結貼上框 */}
                                    <div className="flex flex-col gap-2">
                                        <textarea
                                            rows={3}
                                            value={pastedLinks}
                                            onChange={(e) => setPastedLinks(e.target.value)}
                                            placeholder="貼上 Google Maps / Naver Maps 連結或座標 (每行一筆)"
                                            className="w-full border border-gray-200 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500 resize-none font-mono"
                                        />
                                        <button
                                            onClick={handleParseLinks}
                                            className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition"
                                        >
                                            智慧解析文字連結
                                        </button>
                                    </div>
                                </div>

                                {/* 解析結果清單 */}
                                {parsedPlaces.length > 0 && (
                                    <div className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-slate-50">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-800">待匯入景點 ({parsedPlaces.length})</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-500">匯入至：</span>
                                                <select
                                                    value={selectedTargetDay}
                                                    onChange={(e) => setSelectedTargetDay(Number(e.target.value))}
                                                    className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white font-bold"
                                                >
                                                    {dayPlans.map((dp, idx) => (
                                                        <option key={dp.id || idx} value={idx}>
                                                            Day {idx + 1} ({dp.date})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                            {parsedPlaces.map((p, idx) => (
                                                <div key={idx} className="bg-white p-2.5 rounded-xl border border-gray-200 text-xs flex items-center justify-between gap-2 shadow-xs">
                                                    <div className="truncate flex-1">
                                                        <span className="font-bold text-slate-800">{p.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono ml-2">
                                                            ({p.lat.toFixed(4)}, {p.lng.toFixed(4)})
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-mono">
                                                        {p.source}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={handleConfirmImport}
                                            disabled={isImporting}
                                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                                        >
                                            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            <span>確認匯入至 Day {selectedTargetDay + 1}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Tab 2: 資料匯出 ────────────────────────────────────── */}
                        {activeTab === 'export' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-4 rounded-2xl border border-gray-200 bg-slate-50 space-y-2">
                                        <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                                            <Calendar className="w-4 h-4" />
                                            <span>iCalendar (.ics) 行事曆</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            包含機票航班、住宿飯店、每日景點參訪時間與行前待辦截止日，相容 Apple Calendar、Google 日曆與 Outlook。
                                        </p>
                                        <button
                                            onClick={handleExportIcs}
                                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                                        >
                                            <Download className="w-4 h-4" />
                                            <span>下載 .ics 檔案</span>
                                        </button>
                                    </div>

                                    <div className="p-4 rounded-2xl border border-gray-200 bg-slate-50 space-y-2">
                                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                                            <Compass className="w-4 h-4" />
                                            <span>GPS 航跡與地標 (.gpx)</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            標準 GPX 1.1 格式，匯出所有行程景點坐標點位與連續旅遊路線，可匯入 Garmin、OsmAnd、CoMaps 與 Google Earth。
                                        </p>
                                        <button
                                            onClick={handleExportGpx}
                                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                                        >
                                            <Download className="w-4 h-4" />
                                            <span>下載 .gpx 檔案</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-2">
                                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                                        <Bug className="w-4 h-4 text-amber-600" />
                                        <span>系統除錯診斷包 (Diagnostic Dump)</span>
                                    </div>
                                    <p className="text-[11px] text-amber-900/80 leading-relaxed">
                                        零成本客戶端診斷報告。一鍵匯出瀏覽器環境、IndexedDB 儲存庫健康狀態與記錄統計（不含敏感個資），供排查資料異常或離線同步疑難問題。
                                    </p>
                                    <button
                                        onClick={handleExportDiagnostic}
                                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>下載系統診斷報告 (.json)</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Tab 3: 日期平移 ────────────────────────────────────── */}
                        {activeTab === 'shift' && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                                    <div className="text-xs text-indigo-900 font-bold flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-indigo-600" />
                                        <span>智慧重新錨定旅程日程 (Move Trip Dates)</span>
                                    </div>
                                    <p className="text-[11px] text-indigo-800/80 leading-relaxed">
                                        出發日期延期或提前時，輸入全新出發日，系統將自動計算天數差，並級聯重新錨定所有每日日程、機票航班時間、住宿入住退房日與待辦事項截止日。
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500 mb-1 block">目前出發日期</label>
                                            <input
                                                type="text"
                                                disabled
                                                value={activeTrip.startDate}
                                                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-500 font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-700 mb-1 block">設定全新出發日</label>
                                            <input
                                                type="date"
                                                value={newStartDate}
                                                onChange={(e) => setNewStartDate(e.target.value)}
                                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {dayDiff !== 0 && (
                                        <div className="p-2.5 rounded-xl bg-white border border-indigo-200 text-xs flex items-center justify-between text-indigo-900">
                                            <span>預估調整幅度：</span>
                                            <span className="font-bold font-mono text-sm text-indigo-600">
                                                {dayDiff > 0 ? `+${dayDiff}` : dayDiff} 天
                                            </span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleShiftDates}
                                        disabled={isShifting || dayDiff === 0}
                                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                            dayDiff === 0
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                                        }`}
                                    >
                                        {isShifting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                        <span>確認平移並重新錨定全旅程</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Tab 4: 專業手冊 ────────────────────────────────────── */}
                        {activeTab === 'brochure' && (
                            <div className="space-y-4 text-center py-4">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-2 shadow-inner">
                                    <BookOpen className="w-7 h-7" />
                                </div>
                                <h4 className="text-base font-bold text-slate-800">專業 A4 旅遊手冊預覽與列印</h4>
                                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                                    自動彙整封面、機票航班確認碼、住宿憑證、每日詳細景點時間軸、重要行前檢查與費用摘要，隨時列印或另存為高品質 PDF。
                                </p>
                                <button
                                    onClick={handleOpenBrochure}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs shadow-md transition inline-flex items-center gap-2"
                                >
                                    <BookOpen className="w-4 h-4" />
                                    <span>開啟旅遊手冊排版視窗</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 旅遊手冊 Modal */}
            <TripBrochureModal
                isOpen={isBrochureOpen}
                onClose={() => setIsBrochureOpen(false)}
                trip={activeTrip}
                dayPlans={dayPlans}
                reservations={reservations}
                packingItems={packingItems}
                expenses={expenses}
            />
        </>
    );
}
