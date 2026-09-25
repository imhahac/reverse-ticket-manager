/**
 * reservationTypes.js
 * TREK 16 種標準預訂類型常數定義與視覺徽章配置
 */

export const RESERVATION_TYPES = {
    FLIGHT: 'flight',
    TRAIN: 'train',
    ACCOMMODATION: 'accommodation',
    CAR_RENTAL: 'car_rental',
    BUS: 'bus',
    FERRY: 'ferry',
    RESTAURANT: 'restaurant',
    ACTIVITY: 'activity',
    EVENT: 'event',
    TOUR: 'tour',
    CRUISE: 'cruise',
    CAMPING: 'camping',
    SHUTTLE: 'shuttle',
    TAXI: 'taxi',
    PARKING: 'parking',
    OTHER: 'other'
};

export const RESERVATION_TYPE_CONFIG = {
    flight: {
        label: '航班機票',
        shortLabel: '航班',
        iconName: 'Plane',
        emoji: '✈️',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    train: {
        label: '鐵路高鐵',
        shortLabel: '鐵路',
        iconName: 'Train',
        emoji: '🚆',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    accommodation: {
        label: '住宿飯店',
        shortLabel: '住宿',
        iconName: 'Hotel',
        emoji: '🏨',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    car_rental: {
        label: '租車自駕',
        shortLabel: '租車',
        iconName: 'Car',
        emoji: '🚗',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    bus: {
        label: '長途客運',
        shortLabel: '巴士',
        iconName: 'Bus',
        emoji: '🚌',
        badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200'
    },
    ferry: {
        label: '渡輪航船',
        shortLabel: '渡輪',
        iconName: 'Ship',
        emoji: '⛴️',
        badgeColor: 'bg-teal-50 text-teal-700 border-teal-200'
    },
    restaurant: {
        label: '餐飲訂位',
        shortLabel: '餐廳',
        iconName: 'Utensils',
        emoji: '🍽️',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
    },
    activity: {
        label: '票券活動',
        shortLabel: '活動',
        iconName: 'Ticket',
        emoji: '🎫',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
    },
    event: {
        label: '展演賽事',
        shortLabel: '展演',
        iconName: 'Sparkles',
        emoji: '🎟️',
        badgeColor: 'bg-pink-50 text-pink-700 border-pink-200'
    },
    tour: {
        label: '一日導覽',
        shortLabel: '行程',
        iconName: 'Compass',
        emoji: '🧭',
        badgeColor: 'bg-violet-50 text-violet-700 border-violet-200'
    },
    cruise: {
        label: '豪華郵輪',
        shortLabel: '郵輪',
        iconName: 'Anchor',
        emoji: '🚢',
        badgeColor: 'bg-sky-50 text-sky-700 border-sky-200'
    },
    camping: {
        label: '營地露營',
        shortLabel: '露營',
        iconName: 'Tent',
        emoji: '⛺',
        badgeColor: 'bg-lime-50 text-lime-700 border-lime-200'
    },
    shuttle: {
        label: '機場接駁',
        shortLabel: '接駁',
        iconName: 'Van',
        emoji: '🚐',
        badgeColor: 'bg-orange-50 text-orange-700 border-orange-200'
    },
    taxi: {
        label: '計程包車',
        shortLabel: '包車',
        iconName: 'CarTaxiFront',
        emoji: '🚕',
        badgeColor: 'bg-yellow-50 text-yellow-700 border-yellow-200'
    },
    parking: {
        label: '停車場預約',
        shortLabel: '停車',
        iconName: 'SquareParking',
        emoji: '🅿️',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200'
    },
    other: {
        label: '其他憑證',
        shortLabel: '其他',
        iconName: 'FileText',
        emoji: '📄',
        badgeColor: 'bg-gray-100 text-gray-700 border-gray-200'
    }
};

export const RESERVATION_STATUS = {
    CONFIRMED: { label: '已確認', color: 'bg-emerald-100 text-emerald-800' },
    TENTATIVE: { label: '暫定', color: 'bg-amber-100 text-amber-800' },
    CANCELLED: { label: '已取消', color: 'bg-slate-100 text-slate-500 line-through' }
};
