import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AIRPORT_COORDINATES, loadGoogleMapsApi } from '../utils/geoUtils';
import { logger } from '../utils/logger';
import { MAP } from '../constants/config';
import { HotelForMapPropType, TripForMapPropType } from '../types/propTypes';

export default function TripMap({ itinerary, hotels, onClearSelectedTrip, selectedTripId, selectedHotelId }) {
    const mapRef = useRef(null);
    const [mapInstance, setMapInstance] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const markersRef = useRef([]);
    const directionsRendererRef = useRef(null);
    const [selectedDay, setSelectedDay] = useState(null); // null means All Days
    const [travelMode, setTravelMode] = useState('TRANSIT'); // TRANSIT or DRIVING
    const [travelTimeInfo, setTravelTimeInfo] = useState(null);

    // 當切換行程時，重置 selectedDay
    useEffect(() => {
        setSelectedDay(null);
        setTravelTimeInfo(null);
        if (directionsRendererRef.current) {
            directionsRendererRef.current.setMap(null);
        }
    }, [selectedTripId]);

    useEffect(() => {
        let isMounted = true;
        let map = null;

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
                if (!isMounted || !mapRef.current) return;
                
                if (!window.google || !window.google.maps) {
                    throw new Error('Google Maps API failed to load properly.');
                }

                // 避免記憶體洩漏：確保清除前一次可能的殘留
                if (mapRef.current.firstChild) {
                   mapRef.current.innerHTML = '';
                }

                map = new window.google.maps.Map(mapRef.current, {
                    center: MAP.DEFAULT_CENTER,
                    zoom: MAP.DEFAULT_ZOOM,
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
                logger.error('Map init error:', e);
                if (isMounted) {
                    setError('地圖載入失敗，請檢查網路連線或 API 金鑰權限。');
                    setIsLoading(false);
                }
            }
        };
        initMap();
        
        return () => { 
            isMounted = false; 
            if (map && window.google) {
                window.google.maps.event.clearInstanceListeners(map);
            }
        };
    }, []);

    useEffect(() => {
        if (!mapInstance || !window.google) return;

        // 清除舊的標記與路線
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];
        if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
        setTravelTimeInfo(null);

        const bounds = new window.google.maps.LatLngBounds();
        let hasPoints = false;
        const processedAirports = new Set();
        
        const targetTrip = selectedTripId && itinerary.length > 0 ? itinerary[0] : null;

        const getPointsForDay = () => {
            if (selectedDay === null) return { displayHotels: hotels, displayActivities: itinerary.flatMap(t => t.matchedActivities || []) };
            if (!targetTrip || !targetTrip.tripStartAt) return { displayHotels: [], displayActivities: [] };
            
            const targetDate = new Date(targetTrip.tripStartAt.getTime());
            targetDate.setDate(targetDate.getDate() + (selectedDay - 1));
            targetDate.setHours(0, 0, 0, 0);

            const targetTime = targetDate.getTime();

            const displayHotels = hotels.filter(h => {
                const cin = new Date(h.checkIn).setHours(0,0,0,0);
                const cout = new Date(h.checkOut).setHours(0,0,0,0);
                // 住宿包含當天晚上 (checkOut 那天不算)
                return cin <= targetTime && cout > targetTime;
            });

            const displayActivities = itinerary.flatMap(t => t.matchedActivities || []).filter(a => {
                const sDate = new Date(a.startDate).setHours(0,0,0,0);
                const eDate = a.endDate ? new Date(a.endDate).setHours(0,0,0,0) : sDate;
                return sDate <= targetTime && eDate >= targetTime;
            });

            return { displayHotels, displayActivities };
        };

        const { displayHotels, displayActivities } = getPointsForDay();

        // 1. 繪製機場與飛行航線 (只在「全部天數」時顯示)
        if (selectedDay === null) {
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
        }

        // 2. 繪製飯店位置
        displayHotels.forEach(hotel => {
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

        // 3. 繪製活動位置
        displayActivities.forEach(act => {
            if (act.lat && act.lng) {
                const coords = { lat: act.lat, lng: act.lng };
                const marker = new window.google.maps.Marker({
                        position: coords, map: mapInstance, title: act.title,
                        icon: { url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png' },
                        zIndex: 4
                    });
                    const infoWindow = new window.google.maps.InfoWindow({
                        content: `<div style="padding: 4px; min-width: 120px; font-family: sans-serif;">
                            <strong style="color: #ea580c;">🎫 ${act.title}</strong>
                            <div style="font-size: 12px; margin-top: 4px; color: #4b5563;">${act.location || ''}</div>
                        </div>`
                    });
                marker.addListener('click', () => infoWindow.open(mapInstance, marker));
                markersRef.current.push(marker);
                bounds.extend(coords);
                hasPoints = true;
            }
        });

        // 4. Directions API 路線繪製
        if (selectedDay !== null && (displayHotels.length > 0 || displayActivities.length > 0)) {
            const directionsService = new window.google.maps.DirectionsService();
            const directionsRenderer = new window.google.maps.DirectionsRenderer({
                map: mapInstance,
                suppressMarkers: true, // 我們自己畫 marker
                polylineOptions: {
                    strokeColor: travelMode === 'TRANSIT' ? '#0ea5e9' : '#8b5cf6',
                    strokeOpacity: 0.8,
                    strokeWeight: 5
                }
            });
            directionsRendererRef.current = directionsRenderer;

            // 決定 Waypoints: 飯店起點 -> 活動 1 -> 活動 2 -> 飯店終點
            const hotelLoc = displayHotels.length > 0 && displayHotels[0].lat ? { lat: displayHotels[0].lat, lng: displayHotels[0].lng } : null;
            const actLocs = displayActivities.filter(a => a.lat && a.lng).map(a => ({ location: { lat: a.lat, lng: a.lng }, stopover: true }));

            let origin = hotelLoc || (actLocs.length > 0 ? actLocs.shift().location : null);
            let destination = hotelLoc || (actLocs.length > 0 ? actLocs.pop().location : origin);
            
            if (origin && destination) {
                const request = {
                    origin,
                    destination,
                    waypoints: actLocs,
                    travelMode: window.google.maps.TravelMode[travelMode],
                };

                directionsService.route(request, (result, status) => {
                    if (status === 'OK') {
                        directionsRenderer.setDirections(result);
                        
                        // 計算總時間
                        let totalSeconds = 0;
                        const legs = result.routes[0].legs;
                        legs.forEach(leg => {
                            totalSeconds += leg.duration?.value || 0;
                        });
                        
                        if (totalSeconds > 0) {
                            const hrs = Math.floor(totalSeconds / 3600);
                            const mins = Math.floor((totalSeconds % 3600) / 60);
                            setTravelTimeInfo(hrs > 0 ? `${hrs} 小時 ${mins} 分鐘` : `${mins} 分鐘`);
                        }
                    } else {
                        logger.warn('Directions query failed:', status);
                        setTravelTimeInfo('無法計算路線');
                    }
                });
            }
        }

        // 調整視野以包含所有點
        if (hasPoints) {
            mapInstance.fitBounds(bounds);
            // 如果有選中的飯店，則將地圖中心移到該飯店並放大
            if (selectedHotelId) {
                const targetHotel = hotels.find(h => h.id === selectedHotelId);
                if (targetHotel && targetHotel.lat && targetHotel.lng) {
                    mapInstance.setCenter({ lat: targetHotel.lat, lng: targetHotel.lng });
                    mapInstance.setZoom(MAP.HOTEL_FOCUS_ZOOM);
                }
            } else {
                // 避免如果只有一個點時放得太大
                const listener = window.google.maps.event.addListener(mapInstance, "idle", () => {
                    if (mapInstance.getZoom() > MAP.MAX_SINGLE_POINT_ZOOM) mapInstance.setZoom(MAP.MAX_SINGLE_POINT_ZOOM);
                    window.google.maps.event.removeListener(listener);
                });
            }
        }
    }, [mapInstance, itinerary, hotels, selectedDay, travelMode, selectedTripId]);

    const targetTrip = selectedTripId && itinerary.length > 0 ? itinerary[0] : null;

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
                    <span className="flex items-center"><span className="w-3 h-3 bg-orange-500 rounded-full mr-1"></span> 活動</span>
                </div>
            </div>

            {/* 控制面板：Day Picker 與交通方式切換 */}
            {targetTrip && targetTrip.tripDays > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex flex-wrap gap-2 items-center">
                        <button
                            onClick={() => setSelectedDay(null)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${selectedDay === null ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200'}`}
                        >
                            全部天數
                        </button>
                        {Array.from({ length: targetTrip.tripDays }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedDay(i + 1)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${selectedDay === i + 1 ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200'}`}
                            >
                                Day {i + 1}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedDay !== null && (
                            <div className="flex bg-white rounded-md border border-slate-200 p-0.5 overflow-hidden">
                                <button onClick={() => setTravelMode('TRANSIT')} className={`px-2 py-1 text-xs font-bold rounded-sm ${travelMode === 'TRANSIT' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>🚆 大眾運輸</button>
                                <button onClick={() => setTravelMode('DRIVING')} className={`px-2 py-1 text-xs font-bold rounded-sm ${travelMode === 'DRIVING' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>🚗 開車</button>
                            </div>
                        )}
                        <button
                            onClick={onClearSelectedTrip}
                            className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-md hover:bg-slate-300 transition-colors"
                        >
                            顯示所有行程
                        </button>
                    </div>
                </div>
            )}
            {selectedDay !== null && travelTimeInfo && (
                <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-bold px-3 py-2 rounded-lg flex items-center shadow-sm">
                    ⏱️ 預估總交通時間：<span className="font-mono ml-1 bg-white px-2 py-0.5 rounded text-indigo-600 border border-indigo-200">{travelTimeInfo}</span>
                </div>
            )}

            <div className="w-full h-[500px] bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative">
                {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>}
                {error && <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10 p-6 text-center"><div className="text-red-500 font-bold bg-red-50 p-4 rounded-xl border border-red-100">⚠️ {error}</div></div>}
                <div ref={mapRef} className="w-full h-full" />
            </div>
        </div>
    );
}
TripMap.propTypes = {
    itinerary:           PropTypes.arrayOf(TripForMapPropType).isRequired,
    hotels:              PropTypes.arrayOf(HotelForMapPropType).isRequired,
    onClearSelectedTrip: PropTypes.func,
    selectedTripId:      PropTypes.string,
    selectedHotelId:     PropTypes.string,
};

TripMap.defaultProps = {
    onClearSelectedTrip: undefined,
    selectedTripId:      null,
    selectedHotelId:     null,
};
