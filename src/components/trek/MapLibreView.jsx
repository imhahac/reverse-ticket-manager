/**
 * MapLibreView.jsx
 * 現代化向量地圖視窗 (MapLibre GL JS + OpenFreeMap Liberty 向量圖資)
 * - 100% 免 Token、高流暢度 (60 FPS) 向量旋轉與俯仰
 * - 支援景點標記、編號標籤、起訖飯店標記
 * - 支援 OSRM 實際道路轉折線 (GeoJSON LineString) 繪製
 * - 內建 WebGL 上下文釋放防護 (嚴格 map.remove cleanup)
 */

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Compass, Loader2 } from 'lucide-react';
import { fetchViewportPOIs } from '../../services/places/placeSearchService';
import { logger } from '../../utils/logger';

export const MAP_STYLES = [
    {
        id: 'streets',
        label: '🏙️ 商業街圖',
        style: {
            version: 8,
            sources: {
                'esri-streets': {
                    type: 'raster',
                    tiles: [
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
                    ],
                    tileSize: 256,
                    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom'
                }
            },
            layers: [
                {
                    id: 'esri-streets-layer',
                    type: 'raster',
                    source: 'esri-streets',
                    minzoom: 0,
                    maxzoom: 19
                }
            ]
        }
    },
    {
        id: 'osm',
        label: '🗺️ 開放圖資 (OSM)',
        style: {
            version: 8,
            sources: {
                'osm-raster': {
                    type: 'raster',
                    tiles: [
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                    ],
                    tileSize: 256,
                    attribution: '&copy; OpenStreetMap contributors'
                }
            },
            layers: [
                {
                    id: 'osm-raster-layer',
                    type: 'raster',
                    source: 'osm-raster',
                    minzoom: 0,
                    maxzoom: 19
                }
            ]
        }
    },
    {
        id: 'topo',
        label: '⛰️ 商務地形',
        style: {
            version: 8,
            sources: {
                'esri-topo': {
                    type: 'raster',
                    tiles: [
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
                    ],
                    tileSize: 256,
                    attribution: 'Tiles &copy; Esri &mdash; USGS, Esri, TANA, DeLorme'
                }
            },
            layers: [
                {
                    id: 'esri-topo-layer',
                    type: 'raster',
                    source: 'esri-topo',
                    minzoom: 0,
                    maxzoom: 19
                }
            ]
        }
    },
    {
        id: 'satellite',
        label: '🛰️ 衛星影像',
        style: {
            version: 8,
            sources: {
                'esri-imagery': {
                    type: 'raster',
                    tiles: [
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    ],
                    tileSize: 256,
                    attribution: 'Source: Esri, Maxar, Earthstar Geographics'
                }
            },
            layers: [
                {
                    id: 'esri-imagery-layer',
                    type: 'raster',
                    source: 'esri-imagery',
                    minzoom: 0,
                    maxzoom: 19
                }
            ]
        }
    }
];

