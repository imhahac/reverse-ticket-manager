import React from 'react';

export default function PriceInputSection({ 
    formData, setFormData, exchangeRates 
}) {
    return (
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
    );
}
