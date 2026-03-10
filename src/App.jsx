import React, { useState, useEffect, useMemo } from 'react';
import { Plane, Calendar, Trash2, ArrowRight } from 'lucide-react';
import { useLocalStorage } from './hooks/useLocalStorage';

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
        onAddTicket({
            ...formData,
            id: Date.now().toString(),
            price: Number(formData.price),
        });
        setFormData({ ...formData, airline: '', price: '', outboundDate: '', inboundDate: '' });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
                <Plane className="mr-2 text-blue-500" /> 新增機票訂單
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">機票類型</label>
                    <select
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                    >
                        <option value="normal">正向票 (台灣出發)</option>
                        <option value="reverse">反向票 (外站出發)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">航空公司 / 標籤</label>
                    <input
                        type="text"
                        placeholder="例如: 長榮 BR192"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={formData.airline}
                        onChange={e => setFormData({ ...formData, airline: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">總價格 (NTD)</label>
                    <input
                        type="number"
                        placeholder="例如: 16000"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">台灣端點</label>
                    <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={formData.departRegion}
                        onChange={e => setFormData({ ...formData, departRegion: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">外站端點</label>
                    <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={formData.returnRegion}
                        onChange={e => setFormData({ ...formData, returnRegion: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">去程日期 (第1段)</label>
                    <input
                        type="date"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={formData.outboundDate}
                        onChange={e => setFormData({ ...formData, outboundDate: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">回程日期 (第2段)</label>
                    <input
                        type="date"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={formData.inboundDate}
                        onChange={e => setFormData({ ...formData, inboundDate: e.target.value })}
                    />
                </div>
                <div className="flex items-end">
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium p-2 rounded-md transition duration-150">
                        新增訂單
                    </button>
                </div>
            </form>
        </div>
    );
}

function TicketList({ tickets, onDelete }) {
    if (tickets.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
                🎟️ 已購機票清單 (採購視角)
            </h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">類型</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">航空/標籤</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">航段 1</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">航段 2</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">價格</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {tickets.map(ticket => (
                            <tr key={ticket.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ticket.type === 'normal' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                                        }`}>
                                        {ticket.type === 'normal' ? '正向票' : '反向票'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ticket.airline}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-900">
                                            {ticket.type === 'normal' ? ticket.departRegion : ticket.returnRegion}
                                            <ArrowRight className="inline mx-1 w-3 h-3" />
                                            {ticket.type === 'normal' ? ticket.returnRegion : ticket.departRegion}
                                        </span>
                                        <span className="text-xs">{ticket.outboundDate}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-900">
                                            {ticket.type === 'normal' ? ticket.returnRegion : ticket.departRegion}
                                            <ArrowRight className="inline mx-1 w-3 h-3" />
                                            {ticket.type === 'normal' ? ticket.departRegion : ticket.returnRegion}
                                        </span>
                                        <span className="text-xs">{ticket.inboundDate}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">NT$ {ticket.price.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => onDelete(ticket.id)} className="text-red-600 hover:text-red-900">
                                        <Trash2 className="w-5 h-5 inline" />
                                    </button>
                                </td>
                            </tr>
                        ))}
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
                // Orphan segment at the end
                result.push({ out: segments[i], in: null });
            }
        }
        return result;
    }, [segments]);

    if (segments.length === 0) return null;

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
            <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center">
                ✈️ 實際飛行視角 (自動配對航段)
            </h2>
            <div className="space-y-6">
                {trips.map((trip, idx) => {
                    const hasError = trip.in && new Date(trip.out.date) > new Date(trip.in.date);
                    const isComplete = trip.out && trip.in;

                    return (
                        <div key={idx} className={`p-4 rounded-lg border-2 ${hasError ? 'border-red-400 bg-red-50' : 'border-blue-100 bg-blue-50/30'}`}>
                            <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                                <h3 className="font-bold text-lg text-blue-800">趟次 {idx + 1}</h3>
                                {hasError && <span className="text-red-600 font-bold text-sm bg-red-100 px-2 py-1 rounded">⚠️ 日期錯誤：回程早於去程</span>}
                                {!isComplete && <span className="text-orange-600 font-bold text-sm bg-orange-100 px-2 py-1 rounded">⚠️ 缺回程段</span>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* 去程段 */}
                                <div className="bg-white p-3 rounded shadow-sm border border-blue-100 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                    <div className="ml-2">
                                        <div className="text-xs text-blue-600 font-semibold mb-1 flex items-center justify-between">
                                            <span>去程 (Outbound)</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] ${trip.out.ticket.type === 'normal' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                                                來自: {trip.out.ticket.airline} ({trip.out.ticket.type === 'normal' ? '正向' : '反向'})
                                            </span>
                                        </div>
                                        <div className="flex items-center text-gray-800 font-bold text-lg">
                                            {trip.out.from} <ArrowRight className="mx-2 text-gray-400 w-5 h-5" /> {trip.out.to}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1 flex items-center">
                                            <Calendar className="w-4 h-4 mr-1 inline" /> {trip.out.date}
                                        </div>
                                    </div>
                                </div>

                                {/* 回程段 */}
                                {trip.in ? (
                                    <div className="bg-white p-3 rounded shadow-sm border border-orange-100 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                                        <div className="ml-2">
                                            <div className="text-xs text-orange-600 font-semibold mb-1 flex items-center justify-between">
                                                <span>回程 (Inbound)</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] ${trip.in.ticket.type === 'normal' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                                                    來自: {trip.in.ticket.airline} ({trip.in.ticket.type === 'normal' ? '正向' : '反向'})
                                                </span>
                                            </div>
                                            <div className="flex items-center text-gray-800 font-bold text-lg">
                                                {trip.in.from} <ArrowRight className="mx-2 text-gray-400 w-5 h-5" /> {trip.in.to}
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1 flex items-center">
                                                <Calendar className="w-4 h-4 mr-1 inline" /> {trip.in.date}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 p-3">
                                        尚未配對到回程航班
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function App() {
    const [tickets, setTickets] = useLocalStorage('reverse-tickets', []);

    const addTicket = (ticket) => setTickets([...tickets, ticket]);
    const deleteTicket = (id) => setTickets(tickets.filter(t => t.id !== id));

    const totalPrice = tickets.reduce((sum, t) => sum + t.price, 0);

    return (
        <div className="min-h-screen p-4 md:p-8 bg-gray-50 text-gray-800 font-sans">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8 text-center md:text-left">
                    <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">航班反向票購買管理系統</h1>
                    <p className="text-gray-500">管理你的正反向機票，自動重組實際飛行趟次，不再搞混日期！</p>
                </header>

                {/* Dashboard 總覽 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-4 justify-between items-center rounded-xl shadow-sm border border-gray-100 flex">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">總訂單數</p>
                            <p className="text-2xl font-bold text-gray-800">{tickets.length} 套</p>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600">🎟️</div>
                    </div>
                    <div className="bg-white p-4 justify-between items-center rounded-xl shadow-sm border border-gray-100 flex">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">預計飛行</p>
                            <p className="text-2xl font-bold text-gray-800">{Math.ceil((tickets.length * 2) / 2)} 趟次</p>
                        </div>
                        <div className="bg-green-100 p-3 rounded-full text-green-600">✈️</div>
                    </div>
                    <div className="bg-white p-4 justify-between items-center rounded-xl shadow-sm border border-gray-100 flex">
                        <div>
                            <p className="text-sm text-gray-500 font-medium">總支出</p>
                            <p className="text-2xl font-bold text-gray-800">NT$ {totalPrice.toLocaleString()}</p>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-full text-purple-600">💰</div>
                    </div>
                </div>

                <TicketForm onAddTicket={addTicket} />
                <TripTimeline tickets={tickets} />
                <TicketList tickets={tickets} onDelete={deleteTicket} />

            </div>
        </div>
    );
}

export default App;
