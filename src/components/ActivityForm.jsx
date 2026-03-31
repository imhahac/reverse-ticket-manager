import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Ticket, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { validateNonNegativeNumber, validatePositiveNumber } from '../utils/formUtils';
import { ERRORS } from '../constants/errors';

export default function ActivityForm() {
    const { handleSaveActivity: onSaveActivity, editingActivity, handleCancelEditActivity: onCancelEdit, exchangeRates, isSavingActivity: isSaving } = useAppContext();
    const defaultFormData = {
        title: '',
        category: 'attraction', // attraction, transport, dining, other
        startDate: '',
        endDate: '',
        time: '',
        location: '',
        price: '',
        currency: 'TWD',
        exchangeRate: '1',
        notes: ''
    };

    const [formData, setFormData] = useState(defaultFormData);
    const [isFormExpanded, setIsFormExpanded] = useState(false);

    useEffect(() => {
        if (editingActivity) {
            setFormData({ ...defaultFormData, ...editingActivity });
            setIsFormExpanded(true);
        } else {
            setFormData(defaultFormData);
        }
    }, [editingActivity]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.title || !formData.startDate || !formData.location || !formData.price) {
            toast.error(ERRORS.ACTIVITY_MISSING_FIELDS);
            return;
        }

        if (!validateNonNegativeNumber(formData.price)) {
            toast.error(ERRORS.ACTIVITY_NEGATIVE_PRICE);
            return;
        }

        if (!validatePositiveNumber(formData.exchangeRate)) {
            toast.error('匯率必須大於 0');
            return;
        }

        if (formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
            toast.error(ERRORS.ACTIVITY_INVALID_DATE_ORDER);
            return;
        }

        const newActivity = {
            ...formData,
            id: editingActivity ? editingActivity.id : Date.now().toString(),
            price: Number(formData.price),
            exchangeRate: Number(formData.exchangeRate),
            priceTWD: Math.round(Number(formData.price) * Number(formData.exchangeRate)),
        };

        onSaveActivity(newActivity);
        setFormData(defaultFormData);
        setIsFormExpanded(false);
    };

    return (
        <div className={`bg-white rounded-xl shadow-md border ${editingActivity ? 'border-amber-400' : 'border-gray-100'} mb-8 mt-4 transition-all duration-300 overflow-hidden`}>
            <button 
                type="button"
                onClick={() => setIsFormExpanded(!isFormExpanded)}
                className="w-full p-4 sm:p-6 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors focus:outline-none"
            >
                <div className="flex items-center">
                    <Ticket className={`mr-3 w-6 h-6 ${editingActivity ? 'text-amber-500' : 'text-orange-500'}`} />
                    <h2 className="text-lg md:text-xl font-bold text-gray-800">
                        {editingActivity ? '✏️ 修改票卷/活動' : '🎟️ 新增票卷與活動'}
                    </h2>
                </div>
                <div className={`p-2 rounded-full ${isFormExpanded ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                    {isFormExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
            </button>

            {isFormExpanded && (
                <div className="p-4 sm:p-6 pt-0 border-t border-slate-100 bg-slate-50/50">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">
                        
                        <div className="col-span-1 md:col-span-2 lg:col-span-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">活動類別</label>
                            <select
                                className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="attraction">🎢 景點門票</option>
                                <option value="transport">🚆 交通票券 (如 JR Pass)</option>
                                <option value="dining">🍽️ 餐飲預約</option>
                                <option value="voucher">🎫 其他票卷與活動</option>
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                            <label className="block text-sm font-bold text-gray-700 mb-1">票卷 / 活動名稱</label>
                            <input
                                type="text"
                                placeholder="例如: 東京迪士尼門票、敘敘苑燒肉"
                                className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-2 grid grid-cols-3 gap-2">
                            <div className="col-span-1">
                                <label className="block text-sm font-bold text-gray-700 mb-1">幣別</label>
                                <select
                                    className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                                    value={formData.currency}
                                    onChange={e => {
                                        const newCurrency = e.target.value;
                                        setFormData({
                                            ...formData,
                                            currency: newCurrency,
                                            exchangeRate: newCurrency === 'TWD' ? '1'
                                                : newCurrency === 'JPY' ? String(exchangeRates.JPY)
                                                : newCurrency === 'USD' ? String(exchangeRates.USD)
                                                : newCurrency === 'KRW' ? String(exchangeRates.KRW ?? 0.024)
                                                : formData.exchangeRate
                                        });
                                    }}
                                >
                                    <option value="TWD">TWD 台幣</option>
                                    <option value="JPY">JPY 日幣</option>
                                    <option value="USD">USD 美金</option>
                                    <option value="KRW">KRW 韓元</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-bold text-gray-700 mb-1">匯率</label>
                                <input
                                    type="number" step="0.001" disabled={formData.currency === 'TWD'}
                                    className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 disabled:opacity-50"
                                    value={formData.exchangeRate}
                                    onChange={e => setFormData({ ...formData, exchangeRate: e.target.value })}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="block text-sm font-bold text-gray-700 mb-1">原幣總價</label>
                                <input
                                    type="number" placeholder="例如: 8400"
                                    className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:bg-white outline-none"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">日期區間與時間 (若為單日，結束日期留空即可)</label>
                            <div className="flex gap-2">
                                <input type="date" className="w-1/3 p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                <span className="flex items-center text-gray-400">~</span>
                                <input type="date" title="結束日期" className="w-1/3 p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                                <input type="time" title="具體時間 (選填)" className="w-1/3 p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">活動地點 (自動轉換地圖座標)</label>
                            <input type="text" placeholder="輸入景點名稱或地址" className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-1">備註 / 憑證號碼 (選填)</label>
                            <input type="text" placeholder="例如兌換碼、取票指引..." className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2 flex flex-col sm:flex-row gap-3">
                            <button type="submit" disabled={isSaving} className={`w-full sm:w-auto px-8 py-3 text-white font-bold rounded-lg transition duration-200 shadow hover:shadow-lg flex items-center justify-center disabled:opacity-50 ${editingActivity ? 'bg-amber-500 hover:bg-amber-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
                                {isSaving ? '⏳ 儲存中...' : editingActivity ? '💾 儲存修改' : '＋ 新增票卷活動'}
                            </button>
                            {editingActivity && (
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