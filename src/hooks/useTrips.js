/**
 * useTrips.js ── 核心配對引擎 (Smart Grouping Hook)
 *
 * 職責：將使用者輸入的機票訂單（tickets）轉換為「趟次（trips）」。
 *
 * 運作流程：
 *  1. 將每張票拆成 1~2 個「航段物件（segment）」，並依起訖機場與票種決定方向。
 *  2. 所有航段依出發 dateTime 升冪排序。
 *  3. 用「台灣航點」作為行程邊界，掃描一遍串連成趟次：
 *     - 從台灣出發 → 開啟新 trip
 *     - 抵達台灣   → 關閉 trip（isComplete = true）
 *     - 外站中轉   → 附加到 currentTrip.connections
 *  4. 標記純外站行程（isExternalOnly）。
 *
 * ⚠️ 此 Hook 只做「拆分＋排列＋配對」，不計算費用或 UI 層統計。
 *    費用計算由 App.jsx 的 decoratedTrips useMemo 負責。
 */

import { useMemo } from 'react';

// ── 台灣機場 IATA 代碼清單 ──────────────────────────────────────────────────
// 若日後要新增機場（如 TTT 台東），在這裡加入即可。
const TW_CODES = ['TPE', 'TSA', 'KHH', 'RMQ'];

/**
 * 判斷機場字串是否屬於台灣機場。
 * @param {string} regionStr - 例如 "TPE (台北桃園)" 或純 IATA "TPE"
 * @returns {boolean}
 */
const isTaiwan = (regionStr) =>
    TW_CODES.some(code => regionStr.includes(code));

/**
 * 主要 Hook：將 tickets 陣列計算出 segments 與 trips。
 *
 * @param {Array<Object>} tickets - LocalStorage 中的機票訂單陣列
 * @returns {{ segments: Array, trips: Array }}
 *   - segments: 所有拆解後並排序的航段（供 TripCalendar 使用）
 *   - trips:    配對後的趟次（供 TripTimeline 使用）
 */
export const useTrips = (tickets) => {
    return useMemo(() => {

        // ── Step 1：拆票成航段 ────────────────────────────────────────────────
        const safeTickets = (tickets || []).filter(t => t && typeof t === 'object' && t.id);
        safeTickets.forEach(t => {
            // 建構出發/抵達的 Date 物件，供排序用
            const outTime = t.outboundTime ? `T${t.outboundTime}:00` : 'T00:00:00';
            const inTime  = t.inboundTime  ? `T${t.inboundTime}:00`  : 'T00:00:00';
            const outDateTime = new Date(`${t.outboundDate}${outTime}`);
            const inDateTime  = new Date(`${t.inboundDate}${inTime}`);

            // 共用欄位建構 helper，避免重複程式碼
            const buildSeg = (suffix, date, time, arrDate, arrTime, flightNo, dt, from, to) => ({
                id: t.id + suffix,
                ticket: t,
                date, time,
                arrivalDate: arrDate || '',
                arrivalTime: arrTime || '',
                flightNo: flightNo || '',
                dateTime: dt,
                from,
                to,
            });

            if (t.type === 'normal') {
                // 正向票：第 1 段 出發地→目的地，第 2 段 目的地→出發地
                if (t.outboundDate) segments.push(buildSeg('-1', t.outboundDate, t.outboundTime || '', t.outboundArrivalDate, t.outboundArrivalTime, t.outboundFlightNo, outDateTime, t.departRegion, t.returnRegion));
                if (t.inboundDate)  segments.push(buildSeg('-2', t.inboundDate,  t.inboundTime  || '', t.inboundArrivalDate,  t.inboundArrivalTime,  t.inboundFlightNo,  inDateTime,  t.returnRegion, t.departRegion));
            } else if (t.type === 'reverse') {
                // 反向票：第 1 段 目的地→出發地，第 2 段 出發地→目的地（方向顛倒）
                if (t.outboundDate) segments.push(buildSeg('-1', t.outboundDate, t.outboundTime || '', t.outboundArrivalDate, t.outboundArrivalTime, t.outboundFlightNo, outDateTime, t.returnRegion, t.departRegion));
                if (t.inboundDate)  segments.push(buildSeg('-2', t.inboundDate,  t.inboundTime  || '', t.inboundArrivalDate,  t.inboundArrivalTime,  t.inboundFlightNo,  inDateTime,  t.departRegion, t.returnRegion));
            } else {
                // 單程票（oneway）：只有一段
                if (t.outboundDate) segments.push(buildSeg('-1', t.outboundDate, t.outboundTime || '', t.outboundArrivalDate, t.outboundArrivalTime, t.outboundFlightNo, outDateTime, t.departRegion, t.returnRegion));
            }
        });

        // ── Step 2：按出發時間升冪排序 ────────────────────────────────────────
        segments.sort((a, b) => a.dateTime - b.dateTime);

        // ── Step 3：掃描航段，依台灣邊界配對成趟次 ───────────────────────────
        let trips = [];
        let currentTrip = null;

        segments.forEach(seg => {
            if (!currentTrip) {
                // 尚未開啟行程，初始化新 trip
                currentTrip = {
                    id: seg.id,
                    outbound: seg,
                    connections: [],
                    inbound: null,
                    isComplete: false,
                };

                if (isTaiwan(seg.to)) {
                    // 特殊情況：此段直接抵達台灣（可能是純回程孤兒票）
                    // 把它當作「只有 inbound」的 trip 立即關閉
                    currentTrip.inbound  = seg;
                    currentTrip.outbound = null;
                    currentTrip.isComplete = true;
                    trips.push(currentTrip);
                    currentTrip = null;
                }
            } else {
                if (isTaiwan(seg.to)) {
                    // 抵達台灣 → 正常關閉 trip
                    currentTrip.inbound = seg;
                    currentTrip.isComplete = true;
                    trips.push(currentTrip);
                    currentTrip = null;
                } else if (isTaiwan(seg.from)) {
                    // 又從台灣出發 → 原 trip 未完結就被迫中斷，開啟新 trip
                    trips.push(currentTrip);
                    currentTrip = {
                        id: seg.id,
                        outbound: seg,
                        connections: [],
                        inbound: null,
                        isComplete: false,
                    };
                } else {
                    // 外站中轉航段
                    currentTrip.connections.push(seg);
                }
            }
        });

        // 掃描結束仍有未關閉的 trip（單程或資料不完整）
        if (currentTrip) {
            trips.push(currentTrip);
        }

        // ── Step 4：標記純外站行程（完全不含台灣機場）──────────────────────
        // 例如：OSA → NRT（外站之間的短程票），這類行程特別以藍色標記
        trips = trips.map(trip => {
            const segs = [
                ...(trip.outbound ? [trip.outbound] : []),
                ...trip.connections,
                ...(trip.inbound  ? [trip.inbound]  : []),
            ];
            const hasTW = segs.some(s => isTaiwan(s.from) || isTaiwan(s.to));
            return { ...trip, isExternalOnly: !hasTW };
        });

        return { segments, trips };
    }, [tickets]);
};
