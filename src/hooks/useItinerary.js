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

// ── 高階地點感知比對演算法 (Advanced Location-Aware Matching) ─────────────

// 1. 各大分區的主要識別字 (防呆衝突檢查最準確)
const MAJOR_REGIONS = {
    '關東 (Kanto)': ['tokyo', '東京', 'kanagawa', '神奈川', 'saitama', '埼玉', 'chiba', '千葉', 'yokohama', '橫濱', '横浜'],
    '關西 (Kansai)': ['osaka', '大阪', 'kyoto', '京都', 'hyogo', '兵庫', 'nara', '奈良', 'kobe', '神戶', '神戸'],
    '北海道 (Hokkaido)': ['hokkaido', '北海道', 'sapporo', '札幌', 'hakodate', '函館'],
    '中部 (Chubu)': ['aichi', '愛知', 'nagoya', '名古屋', 'shizuoka', '静岡', '靜岡', 'nagano', '長野', 'gifu', '岐阜', 'ishikawa', '石川', 'kanazawa', '金澤', 'toyama', '富山'],
    '九州 (Kyushu)': ['fukuoka', '福岡', 'kumamoto', '熊本', 'kagoshima', '鹿兒島', '鹿児島', 'nagasaki', '長崎', 'oita', '大分', 'miyazaki', '宮崎'],
    '沖繩 (Okinawa)': ['okinawa', '沖繩', '沖縄', '那霸', 'naha'],
    '東北 (Tohoku)': ['aomori', '青森', 'sendai', '仙台', 'miyagi', '宮城', 'akita', '秋田', 'iwate', '岩手'],
    '中國 (Chugoku)': ['hiroshima', '廣島', '広島', 'okayama', '岡山'],
    '四國 (Shikoku)': ['kagawa', '香川', 'ehime', '愛媛'],
    '韓國 (Korea)': ['seoul', '首爾', 'busan', '釜山', 'jeju', '濟州', 'incheon', '仁川'],
    '泰國 (Thailand)': ['bangkok', '曼谷', 'chiang mai', '清邁', 'phuket', '普吉', 'pattaya', '芭達雅'],
    '新加坡 (Singapore)': ['singapore', '新加坡'],
    '港澳 (HK/Macau)': ['hong kong', '香港', 'macau', '澳門'],
    '台灣 (Taiwan)': ['taiwan', '台灣', 'taipei', '台北', 'taoyuan', '桃園', 'hsinchu', '新竹', 'taichung', '台中', 'tainan', '台南', 'kaohsiung', '高雄'],
};

// 2. 航點所涵蓋的「合法大區」(可用新幹線/國內線接駁的合理範圍)
const AIRPORT_REGIONS = {
    'NRT': ['關東 (Kanto)', '東北 (Tohoku)', '中部 (Chubu)'],
    'HND': ['關東 (Kanto)', '東北 (Tohoku)', '中部 (Chubu)'],
    'KIX': ['關西 (Kansai)', '中國 (Chugoku)', '四國 (Shikoku)', '中部 (Chubu)'],
    'ITM': ['關西 (Kansai)', '中國 (Chugoku)', '四國 (Shikoku)', '中部 (Chubu)'],
    'NGO': ['中部 (Chubu)', '關西 (Kansai)', '關東 (Kanto)'], // 中部在兩者之間
    'CTS': ['北海道 (Hokkaido)'],
    'HKD': ['北海道 (Hokkaido)', '東北 (Tohoku)'],
    'FUK': ['九州 (Kyushu)', '中國 (Chugoku)'],
    'OKA': ['沖繩 (Okinawa)'],
    'BKK': ['泰國 (Thailand)'],
    'DMK': ['泰國 (Thailand)'],
    'CNX': ['泰國 (Thailand)'],
    'HKT': ['泰國 (Thailand)'],
    'SIN': ['新加坡 (Singapore)', '港澳 (HK/Macau)'],
    'HKG': ['港澳 (HK/Macau)', '新加坡 (Singapore)'],
    'MFM': ['港澳 (HK/Macau)'],
    'ICN': ['韓國 (Korea)'],
    'GMP': ['韓國 (Korea)'],
    'PUS': ['韓國 (Korea)'],
    'CJU': ['韓國 (Korea)']
};

