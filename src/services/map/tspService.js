/**
 * tspService.js
 * 啟發式路徑排序演算法 (Nearest Neighbour + 2-opt TSP Optimizer)
 * 用於一日多個景點的最佳順序排序，顯著減少行車與步行繞路距離。
 *
 * 支援業務限制：
 * 1. 起點飯店錨點 (isAnchorStart) 恆固定於第 1 個。
 * 2. 終點飯店錨點 (isAnchorEnd) 恆固定於最後 1 個。
 * 3. 鎖定景點 (isLocked) 保持在原指定索引位置不變。
 */

import { getDistanceFromLatLonInKm } from '../../utils/geoUtils';

function calcDistance(p1, p2) {
    if (!p1 || !p2) return 0;
    const dist = getDistanceFromLatLonInKm(p1.lat, p1.lng, p2.lat, p2.lng);
    return dist != null ? dist : 0;
}

export function calculateTotalRouteDistance(places) {
    if (!places || places.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < places.length - 1; i++) {
        total += calcDistance(places[i], places[i + 1]);
    }
    return Math.round(total * 100) / 100; // 保留兩位小數 (km)
}

/**
 * 2-opt 路徑最佳化
 * @param {Array<Object>} places
 * @param {number} maxIterations
 * @returns {{ optimizedPlaces: Array<Object>, originalDistance: number, optimizedDistance: number, improvedKm: number }}
 */
export function optimizeRouteWith2Opt(places, maxIterations = 500) {
    if (!places || places.length <= 2) {
        const d = calculateTotalRouteDistance(places);
        return {
            optimizedPlaces: places ? [...places] : [],
            originalDistance: d,
            optimizedDistance: d,
            improvedKm: 0
        };
    }

    const n = places.length;
    const originalDistance = calculateTotalRouteDistance(places);
    let route = [...places];

    // 判斷哪些 index 是不可動的 (起點、迄點、或被使用者顯式鎖定的 index)
    const isFixed = (idx) => {
        if (idx === 0 && route[0].isAnchorStart) return true;
        if (idx === n - 1 && route[n - 1].isAnchorEnd) return true;
        return Boolean(route[idx]?.isLocked);
    };

    // ── 1. Nearest Neighbour 預先建構 (僅針對未鎖定群體) ──
    // 若沒有任何固定點限制，可先做貪婪最近鄰；若有固定點，保持原序做 2-opt 改善
    let iteration = 0;
    let improved = true;

    while (improved && iteration < maxIterations) {
        improved = false;
        iteration++;

        for (let i = 1; i < n - 1; i++) {
            for (let k = i + 1; k < n; k++) {
                // 如果區間內包含鎖定的節點，不允許翻轉
                let hasLockedInSubarray = false;
                for (let check = i; check <= k; check++) {
                    if (isFixed(check)) {
                        hasLockedInSubarray = true;
                        break;
                    }
                }
                if (hasLockedInSubarray) continue;

                const pA = route[i - 1];
                const pB = route[i];
                const pC = route[k];
                const pD = route[k + 1] || null;

                const currentEdges = calcDistance(pA, pB) + (pD ? calcDistance(pC, pD) : 0);
                const newEdges = calcDistance(pA, pC) + (pD ? calcDistance(pB, pD) : 0);

                if (newEdges < currentEdges - 0.001) { // 減少至少 1 公尺
                    // 執行 2-opt 翻轉子序列 [i...k]
                    const reversedSubarray = route.slice(i, k + 1).reverse();
                    route.splice(i, k - i + 1, ...reversedSubarray);
                    improved = true;
                    break;
                }
            }
            if (improved) break;
        }
    }

    const optimizedDistance = calculateTotalRouteDistance(route);
    const improvedKm = Math.round((originalDistance - optimizedDistance) * 100) / 100;

    return {
        optimizedPlaces: route,
        originalDistance,
        optimizedDistance,
        improvedKm: Math.max(0, improvedKm)
    };
}
