/**
 * flightService.js
 * 獨立處理航班時刻表的查詢與快取邏輯
 */

import { CONFIG } from '../constants/config';

// Caching Setup
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 1 week

const getSafeDateFromISO = (isoStr, fallback) => {
    if (!isoStr) return fallback;
    const datePart = isoStr.includes('T') ? isoStr.split('T')[0] : (isoStr.includes(' ') ? isoStr.split(' ')[0] : isoStr);
    return datePart;
};

const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date();
    return new Date(y, m - 1, d);
};

export const getOffsetDate = (baseDateStr, offset) => {
    if (!baseDateStr || isNaN(offset)) return baseDateStr;
    const d = parseLocalDate(baseDateStr);
    d.setDate(d.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const getTimeFromISO = (isoStr) => {
    if (!isoStr) return '';
    const tech = isoStr.includes('T') ? isoStr.split('T')[1] : (isoStr.includes(' ') ? isoStr.split(' ')[1] : '');
    return tech ? tech.substring(0, 5) : '';
};

// AviationStack API
const tryAviationStack = async (flightNo, flightDate) => {
    const avKey = CONFIG.aviationStackKey;
    if (!avKey) return null;
    const targetUrl = `http://api.aviationstack.com/v1/flights?access_key=${avKey}&flight_iata=${flightNo}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    const wrapped = await res.json();
    if (!wrapped.contents) return null;
    const data = JSON.parse(wrapped.contents);
    if (data.error || !data.data || data.data.length === 0) return null;
    
    const scheduledFlights = data.data.filter(f => f.flight_date >= flightDate);
    const flight = scheduledFlights.length > 0 ? scheduledFlights[0] : data.data[0];
    if (!flight.departure || !flight.arrival) return null;

    const depDateRaw = getSafeDateFromISO(flight.departure.scheduled, flight.flight_date);
    const arrDateRaw = getSafeDateFromISO(flight.arrival.scheduled, depDateRaw);
    const depD = parseLocalDate(depDateRaw);
    const arrD = parseLocalDate(arrDateRaw);
    
    return {
        depTime: getTimeFromISO(flight.departure.scheduled),
        arrTime: getTimeFromISO(flight.arrival.scheduled),
        dayOffset: Math.round((arrD - depD) / (86400000)),
        airline: flight.airline ? flight.airline.name : '',
        flightIcao: flight.flight ? flight.flight.icao : '',
        originIata: flight.departure.iata || '',
        originName: flight.departure.airport || '',
        destIata: flight.arrival.iata || '',
        destName: flight.arrival.airport || '',
        source: 'AviationStack'
    };
};

// AirLabs API
const tryAirLabs = async (flightNo) => {
    const alKey = CONFIG.airLabsKey;
    if (!alKey) return null;
    const targetUrl = `https://airlabs.co/api/v9/routes?api_key=${alKey}&flight_iata=${flightNo}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    const wrapped = await res.json();
    if (!wrapped.contents) return null;
    const data = JSON.parse(wrapped.contents);
    if (!data.response || data.response.length === 0) return null;

    const flight = data.response[0];
    
    const depT = flight.dep_time || '';
    const arrT = flight.arr_time || '';
    let offset = 0;
    if (depT && arrT) {
        const depSum = parseInt(depT.replace(':',''));
        const arrSum = parseInt(arrT.replace(':',''));
        if (arrSum < depSum) offset = 1;
    }

    return {
        depTime: depT,
        arrTime: arrT,
        dayOffset: offset,
        airline: flight.airline_iata || '',
        flightIcao: flight.flight_icao || '',
        originIata: flight.dep_iata || '',
        originName: '', 
        destIata: flight.arr_iata || '',
        destName: '',
        source: 'AirLabs'
    };
};

export const lookupFlight = async (flightNo, flightDate) => {
    const cacheKey = `fcache_${flightNo.toUpperCase()}`;

    // 1. Check Cache
    const cachedValue = localStorage.getItem(cacheKey);
    if (cachedValue) {
        try {
            const { timestamp, data } = JSON.parse(cachedValue);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
                return { ...data, isCache: true, sourceLabel: '本地快取' };
            }
        } catch (e) {
            localStorage.removeItem(cacheKey);
        }
    }

    // 2. Try APIs
    let flightData = await tryAviationStack(flightNo, flightDate);
    if (!flightData) {
        console.log('AviationStack failed/empty, trying AirLabs...');
        flightData = await tryAirLabs(flightNo);
    }

    if (!flightData) throw new Error(`找不到航班 ${flightNo.toUpperCase()} 的有效資訊`);

    // Save to Cache
    localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: flightData
    }));

    return { ...flightData, isCache: false, sourceLabel: flightData.source };
};
