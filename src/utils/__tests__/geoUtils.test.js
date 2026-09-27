import { describe, it, expect } from 'vitest';
import { extractRegionName, getCityDefaultCoordinates } from '../geoUtils';

describe('extractRegionName', () => {
    it('should extract district from Nominatim formatted address (Japan & Taiwan)', () => {
        expect(extractRegionName('明治神宮, 1, Yoyogi Kamizono-chō, 澀谷區, 东京都/東京都, 日本')).toBe('澀谷區');
        expect(extractRegionName('淺草寺, 1, 浅草二丁目, 臺東區, 東京都, 日本')).toBe('臺東區');
        expect(extractRegionName('清水寺, 清水一丁目, 東山區, 京都市, 日本')).toBe('東山區');
        expect(extractRegionName('難波八阪神社, 難波中二丁目, 浪速區, 大阪市, 日本')).toBe('浪速區');
    });

    it('should extract district from UK and European addresses', () => {
        // UK
        expect(extractRegionName('大英博物馆, Great Russell Street, St Giles, Bloomsbury, 卡姆登區, 大倫敦;大伦敦, 英格兰;英格蘭, WC1B 3DG, 英国;英國')).toBe('卡姆登區');
        expect(extractRegionName('London Eye, York Road, South Bank, Waterloo, London Borough of Lambeth, 大倫敦;大伦敦, 英格兰;英格蘭, SE1 7ND, 英国;英國')).toBe('Lambeth 區');
        // France
        expect(extractRegionName('艾菲爾鐵塔, 5, Avenue Anatole France, 格罗斯卡尤街区, 第七区, 巴黎, 法兰西岛大区;法蘭西島大區, 法國本土;法国本土, 75007, 法国;法國')).toBe('第七区');
        // Italy
        expect(extractRegionName('Colosseum, Piazza del Colosseo, Rione Monti, Municipio Roma I, Roma, Roma Capitale, Lazio, 00184, Italia')).toBe('Roma');
    });

    it('should extract district and city from USA addresses', () => {
        expect(extractRegionName('帝国大厦, 350, 5th Avenue, Koreatown, Manhattan Community Board 5, Manhattan, New York County, 纽约;紐約, 纽约州;紐約州, 10118, 美国;美國')).toBe('Manhattan');
        expect(extractRegionName('中央公园, New York County, 纽约;紐約, 纽约州;紐約州, 11025, 美国;美國')).toBe('纽约');
    });

    it('should extract district and city from Thailand addresses', () => {
        expect(extractRegionName('玉佛寺, Na Phra Lan Road, Tha Chang, 大皇宫区, Phra Nakhon District, 曼谷, 10200, 泰国;泰國')).toBe('大皇宫区');
        expect(extractRegionName('鄭王廟, 158, Wang Doem Road, Wat Arun Subdistrict, Bangkok Yai District, 曼谷, 10600, 泰国;泰國')).toBe('Bangkok Yai 區');
        expect(extractRegionName('Wat Phra Singh, Sam Lan Road, Tambon Si Phum, 清邁, 50200, Thailand')).toBe('清邁');
    });

    it('should extract district and city from South Korea addresses', () => {
        expect(extractRegionName('景福宮, Samcheong-ro, 昌成洞, 淸雲孝子洞, 鍾路區, 首尔特别市, 03142, 韩国 / 南韓')).toBe('鍾路區');
        expect(extractRegionName('Hongdae, Mapo-gu, Seoul, 04050, South Korea')).toBe('Mapo-gu');
        expect(extractRegionName('강남대로, 역삼동, 강남구, 서울특별시, 06232, 대한민국')).toBe('강남구');
    });

    it('should extract district or city from continuous address without commas', () => {
        expect(extractRegionName('東京都中央區日本橋馬喰町1-2-3')).toBe('中央區');
        expect(extractRegionName('台北市信義區市府路45號')).toBe('信義區');
        expect(extractRegionName('新北市板橋區縣民大道二段')).toBe('板橋區');
        expect(extractRegionName('日本長野縣北佐久郡輕井澤町')).toBe('輕井澤町');
        expect(extractRegionName('京都府宇治市宇治蓮華')).toBe('宇治市');
    });

    it('should return fallback if no region is detected or address is invalid', () => {
        expect(extractRegionName('', '當地市區')).toBe('當地市區');
        expect(extractRegionName(null, '當地市區')).toBe('當地市區');
        expect(extractRegionName(undefined, '當地市區')).toBe('當地市區');
        expect(extractRegionName('無關字元12345', '當地市區')).toBe('當地市區');
    });
});

describe('getCityDefaultCoordinates', () => {
    it('should resolve default coordinates for global cities', () => {
        expect(getCityDefaultCoordinates('倫敦')).toEqual({ lat: 51.5074, lng: -0.1278 });
        expect(getCityDefaultCoordinates('London 7-Day Trip')).toEqual({ lat: 51.5074, lng: -0.1278 });
        expect(getCityDefaultCoordinates('巴黎自由行')).toEqual({ lat: 48.8566, lng: 2.3522 });
        expect(getCityDefaultCoordinates('紐約商務行')).toEqual({ lat: 40.7128, lng: -74.0060 });
        expect(getCityDefaultCoordinates('曼谷放鬆之旅')).toEqual({ lat: 13.7563, lng: 100.5018 });
        expect(getCityDefaultCoordinates('首爾吃貨行')).toEqual({ lat: 37.5665, lng: 126.9780 });
        expect(getCityDefaultCoordinates('東京迪士尼之旅')).toEqual({ lat: 35.6812, lng: 139.7671 });
    });

    it('should return null for unknown destinations', () => {
        expect(getCityDefaultCoordinates('火星探索之旅')).toBeNull();
        expect(getCityDefaultCoordinates('')).toBeNull();
    });
});
