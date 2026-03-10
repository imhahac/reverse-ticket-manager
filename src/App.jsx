import React, { useState, useMemo } from 'react';
import { Plane, Calendar, Trash2, ArrowRight, BookOpen, AlertCircle, CheckCircle2, ListFilter } from 'lucide-react';
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
                            <h3 className="font-bold flex items-center mb-2"><CheckCircle2 className="w-4 h-4 mr-1" /> 操作步驟</h3>
                            <ul className="list-decimal list-inside text-sm space-y-2 leading-relaxed">
                                <li>於下方表單輸入機票資訊，重點是選擇正確的<strong>機票類型</strong>。</li>
                                <li>新增後，系統會在<strong>「實際飛行配對」</strong>區域依時間軸為你拼湊出真正的旅行趟次。</li>
                                <li>請隨時留意是否有紅色警告（代表日期配對失敗，可能漏買或日期輸入錯誤）。</li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-blue-200/50 flex space-x-2 text-xs text-blue-700">
                        <span className="bg-blue-100 flex items-center px-2 py-1 rounded">🛡️ 隱私保證：你的資料只存在自己瀏覽器內，不會上傳雲端。</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function TicketForm({ onAddTicket }) {
    const [formData, setFormData] = useState({
        airline: '',
        price: '',
        departRegion: '台北 (TPE/TSA)',
        returnRegion: '東京 (NRT/HND)',
        outboundDate: '',
        inboundDate: '',
        type: 'normal',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.airline || !formData.price || !formData.outboundDate || !formData.inboundDate) {
            alert('請填寫完整資訊');
            return;
        }
        // Simple validation: make sure segment 2 doesn't happen before segment 1 inside the SAME ticket
        if (new Date(formData.inboundDate) < new Date(formData.outboundDate)) {
            alert('同一張發票中，回程段的日期不能早於去程段喔！');
            return;
        }

        onAddTicket({
            ...formData,
            id: Date.now().toString(),
            price: Number(formData.price),
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
                            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${!isReverse ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            正向 (台灣出發)
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, type: 'reverse' })}
                            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${isReverse ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            反向 (外站出發)
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">航空公司 / 備註</label>
                    <input
                        type="text"
                        placeholder="例如: 長榮 BR192"
                        className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                        value={formData.airline}
                        onChange={e => setFormData({ ...formData, airline: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">總價格 (NTD)</label>
                    <input
                        type="number"
                        placeholder="例如: 16000"
                        className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                    />
                </div>

                <div className="hidden lg:block"></div>

                {/* Row 2: Regions Configuration */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">您的出發地 (Home)</label>
                    <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                        value={formData.departRegion}
                        onChange={e => setFormData({ ...formData, departRegion: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">國外目的地 (Away)</label>
                    <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                        value={formData.returnRegion}
                        onChange={e => setFormData({ ...formData, returnRegion: e.target.value })}
                    />
                </div>

                {/* Row 3: Segment Dates with adaptive labels based on type */}
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                    <label className="block text-sm font-bold text-indigo-900 mb-1">
                        第 1 段航班日期
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
                            const Segment1 = ticket.type === 'normal'
                                ? `${ticket.departRegion} ✈️ ${ticket.returnRegion}`
                                : `${ticket.returnRegion} ✈️ ${ticket.departRegion}`;
                            const Segment2 = ticket.type === 'normal'
                                ? `${ticket.returnRegion} ✈️ ${ticket.departRegion}`
                                : `${ticket.departRegion} ✈️ ${ticket.returnRegion}`;

                            return (
                                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-4 font-bold rounded shadow-sm ${ticket.type === 'normal' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {ticket.type === 'normal' ? '正向票' : '反向票'}
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
                                        <div className="text-sm text-gray-500 mt-1 flex items-center"><Calendar className="w-3 h-3 mr-1" /> {ticket.inboundDate}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">NT$ {ticket.price.toLocaleString()}</td>
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

function TripTimeline({ tickets }) {
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

    return (
        <div className="space-y-6 mt-6">
            {trips.map((trip, idx) => {
                const hasError = trip.in && new Date(trip.out.date) > new Date(trip.in.date);
                const isComplete = trip.out && trip.in;

                return (
                    <div key={idx} className={`p-5 rounded-xl border-2 shadow-sm relative overflow-hidden ${hasError ? 'border-red-400 bg-red-50' : 'border-indigo-100 bg-white'}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-2 ${hasError ? 'bg-red-500' : 'bg-indigo-500'}`}></div>

                        <div className="flex justify-between items-center mb-4 pl-3">
                            <h3 className="font-extrabold text-xl text-gray-800">趟次 #{idx + 1}</h3>
                            <div className="flex gap-2">
                                {hasError && <span className="flex items-center text-white font-bold text-xs bg-red-500 px-3 py-1 rounded-full shadow-sm"><AlertCircle className="w-3 h-3 mr-1" /> 日期矛盾</span>}
                                {!isComplete && <span className="flex items-center text-orange-800 font-bold text-xs bg-orange-200 px-3 py-1 rounded-full"><AlertCircle className="w-3 h-3 mr-1" /> 缺回程段</span>}
                                {isComplete && !hasError && <span className="flex items-center text-green-800 font-bold text-xs bg-green-100 px-3 py-1 rounded-full"><CheckCircle2 className="w-3 h-3 mr-1" /> 配對成功</span>}
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
                                        <span className={`px-2 py-1 rounded shadow-sm text-[10px] font-bold ${trip.out.ticket.type === 'normal' ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}`}>
                                            {trip.out.ticket.airline} ({trip.out.ticket.type === 'normal' ? '正向票' : '反向票'})
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
                                            <span className={`px-2 py-1 rounded shadow-sm text-[10px] font-bold ${trip.in.ticket.type === 'normal' ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}`}>
                                                {trip.in.ticket.airline} ({trip.in.ticket.type === 'normal' ? '正向票' : '反向票'})
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

function App() {
    const [tickets, setTickets] = useLocalStorage('reverse-tickets', []);
    const [activeTab, setActiveTab] = useState('timeline');

    const addTicket = (ticket) => setTickets([...tickets, ticket]);
    const deleteTicket = (id) => {
        if (window.confirm('確定要刪除這筆機票訂單嗎？相關的趟次配對將會被移除。')) {
            setTickets(tickets.filter(t => t.id !== id));
        }
    };

    const totalPrice = tickets.reduce((sum, t) => sum + t.price, 0);

    return (
        <div className="min-h-screen p-4 md:p-8 bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <div className="max-w-5xl mx-auto">

                <header className="mb-8 pt-4">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight flex items-center">
                        <Plane className="w-8 h-8 mr-3 text-indigo-600" /> 航班反向票管理系統
                    </h1>
                    <p className="text-slate-500 text-lg">解決來回機票分段購買時，出發方向與日期混淆的問題。</p>
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
                            <p className="text-slate-300 font-medium mb-1">總預算支出 (NTD)</p>
                            <p className="text-3xl font-extrabold">${totalPrice.toLocaleString()}</p>
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
                    </div>

                    <div className="p-4 md:p-6 bg-white min-h-[400px]">
                        {activeTab === 'timeline' ? (
                            <TripTimeline tickets={tickets} />
                        ) : (
                            <TicketList tickets={tickets} onDelete={deleteTicket} />
                        )}
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
