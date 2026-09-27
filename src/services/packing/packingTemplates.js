/**
 * packingTemplates.js
 * 行李清單範本庫與重量滾動加總演算法
 */

export const PACKING_CATEGORIES = [
    { key: 'essential',   label: '重要物品必帶', emoji: '🛂' },
    { key: 'toiletries',  label: '護理衛生備品', emoji: '🧴' },
    { key: 'electronics', label: '3C 數位通訊',  emoji: '🔌' },
    { key: 'clothes',     label: '衣物穿搭',     emoji: '👕' },
    { key: 'info',        label: '行前確認資訊', emoji: '📋' },
    { key: 'activity',    label: '風格旅行裝備', emoji: '🎒' },
    { key: 'misc',        label: '其他雜項',     emoji: '📦' }
];

// 1. 重要物品、必帶
const ESSENTIAL_ITEMS = [
    { name: '護照', category: 'essential', notes: '需大於6個月效期，護照過期也可以先買機票，拿到護照再更新號碼', weightGrams: 50 },
    { name: '簽證／轉機文件', category: 'essential', notes: '如果要轉機，留意當地的轉機資訊', weightGrams: 20 },
    { name: '錢包', category: 'essential', notes: '越好收納越好', weightGrams: 100 },
    { name: '當地貨幣', category: 'essential', notes: '看當地對信用卡的支援，建議每天每人1000~1500台幣', weightGrams: 50 },
    { name: '信用卡', category: 'essential', notes: '建議在台灣先結清款項，讓額度充裕，並確認是否支援當地實體消費', weightGrams: 20 },
    { name: '駕照正本＋國際駕照／駕照譯本', category: 'essential', notes: '日本為駕照譯本', weightGrams: 30 },
    { name: '慢性藥', category: 'essential', notes: '建議備足出國天數＋2~3天份量隨身攜帶', weightGrams: 100 },
    { name: '急性藥', category: 'essential', notes: '常備急救包與處方箋影本', weightGrams: 100 },
    { name: '行李箱', category: 'essential', notes: '3~4天：20吋，4~7天：24~26吋，7~14天：26吋，14天以上：28吋', weightGrams: 3500 },
    { name: '智慧型手機 + 充電器', category: 'essential', notes: '包含充電線與快充頭', weightGrams: 250 },
    { name: '旅平險／旅遊不便險', category: 'essential', notes: '確認英文投保證明與海外緊急救助電話', weightGrams: 10 }
];

// 2. 護理、備品
const TOILETRIES_ITEMS = [
    { name: '牙刷、牙膏（旅行組）', category: 'toiletries', notes: '請帶輕便旅行組。100cc以下：隨身行李／100cc以上：託運行李', weightGrams: 120 },
    { name: '洗髮精、護髮乳（旅行組）', category: 'toiletries', notes: '分裝瓶密封避免機艙壓力外溢', weightGrams: 150 },
    { name: '沐浴乳、洗面乳（旅行組）', category: 'toiletries', notes: '分裝小瓶輕便為主', weightGrams: 150 },
    { name: '化妝品、保養品（旅行組）', category: 'toiletries', notes: '以基礎保濕修護為主', weightGrams: 200 },
    { name: '指甲剪', category: 'toiletries', notes: '無刀片可上隨身，其他一律托運', weightGrams: 40 },
    { name: '防曬乳', category: 'toiletries', notes: '樂敦SKIN AQUA', weightGrams: 120 },
    { name: '乾洗手／消毒濕紙巾', category: 'toiletries', notes: '隨身消毒必備', weightGrams: 80 },
    { name: '頭痛藥、腸胃藥、過敏藥', category: 'toiletries', notes: '建議到藥局諮詢藥師', weightGrams: 80 },
    { name: '眼藥水', category: 'toiletries', notes: '如果要玩潑水節，建議攜帶，可諮詢藥師', weightGrams: 30 },
    { name: '隱形眼鏡、人工淚液', category: 'toiletries', notes: '樂敦人工淚液', weightGrams: 60 },
    { name: '口內膏', category: 'toiletries', notes: '長途推薦，時差影響免疫力容易嘴破', weightGrams: 20 },
    { name: '暈車藥', category: 'toiletries', notes: '成分選擇：短車程dimenhydrinate(4~6小時)，長車程meclizine(8~12小時)', weightGrams: 30 },
    { name: '衛生棉', category: 'toiletries', notes: '依天數適量準備', weightGrams: 100 },
    { name: '其他化妝品', category: 'toiletries', notes: '彩妝與卸妝用品', weightGrams: 150 }
];

