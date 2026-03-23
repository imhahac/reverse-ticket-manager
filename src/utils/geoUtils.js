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

// Global state for Google Maps API loading
let googleMapsApiLoaded = false;
let googleMapsApiLoadPromise = null;

/**
 * Dynamically loads the Google Maps JavaScript API.
 * Ensures the API is loaded only once and handles multiple concurrent requests.
 * @param {string} apiKey Your Google Maps API Key.
 * @returns {Promise<void>} A promise that resolves when the API is loaded.
 */
function loadGoogleMapsApi(apiKey) {
    if (googleMapsApiLoaded) {
        return Promise.resolve();
    }

    if (googleMapsApiLoadPromise) {
        return googleMapsApiLoadPromise; // Return existing promise if already loading
    }

    googleMapsApiLoadPromise = new Promise((resolve, reject) => {
        // Check if the script tag already exists to prevent duplicates
        const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);
        if (existingScript) {
            // If script exists, assume it's loading or loaded.
            // We need to wait for the global `window.google.maps` object to be available.
            const checkGoogleMapsInterval = setInterval(() => {
                if (window.google && window.google.maps) {
                    clearInterval(checkGoogleMapsInterval);
                    googleMapsApiLoaded = true;
                    resolve();
                }
            }, 100); // Check every 100ms
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsApi`;
        script.async = true;
        script.defer = true;
        
        // Define a global callback function that Google Maps API will call
        window.initGoogleMapsApi = () => {
            googleMapsApiLoaded = true;
            resolve();
            delete window.initGoogleMapsApi; // Clean up global callback
        };

        script.onerror = (e) => {
            console.error("Google Maps API script failed to load:", e);
            googleMapsApiLoadPromise = null; // Reset promise on error
            reject(e);
        };
        document.head.appendChild(script);
    });

    return googleMapsApiLoadPromise;
}

export async function geocodeAddress(address) {
    if (!address) return null;
    const mapboxKey = import.meta.env.VITE_MAPBOX_API_KEY;
    const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    // 1. 優先使用 Google Maps JavaScript API 的 Geocoder 服務
    if (googleKey) {
        try {
            // 確保 Google Maps API 已經載入
            await loadGoogleMapsApi(googleKey);

            // 檢查 window.google.maps 是否存在
            if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
                throw new Error("Google Maps Geocoder not available after loading API.");
            }

            const geocoder = new window.google.maps.Geocoder();
            const response = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: address }, (results, status) => {
                    if (status === window.google.maps.GeocoderStatus.OK && results && results.length > 0) {
                        resolve(results[0]);
                    } else if (status === window.google.maps.GeocoderStatus.ZERO_RESULTS) {
                        resolve(null); // 沒有找到結果
                    } else {
                        // Reject with the status for better error handling
                        reject(new Error(`Google Geocoding failed with status: ${status}`));
                    }
                });
            });

            if (response) {
                const lat = response.geometry.location.lat();
                const lng = response.geometry.location.lng();
                return { lat, lng, source: 'google' };
            }
        } catch (e) {
            console.warn('Google Maps Geocoding (JavaScript API) failed:', e);
        }
    }

    // 2. Google Maps 失敗或無結果時，退回使用 Mapbox
    // 由於您目前沒有 Mapbox Key，這段會被跳過
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