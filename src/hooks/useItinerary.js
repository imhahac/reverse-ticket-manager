/**
 * useItinerary.js ── 旅程協調層
 *
 * 職責：將 decoratedTrips 與 hotels 合併，
 * 為每個 trip 注入 matchedHotels（日期在趟次範圍內的住宿）。
 *
 * 匹配規則（修正版）：
 *   hotel.checkIn  <= tripEndDate      （飯店開始不超過行程結束）
 *   hotel.checkOut >  tripStartDate    （使用嚴格大於，避免 checkOut 恰好等於
 *                                       下一趟 tripStartDate 時誤配到下一趟）
 *
 * 修正說明：
 *   舊版用 checkOut >= tripStartDate，會使「前一趟最後一天 checkout」
 *   的飯店被同日出發的下一趟誤配。改為嚴格大於後，
 *   例如飯店 5/5~5/10 checkout 時，對下一趟 5/10 出發的行程
 *   checkOut(5/10) > tripStartDate(5/10) 不成立 → 不再誤配。
 */
import { useMemo } from 'react';

const TW_CODES = ['TPE', 'TSA', 'KHH', 'RMQ'];
const isTaiwan = (regionStr) => {
    if (!regionStr) return false;
    return TW_CODES.some(code => regionStr.includes(code));
};

const TOKYO_WARDS = ['chiyoda', '千代田', 'chuo', '中央', 'minato', '港區', '港区', 'shinjuku', '新宿', 'bunkyo', '文京', 'taito', '台東', 'sumida', '墨田', 'koto', '江東', 'shinagawa', '品川', 'meguro', '目黑', '目黒', 'ota', '大田', 'setagaya', '世田谷', 'shibuya', '涉谷', '澀谷', '渋谷', 'nakano', '中野', 'suginami', '杉並', 'toshima', '豐島', '豊島', 'kita', '北區', '北区', 'arakawa', '荒川', 'itabashi', '板橋', 'nerima', '練馬', 'adachi', '足立', 'katsushika', '葛飾', 'edogawa', '江戶川', '江戸川'];
const OSAKA_CITIES = ['sakai', '堺', 'suita', '吹田', 'toyonaka', '豐中', '豊中', 'moriguchi', '守口', 'hirakata', '枚方', 'izumisano', '泉佐野', 'higashiosaka', '東大阪', 'takatsuki', '高槻', 'ibaraki', '茨木', 'yao', '八尾', 'neyagawa', '寢屋川', '寝屋川', 'kishiwada', '岸和田', 'izumi', '和泉', 'minoo', '箕面', 'matsubara', '松原', 'daito', '大東', 'kadoma', '門真', 'settsu', '攝津', '摂津', 'takaishi', '高石', 'fujiidera', '藤井寺', 'shijonawate', '四條畷', 'katano', '交野', 'osakasayama', '大阪狹山', '大阪狭山', 'hannan', '阪南'];

const CITY_MAPPINGS = {
    'NRT': ['tokyo', '東京', 'nrt', '成田', '千葉', 'chiba', 'ueno', '上野', 'asakusa', '淺草', 'ginza', '銀座', ...TOKYO_WARDS],
    'HND': ['tokyo', '東京', 'hnd', '羽田', 'ueno', '上野', 'asakusa', '淺草', 'ginza', '銀座', ...TOKYO_WARDS],
    'KIX': ['osaka', '大阪', 'kix', '關西', 'kansai', 'namba', '難波', 'umeda', '梅田', 'shinsaibashi', '心齋橋', 'kyoto', '京都', 'nara', '奈良', 'kobe', '神戶', ...OSAKA_CITIES],
    'ITM': ['osaka', '大阪', 'itm', '伊丹', 'namba', '難波', 'umeda', '梅田', 'kyoto', '京都', 'nara', '奈良', 'kobe', '神戶', ...OSAKA_CITIES],
    'NGO': ['nagoya', '名古屋', 'ngo', '中部'],
    'CTS': ['sapporo', '札幌', 'cts', '新千歲', 'hokkaido', '北海道', 'otaru', '小樽'],
    'HKD': ['hakodate', '函館', 'hkd', 'hokkaido', '北海道'],
    'FUK': ['fukuoka', '福岡', 'fuk', '博多', 'hakata', 'kyushu', '九州', 'tenjin', '天神'],
    'OKA': ['okinawa', '沖繩', 'oka', '那霸', 'naha'],
    'BKK': ['bangkok', '曼谷', 'bkk', 'thailand', '泰國'],
    'DMK': ['bangkok', '曼谷', 'dmk', 'thailand', '泰國'],
    'SIN': ['singapore', '新加坡', 'sin', 'changi', '樟宜'],
    'HKG': ['hong kong', '香港', 'hkg', 'hongkong'],
    'ICN': ['seoul', '首爾', 'icn', '仁川', 'korea', '韓國', 'myeongdong', '明洞'],
    'GMP': ['seoul', '首爾', 'gmp', '金浦', 'korea', '韓國', 'myeongdong', '明洞'],
    'PUS': ['busan', '釜山', 'pus']
};
const ALL_KNOWN_KEYWORDS = Object.values(CITY_MAPPINGS).flat();
const getCityKeywords = (iataCode) => CITY_MAPPINGS[iataCode] || [];

