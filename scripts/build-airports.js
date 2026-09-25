import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAirports() {
    console.log('✈️ Fetching global airports database...');
    const res = await fetch('https://raw.githubusercontent.com/mwgg/Airports/master/airports.json');
    if (!res.ok) {
        throw new Error(`Failed to fetch airports: ${res.statusText}`);
    }
    const raw = await res.json();

    // Map common Chinese / Asian city / airport names
    const commonAliases = {
        'TPE': '台北桃園',
        'TSA': '台北松山',
        'KHH': '高雄小港',
        'RMQ': '台中清泉崗',
        'NRT': '東京成田',
        'HND': '東京羽田',
        'KIX': '大阪關西',
        'ITM': '大阪伊丹',
        'NGO': '名古屋中部',
        'CTS': '札幌新千歲',
        'FUK': '福岡',
        'OKA': '沖繩那霸',
        'HKD': '函館',
        'BKK': '曼谷蘇凡納布',
        'DMK': '曼谷廊曼',
        'CNX': '清邁',
        'HKT': '普吉島',
        'SIN': '新加坡樟宜',
        'HKG': '香港赤鱲角',
        'MFM': '澳門',
        'ICN': '首爾仁川',
        'GMP': '首爾金浦',
        'PUS': '釜山金海',
        'CJU': '濟州島',
        'KUL': '吉隆坡',
        'PEN': '檳城',
        'SGN': '胡志明市新山一',
        'HAN': '河內內排',
        'DAD': '峴港',
        'DPS': '峇里島',
        'MNL': '馬尼拉',
        'CEB': '宿霧',
        'LAX': '洛杉磯',
        'SFO': '舊金山',
        'JFK': '紐約甘迺迪',
        'SEA': '西雅圖',
        'YVR': '溫哥華',
        'LHR': '倫敦希斯洛',
        'CDG': '巴黎戴高樂',
        'FRA': '法蘭克福',
        'AMS': '阿姆斯特丹',
        'DXB': '杜拜',
        'SYD': '雪梨',
        'MEL': '墨爾本',
        'AKL': '奧克蘭'
    };

    const airports = {};
    for (const [icao, item] of Object.entries(raw)) {
        const iata = item.iata?.trim()?.toUpperCase();
        if (!iata || iata.length !== 3 || !item.tz || typeof item.lat !== 'number' || typeof item.lon !== 'number') {
            continue;
        }

        // Keep 4 decimal places for lat/lng (~11m accuracy, saves 40% JSON size)
        const lat = Math.round(item.lat * 10000) / 10000;
        const lon = Math.round(item.lon * 10000) / 10000;

        airports[iata] = {
            i: iata,
            n: item.name || '',
            c: item.city || '',
            cc: item.country || '',
            lat,
            lon,
            tz: item.tz,
            zh: commonAliases[iata] || ''
        };
    }

    const outputDir = path.resolve(__dirname, '../src/data');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'airports.json');
    fs.writeFileSync(outputPath, JSON.stringify(airports));
    const stats = fs.statSync(outputPath);
    console.log(`✅ Bundled ${Object.keys(airports).length} airports to ${outputPath} (${Math.round(stats.size / 1024)} KB)`);
}

buildAirports().catch(err => {
    console.error('❌ Error building airports:', err);
    process.exit(1);
});