// 3. 3C 數位通訊
const ELECTRONICS_ITEMS = [
    { name: '手機掛繩', category: 'electronics', notes: '歐洲建議攜帶，防止飛車搶奪', weightGrams: 40 },
    { name: '行動電源', category: 'electronics', notes: '隨身攜帶不可托運，準備夾鏈袋收納', weightGrams: 250 },
    { name: '轉接頭', category: 'electronics', notes: '確認當地電壓與充電頭電壓', weightGrams: 100 },
    { name: '耳機', category: 'electronics', notes: '建議耳塞式藍芽耳機，不要在機場、大車站使用以策安全', weightGrams: 50 },
    { name: '漫遊服務/eSIM/實體SIM卡', category: 'electronics', notes: '正常旅行使用，一天1gb，除非你整天滑影片', weightGrams: 10 },
    { name: 'AirTag', category: 'electronics', notes: '放行李箱掌握托運定位', weightGrams: 20 }
];

// 4. 穿著服飾
const CLOTHES_ITEMS = [
    { name: '衣物', category: 'clothes', notes: '確認這次旅行「最高溫和最低溫」再來打包', weightGrams: 1200 },
    { name: '鞋子', category: 'clothes', notes: '至多3雙，建議完全不同取向，一雙好走，一雙好看，一雙耐髒', weightGrams: 1500 },
    { name: '襯衫＋長褲＋休閒鞋', category: 'clothes', notes: '確認餐廳有沒有服裝規定 (Smart Casual)', weightGrams: 800 }
];

// 5. 行前確認資訊（旅伴躺分區）
const INFO_ITEMS = [
    { name: '機票日期確認', category: 'info', notes: '確切的去回日期與搭機航廈', weightGrams: 0 },
    { name: '住宿「區域」確認', category: 'info', notes: '避免迷路，讓對方知道住哪區／哪站', weightGrams: 0 },
    { name: '住宿名稱與日期確認', category: 'info', notes: '迷路直接給計程車司機看日文/英文地址', weightGrams: 0 },
    { name: '緊急聯絡人設定', category: 'info', notes: '填寫 1 位同行旅伴 + 1 位台灣家人聯絡方式', weightGrams: 0 },
    { name: '保險與保險日期確認', category: 'info', notes: '從出發搭機日期涵蓋到回國落地日期', weightGrams: 0 }
];

// 完整基礎必備包（合併上述 5 大項，共 44 項）
const UNIVERSAL_STANDARD_ITEMS = [
    ...ESSENTIAL_ITEMS,
    ...TOILETRIES_ITEMS,
    ...ELECTRONICS_ITEMS,
    ...CLOTHES_ITEMS,
    ...INFO_ITEMS
];

