import React, { useState, useMemo, useRef } from 'react';
import { Plane, Calendar, Trash2, ArrowRight, BookOpen, AlertCircle, CheckCircle2, ListFilter, Download, Upload, Cloud, CloudUpload, CloudDownload, LogOut, LogIn } from 'lucide-react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { syncToDrive, loadFromDrive, syncToCalendar } from './utils/googleSync';
import { useLocalStorage } from './hooks/useLocalStorage';

function Instructions() {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl mb-8 overflow-hidden shadow-sm transition-all duration-300">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-blue-100/50 hover:bg-blue-100 text-blue-900 transition-colors"
            >
                <span className="flex items-center text-lg font-bold">
                    <BookOpen className="w-5 h-5 mr-2" />
                    使用說明與操作指南
                </span>
                <span className="text-sm font-medium">{isOpen ? '收起 ▴' : '展開 ▾'}</span>
            </button>

            {isOpen && (
                <div className="p-5 text-blue-900">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-bold flex items-center mb-2"><AlertCircle className="w-4 h-4 mr-1" /> 系統運作邏輯</h3>
                            <p className="text-sm mb-2 leading-relaxed">
                                本系統專門用來解決「混買來回票」所造成的日期混淆。系統會將你買的每一筆來回訂單拆解成兩張單程票，接著按照**時間順序重新排列**。
                            </p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                <li><strong>正向票</strong>：第一段是「出發地 → 目的地」，第二段是「目的地 → 出發地」。</li>
                                <li><strong>反向票</strong>：第一段是「目的地 → 出發地」，第二段是「出發地 → 目的地」。</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold flex items-center mb-2"><CheckCircle2 className="w-4 h-4 mr-1" /> 操作步驟 & 新功能</h3>
                            <ul className="list-decimal list-inside text-sm space-y-2 leading-relaxed">
                                <li>於下方表單輸入機票資訊，支援 <strong>單程票 (One-way)</strong> 與 <strong>多幣別換算 (TWD/JPY/USD)</strong>。</li>
                                <li>切換 <strong>「實際飛行配對」</strong>，系統為你拼湊真正的趟次並精算成本。點擊趟次標題旁的 ✏️ 即可<strong>自訂行程命名</strong>。</li>
                                <li><strong>【雲端跨裝置同步】</strong>點擊右上角「登入 Google」，授權後即可一鍵 <strong>雲端備份/載入</strong> 到你私人的 Google Drive。</li>
                                <li><strong>【行事曆與推播】</strong>登入後點擊「同步日曆」，航班將自動排入你的 Google 行事曆；若有設定 GitHub Actions，系統還會每日透過 LINE 推播提醒！</li>
                                <li>或者，你也可以點擊右上角使用傳統的 <strong>「本地匯出 / 匯入 JSON」</strong> 來搬移資料。</li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-blue-200/50 flex space-x-2 text-xs text-blue-700">
                        <span className="bg-blue-100 flex items-center px-2 py-1 rounded">🛡️ 隱私保證：你的資料只存在自己瀏覽器內，不會上傳雲端。(匯入匯出亦在本地完成)</span>
                    </div>
                </div>
            )}
        </div>
    );
}

const AIRPORTS = [
    'TPE (台北桃園)', 'TSA (台北松山)', 'KHH (高雄小港)', 'RMQ (台中清泉崗)',
    'NRT (東京成田)', 'HND (東京羽田)', 'KIX (大阪關西)', 'NGO (名古屋中部)',
    'CTS (札幌新千歲)', 'OKA (沖繩那霸)', 'FUK (福岡)', 'SDJ (仙台)', 'HKD (函館)'
];