export default function MapLibreView({ 
    places = [], 
    activePlaceId = null,
    onPlaceClick = null,
    routeGeometry = null,
    defaultCenter = [121.5654, 25.0330], // [lng, lat] 預設台北 (101)
    defaultZoom = 12
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [currentStyleId, setCurrentStyleId] = useState('streets');
    const [poiCategory, setPoiCategory] = useState(null); // 'sights' | 'food' | null
    const [pois, setPois] = useState([]);
    const [isFetchingPoi, setIsFetchingPoi] = useState(false);

    // 1. 初始化 MapLibre GL 實例
    useEffect(() => {
        if (!mapContainerRef.current) return;

        let center = defaultCenter;
        if (places && places.length > 0 && places[0].lat && places[0].lng) {
            center = [places[0].lng, places[0].lat];
        }

        const selectedStyleObj = MAP_STYLES.find(s => s.id === currentStyleId) || MAP_STYLES[0];

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: selectedStyleObj.style,
            center: center,
            zoom: defaultZoom,
            pitch: 0,
            bearing: 0,
            attributionControl: true
        });

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

        map.on('load', () => {
            setIsMapLoaded(true);
            mapRef.current = map;
            map.resize();
            setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 150);
            setTimeout(() => { if (mapRef.current) mapRef.current.resize(); }, 500);
        });

        // 綁定 ResizeObserver，當切換雙欄/全螢幕或容器大小變動時自動觸發 resize
        const resizeObserver = new ResizeObserver(() => {
            if (mapRef.current) {
                mapRef.current.resize();
            }
        });
        resizeObserver.observe(mapContainerRef.current);

        // 嚴格銷毀 WebGL Context，防止記憶體洩漏與 Context Loss
        return () => {
            resizeObserver.disconnect();
            markersRef.current.forEach(m => m.remove());
            markersRef.current = [];
            map.remove();
            mapRef.current = null;
            setIsMapLoaded(false);
        };
    }, []);

    // 當使用者手動切換圖資樣式
    const handleSwitchStyle = (styleId) => {
        const map = mapRef.current;
        if (styleId === currentStyleId || !map) return;
        const target = MAP_STYLES.find(s => s.id === styleId);
        if (target) {
            setCurrentStyleId(styleId);
            map.setStyle(target.style);
            map.once('style.load', () => {
                map.resize();
                // 觸發自定義重新繪製路線與景點
                setIsMapLoaded(true);
            });
        }
    };

    // 2. 繪製或更新景點 Marker
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isMapLoaded) return;

        // 清除舊 Markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        if (!places || places.length === 0) return;

        const bounds = new maplibregl.LngLatBounds();
        let validPointsCount = 0;

        places.forEach((place, index) => {
            if (!place.lat || !place.lng) return;

            validPointsCount++;
            bounds.extend([place.lng, place.lat]);

            // 客製化 Marker DOM
            const el = document.createElement('div');
            el.className = 'group cursor-pointer relative';

            const isActive = place.id === activePlaceId;
            const isHotel = place.isAnchorStart || place.isAnchorEnd || place.category === 'hotel';

            el.innerHTML = `
                <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-lg font-black text-xs transition-transform transform group-hover:scale-125 ${
                    isActive 
                        ? 'bg-rose-500 text-white ring-4 ring-rose-300' 
                        : isHotel 
                            ? 'bg-amber-500 text-white' 
                            : 'bg-indigo-600 text-white'
                }">
                    ${isHotel ? '🏨' : (index + 1)}
                </div>
                <div class="absolute left-1/2 -translate-x-1/2 bottom-8 hidden group-hover:block bg-slate-900/90 text-white text-[11px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50 pointer-events-none">
                    ${place.name}
                </div>
            `;

            el.addEventListener('click', () => {
                if (onPlaceClick) onPlaceClick(place);
            });

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([place.lng, place.lat])
                .addTo(map);

            markersRef.current.push(marker);
        });

        // 自動縮放與視野貼齊
        if (validPointsCount > 1) {
            map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1000 });
        } else if (validPointsCount === 1) {
            map.flyTo({ center: [places[0].lng, places[0].lat], zoom: 14 });
        }
    }, [places, activePlaceId, isMapLoaded, onPlaceClick]);

    // 3. 繪製 OSRM 道路轉折路線 (GeoJSON LineString)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isMapLoaded) return;

        const sourceId = 'route-source';
        const layerId = 'route-layer';

        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);

        if (routeGeometry && routeGeometry.coordinates && routeGeometry.coordinates.length > 1) {
            map.addSource(sourceId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: routeGeometry
                }
            });

            map.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#4f46e5', // Indigo-600
                    'line-width': 4,
                    'line-opacity': 0.85
                }
            });
        }
    }, [routeGeometry, isMapLoaded]);

    // 4. Overpass POI 景點探索引擎
    const handleTogglePOI = async (cat) => {
        const map = mapRef.current;
        if (!map || !isMapLoaded) return;

        if (poiCategory === cat) {
            setPoiCategory(null);
            setPois([]);
            return;
        }

        setPoiCategory(cat);
        setIsFetchingPoi(true);

        const bounds = map.getBounds();
        const bbox = {
            south: bounds.getSouth(),
            west: bounds.getWest(),
            north: bounds.getNorth(),
            east: bounds.getEast()
        };

        const results = await fetchViewportPOIs(bbox, cat, 25);
        setPois(results);
        setIsFetchingPoi(false);
    };

    return (
        <div className="relative w-full h-full min-h-[400px]">
            {/* MapLibre DOM 容器 */}
            <div ref={mapContainerRef} className="w-full h-full absolute inset-0" />

            {/* 視角與 POI 探索浮動工具列 */}
            <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
                <button
                    onClick={() => handleTogglePOI('sights')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-md backdrop-blur-md transition flex items-center gap-1.5 ${
                        poiCategory === 'sights'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white/90 text-slate-700 hover:bg-white border border-gray-200'
                    }`}
                >
                    <span>🏛️ 熱門景點</span>
                    {poiCategory === 'sights' && isFetchingPoi && <Loader2 className="w-3 h-3 animate-spin" />}
                </button>
                <button
                    onClick={() => handleTogglePOI('food')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-md backdrop-blur-md transition flex items-center gap-1.5 ${
                        poiCategory === 'food'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white/90 text-slate-700 hover:bg-white border border-gray-200'
                    }`}
                >
                    <span>🍜 美食咖啡</span>
                    {poiCategory === 'food' && isFetchingPoi && <Loader2 className="w-3 h-3 animate-spin" />}
                </button>

                {/* 圖資樣式切換器 */}
                <div className="flex items-center bg-white/95 rounded-lg border border-gray-200 shadow-md p-0.5 backdrop-blur-md">
                    {MAP_STYLES.map(s => (
                        <button
                            key={s.id}
                            onClick={() => handleSwitchStyle(s.id)}
                            className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                                currentStyleId === s.id
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 尚未選定景點之提示 */}
            {places.length === 0 && (
                <div className="absolute top-14 left-3 z-10 bg-slate-900/80 text-slate-200 text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-md backdrop-blur-sm pointer-events-none flex items-center gap-1.5">
                    <span>💡 目前顯示預設視野，可於左側日程新增景點，或探索周邊點位</span>
                </div>
            )}

            {/* POI 結果小計提示 */}
            {pois.length > 0 && (
                <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-md flex items-center gap-2">
                    <span>已探索到 {pois.length} 個周圍熱門點位</span>
                    <button onClick={() => setPois([])} className="text-slate-400 hover:text-white">&times;</button>
                </div>
            )}
        </div>
    );
}