export const PACKING_TEMPLATES = [
    {
        id: 'universal_standard',
        title: '🌟 出國通用必備全套',
        description: '涵蓋重要物品、護理備品、3C通訊、穿著衣物與行前確認資訊 (共44項)',
        items: UNIVERSAL_STANDARD_ITEMS
    },
    {
        id: 'japan_simple',
        title: '🇯🇵 輕便自由行 (重要+3C+穿著)',
        description: '簡單的出國旅行必備組合',
        items: [
            ...ESSENTIAL_ITEMS,
            ...ELECTRONICS_ITEMS,
            ...CLOTHES_ITEMS
        ]
    },
    {
        id: 'city',
        title: '🏙️ 都市旅行補充包',
        description: '採購、行動支付與市區步行推薦',
        items: [
            { name: '行動支付、高回饋信用卡', category: 'activity', notes: '採購時的回饋會很可觀', weightGrams: 30 },
            { name: '可折疊行李袋', category: 'activity', notes: '最後可以裝戰利品，百元商店會賣', weightGrams: 150 },
            { name: '好走的鞋子', category: 'activity', notes: '推薦ASICS Cumulus，日行萬步必備', weightGrams: 600 }
        ]
    },
    {
        id: 'tropical', // 保留 id 相容既有測試與使用
        title: '🏝️ 海島水上度假包',
        description: '防曬、浮潛裝備與水上活動備品',
        items: [
            { name: '防曬乳', category: 'activity', notes: '樂敦SKIN AQUA', weightGrams: 120 },
            { name: '浮潛鏡', category: 'activity', notes: '唐吉訶德、迪卡儂皆有賣', weightGrams: 250 },
            { name: '膠鞋', category: 'activity', notes: '可以行走沙灘、礁石、海邊秘境', weightGrams: 350 },
            { name: '水母衣 (rush guard)', category: 'activity', notes: '泳裝店、迪卡儂購買，防磨防曬', weightGrams: 200 },
            { name: '帽子', category: 'activity', notes: '寬沿遮陽帽', weightGrams: 80 },
            { name: '防水手機套', category: 'activity', notes: '下水前務必先用紙巾測試防水氣密', weightGrams: 50 },
            { name: '蘆薈精華或藥膏', category: 'activity', notes: '曬傷鎮定舒緩可用', weightGrams: 120 },
            { name: '手機腳架', category: 'activity', notes: '海島會有漂亮的星空，可考慮架腳架拍照', weightGrams: 300 },
            { name: '塑膠袋/洗衣袋', category: 'activity', notes: '裝玩水後的濕衣物，可用飯店洗衣袋(laundry bag)', weightGrams: 20 },
            { name: '太陽眼鏡', category: 'activity', notes: '抗UV偏光太陽眼鏡', weightGrams: 50 }
        ]
    },
    {
        id: 'hiking',
        title: '⛰️ 山地健行補充包 (簡易一日來回)',
        description: '一日步道與輕健行裝備清單',
        items: [
            { name: '登山杖', category: 'activity', notes: '有些一日行程可租借', weightGrams: 300 },
            { name: '登山鞋', category: 'activity', notes: '如果很少穿，買迪卡儂就好', weightGrams: 800 },
            { name: '防水背包', category: 'activity', notes: '輕量雙肩後背包', weightGrams: 500 },
            { name: '防水防風外套', category: 'activity', notes: '高山防風保暖必備', weightGrams: 400 },
            { name: '排汗衣', category: 'activity', notes: 'Uniqlo airism，避免棉質吸汗濕冷失溫', weightGrams: 150 },
            { name: '輕羽絨', category: 'activity', notes: '停下休息時保暖備用', weightGrams: 250 },
            { name: '哨子', category: 'activity', notes: '緊急呼救用', weightGrams: 20 },
            { name: '防蚊液', category: 'activity', notes: '敵避成分可以(DEET)，不要帶環境殺蟲劑，例如金鳥', weightGrams: 100 }
        ]
    },
    {
        id: 'winter', // 保留 id 相容既有測試與使用
        title: '❄️ 滑雪行程補充包',
        description: '滑雪場與雪地防寒穿搭清單',
        items: [
            { name: '吸濕排汗衣褲', category: 'activity', notes: '迪卡儂即可，作為貼身底層', weightGrams: 350 },
            { name: '一般長袖上衣', category: 'activity', notes: '任意上衣，不用太厚，滑雪很熱', weightGrams: 250 },
            { name: '防潑水保暖外套', category: 'activity', notes: '不是滑雪用，是雪地行走用，避免外套全濕', weightGrams: 700 },
            { name: '保暖手套', category: 'activity', notes: '防潑水，不是滑雪用，平時雪地逛街用', weightGrams: 120 },
            { name: '滑雪襪', category: 'activity', notes: '雪鞋會磨腳，準備滑雪襪會舒適很多，迪卡儂即可', weightGrams: 150 },
            { name: '護具、手套、滑雪外套、滑雪褲', category: 'activity', notes: '新手建議直接向滑雪店家租借', weightGrams: 0 },
            { name: '太陽眼鏡 / 雪鏡', category: 'activity', notes: '雪地反射紫外線非常刺眼', weightGrams: 100 },
            { name: '防曬乳', category: 'activity', notes: '樂敦SKIN AQUA，雪地紫外線很強一樣會曬黑', weightGrams: 120 },
            { name: '暖暖包', category: 'activity', notes: '暖暖包很重，建議帶幾個備用就好', weightGrams: 200 }
        ]
    },
    {
        id: 'europe', // 保留 id 相容既有測試與使用
        title: '🏛️ 歐洲防盜防扒長途包',
        description: '長途飛行與歐洲防盜安全備品',
        items: [
            { name: '防盜腰包', category: 'activity', notes: '貼身收納護照與緊急大鈔', weightGrams: 80 },
            { name: '八字鎖', category: 'activity', notes: '鎖在包包拉鍊上防止被拉開', weightGrams: 40 },
            { name: '手機掛繩', category: 'activity', notes: '建議買全新牢固款，防止飛車黨搶劫', weightGrams: 50 },
            { name: '線鎖', category: 'activity', notes: '搭火車固定大行李箱於行李架上', weightGrams: 80 },
            { name: '水壺', category: 'activity', notes: '歐洲部分國家路邊即可直接飲用自來水', weightGrams: 150 },
            { name: '摺疊熱水壺', category: 'activity', notes: '天數大於2週再考慮，優先選有熱水壺的住宿，沒有才自備', weightGrams: 450 },
            { name: '泡麵', category: 'activity', notes: '帶素食或海鮮口味，符合海關入境申報規範', weightGrams: 200 }
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
