import React from 'react';
import PropTypes from 'prop-types';
import { Zap } from 'lucide-react';

export default function FlightSegmentInput({
    labelTitle,
    routeText,
    date,
    time,
    arrivalDate,
    arrivalTime,
    flightNo,
    onDateChange,
    onTimeChange,
    onArrivalDateChange,
    onArrivalTimeChange,
    onFlightNoChange,
    onAutofill,
    isFetchingFlight,
}) {
    return (
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3">
            <div>
                <label className="block text-sm font-bold text-indigo-900 mb-1">
                    {labelTitle}
                    <span className="block text-xs text-indigo-600 font-normal mt-0.5">
                        {routeText}
                    </span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="date"
                        className="flex-1 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                        value={date || ''}
                        onChange={e => onDateChange(e.target.value)}
                    />
                    <input
                        type="time"
                        step="600"
                        className="w-full sm:w-32 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                        value={time || ''}
                        onChange={e => onTimeChange(e.target.value)}
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
                        value={arrivalDate || ''}
                        onChange={e => onArrivalDateChange(e.target.value)}
                    />
                    <input
                        type="time"
                        step="600"
                        className="w-full sm:w-32 p-2 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                        value={arrivalTime || ''}
                        onChange={e => onArrivalTimeChange(e.target.value)}
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
                        value={flightNo || ''}
                        onChange={e => onFlightNoChange(e.target.value)}
                    />
                    <button
                        type="button"
                        disabled={isFetchingFlight}
                        onClick={onAutofill}
                        className="px-3 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-bold text-xs transition-colors flex items-center shrink-0 disabled:opacity-50"
                        title="自動從 API 帶入時程"
                    >
                        <Zap className="w-4 h-4 mr-1" /> 自動帶入
                    </button>
                </div>
            </div>
        </div>
    );
}

FlightSegmentInput.propTypes = {
    labelTitle: PropTypes.string.isRequired,
    routeText: PropTypes.string.isRequired,
    date: PropTypes.string,
    time: PropTypes.string,
    arrivalDate: PropTypes.string,
    arrivalTime: PropTypes.string,
    flightNo: PropTypes.string,
    onDateChange: PropTypes.func.isRequired,
    onTimeChange: PropTypes.func.isRequired,
    onArrivalDateChange: PropTypes.func.isRequired,
    onArrivalTimeChange: PropTypes.func.isRequired,
    onFlightNoChange: PropTypes.func.isRequired,
    onAutofill: PropTypes.func.isRequired,
    isFetchingFlight: PropTypes.bool.isRequired,
};
