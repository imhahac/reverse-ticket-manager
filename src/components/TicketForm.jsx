import React, { useState } from 'react';
import { Plane } from 'lucide-react';

const AIRPORTS = [
    'TPE (台北桃園)', 'TSA (台北松山)', 'KHH (高雄小港)', 'RMQ (台中清泉崗)',
    'NRT (東京成田)', 'HND (東京羽田)', 'KIX (大阪關西)', 'NGO (名古屋中部)',
    'CTS (札幌新千歲)', 'OKA (沖繩那霸)', 'FUK (福岡)', 'SDJ (仙台)', 'HKD (函館)'
];

export default function TicketForm({ onAddTicket, editingTicket, onCancelEdit }) {
    const defaultFormData = {
        airline: '',
        price: '',
        currency: 'TWD',
        exchangeRate: '1',
        departRegion: 'TPE (台北桃園)',
        returnRegion: 'NRT (東京成田)',
        outboundDate: '',
        outboundTime: '',
        inboundDate: '',
        inboundTime: '',
        outboundFlightNo: '',
        inboundFlightNo: '',
        type: 'normal',
    };

    const [formData, setFormData] = useState(defaultFormData);

    React.useEffect(() => {
        if (editingTicket) {
            setFormData(editingTicket);
        } else {
            setFormData(defaultFormData);
        }
    }, [editingTicket]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.airline || !formData.price || !formData.outboundDate) {
            alert('請填寫完整資訊 (航空公司、價格、去程日期)');
            return;
        }

        if (formData.type !== 'oneway') {
            if (!formData.inboundDate) {
                alert('請填寫第 2 段日期');
                return;
            }
        }

        const outDateTimeStr = formData.outboundTime ? `${formData.outboundDate}T${formData.outboundTime}` : `${formData.outboundDate}T00:00:00`;
        const inDateTimeStr = formData.inboundTime ? `${formData.inboundDate}T${formData.inboundTime}` : `${formData.inboundDate}T00:00:00`;

        if (formData.type !== 'oneway' && new Date(inDateTimeStr) < new Date(outDateTimeStr)) {
            alert('同一張發票中，回程段的日期時間不能早於去程段喔！');
            return;
        }

        const newTicket = {
            ...formData,
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
    };

    const isReverse = formData.type === 'reverse';

    return (
        <div className={`bg-white p-6 rounded-xl shadow-md border ${editingTicket ? 'border-amber-400' : 'border-gray-100'} mb-8 mt-4 transition-colors duration-300`}>
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center border-b pb-3">
                <Plane className={`mr-2 ${editingTicket ? 'text-amber-500' : 'text-indigo-500'}`} /> {editingTicket ? '✏️ 修改機票訂單' : '新增購買機票訂單'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

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
                            <label className="block text-xs font-bold text-indigo-800 mb-1">航班編號 (選填)</label>
                            <input
                                placeholder="例: BR192"
                                type="text"
                                className="w-full p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow uppercase"
                                value={formData.outboundFlightNo}
                                onChange={e => setFormData({ ...formData, outboundFlightNo: e.target.value })}
                            />
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
                                <label className="block text-xs font-bold text-indigo-800 mb-1">航班編號 (選填)</label>
                                <input
                                    placeholder="例: JX801"
                                    type="text"
                                    className="w-full p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow uppercase"
                                    value={formData.inboundFlightNo}
                                    onChange={e => setFormData({ ...formData, inboundFlightNo: e.target.value })}
                                />
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
    );
}