function TicketForm({ onAddTicket }) {
    const [formData, setFormData] = useState({
        airline: '',
        price: '',
        currency: 'TWD',
        exchangeRate: '1',
        departRegion: 'TPE (台北桃園)',
        returnRegion: 'NRT (東京成田)',
        outboundDate: '',
        inboundDate: '',
        type: 'normal',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.airline || !formData.price || !formData.outboundDate || (formData.type !== 'oneway' && !formData.inboundDate)) {
            alert('請填寫完整資訊');
            return;
        }
        // Simple validation: make sure segment 2 doesn't happen before segment 1 inside the SAME ticket
        if (formData.type !== 'oneway' && new Date(formData.inboundDate) < new Date(formData.outboundDate)) {
            alert('同一張發票中，回程段的日期不能早於去程段喔！');
            return;
        }

        const basePrice = Number(formData.price);
        const rate = Number(formData.exchangeRate) || 1;
        const priceInTWD = Math.round(basePrice * rate);

        onAddTicket({
            ...formData,
            id: Date.now().toString(),
            price: basePrice,
            priceTWD: priceInTWD,
        });
        setFormData({ ...formData, airline: '', price: '', outboundDate: '', inboundDate: '' });
    };

    const isReverse = formData.type === 'reverse';

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 mb-8 mt-4">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center border-b pb-3">
                <Plane className="mr-2 text-indigo-500" /> 新增購買機票訂單
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

                {/* Row 1 */}
                <div className="col-span-1 md:col-span-2 lg:col-span-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">票種設定</label>
                    <div className="flex p-1 bg-gray-100 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'normal' })}
                            className={`flex-1 text-sm py-1.5 rounded-l-md font-medium transition-colors ${formData.type === 'normal' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            正向 (台灣出發)
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'reverse' })}
                            className={`flex-1 text-sm py-1.5 font-medium transition-colors ${formData.type === 'reverse' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            反向 (外站出發)
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'oneway' })}
                            className={`flex-1 text-sm py-1.5 rounded-r-md font-medium transition-colors border-l border-gray-200 ${formData.type === 'oneway' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            單程
                        </button>
                    </div>
                </div>

                <datalist id="airports-list">
                    {AIRPORTS.map(ap => <option key={ap} value={ap} />)}
                </datalist>

                <div className="col-span-1 md:col-span-2 lg:col-span-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">航空公司 / 備註</label>
                    <input
                        type="text"
                        placeholder="例如: 長榮 BR192"
                        className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                        value={formData.airline}
                        onChange={e => setFormData({ ...formData, airline: e.target.value })}
                    />
                </div>
                <div className="col-span-1 md:col-span-2 lg:col-span-2 grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">幣別</label>
                        <select
                            className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                            value={formData.currency}
                            onChange={e => {
                                const newCurrency = e.target.value;
                                setFormData({
                                    ...formData,
                                    currency: newCurrency,
                                    // Auto-suggest rough exchange rates
                                    exchangeRate: newCurrency === 'TWD' ? '1' : newCurrency === 'JPY' ? '0.21' : newCurrency === 'USD' ? '32.5' : formData.exchangeRate
                                });
                            }}
                        >
                            <option value="TWD">TWD 台幣</option>
                            <option value="JPY">JPY 日幣</option>
                            <option value="USD">USD 美金</option>
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">匯率(對台幣)</label>
                        <input
                            type="number" step="0.001"
                            disabled={formData.currency === 'TWD'}
                            className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 disabled:opacity-50"
                            value={formData.exchangeRate}
                            onChange={e => setFormData({ ...formData, exchangeRate: e.target.value })}
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">原幣總價</label>
                        <input
                            type="number"
                            placeholder="例如: 16000"
                            className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                        />
                    </div>
                </div>

                {/* Row 2: Regions Configuration */}
                <div className="col-span-1 md:col-span-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">航點設定 (支援 IATA 代碼)</div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-600 mb-1">您的出發地 (Home)</label>
                            <input
                                autoComplete="off"
                                list="airports-list"
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={formData.departRegion}
                                onChange={e => setFormData({ ...formData, departRegion: e.target.value })}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-600 mb-1">國外目的地 (Away)</label>
                            <input
                                autoComplete="off"
                                list="airports-list"
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={formData.returnRegion}
                                onChange={e => setFormData({ ...formData, returnRegion: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Row 3: Segment Dates with adaptive labels based on type */}
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                    <label className="block text-sm font-bold text-indigo-900 mb-1">
                        {formData.type === 'oneway' ? '出發日期' : '第 1 段航班日期'}
                        <span className="block text-xs text-indigo-600 font-normal mt-0.5">
                            ({isReverse ? formData.returnRegion : formData.departRegion} ✈️ {isReverse ? formData.departRegion : formData.returnRegion})
                        </span>
                    </label>
                    <input
                        type="date"
                        className="w-full p-2 border border-indigo-200 rounded-md focus:ring-indigo-500"
                        value={formData.outboundDate}
                        onChange={e => setFormData({ ...formData, outboundDate: e.target.value })}
                    />
                </div>
                {formData.type !== 'oneway' && (
                    <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                        <label className="block text-sm font-bold text-indigo-900 mb-1">
                            第 2 段航班日期
                            <span className="block text-xs text-indigo-600 font-normal mt-0.5">
                                ({isReverse ? formData.departRegion : formData.returnRegion} ✈️ {isReverse ? formData.returnRegion : formData.departRegion})
                            </span>
                        </label>
                        <input
                            type="date"
                            className="w-full p-2 border border-indigo-200 rounded-md focus:ring-indigo-500"
                            value={formData.inboundDate}
                            onChange={e => setFormData({ ...formData, inboundDate: e.target.value })}
                        />
                    </div>
                )}

                <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2">
                    <button type="submit" className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition duration-200 shadow hover:shadow-lg flex items-center justify-center">
                        ＋ 將此訂單加入系統
                    </button>
                </div>
            </form>
        </div>
    );
}

function TicketList({ tickets, onDelete }) {
    if (tickets.length === 0) return (
        <div className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            尚未購買機票，請上方新增
        </div>
    );

    return (
        <div className="bg-white rounded-xl shadow border border-gray-100">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">票種/標籤</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">航段一 (去程)</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">航段二 (回程)</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">花費</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">管理</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {tickets.map(ticket => {
                            const Segment1 = ticket.type === 'normal' || ticket.type === 'oneway'
                                ? `${ticket.departRegion} ✈️ ${ticket.returnRegion}`
                                : `${ticket.returnRegion} ✈️ ${ticket.departRegion}`;
                            const Segment2 = ticket.type === 'oneway'
                                ? '無 (單程票)'
                                : ticket.type === 'normal'
                                    ? `${ticket.returnRegion} ✈️ ${ticket.departRegion}`
                                    : `${ticket.departRegion} ✈️ ${ticket.returnRegion}`;

                            return (
                                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-4 font-bold rounded shadow-sm ${ticket.type === 'normal' ? 'bg-indigo-100 text-indigo-700' :
                                                ticket.type === 'reverse' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {ticket.type === 'normal' ? '正向票' : ticket.type === 'reverse' ? '反向票' : '單程票'}
                                            </span>
                                            <span className="text-sm font-medium text-gray-900">{ticket.airline}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 font-medium">{Segment1}</div>
                                        <div className="text-sm text-gray-500 mt-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> {ticket.outboundDate}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 font-medium">{Segment2}</div>
                                        {ticket.type !== 'oneway' && (
                                            <div className="text-sm text-gray-500 mt-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> {ticket.inboundDate}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                                        {ticket.currency === 'TWD' ? (
                                            `NT$ ${ticket.priceTWD?.toLocaleString() || ticket.price.toLocaleString()}`
                                        ) : (
                                            <div className="flex flex-col">
                                                <span>NT$ {ticket.priceTWD?.toLocaleString() || Math.round(ticket.price).toLocaleString()}</span>
                                                <span className="text-xs text-gray-400 font-normal">{ticket.currency} {ticket.price.toLocaleString()} (@{ticket.exchangeRate})</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => onDelete(ticket.id)} className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TripTimeline({ tickets, tripLabels, onUpdateLabel }) {
    const segments = useMemo(() => {
        let segs = [];
        tickets.forEach(t => {
            if (t.type === 'normal') {
                segs.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, from: t.departRegion, to: t.returnRegion });
                segs.push({ id: t.id + '-2', ticket: t, date: t.inboundDate, from: t.returnRegion, to: t.departRegion });
            } else {
                segs.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, from: t.returnRegion, to: t.departRegion });
                segs.push({ id: t.id + '-2', ticket: t, date: t.inboundDate, from: t.departRegion, to: t.returnRegion });
            }
        });
        return segs.sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [tickets]);

    const trips = useMemo(() => {
        let result = [];
        for (let i = 0; i < segments.length; i += 2) {
            if (i + 1 < segments.length) {
                result.push({ out: segments[i], in: segments[i + 1] });
            } else {
                result.push({ out: segments[i], in: null });
            }
        }
        return result;
    }, [segments]);

    if (segments.length === 0) return (
        <div className="p-12 mt-6 text-center bg-white border border-gray-100 rounded-xl shadow-sm text-gray-400">
            <Plane className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>這裡將會顯示由系統自動排出的飛行趟次表，請先建立機票訂單。</p>
        </div>
    );

    const isTaiwan = (regionStr) => {
        const twCodes = ['TPE', 'TSA', 'KHH', 'RMQ'];
        return twCodes.some(code => regionStr.includes(code));
    };

    return (
        <div className="space-y-6 mt-6">
            {trips.map((trip, idx) => {
                const isComplete = trip.out && trip.in;
                // Loose Matching: Date contradiction check
                const hasDateError = trip.in && new Date(trip.out.date) > new Date(trip.in.date);

                // Open-Jaw Check
                let isOpenJawError = false;
                if (isComplete && !hasDateError) {
                    const outFromTw = isTaiwan(trip.out.from);
                    const inToTw = isTaiwan(trip.in.to);
                    // Standard matching assumes Outbound is From Home, Inbound is To Home
                    if (!outFromTw || !inToTw) isOpenJawError = true;
                }

                const hasError = hasDateError;

                // Calculate Trip Cost
                const outCost = Math.round((trip.out.ticket.priceTWD || trip.out.ticket.price) / (trip.out.ticket.type === 'oneway' ? 1 : 2));
                const inCost = trip.in ? Math.round((trip.in.ticket.priceTWD || trip.in.ticket.price) / (trip.in.ticket.type === 'oneway' ? 1 : 2)) : 0;
                const tripTotalCost = outCost + inCost;

                const comboKey = trip.in ? `${trip.out.id}_${trip.in.id}` : `${trip.out.id}_null`;
                const customName = tripLabels && tripLabels[comboKey] ? tripLabels[comboKey] : `趟次 #${idx + 1}`;

                return (
                    <div key={idx} className={`p-5 rounded-xl border-2 shadow-sm relative overflow-hidden ${hasError ? 'border-red-400 bg-red-50' : 'border-indigo-100 bg-white'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-2 ${hasError ? 'bg-red-500' : isOpenJawError ? 'bg-yellow-500' : 'bg-indigo-500'}`}></div>

                        <div className="flex justify-between items-center mb-4 pl-3">
                            <h3 className="font-extrabold text-xl text-gray-800 flex items-center group cursor-pointer"
                                onClick={() => {
                                    const newName = window.prompt('請輸入自訂趟次名稱 (留空則恢復預設):', (tripLabels && tripLabels[comboKey]) || '');
                                    if (newName !== null) {
                                        onUpdateLabel(comboKey, newName.trim());
                                    }
                                }}
                            >
                                {customName}
                                <span className="ml-2 text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">✏️ 編輯命名</span>
                            </h3>
                            <div className="flex gap-2">
                                <span className="flex items-center text-slate-700 font-bold text-sm bg-slate-100 px-3 py-1 rounded-full shadow-sm">
                                    此趟成本: NT$ {tripTotalCost.toLocaleString()}
                                </span>
                                {hasError && <span className="flex items-center text-white font-bold text-xs bg-red-500 px-3 py-1 rounded-full shadow-sm"><AlertCircle className="w-3 h-3 mr-1" /> 日期矛盾</span>}
                                {isOpenJawError && !hasError && <span className="flex items-center text-yellow-800 font-bold text-xs bg-yellow-200 px-3 py-1 rounded-full shadow-sm"><AlertCircle className="w-3 h-3 mr-1" /> 不同點進出 (可能錯置)</span>}
                                {!isComplete && <span className="flex items-center text-orange-800 font-bold text-xs bg-orange-200 px-3 py-1 rounded-full"><AlertCircle className="w-3 h-3 mr-1" /> 缺回程段</span>}
                                {isComplete && !hasError && !isOpenJawError && <span className="flex items-center text-green-800 font-bold text-xs bg-green-100 px-3 py-1 rounded-full"><CheckCircle2 className="w-3 h-3 mr-1" /> 配對成功</span>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-3">
                            {/* 去程段 */}
                            <div className="relative group">
                                <div className="text-xs text-indigo-600 font-bold mb-2 uppercase tracking-wide">🛫 實際去程 (Outbound)</div>
                                <div className="bg-gray-50 border border-gray-100 p-4 rounded-lg group-hover:shadow-md transition-shadow">
                                    <div className="flex items-center text-gray-900 font-bold text-lg mb-2">
                                        {trip.out.from} <ArrowRight className="mx-2 text-indigo-300 w-5 h-5 flex-shrink-0" /> {trip.out.to}
                                    </div>
                                    <div className="text-sm text-gray-600 flex justify-between items-center">
                                        <span className="flex items-center font-medium"><Calendar className="w-4 h-4 mr-1.5 text-indigo-400" /> {trip.out.date}</span>
                                        <span className={`px-2 py-1 rounded shadow-sm text-[10px] font-bold ${trip.out.ticket.type === 'normal' ? 'bg-indigo-100 text-indigo-800' :
                                            trip.out.ticket.type === 'reverse' ? 'bg-purple-100 text-purple-800' :
                                                'bg-emerald-100 text-emerald-800'
                                            }`}>
                                            {trip.out.ticket.airline} ({trip.out.ticket.type === 'normal' ? '正向票' : trip.out.ticket.type === 'reverse' ? '反向票' : '單程票'})
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 回程段 */}
                            {trip.in ? (
                                <div className="relative group">
                                    <div className="text-xs text-orange-600 font-bold mb-2 uppercase tracking-wide">🛬 實際回程 (Inbound)</div>
                                    <div className="bg-gray-50 border border-gray-100 p-4 rounded-lg group-hover:shadow-md transition-shadow">
                                        <div className="flex items-center text-gray-900 font-bold text-lg mb-2">
                                            {trip.in.from} <ArrowRight className="mx-2 text-orange-300 w-5 h-5 flex-shrink-0" /> {trip.in.to}
                                        </div>
                                        <div className="text-sm text-gray-600 flex justify-between items-center">
                                            <span className="flex items-center font-medium"><Calendar className="w-4 h-4 mr-1.5 text-orange-400" /> {trip.in.date}</span>
                                            <span className={`px-2 py-1 rounded shadow-sm text-[10px] font-bold ${trip.in.ticket.type === 'normal' ? 'bg-indigo-100 text-indigo-800' :
                                                trip.in.ticket.type === 'reverse' ? 'bg-purple-100 text-purple-800' :
                                                    'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                {trip.in.ticket.airline} ({trip.in.ticket.type === 'normal' ? '正向票' : trip.in.ticket.type === 'reverse' ? '反向票' : '單程票'})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 p-6 min-h-[120px]">
                                    <AlertCircle className="w-6 h-6 mb-2 text-gray-300" />
                                    <span className="font-medium text-sm">尚未購買此趟回程機票</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TripCalendar({ tickets }) {
    if (tickets.length === 0) return (
        <div className="p-12 mt-6 text-center bg-white border border-gray-100 rounded-xl shadow-sm text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>請先新增機票，系統會自動為您繪製飛行月曆。</p>
        </div>
    );

    const segments = tickets.flatMap(t => {
        if (t.type === 'normal') {
            return [
                { id: t.id + '-1', ticket: t, date: t.outboundDate, from: t.departRegion, to: t.returnRegion },
                { id: t.id + '-2', ticket: t, date: t.inboundDate, from: t.returnRegion, to: t.departRegion }
            ];
        } else if (t.type === 'reverse') {
            return [
                { id: t.id + '-1', ticket: t, date: t.outboundDate, from: t.returnRegion, to: t.departRegion },
                { id: t.id + '-2', ticket: t, date: t.inboundDate, from: t.departRegion, to: t.returnRegion }
            ];
        } else {
            // One-way
            return [
                { id: t.id + '-1', ticket: t, date: t.outboundDate, from: t.departRegion, to: t.returnRegion }
            ]
        }
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group segments by month
    const segmentsByMonth = segments.reduce((acc, seg) => {
        const monthKey = seg.date.substring(0, 7); // YYYY-MM
        if (!acc[monthKey]) acc[monthKey] = [];
        acc[monthKey].push(seg);
        return acc;
    }, {});

    const sortedMonths = Object.keys(segmentsByMonth).sort();

    return (
        <div className="mt-6 space-y-8">
            {sortedMonths.map(month => (
                <div key={month} className="bg-white border text-slate-800 border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="bg-slate-100 px-4 py-3 border-b border-gray-200 font-bold text-lg flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-indigo-600" /> {month}
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                        {segmentsByMonth[month].map(seg => {
                            const isReturnToTaiwan = seg.to.includes('TPE') || seg.to.includes('TSA') || seg.to.includes('KHH') || seg.to.includes('RMQ');
                            return (
                                <div key={seg.id} className="flex flex-col sm:flex-row p-3 hover:bg-slate-50 border border-slate-100 rounded-lg group transition-colors">
                                    <div className="sm:w-32 flex-shrink-0 font-bold text-indigo-700 flex items-center mb-2 sm:mb-0">
                                        <span className="bg-indigo-50 px-2 py-1 rounded text-sm group-hover:bg-indigo-100">{seg.date.substring(8, 10)} 日</span>
                                        <span className="mx-2 text-slate-300">|</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`text-lg font-bold ${isReturnToTaiwan ? 'text-orange-600' : 'text-indigo-600'}`}>
                                                {seg.from} <ArrowRight className="inline w-4 h-4 text-slate-400" /> {seg.to}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${seg.ticket.type === 'normal' ? 'bg-indigo-100 text-indigo-800' :
                                                    seg.ticket.type === 'reverse' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                機票來源: {seg.ticket.airline} ({seg.ticket.type === 'normal' ? '正向' : seg.ticket.type === 'reverse' ? '反向' : '單程'})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
            <div className="text-center text-slate-400 text-sm italic mt-8">💡 上方月曆依日期將每一段單程獨立顯示，方便您一眼看出各個月份的動態。</div>
        </div>
    );
}

function App() {
    const [tickets, setTickets] = useLocalStorage('reverse-tickets', []);
    const [tripLabels, setTripLabels] = useLocalStorage('reverse-trip-labels', {});
    const [accessToken, setAccessToken] = useLocalStorage('google-access-token', null);
    const [activeTab, setActiveTab] = useState('timeline');
    const [isSyncing, setIsSyncing] = useState(false);
    const fileInputRef = useRef(null);

    const addTicket = (ticket) => setTickets([...tickets, ticket]);
    const deleteTicket = (id) => {
        if (window.confirm('確定要刪除這筆機票訂單嗎？相關的趟次配對將會被移除。')) {
            setTickets(tickets.filter(t => t.id !== id));
        }
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
                // Backward compatibility: imported data might be just an array of tickets
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

                if (window.confirm(`成功讀取 ${newTickets.length} 筆機票資料，要覆寫目前所有訂單嗎？`)) {
                    setTickets(newTickets);
                    setTripLabels(newLabels);
                    alert('匯入成功！');
                }
            } catch (err) {
                alert('檔案格式錯誤或損毀，匯入失敗。');
                console.error(err);
            }
            // reset input
            e.target.value = '';
        };
        reader.readAsText(file);
    };

    const login = useGoogleLogin({
        onSuccess: (codeResponse) => {
            setAccessToken(codeResponse.access_token);
            alert('Google 登入成功！');
        },
        onError: (error) => {
            console.error('Login Failed:', error);
            alert(`Google 登入失敗\n錯誤訊息: ${error?.error_description || error?.error || '未知錯誤'}\n請確認您的 Client ID 是否正確，以及是否將目前網址加入 GCP Console 的「已授權的 JavaScript 來源」。`);
        },
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events'
    });

    const logout = () => {
        googleLogout();
        setAccessToken(null);
    };

    const handleSyncToDrive = async () => {
        if (!accessToken) return alert('請先登入 Google');
        setIsSyncing(true);
        const res = await syncToDrive(tickets, tripLabels, accessToken);
        setIsSyncing(false);
        if (res.success) {
            alert(`雲端同步成功！資料已備份至 Google Drive。\n(雲端檔案 ID: ${res.fileId})`);
        } else {
            alert(`雲端同步失敗 ❌\n錯誤訊息：\n${res.error}\n\n可能原因：您的權限不足或者 API 呼叫格式錯誤。`);
        }
    };

    const handleLoadFromDrive = async () => {
        if (!accessToken) return alert('請先登入 Google');
        setIsSyncing(true);
        const res = await loadFromDrive(accessToken);
        setIsSyncing(false);
        
        if (res.success) {
            if (window.confirm(`【雲端讀取成功】\n共找到 ${res.tickets.length} 筆趟次。\n(找到的檔案：\n${res.foundFilesLog})\n\n確定要覆寫您目前的訂單表嗎？`)) {
                setTickets(res.tickets);
                setTripLabels(res.tripLabels || {});
            }
        } else {
            alert(`雲端載入失敗 ❌\n錯誤訊息：\n${res.error}`);
        }
    };

    const handleSyncToCalendar = async () => {
        if (!accessToken) return alert('請先登入 Google');
        setIsSyncing(true);
        const res = await syncToCalendar(tickets, accessToken);
        setIsSyncing(false);
        if (res.success) {
            alert(`日曆同步成功！\n共新增了 ${res.count} 個航班事件。\n\n${res.error ? `部分警告：\n${res.error}` : ''}`);
        } else {
            alert(`日曆同步失敗 ❌\n錯誤訊息：\n${res.error}\n可能 Access Token 已過期或是這本行事曆設定有誤，請嘗試重新登入。`);
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
                            <p className="text-emerald-50 font-medium mb-1">預計可換得趟次</p>
                            <p className="text-3xl font-extrabold">{Math.ceil((tickets.length * 2) / 2)} 趟次</p>
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

                <TicketForm onAddTicket={addTicket} />

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
                        {activeTab === 'timeline' && <TripTimeline tickets={tickets} tripLabels={tripLabels} onUpdateLabel={updateLabel} />}
                        {activeTab === 'list' && <TicketList tickets={tickets} onDelete={deleteTicket} />}
                        {activeTab === 'calendar' && <TripCalendar tickets={tickets} />}
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
