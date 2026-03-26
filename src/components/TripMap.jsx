import React, { useEffect, useRef, useState } from 'react';
import { AIRPORT_COORDINATES, loadGoogleMapsApi } from '../utils/geoUtils';

export default function TripMap({ itinerary, hotels, onClearSelectedTrip, selectedTripId, selectedHotelId }) {
    const mapRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const markersRef = useRef([]);

    useEffect(() => {
        let isMounted = true;
        const initMap = async () => {
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                if (isMounted) {
                    setError('請在環境變數或 Secrets 中設定 Google Maps API 金鑰才能使用地圖功能。');
                    setIsLoading(false);
                }
                return;
            }
            try {
                await loadGoogleMapsApi(apiKey);
                if (!mapRef.current) return;
                
                if (!window.google || !window.google.maps) {
                    throw new Error('Google Maps API failed to load properly.');
                }

                // 避免 React StrictMode 造成重複初始化
                if (mapRef.current.querySelector('div')) return; 

                const map = new window.google.maps.Map(mapRef.current, {
                    center: { lat: 23.6978, lng: 120.9605 }, // 預設中心：台灣
                    zoom: 6,
                    mapTypeId: 'roadmap',
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true
                });
                
                if (isMounted) {
                    setMapInstance(map);
                    setIsLoading(false);
                }
            } catch (e) {
                console.error('Map init error:', e);
                if (isMounted) {
                    setError('地圖載入失敗，請檢查網路連線或 API 金鑰權限。');
                    setIsLoading(false);
                }
            }
        };
        initMap();
        
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (!mapInstance || !window.google) return;

        // 清除舊的標記與路線
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();
        let hasPoints = false;
        const processedAirports = new Set();

        // 1. 繪製機場與飛行航線
        itinerary.forEach(trip => {
            trip.segments?.forEach(seg => {
                const fromCode = (seg.from || '').split(' ')[0];
                const toCode = (seg.to || '').split(' ')[0];
                
                const fromCoords = AIRPORT_COORDINATES[fromCode];
                const toCoords = AIRPORT_COORDINATES[toCode];

                // 標記機場
                [ { code: fromCode, coords: fromCoords }, { code: toCode, coords: toCoords } ].forEach(pt => {
                    if (pt.code && pt.coords && !processedAirports.has(pt.code)) {
                        processedAirports.add(pt.code);
                        const marker = new window.google.maps.Marker({
                            position: pt.coords, map: mapInstance, title: pt.code,
                            icon: { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
                            zIndex: 2
                        });
                        const infoWindow = new window.google.maps.InfoWindow({
                            content: `<div style="padding: 4px; min-width: 100px;">
                                <strong style="color: #1d4ed8; font-family: sans-serif;">✈️ 機場: ${pt.code}</strong>
                            </div>`
                        });
                        marker.addListener('click', () => infoWindow.open(mapInstance, marker));
                        markersRef.current.push(marker);
                        bounds.extend(pt.coords);
                        hasPoints = true;
                    }
                });

                // 畫出飛行軌跡連線
                if (fromCoords && toCoords) {
                    const flightPath = new window.google.maps.Polyline({
                        path: [fromCoords, toCoords], geodesic: true,
                        strokeColor: '#4F46E5', strokeOpacity: 0.6, strokeWeight: 2,
                        icons: [{ icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW }, offset: '50%' }],
                        map: mapInstance, zIndex: 1
                    });
                    markersRef.current.push(flightPath);
                }
            });
        });

        // 2. 繪製飯店位置
        hotels.forEach(hotel => {
            if (hotel.lat && hotel.lng) {
                const coords = { lat: hotel.lat, lng: hotel.lng };
                const marker = new window.google.maps.Marker({
                    position: coords, map: mapInstance, title: hotel.name,
                    icon: { url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' },
                    zIndex: 3
                });
                const infoWindow = new window.google.maps.InfoWindow({
                    content: `<div style="padding: 4px; min-width: 120px; font-family: sans-serif;">
                        <strong style="color: #dc2626;">🏨 ${hotel.name}</strong>
                        <div style="font-size: 12px; margin-top: 4px; color: #4b5563;">${hotel.address || ''}</div>
                    </div>`
                });
                marker.addListener('click', () => infoWindow.open(mapInstance, marker));
                markersRef.current.push(marker);
                bounds.extend(coords);
                hasPoints = true;
            }
        });

        // 調整視野以包含所有點
        if (hasPoints) {
            mapInstance.fitBounds(bounds);
            // 如果有選中的飯店，則將地圖中心移到該飯店並放大
            if (selectedHotelId) {
                const targetHotel = hotels.find(h => h.id === selectedHotelId);
                if (targetHotel && targetHotel.lat && targetHotel.lng) {
                    mapInstance.setCenter({ lat: targetHotel.lat, lng: targetHotel.lng });
                    mapInstance.setZoom(14); // 放大到一個合適的級別
                }
            } else {
                // 避免如果只有一個點時放得太大
                const listener = window.google.maps.event.addListener(mapInstance, "idle", () => {
                    if (mapInstance.getZoom() > 10) mapInstance.setZoom(10);
                    window.google.maps.event.removeListener(listener);
                });
            }
        }
    }, [mapInstance, itinerary, hotels]);

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-lg font-extrabold text-slate-800 flex items-center">
                    <span className="mr-2">🗺️</span>
                    {selectedTripId ? '單一行程地圖檢視' : '旅程分佈地圖'}
                </h2>
                <div className="flex space-x-3 text-xs font-bold text-slate-500">
                    <span className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-full mr-1"></span> 機場</span>
                    <span className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-1"></span> 飯店</span>
                    {selectedTripId && (
                        <button
                            onClick={onClearSelectedTrip}
                            className="ml-4 px-3 py-1 bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
                        >
                            顯示所有行程
                        </button>
                    )}
                </div>
            </div>
            <div className="w-full h-[500px] bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative">
                {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>}
                {error && <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 p-6 text-center"><div className="text-red-500 font-bold bg-red-50 p-4 rounded-xl border border-red-100">⚠️ {error}</div></div>}
                <div ref={mapRef} className="w-full h-full" />
            </div>
        </div>
    );
}