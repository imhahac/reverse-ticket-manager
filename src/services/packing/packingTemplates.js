/**
 * packingTemplates.js
 * 行李清單範本庫與重量滾動加總演算法
 */

export const PACKING_CATEGORIES = [
    { key: 'documents', label: '證件財物', emoji: '🛂' },
    { key: 'clothes', label: '衣物穿搭', emoji: '👕' },
    { key: 'electronics', label: '電子數位', emoji: '🔌' },
    { key: 'toiletries', label: '盥洗保養', emoji: '🧴' },
    { key: 'medicine', label: '常備藥品', emoji: '💊' },
    { key: 'misc', label: '個人雜項', emoji: '🎒' }
];

export const PACKING_TEMPLATES = [
    {
        id: 'tropical',
        title: '🏝️ 海島度假',
        items: [
            { name: '護照與機票憑證', category: 'documents', weightGrams: 100 },
            { name: '信用卡與當地貨幣', category: 'documents', weightGrams: 150 },
            { name: '泳裝/泳褲 (2套)', category: 'clothes', weightGrams: 300 },
            { name: '海灘拖鞋/涼鞋', category: 'clothes', weightGrams: 400 },
            { name: '透氣防曬薄外套', category: 'clothes', weightGrams: 250 },
            { name: '太陽眼鏡', category: 'misc', weightGrams: 80 },
            { name: '海洋友善防曬乳', category: 'toiletries', weightGrams: 150 },
            { name: '手機防水袋', category: 'electronics', weightGrams: 50 },
            { name: '萬國轉接頭與行動電源', category: 'electronics', weightGrams: 350 }
        ]
    },
    {
        id: 'winter',
        title: '❄️ 日韓冬季賞雪',
        items: [
            { name: '發熱衣與發熱褲 (3套)', category: 'clothes', weightGrams: 600 },
            { name: '保暖羽絨厚外套', category: 'clothes', weightGrams: 900 },
            { name: '防水防滑雪靴', category: 'clothes', weightGrams: 1100 },
            { name: '毛帽與防風圍巾', category: 'clothes', weightGrams: 200 },
            { name: '觸控防水保暖手套', category: 'clothes', weightGrams: 150 },
            { name: '暖暖包 (數包)', category: 'misc', weightGrams: 400 },
            { name: '高保濕面霜與護唇膏', category: 'toiletries', weightGrams: 120 },
            { name: '感冒藥與腸胃藥', category: 'medicine', weightGrams: 100 }
        ]
    },
    {
        id: 'europe',
        title: '🏛️ 歐洲/長途自由行',
        items: [
            { name: '護照影本與保險英文證明', category: 'documents', weightGrams: 80 },
            { name: '貼身防盜隱形隨身包', category: 'documents', weightGrams: 100 },
            { name: '歐規雙圓腳轉接頭', category: 'electronics', weightGrams: 80 },
            { name: '耐走避震健行球鞋', category: 'clothes', weightGrams: 800 },
            { name: '飛機用充氣頸枕與眼罩', category: 'misc', weightGrams: 150 },
            { name: '摺疊輕便雨傘', category: 'misc', weightGrams: 250 },
            { name: '綜合維他命與止痛藥', category: 'medicine', weightGrams: 100 }
        ]
    }
];

/**
 * 計算行李重量加總與已打包進度
 * @param {Array<Object>} items
 */
export function calculatePackingStats(items = []) {
    const totalCount = items.length;
    const packedCount = items.filter(i => i.isPacked).length;
    const progressPercent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

    let totalWeightGrams = 0;
    let packedWeightGrams = 0;

    items.forEach(i => {
        const w = Number(i.weightGrams) || 0;
        totalWeightGrams += w;
        if (i.isPacked) packedWeightGrams += w;
    });

    return {
        totalCount,
        packedCount,
        progressPercent,
        totalWeightKg: Math.round((totalWeightGrams / 1000) * 10) / 10,
        packedWeightKg: Math.round((packedWeightGrams / 1000) * 10) / 10
    };
}
