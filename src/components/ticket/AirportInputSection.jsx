import React from 'react';

export default function AirportInputSection({ 
    departRegion, returnRegion, onChangeDepart, onChangeReturn 
}) {
    return (
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
                        value={departRegion}
                        onChange={e => onChangeDepart(e.target.value)}
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1">國外目的地 (Away)</label>
                    <input
                        autoComplete="off"
                        list="airports-list"
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded bg-white text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={returnRegion}
                        onChange={e => onChangeReturn(e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}
