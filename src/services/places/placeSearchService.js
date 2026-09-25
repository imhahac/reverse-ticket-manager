/**
 * placeSearchService.js
 * 地點搜尋、視角 POI 探索與維基百科圖文富化服務
 * 1. OSM Nominatim 地點搜尋 (免 Key)
 * 2. Overpass API 視野 POI 景點/美食探索 (免 Key)
 * 3. Wikipedia / Wikimedia 景點圖文富化 (免 Key)
 */

import { logger } from '../../utils/logger';

/**
 * OpenStreetMap Nominatim 地點搜尋
 */
export async function searchPlaces(query) {
    if (!query || typeof query !== 'string' || !query.trim()) return [];
    const q = query.trim();

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=8`;

    try {
        const res = await fetch(url, {
            headers: {
                'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8,ja;q=0.7',
                'User-Agent': 'TREKLite-Planner/1.0'
            }
        });
        if (!res.ok) return [];
        const items = await res.json();

        return items.map(item => ({
            id: `osm_${item.place_id}`,
            name: item.name || item.display_name.split(',')[0],
            displayName: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            category: item.type || item.class || 'place',
            address: item.display_name
        }));
    } catch (err) {
        logger.error('Nominatim place search failed:', err);
        return [];
    }
}

/**
 * 透過 Overpass API 抓取當前地圖視角 (Bounding Box) 內的熱門景點與美食
 * @param {{south: number, west: number, north: number, east: number}} bbox
 * @param {'sights' | 'food' | 'lodging' | 'transit'} category
 */
export async function fetchViewportPOIs(bbox, category = 'sights', limit = 20) {
    if (!bbox) return [];

    let filterTag = '["tourism"~"attraction|museum|viewpoint"]';
    if (category === 'food') {
        filterTag = '["amenity"~"restaurant|cafe|bar"]';
    } else if (category === 'lodging') {
        filterTag = '["tourism"="hotel"]';
    } else if (category === 'transit') {
        filterTag = '["railway"~"station|subway_entrance"]';
    }

    const { south, west, north, east } = bbox;
    const overpassQuery = `
        [out:json][timeout:15];
        (
            node${filterTag}(${south},${west},${north},${east});
        );
        out body ${limit};
    `;

    try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: overpassQuery
        });
        if (!res.ok) return [];
        const data = await res.json();

        return (data.elements || []).map(el => ({
            id: `poi_${el.id}`,
            name: el.tags.name || el.tags['name:zh'] || el.tags['name:en'] || '未知名稱',
            lat: el.lat,
            lng: el.lon,
            category: category,
            tags: el.tags,
            openingHours: el.tags.opening_hours || null
        }));
    } catch (err) {
        logger.warn('Overpass POI query failed or timed out:', err);
        return [];
    }
}

/**
 * 抓取維基百科景點介紹與封面圖
 * @param {string} placeName
 */
export async function enrichPlaceWithWikipedia(placeName) {
    if (!placeName) return null;
    const cleanTitle = placeName.split('(')[0].split('（')[0].trim();

    try {
        // 先嘗試中文維基
        let res = await fetch(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`);
        if (!res.ok) {
            // 嘗試英文維基
            res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`);
        }
        if (!res.ok) return null;

        const data = await res.json();
        return {
            title: data.title,
            description: data.extract || null,
            thumbnailUrl: data.thumbnail?.source || null,
            pageUrl: data.content_urls?.desktop?.page || null
        };
    } catch (err) {
        logger.warn('Wikipedia enrichment failed:', err);
        return null;
    }
}
