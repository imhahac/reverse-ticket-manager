import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { toast } from 'sonner';
import { Plane, ChevronDown, ChevronUp } from 'lucide-react';
import { lookupFlight, getOffsetDate } from '../services/flightService';
import { buildLocalDateTimeStr, autoFixArrival } from '../utils/formUtils';
import { useAppContext } from '../contexts/AppContext';

// 匯入子組件
import FlightSegmentInput from './ticket/FlightSegmentInput';
import PriceInputSection from './ticket/PriceInputSection';
import AirportInputSection from './ticket/AirportInputSection';

const AIRPORTS = [
    'TPE (台北桃園)', 'TSA (台北松山)', 'KHH (高雄小港)', 'RMQ (台中清泉崗)',
    'NRT (東京成田)', 'HND (東京羽田)', 'KIX (大阪關西)', 'NGO (名古屋中部)',
    'CTS (札幌新千歲)', 'OKA (沖繩那霸)', 'FUK (福岡)', 'SDJ (仙台)', 'HKD (函館)'
];

export default function TicketForm() {
    const { handleSaveTicket: onAddTicket, editingTicket, handleCancelEdit: onCancelEdit, exchangeRates = { JPY: 0.21, USD: 32.5 } } = useAppContext();
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

        setIsFetchingFlight(true);
        const toastId = toast.loading(`正在查詢航班 ${flightNo.toUpperCase()} ...`);

        const applyData = (flightData, sourceLabel) => {
            const targetArrivalDate = getOffsetDate(flightDate, flightData.dayOffset);
            const isReverse = formData.type === 'reverse';

            setFormData(prev => ({
                ...prev,
                ...(segment === 'outbound' ? {
                    outboundTime: flightData.depTime,
                    outboundArrivalDate: targetArrivalDate,
                    outboundArrivalTime: flightData.arrTime,
                    outboundFlightICAO: flightData.flightIcao || prev.outboundFlightICAO || '',
                    ...(!isReverse ? {
                        departRegion: flightData.originIata ? `${flightData.originIata} (${flightData.originName || prev.departRegion})` : prev.departRegion,
                        returnRegion: flightData.destIata ? `${flightData.destIata} (${flightData.destName || prev.returnRegion})` : prev.returnRegion
                    } : {
                        returnRegion: flightData.originIata ? `${flightData.originIata} (${flightData.originName || prev.returnRegion})` : prev.returnRegion,
                        departRegion: flightData.destIata ? `${flightData.destIata} (${flightData.destName || prev.departRegion})` : prev.departRegion
                    })
                } : {
                    inboundTime: flightData.depTime,
                    inboundArrivalDate: targetArrivalDate,
                    inboundArrivalTime: flightData.arrTime,
                    inboundFlightICAO: flightData.flightIcao || prev.inboundFlightICAO || '',
                    ...(!isReverse ? {
                        returnRegion: flightData.originIata ? `${flightData.originIata} (${flightData.originName || prev.returnRegion})` : prev.returnRegion,
                        departRegion: flightData.destIata ? `${flightData.destIata} (${flightData.destName || prev.departRegion})` : prev.departRegion
                    } : {
                        departRegion: flightData.originIata ? `${flightData.originIata} (${flightData.originName || prev.departRegion})` : prev.departRegion,
                        returnRegion: flightData.destIata ? `${flightData.destIata} (${flightData.destName || prev.returnRegion})` : prev.returnRegion
                    })
                }),
                airline: flightData.airline || prev.airline
            }));

            toast.success(`已從 ${sourceLabel} 取得航班 ${flightNo.toUpperCase()} 時程！`, { id: toastId });
        };

        try {
            const flightData = await lookupFlight(flightNo, flightDate);
            if (flightData) {
                applyData(flightData, flightData.source);
            } else {
                toast.error('查無航班資訊或查詢失敗', { id: toastId });
            }
        } catch (err) {
            toast.error(`查詢失敗：${err.message}`, { id: toastId });
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

        if (Number(formData.price) <= 0) {
            toast.error('機票價格必須大於 0');
            return;
        }

        if (!formData.departRegion || !formData.returnRegion) {
            toast.error('出發與抵達機場不能為空！');
            return;
        }

        if (formData.type !== 'oneway') {
            if (!formData.inboundDate) {
                toast.error('請填寫第 2 段日期');
                return;
            }
        }

        const outDateTimeStr = buildLocalDateTimeStr(formData.outboundDate, formData.outboundTime);
        const outDateObj = new Date(outDateTimeStr || formData.outboundDate);

        if (isNaN(outDateObj.getTime())) {
            toast.error('去程日期無效，請檢查輸入格式');
            return;
        }

        let inDateTimeStr = null;

        if (formData.type !== 'oneway') {
            inDateTimeStr = buildLocalDateTimeStr(formData.inboundDate, formData.inboundTime);
            const inDateObj = new Date(inDateTimeStr || formData.inboundDate);

            if (isNaN(inDateObj.getTime())) {
                toast.error('回程日期無效，請檢查輸入格式');
                return;
            }

            if (inDateTimeStr && outDateTimeStr && inDateObj < outDateObj) {
                toast.error('同一張發票中，回程段的日期時間不能早於去程段喔！');
                return;
            }
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

                        <PriceInputSection 
                            formData={formData} 
                            setFormData={setFormData}
                            exchangeRates={exchangeRates}
                        />

                        <AirportInputSection 
                            departRegion={formData.departRegion}
                            returnRegion={formData.returnRegion}
                            onChangeDepart={val => setFormData({ ...formData, departRegion: val })}
                            onChangeReturn={val => setFormData({ ...formData, returnRegion: val })}
                        />

                        {/* Row 3: Segment Dates & Times with adaptive labels based on type */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <FlightSegmentInput
                                labelTitle={formData.type === 'oneway' ? '出發日期與時間' : '第 1 段航班出發時間'}
                                routeText={`(${isReverse ? formData.returnRegion : formData.departRegion} ✈️ ${isReverse ? formData.departRegion : formData.returnRegion})`}
                                date={formData.outboundDate}
                                time={formData.outboundTime}
                                arrivalDate={formData.outboundArrivalDate}
                                arrivalTime={formData.outboundArrivalTime}
                                flightNo={formData.outboundFlightNo}
                                onDateChange={val => setFormData({ ...formData, outboundDate: val })}
                                onTimeChange={val => setFormData({ ...formData, outboundTime: val })}
                                onArrivalDateChange={val => setFormData({ ...formData, outboundArrivalDate: val })}
                                onArrivalTimeChange={val => setFormData({ ...formData, outboundArrivalTime: val })}
                                onFlightNoChange={val => setFormData({ ...formData, outboundFlightNo: val })}
                                onAutofill={() => handleAutofill('outbound')}
                                isFetchingFlight={isFetchingFlight}
                            />

                            {formData.type !== 'oneway' && (
                                <FlightSegmentInput
                                    labelTitle="第 2 段航班出發時間"
                                    routeText={`(${isReverse ? formData.departRegion : formData.returnRegion} ✈️ ${isReverse ? formData.returnRegion : formData.departRegion})`}
                                    date={formData.inboundDate}
                                    time={formData.inboundTime}
                                    arrivalDate={formData.inboundArrivalDate}
                                    arrivalTime={formData.inboundArrivalTime}
                                    flightNo={formData.inboundFlightNo}
                                    onDateChange={val => setFormData({ ...formData, inboundDate: val })}
                                    onTimeChange={val => setFormData({ ...formData, inboundTime: val })}
                                    onArrivalDateChange={val => setFormData({ ...formData, inboundArrivalDate: val })}
                                    onArrivalTimeChange={val => setFormData({ ...formData, inboundArrivalTime: val })}
                                    onFlightNoChange={val => setFormData({ ...formData, inboundFlightNo: val })}
                                    onAutofill={() => handleAutofill('inbound')}
                                    isFetchingFlight={isFetchingFlight}
                                />
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

