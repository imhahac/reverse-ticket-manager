/**
 * flightService.js
 * 獨立處理航班時刻表的查詢與快取邏輯
 */

import { CONFIG } from '../constants/config';
import { logger } from '../utils/logger';
import { getSafeDateFromISO, parseLocalDate, getTimeFromISO } from '../utils/dateHelpers';

/**
 * SECURITY NOTE: 
 * Because this is a static project (GitHub Pages), API keys are stored in environment variables 
 * and used client-side. For maximum security in a production environment with a backend, 
 * these calls should be proxied through a server to hide the keys from the browser.
 */

import { TIMING } from '../constants/timing';

export const getOffsetDate = (baseDateStr, offset) => {
    if (!baseDateStr || isNaN(offset)) return baseDateStr;
    const d = parseLocalDate(baseDateStr);
    d.setDate(d.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

/**
 * 通用的 Proxy Fetch 輔助函式 (Fallback 用)
 * 當使用者未架設私有 Cloudflare Worker 時，嘗試公共 Proxy 以跳過 CORS 限制
 */
const fetchWithPublicProxy = async (targetUrl) => {
    // 1. 嘗試 corsproxy.io
    try {
        const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
        if (res.ok) {
            const text = await res.text();
            if (text) return JSON.parse(text);
        }
    } catch (e) {
        logger.warn('corsproxy.io failed, trying allorigins...', e);
    }

    // 2. 嘗試 allorigins.win
    try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&timestamp=${Date.now()}`);
        if (res.ok) {
            const wrapped = await res.json();
            if (wrapped.contents) return JSON.parse(wrapped.contents);
        }
    } catch (e) {
        logger.warn('allorigins.win failed', e);
    }

    return null;
};

// AviationStack 查詢 (支援自建 Proxy 或金鑰直連)
const tryAviationStack = async (flightNo, flightDate) => {
    const proxyUrl = CONFIG.flightProxyUrl;
    const avKey = CONFIG.aviationStackKey;
    
    let data = null;
    let sourceLabel = 'AviationStack';

    if (proxyUrl) {
        // 【最高優先】使用自建安全 Proxy
        try {
            const _url = new URL(proxyUrl);
            _url.searchParams.set('api', 'aviationstack');
            _url.searchParams.set('flight', flightNo);
            const targetUrl = _url.toString();
            
            const res = await fetch(targetUrl);
            if (res.ok) {
                data = await res.json();
                sourceLabel = 'AviationStack (Proxy)';
            } else {
                logger.warn(`[Proxy] AviationStack returned status ${res.status}`);
            }
        } catch (e) {
            logger.error('AviationStack self-hosted proxy failed:', e);
        }
        // 注意：若已設定 Proxy 但失敗，不再嘗試直連金鑰以防洩漏
    } else if (avKey) {
        // 【次之】僅在未設定 Proxy 時才嘗試前端金鑰 (Direct Key)
        const targetUrl = `http://api.aviationstack.com/v1/flights?access_key=${avKey}&flight_iata=${flightNo}`;
        data = await fetchWithPublicProxy(targetUrl);
        sourceLabel = 'AviationStack (Direct Key)';
    }

    if (!data || data.error || !data.data || data.data.length === 0) return null;
    
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
        source: sourceLabel
    };
};

// AirLabs 查詢 (支援自建 Proxy 或金鑰直連)
const tryAirLabs = async (flightNo) => {
    const proxyUrl = CONFIG.flightProxyUrl;
    const alKey = CONFIG.airLabsKey;

    let data = null;
    let sourceLabel = 'AirLabs';

    if (proxyUrl) {
        // 【最高優先】使用自建安全 Proxy
        try {
            const _url = new URL(proxyUrl);
            _url.searchParams.set('api', 'airlabs');
            _url.searchParams.set('flight', flightNo);
            const targetUrl = _url.toString();

            const res = await fetch(targetUrl);
            if (res.ok) {
                data = await res.json();
                sourceLabel = 'AirLabs (Proxy)';
            } else {
                logger.warn(`[Proxy] AirLabs returned status ${res.status}`);
            }
        } catch (e) {
            logger.error('AirLabs self-hosted proxy failed:', e);
        }
        // 為了安全，若已設定 Proxy 但失敗，不再嘗試直連金鑰
    } else if (alKey) {
        // 【次之】僅在未設定 Proxy 時才嘗試前端金鑰 (Direct Key)
        const targetUrl = `https://airlabs.co/api/v9/routes?api_key=${alKey}&flight_iata=${flightNo}`;
        // AirLabs 是 https，優先嘗試直接連線
        try {
            const res = await fetch(targetUrl);
            if (res.ok) {
                data = await res.json();
            }
        } catch (e) {
            logger.warn('AirLabs direct fetch failed, fallback to public proxy...', e);
        }

        if (!data) {
            data = await fetchWithPublicProxy(targetUrl);
        }
        sourceLabel = 'AirLabs (Direct Key)';
    }

    if (!data || !data.response || data.response.length === 0) return null;

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
        source: sourceLabel
    };
};

export const lookupFlight = async (flightNo, flightDate) => {
    const cacheKey = `fcache_${flightNo.toUpperCase()}`;

    // 1. Check Cache
    const cachedValue = localStorage.getItem(cacheKey);
    if (cachedValue) {
        try {
            const { timestamp, data } = JSON.parse(cachedValue);
            if (Date.now() - timestamp < TIMING.FLIGHT_CACHE_TTL) {
                return { ...data, isCache: true, sourceLabel: '本地快取' };
            }
        } catch (e) {
            logger.warn(`Invalid flight cache entry removed: ${cacheKey}`, e);
            localStorage.removeItem(cacheKey);
        }
    }

    // 2. Try APIs
    let flightData = await tryAviationStack(flightNo, flightDate);
    if (!flightData) {
        logger.info('AviationStack failed/empty, trying AirLabs...');
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