// 3. 次級市區/區公所細節字 (當未寫明縣市，只寫區或鄉鎮時的補強)
const TOKYO_WARDS = ['chiyoda', '千代田', 'chuo', '中央', 'minato', '港區', '港区', 'shinjuku', '新宿', 'bunkyo', '文京', 'taito', '台東', 'sumida', '墨田', 'koto', '江東', 'shinagawa', '品川', 'meguro', '目黑', '目黒', 'ota', '大田', 'setagaya', '世田谷', 'shibuya', '涉谷', '澀谷', '渋谷', 'nakano', '中野', 'suginami', '杉並', 'toshima', '豐島', '豊島', 'kita-ku', '北區', '北区', 'arakawa', '荒川', 'itabashi', '板橋', 'nerima', '練馬', 'adachi', '足立', 'katsushika', '葛飾', 'edogawa', '江戶川', '江戸川', 'ueno', '上野', 'asakusa', '淺草', 'ginza', '銀座', 'ikebukuro', '池袋', 'roppongi', '六本木', 'akihabara', '秋葉原'];
const OSAKA_CITIES = ['sakai', '堺', 'suita', '吹田', 'toyonaka', '豐中', '豊中', 'moriguchi', '守口', 'hirakata', '枚方', 'izumisano', '泉佐野', 'higashiosaka', '東大阪', 'takatsuki', '高槻', 'ibaraki', '茨木', 'yao', '八尾', 'neyagawa', '寢屋川', '寝屋川', 'kishiwada', '岸和田', 'izumi', '和泉', 'minoo', '箕面', 'matsubara', '松原', 'daito', '大東', 'kadoma', '門真', 'settsu', '攝津', '摂津', 'takaishi', '高石', 'fujiidera', '藤井寺', 'shijonawate', '四條畷', 'katano', '交野', 'osakasayama', '大阪狹山', '大阪狭山', 'hannan', '阪南', 'namba', '難波', 'umeda', '梅田', 'shinsaibashi', '心齋橋', 'tennoji', '天王寺', 'dotonbori', '道頓堀'];

const AIRPORT_LOCAL_WORDS = {
    'NRT': ['nrt', '成田', ...TOKYO_WARDS],
    'HND': ['hnd', '羽田', ...TOKYO_WARDS],
    'KIX': ['kix', 'kansai', '關西', '関西', ...OSAKA_CITIES],
    'ITM': ['itm', '伊丹', ...OSAKA_CITIES],
    'NGO': ['ngo', 'centrair', '中部'],
    'CTS': ['cts', '新千歲', '新千歳'],
    'HKD': ['hkd'],
    'FUK': ['fuk', '博多', 'hakata', '天神', 'tenjin'],
    'OKA': ['oka'],
    'BKK': ['bkk', 'suvarnabhumi', '蘇凡納布'],
    'DMK': ['dmk', 'don mueang', '廊曼'],
    'CNX': ['cnx'],
    'HKT': ['hkt'],
    'SIN': ['sin', 'changi', '樟宜', 'sentosa', '聖淘沙'],
    'HKG': ['hkg', 'kowloon', '九龍', 'tsim sha tsui', '尖沙咀', 'causeway bay', '銅鑼灣'],
    'MFM': ['mfm', 'cotai', '路氹'],
    'ICN': ['icn', 'myeongdong', '明洞', 'hongdae', '弘大'],
    'GMP': ['gmp', 'myeongdong', '明洞', 'hongdae', '弘大'],
    'PUS': ['pus', 'haeundae', '海雲台', 'seomyeon', '西面'],
    'CJU': ['cju']
};

const ALL_LOCAL_WORDS = Object.values(AIRPORT_LOCAL_WORDS).flat();

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

                // ── 地點感知 (Multi-Location Aware Matching) ────────────
                const uniqueCodes = [...new Set(segs.flatMap(s => [s.from?.split(' ')[0], s.to?.split(' ')[0]]))]
                    .filter(code => code && !isTaiwan(code));

                if (uniqueCodes.length > 0 && valid.length > 0) {
                    valid.forEach(h => {
                        const text = ((h.name || '') + ' ' + (h.address || '')).toLowerCase();

                        // 1. 偵測飯店文字中所有已知的地點關鍵字
                        const mentionedRegions = Object.entries(MAJOR_REGIONS)
                            .filter(([_, keywords]) => keywords.some(kw => text.includes(kw.toLowerCase())))
                            .map(([regionName, _]) => regionName);
                        
                        const mentionedLocalKeywords = ALL_LOCAL_WORDS.filter(kw => text.includes(kw));

                        // 如果飯店資訊中不包含任何我們已知的地點關鍵字，則無法判斷，直接跳過
                        if (mentionedRegions.length === 0 && mentionedLocalKeywords.length === 0) {
                            return;
                        }

                        // 2. 檢查飯店地點是否與行程中「任何一個」航點區域相符
                        const isMatched = uniqueCodes.some(code => {
                            const validRegionsForCode = new Set(AIRPORT_REGIONS[code] || []);
                            const validLocalKeywordsForCode = AIRPORT_LOCAL_WORDS[code] || [];

                            // 檢查主要地區是否匹配
                            const regionMatch = mentionedRegions.some(mr => validRegionsForCode.has(mr));
                            if (regionMatch) return true;

                            // 如果無主要地區匹配，檢查次級關鍵字
                            const localMatch = mentionedLocalKeywords.some(mk => validLocalKeywordsForCode.includes(mk));
                            if (localMatch) return true;

                            return false;
                        });
                        
                        // 3. 如果遍歷所有航點後，飯店地點都不匹配，則產生警告
                        if (!isMatched) {
                            const detectedLocation = (mentionedRegions[0] || mentionedLocalKeywords[0] || '未知').split(' ')[0];
                            warns.push(`⚠️ 地點矛盾：「${h.name}」的地點 (${detectedLocation}) 似乎與所有航點 (${uniqueCodes.join(', ')}) 都不符`);
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
