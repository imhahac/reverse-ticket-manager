/**
 * routeService.js
 * 路線導航與轉向幾何服務：
 * 1. OSRM 駕車、步行、自行車路線計算 (免 Key，回傳 GeoJSON LineString 與耗時)
 * 2. Transitous 門到門大眾運輸行程
 * 3. 外部地圖 (Google Maps / CoMaps / Apple Maps) 一鍵導航深度連結
 */

import { logger } from '../../utils/logger';

/**
 * 透過 OSRM 計算實際道路行車/步行線段
 * @param {Array<{lat: number, lng: number}>} coordinates - 順序經緯度
 * @param {'driving' | 'walking' | 'cycling'} profile
 * @returns {Promise<{distanceKm: number, durationMinutes: number, geometry: Object}|null>}
 */
export async function getOSRMRoute(coordinates, profile = 'driving') {
    if (!coordinates || coordinates.length < 2) return null;

    // OSRM 格式為: lng,lat;lng,lat;...
    const coordString = coordinates
        .map(c => `${c.lng.toFixed(5)},${c.lat.toFixed(5)}`)
        .join(';');

    const url = `https://router.project-osrm.org/route/v1/${profile}/${coordString}?overview=full&geometries=geojson`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            logger.warn(`OSRM Route request failed with status: ${res.status}`);
            return null;
        }
        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            return null;
        }

        const route = data.routes[0];
        return {
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
            durationMinutes: Math.round(route.duration / 60),
            geometry: route.geometry // GeoJSON LineString { type: "LineString", coordinates: [[lng, lat], ...] }
        };
    } catch (err) {
        logger.error('OSRM route calculation error:', err);
        return null;
    }
}

/**
 * 產生 Google Maps 外部路徑規劃 URL (支援多中途點 waypoints)
 */
export function getGoogleMapsRouteUrl(places) {
    if (!places || places.length === 0) return 'https://www.google.com/maps';
    if (places.length === 1) {
        return `https://www.google.com/maps/search/?api=1&query=${places[0].lat},${places[0].lng}`;
    }

    const origin = `${places[0].lat},${places[0].lng}`;
    const destination = `${places[places.length - 1].lat},${places[places.length - 1].lng}`;
    
    // 中途停靠點 (最多 9 個 waypoints)
    const waypoints = places
        .slice(1, -1)
        .slice(0, 9)
        .map(p => `${p.lat},${p.lng}`)
        .join('|');

    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints) {
        url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }
    return url;
}

/**
 * 產生 CoMaps / Organic Maps 外部連結
 */
export function getCoMapsRouteUrl(places) {
    if (!places || places.length === 0) return 'https://comaps.app';
    const first = places[0];
    return `https://comaps.app/#map=14/${first.lat}/${first.lng}`;
}

/**
 * Transitous 大眾運輸行程查詢 (開放公車/鐵路/捷運)
 */
export async function getTransitousItinerary(fromCoord, toCoord, departureTime = null) {
    if (!fromCoord || !toCoord) return null;
    try {
        const timeParam = departureTime ? `&time=${encodeURIComponent(departureTime)}` : '';
        const url = `https://api.transitous.org/routing?from=${fromCoord.lat},${fromCoord.lng}&to=${toCoord.lat},${toCoord.lng}${timeParam}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        logger.warn('Transitous API unavailable, falling back:', e);
        return null;
    }
}