export function useItinerary(decoratedTrips, hotels) {
    return useMemo(() => {
        return decoratedTrips.map(trip => {
            const segs = trip.segments || [];
            if (!segs.length || !hotels.length) {
                return { ...trip, matchedHotels: [], totalHotelCostTWD: 0, hotelWarnings: [], hasWarning: false };
            }

            const tripStartDate = segs[0]?.date;
            const tripEndDate   = segs[segs.length - 1]?.date;

            // ── 動態住宿邊界 (Red-eye & Home) ─────────────────────────────────
            // 預設需要住宿的起訖點即為第一段與最後一段的日期
            let reqStart = tripStartDate;
            const reqEnd = tripEndDate; // 回程起飛當晚不需要訂當地住宿，所以終點就是 tripEndDate

            // 若第一段從台灣出發且為跨日紅眼航班，當晚在飛機上不需要訂房，住宿起點往後推至抵達日
            if (segs.length > 0 && isTaiwan(segs[0].from) && segs[0].arrivalDate && segs[0].arrivalDate > tripStartDate) {
                reqStart = segs[0].arrivalDate;
            }

            if (!tripStartDate || !tripEndDate) {
                return { ...trip, matchedHotels: [], totalHotelCostTWD: 0, hotelWarnings: [], hasWarning: false };
            }

            // ── 核心修正：雙端嚴格比較，避免跨趟次邊界誤配 ──────────────
            const matchedHotels = hotels.filter(h =>
                h.checkIn  &&
                h.checkOut &&
                h.checkIn  < tripEndDate   &&  // 嚴格小於：checkIn 當天不算「已結束趟次」
                h.checkOut > tripStartDate      // 嚴格大於：checkOut 當天不算「下一趟起點」
            );

            const totalHotelCostTWD = matchedHotels.reduce(
                (s, h) => s + (h.priceTWD || 0), 0
            );

            // ── 住宿警告：缺口 / 重疊 / 地點矛盾 ────────────────────────────────
            const hotelWarnings = (() => {
                const warns = [];
                const tripDays = trip.tripDays || 0;

                // 若動態範圍發現當天去當天回（如 10/1到 10/1走），不需住宿
                if (reqStart >= reqEnd) return warns;

                if (tripDays > 1 && matchedHotels.length === 0) {
                    warns.push('⚠️ 此趟次尚未安排任何住宿');
                    return warns;
                }

                const valid = [...matchedHotels]
                    .filter(h => h.checkIn && h.checkOut)
                    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

                for (let i = 0; i < valid.length - 1; i++) {
                    const a = valid[i], b = valid[i + 1];
                    if (b.checkIn < a.checkOut) {
                        warns.push(`⚠️ 住宿重疊：「${a.name}」與「${b.name}」`);
                    } else if (b.checkIn > a.checkOut) {
                        warns.push(`⚠️ 住宿缺口：${a.checkOut} 到 ${b.checkIn} 之間無住宿`);
                    }
                }

                if (valid.length > 0) {
                    if (valid[0].checkIn > reqStart) {
                        warns.push(`⚠️ 住宿缺口：${reqStart} 到 ${valid[0].checkIn} 之間無住宿`);
                    }
                    if (valid[valid.length - 1].checkOut < reqEnd) {
                        warns.push(`⚠️ 住宿缺口：${valid[valid.length - 1].checkOut} 到 ${reqEnd} 之間無住宿`);
                    }
                }

                // ── 地點感知 (Location-Aware Matching) ────────────
                const tripIataCodes = [];
                segs.forEach(s => {
                    const fromCode = (s.from || '').split(' ')[0];
                    const toCode = (s.to || '').split(' ')[0];
                    if (fromCode && !isTaiwan(fromCode)) tripIataCodes.push(fromCode);
                    if (toCode && !isTaiwan(toCode)) tripIataCodes.push(toCode);
                });
                const uniqueCodes = [...new Set(tripIataCodes)];
                
                if (uniqueCodes.length > 0 && valid.length > 0) {
                    const validKeywords = uniqueCodes.flatMap(code => getCityKeywords(code));
                    valid.forEach(h => {
                        const text = ((h.name || '') + ' ' + (h.address || '')).toLowerCase();
                        // 檢查是否有當前航點的關鍵字
                        const hasValid = validKeywords.some(kw => text.includes(kw.toLowerCase()));
                        if (!hasValid) {
                            // 若無，再檢查是否含有其他城市的關鍵字 (例如去日本卻訂到韓國)
                            const hasOther = ALL_KNOWN_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
                            if (hasOther) {
                                warns.push(`⚠️ 飯店地點矛盾：「${h.name}」似乎不在您的航點城市`);
                            }
                        }
                    });
                }

                return warns;
            })();

            const hasWarning = hotelWarnings.length > 0 || trip.isOpenJaw;

            return { ...trip, matchedHotels, totalHotelCostTWD, hotelWarnings, hasWarning };
        });
    }, [decoratedTrips, hotels]);
}
