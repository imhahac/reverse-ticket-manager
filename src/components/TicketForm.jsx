import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plane, ChevronDown, ChevronUp, Zap } from 'lucide-react';

const AIRPORTS = [
    'TPE (台北桃園)', 'TSA (台北松山)', 'KHH (高雄小港)', 'RMQ (台中清泉崗)',
    'NRT (東京成田)', 'HND (東京羽田)', 'KIX (大阪關西)', 'NGO (名古屋中部)',
    'CTS (札幌新千歲)', 'OKA (沖繩那霸)', 'FUK (福岡)', 'SDJ (仙台)', 'HKD (函館)'
];

export default function TicketForm({ onAddTicket, editingTicket, onCancelEdit, exchangeRates = { JPY: 0.21, USD: 32.5 } }) {
    const defaultFormData = {
        airline: '',
        price: '',
        currency: 'TWD',
        exchangeRate: '1',
        departRegion: 'TPE (台北桃園)',
        returnRegion: 'NRT (東京成田)',
        outboundDate: '',
        outboundTime: '',
        outboundArrivalDate: '',
        outboundArrivalTime: '',
        inboundDate: '',
        inboundTime: '',
        inboundArrivalDate: '',
        inboundArrivalTime: '',
        outboundFlightNo: '',
        inboundFlightNo: '',
        type: 'normal',
    };

    const [formData, setFormData] = useState(defaultFormData);
    const [isFormExpanded, setIsFormExpanded] = useState(false);
    const [isFetchingFlight, setIsFetchingFlight] = useState(false);

    React.useEffect(() => {
        if (editingTicket) {
            setFormData({ ...defaultFormData, ...editingTicket });
            setIsFormExpanded(true);
        } else {
            setFormData(defaultFormData);
        }
    }, [editingTicket]);

    const handleAutofill = async (segment) => {
        const flightNo = segment === 'outbound' ? formData.outboundFlightNo : formData.inboundFlightNo;
        const flightDate = segment === 'outbound' ? formData.outboundDate : formData.inboundDate;
        
        if (!flightNo || !flightDate) {
            toast.error('請先填寫航班編號與對應的日期');
            return;
        }

        const apiKey = import.meta.env.VITE_AVIATIONSTACK_API_KEY;
        if (!apiKey) {
            toast.error('尚未設定 VITE_AVIATIONSTACK_API_KEY 環境變數', {
                description: '請在開發環境 .env 或 GitHub Actions Secrets 中加入金鑰。'
            });
            return;
        }

        setIsFetchingFlight(true);
        const toastId = toast.loading('正在查詢航班資訊...');
        try {
            // AviationStack free tier only supports HTTP. We use a CORS proxy to avoid Mixed Content errors on HTTPS deployments like GitHub Pages.
            const targetUrl = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${flightNo}`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
            
            const res = await fetch(proxyUrl);
            const wrappedData = await res.json();
            
            if (!wrappedData.contents) throw new Error('Proxy returned empty contents');
            const data = JSON.parse(wrappedData.contents);

            if (data.error) throw new Error(data.error.message || 'API 錯誤');
            if (!data.data || data.data.length === 0) throw new Error(`找不到航班 ${flightNo} 的相關資訊`);

            // Sort by recent scheduled date
            const scheduledFlights = data.data.filter(f => f.flight_date >= flightDate);
            const flight = scheduledFlights.length > 0 ? scheduledFlights[0] : data.data[0];

            if (!flight.departure || !flight.arrival) throw new Error('回傳的航班資訊不齊全');

            const depDateRaw = flight.departure.scheduled ? flight.departure.scheduled.split('T')[0] : flight.flight_date;
            const arrDateRaw = flight.arrival.scheduled ? flight.arrival.scheduled.split('T')[0] : depDateRaw;
            
            // Calculate date offset (usually 0 or 1 for red-eye flights)
            // Parse as local dates to avoid timezone shift (e.g. UTC vs Asia/Taipei difference)
            const parseLocalDate = (dateStr) => {
                const [y, m, d] = dateStr.split('-');
                return new Date(y, m - 1, d);
            };

            const depD = parseLocalDate(depDateRaw);
            const arrD = parseLocalDate(arrDateRaw);
            const dayOffset = Math.round((arrD - depD) / (1000 * 60 * 60 * 24));

            const depTime = flight.departure.scheduled ? flight.departure.scheduled.split('T')[1].substring(0, 5) : '';
            const arrTime = flight.arrival.scheduled ? flight.arrival.scheduled.split('T')[1].substring(0, 5) : '';

            // Apply the offset to the user's selected date safely
            const getOffsetDate = (baseDateStr, offset) => {
                if (!baseDateStr || isNaN(offset)) return baseDateStr;
                const d = parseLocalDate(baseDateStr);
                d.setDate(d.getDate() + offset);
                // format back to YYYY-MM-DD
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            const targetArrivalDate = getOffsetDate(flightDate, dayOffset);

            setFormData(prev => ({
                ...prev,
                ...(segment === 'outbound' ? {
                    outboundTime: depTime,
                    outboundArrivalDate: targetArrivalDate,
                    outboundArrivalTime: arrTime,
                    departRegion: `${flight.departure.iata || ''} (${flight.departure.airport || prev.departRegion})`,
                    returnRegion: `${flight.arrival.iata || ''} (${flight.arrival.airport || prev.returnRegion})`
                } : {
                    inboundTime: depTime,
                    inboundArrivalDate: targetArrivalDate,
                    inboundArrivalTime: arrTime,
                    returnRegion: `${flight.departure.iata || ''} (${flight.departure.airport || prev.returnRegion})`,
                    departRegion: `${flight.arrival.iata || ''} (${flight.arrival.airport || prev.departRegion})`
                }),
                airline: flight.airline ? flight.airline.name : prev.airline
            }));

            toast.success(`已成功帶入航班 ${flightNo} 的時刻表！`, { id: toastId });
        } catch (err) {
            toast.error(`航班查詢失敗：${err.message}`, { id: toastId });
        } finally {
            setIsFetchingFlight(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.airline || !formData.price || !formData.outboundDate) {
            toast.error('請填寫完整資訊 (航空公司、價格、去程日期)');
            return;
        }

        if (formData.type !== 'oneway') {
            if (!formData.inboundDate) {
                toast.error('請填寫第 2 段日期');
                return;
            }
        }

        const buildLocalDateTimeStr = (date, time) => {
            if (!date) return '';
            if (!time) return `${date}T00:00:00`;
            return `${date}T${time}:00`;
        };

        const addOneDay = (dateStr) => {
            const d = new Date(`${dateStr}T00:00:00`);
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        };

        // Smart Cross-Day Fix：若抵達時間早於出發時間，自動 +1 天（紅眼航班）
        // 回傳修正後的 { arrivalDate, arrivalTime }，或 null 代表驗證失敗
        const autoFixArrival = (label, departDate, departTime, arrivalDate, arrivalTime) => {
            const hasArrDate = Boolean(arrivalDate);
            const hasArrTime = Boolean(arrivalTime);
            if (hasArrDate !== hasArrTime) {
                toast.error(`${label}：抵達日期/時間需同時填寫或同時留空`);
                return null;
            }
            if (!hasArrDate && !hasArrTime) return { arrivalDate, arrivalTime, fixed: false };

            const departStr = buildLocalDateTimeStr(departDate, departTime);
            const arriveStr = buildLocalDateTimeStr(arrivalDate, arrivalTime);
            if (departStr && new Date(arriveStr) < new Date(departStr)) {
                // 只有「同日填錯」才自動修正；若跨日後還是早於出發，才報錯
                const fixedDate = addOneDay(arrivalDate);
                const fixedStr = buildLocalDateTimeStr(fixedDate, arrivalTime);
                if (new Date(fixedStr) < new Date(departStr)) {
                    toast.error(`${label}：抵達時間早於出發時間，且無法以 +1 天修正`);
                    return null;
                }
                toast.info(`✈️ ${label}：已自動修正抵達日期 +1 天（紅眼航班跨日）`);
                return { arrivalDate: fixedDate, arrivalTime, fixed: true };
            }
            return { arrivalDate, arrivalTime, fixed: false };
        };

        const outDateTimeStr = buildLocalDateTimeStr(formData.outboundDate, formData.outboundTime);
        const inDateTimeStr = buildLocalDateTimeStr(formData.inboundDate, formData.inboundTime);

        if (formData.type !== 'oneway' && new Date(inDateTimeStr) < new Date(outDateTimeStr)) {
            toast.error('同一張發票中，回程段的日期時間不能早於去程段喔！');
            return;
        }

        const seg1Fix = autoFixArrival('第 1 段航班', formData.outboundDate, formData.outboundTime, formData.outboundArrivalDate, formData.outboundArrivalTime);
        if (seg1Fix === null) return;

        let seg2Fix = { arrivalDate: formData.inboundArrivalDate, arrivalTime: formData.inboundArrivalTime, fixed: false };
        if (formData.type !== 'oneway') {
            seg2Fix = autoFixArrival('第 2 段航班', formData.inboundDate, formData.inboundTime, formData.inboundArrivalDate, formData.inboundArrivalTime);
            if (seg2Fix === null) return;
        }

        const newTicket = {
            ...formData,
            outboundArrivalDate: seg1Fix.arrivalDate,
            outboundArrivalTime: seg1Fix.arrivalTime,
            inboundArrivalDate: seg2Fix.arrivalDate,
            inboundArrivalTime: seg2Fix.arrivalTime,
            id: editingTicket ? editingTicket.id : Date.now().toString(),
            calendarIds: editingTicket ? editingTicket.calendarIds : undefined,
            price: Number(formData.price),
            exchangeRate: Number(formData.exchangeRate),
            priceTWD: Math.round(Number(formData.price) * Number(formData.exchangeRate)),
            outboundFlightNo: formData.outboundFlightNo.toUpperCase(),
            inboundFlightNo: formData.inboundFlightNo.toUpperCase()
        };

        onAddTicket(newTicket);
        setFormData(defaultFormData);
        setIsFormExpanded(false);
    };

    const isReverse = formData.type === 'reverse';

    return (
        <div className={`bg-white rounded-xl shadow-md border ${editingTicket ? 'border-amber-400' : 'border-gray-100'} mb-8 mt-4 transition-all duration-300 overflow-hidden`}>
            {/* Header / Toggle Button */}
            <button 
                type="button"
                onClick={() => setIsFormExpanded(!isFormExpanded)}
                className="w-full p-4 sm:p-6 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors focus:outline-none"
            >
                <div className="flex items-center">
                    <Plane className={`mr-3 w-6 h-6 ${editingTicket ? 'text-amber-500' : 'text-indigo-500'}`} />
                    <h2 className="text-lg md:text-xl font-bold text-gray-800">
                        {editingTicket ? '✏️ 修改機票訂單' : '新增購買機票訂單'}
                    </h2>
                </div>
                <div className={`p-2 rounded-full ${isFormExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                    {isFormExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
            </button>

            {/* Collapsible Form Area */}
            {isFormExpanded && (
                <div className="p-4 sm:p-6 pt-0 border-t border-slate-100 bg-slate-50/50">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">

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
                                    exchangeRate: newCurrency === 'TWD' ? '1'
                                        : newCurrency === 'JPY' ? String(exchangeRates.JPY)
                                        : newCurrency === 'USD' ? String(exchangeRates.USD)
                                        : formData.exchangeRate
                                });
                            }}
                        >
                            <option value="TWD">TWD 台幣</option>
                            <option value="JPY">JPY 日幣</option>
                            <option value="USD">USD 美金</option>
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            匯率(對台幣)
                            {formData.currency !== 'TWD' && (
                                <span className="text-xs font-normal text-emerald-600 ml-1">即時</span>
                            )}
                        </label>
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

                {/* Row 3: Segment Dates & Times with adaptive labels based on type */}
                <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3">
                        <div>
                            <label className="block text-sm font-bold text-indigo-900 mb-1">
                                {formData.type === 'oneway' ? '出發日期與時間' : '第 1 段航班出發時間'}
                                <span className="block text-xs text-indigo-600 font-normal mt-0.5">
                                    ({isReverse ? formData.returnRegion : formData.departRegion} ✈️ {isReverse ? formData.departRegion : formData.returnRegion})
                                </span>
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="date"
                                    className="flex-1 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    value={formData.outboundDate}
                                    onChange={e => setFormData({ ...formData, outboundDate: e.target.value })}
                                />
                                <input
                                    type="time"
                                    step="600"
                                    className="w-full sm:w-32 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    value={formData.outboundTime}
                                    onChange={e => setFormData({ ...formData, outboundTime: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-indigo-800 mb-1">
                                抵達日期與時間 (選填)
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="date"
                                    className="flex-1 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    value={formData.outboundArrivalDate || ''}
                                    onChange={e => setFormData({ ...formData, outboundArrivalDate: e.target.value })}
                                />
                                <input
                                    type="time"
                                    step="600"
                                    className="w-full sm:w-32 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    value={formData.outboundArrivalTime || ''}
                                    onChange={e => setFormData({ ...formData, outboundArrivalTime: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-indigo-800 mb-1">航班編號 (支援自動帶入時間)</label>
                            <div className="flex gap-2">
                                <input
                                    placeholder="例: BR192"
                                    type="text"
                                    className="flex-1 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow uppercase"
                                    value={formData.outboundFlightNo}
                                    onChange={e => setFormData({ ...formData, outboundFlightNo: e.target.value })}
                                />
                                <button
                                    type="button"
                                    disabled={isFetchingFlight}
                                    onClick={() => handleAutofill('outbound')}
                                    className="px-3 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-bold text-xs transition-colors flex items-center shrink-0 disabled:opacity-50"
                                    title="自動從 API 帶入時程"
                                >
                                    <Zap className="w-4 h-4 mr-1" /> 自動帶入
                                </button>
                            </div>
                        </div>
                    </div>

                    {formData.type !== 'oneway' && (
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3">
                            <div>
                                <label className="block text-sm font-bold text-indigo-900 mb-1">
                                    第 2 段航班出發時間
                                    <span className="block text-xs text-indigo-600 font-normal mt-0.5">
                                        ({isReverse ? formData.departRegion : formData.returnRegion} ✈️ {isReverse ? formData.returnRegion : formData.departRegion})
                                    </span>
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="date"
                                        className="flex-1 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                        value={formData.inboundDate}
                                        onChange={e => setFormData({ ...formData, inboundDate: e.target.value })}
                                    />
                                    <input
                                        type="time"
                                        step="600"
                                        className="w-full sm:w-32 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                        value={formData.inboundTime}
                                        onChange={e => setFormData({ ...formData, inboundTime: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-indigo-800 mb-1">
                                    抵達日期與時間 (選填)
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="date"
                                        className="flex-1 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                        value={formData.inboundArrivalDate || ''}
                                        onChange={e => setFormData({ ...formData, inboundArrivalDate: e.target.value })}
                                    />
                                    <input
                                        type="time"
                                        step="600"
                                        className="w-full sm:w-32 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                        value={formData.inboundArrivalTime || ''}
                                        onChange={e => setFormData({ ...formData, inboundArrivalTime: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-indigo-800 mb-1">航班編號 (支援自動帶入時間)</label>
                                <div className="flex gap-2">
                                    <input
                                        placeholder="例: JX801"
                                        type="text"
                                        className="flex-1 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow uppercase"
                                        value={formData.inboundFlightNo}
                                        onChange={e => setFormData({ ...formData, inboundFlightNo: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        disabled={isFetchingFlight}
                                        onClick={() => handleAutofill('inbound')}
                                        className="px-3 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-bold text-xs transition-colors flex items-center shrink-0 disabled:opacity-50"
                                        title="自動從 API 帶入時程"
                                    >
                                        <Zap className="w-4 h-4 mr-1" /> 自動帶入
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                    <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2 flex flex-col sm:flex-row gap-3">
                        <button type="submit" className={`w-full sm:w-auto px-8 py-3 text-white font-bold rounded-lg transition duration-200 shadow hover:shadow-lg flex items-center justify-center ${editingTicket ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                            {editingTicket ? '💾 儲存修改' : '＋ 將此訂單加入系統'}
                        </button>
                        {editingTicket && (
                            <button type="button" onClick={onCancelEdit} className="w-full sm:w-auto px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition duration-200 shadow-sm flex items-center justify-center border border-gray-300">
                                取消修改
                            </button>
                        )}
                    </div>
                </form>
                </div>
            )}
        </div>
    );
}
