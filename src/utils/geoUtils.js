export const AIRPORT_COORDINATES = {
    'TPE': { lat: 25.0797, lng: 121.2342 }, // 桃園
    'TSA': { lat: 25.0697, lng: 121.5526 }, // 松山
    'KHH': { lat: 22.5771, lng: 120.3500 }, // 高雄
    'RMQ': { lat: 24.2646, lng: 120.6209 }, // 台中
    'NRT': { lat: 35.7647, lng: 140.3863 }, // 成田
    'HND': { lat: 35.5494, lng: 139.7798 }, // 羽田
    'KIX': { lat: 34.4320, lng: 135.2304 }, // 關西
    'ITM': { lat: 34.7855, lng: 135.4382 }, // 伊丹
    'NGO': { lat: 34.8583, lng: 136.8054 }, // 中部
    'CTS': { lat: 42.7849, lng: 141.6708 }, // 新千歲
    'HKD': { lat: 41.7735, lng: 140.8166 }, // 函館
    'FUK': { lat: 33.5859, lng: 130.4507 }, // 福岡
    'OKA': { lat: 26.1958, lng: 127.6525 }, // 沖繩
    'BKK': { lat: 13.6900, lng: 100.7501 }, // 蘇凡納布
    'DMK': { lat: 13.9126, lng: 100.6068 }, // 廊曼
    'CNX': { lat: 18.7668, lng: 98.9626 },  // 清邁
    'HKT': { lat: 8.1111,  lng: 98.3065 },  // 普吉島
    'SIN': { lat: 1.3644,  lng: 103.9915 }, // 樟宜
    'HKG': { lat: 22.3080, lng: 113.9185 }, // 香港
    'MFM': { lat: 22.1496, lng: 113.5915 }, // 澳門
    'ICN': { lat: 37.4602, lng: 126.4407 }, // 仁川
    'GMP': { lat: 37.5619, lng: 126.8010 }, // 金浦
    'PUS': { lat: 35.1732, lng: 128.9463 }, // 釜山
    'CJU': { lat: 33.5113, lng: 126.4930 }  // 濟州島
};

export function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // 地球半徑 (km)
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export async function geocodeAddress(address) {
    if (!address) return null;
    const mapboxKey = import.meta.env.VITE_MAPBOX_API_KEY;
    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    // 1. 優先使用 Google Maps
    if (googleKey) {
        try {
            const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleKey}`;
            const res = await fetch(googleUrl);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const { lat, lng } = data.results[0].geometry.location;
                return { lat, lng, source: 'google' };
            }
        } catch (e) {
            console.warn('Google Maps geocoding failed:', e);
        }
    }

    // 2. Google Maps 失敗或無結果時，退回使用 Mapbox
    if (mapboxKey) {
        try {
            const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxKey}&limit=1`;
            const res = await fetch(mapboxUrl);
            const data = await res.json();
            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].center; // Mapbox 回傳格式為 [lng, lat]
                return { lat, lng, source: 'mapbox' };
            }
        } catch (e) {
            console.warn('Mapbox geocoding failed:', e);
        }
    }
    
    return null;
}