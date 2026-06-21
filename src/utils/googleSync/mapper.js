import { addHours, format } from 'date-fns';

export function addHoursToLocalStr(localStr, hours) {
    const date = new Date(localStr);
    const resultDate = addHours(date, hours);
    return format(resultDate, "yyyy-MM-dd'T'HH:mm:ss");
}

export function getAirportTimeZone(airportStr) {
    const code = (airportStr || '').split(' ')[0].toUpperCase();
    const table = {
        // Taiwan
        TPE: 'Asia/Taipei', TSA: 'Asia/Taipei', KHH: 'Asia/Taipei', RMQ: 'Asia/Taipei',
        // Japan
        NRT: 'Asia/Tokyo', HND: 'Asia/Tokyo', KIX: 'Asia/Tokyo', ITM: 'Asia/Tokyo', NGO: 'Asia/Tokyo', CTS: 'Asia/Tokyo', HKD: 'Asia/Tokyo', FUK: 'Asia/Tokyo', OKA: 'Asia/Tokyo', SDJ: 'Asia/Tokyo',
        // Thailand
        BKK: 'Asia/Bangkok', DMK: 'Asia/Bangkok', CNX: 'Asia/Bangkok', HKT: 'Asia/Bangkok',
        // Korea
        ICN: 'Asia/Seoul', GMP: 'Asia/Seoul', PUS: 'Asia/Seoul', CJU: 'Asia/Seoul',
        // Singapore, Hong Kong, Macau
        SIN: 'Asia/Singapore', HKG: 'Asia/Hong_Kong', MFM: 'Asia/Macau',
        // North America
        LAX: 'America/Los_Angeles', SFO: 'America/Los_Angeles', SEA: 'America/Los_Angeles',
        JFK: 'America/New_York', YVR: 'America/Vancouver',
        // Europe
        LHR: 'Europe/London', CDG: 'Europe/Paris', FRA: 'Europe/Berlin', AMS: 'Europe/Amsterdam',
        // Oceania & Middle East
        DXB: 'Asia/Dubai', SYD: 'Australia/Sydney', MEL: 'Australia/Melbourne', AKL: 'Pacific/Auckland'
    };
    return table[code] || 'Asia/Taipei';
}

export function getIanaTimeZone(seg) {
    return getAirportTimeZone(seg.from);
}
