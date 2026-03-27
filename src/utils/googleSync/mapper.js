import { addHours, format } from 'date-fns';

export function addHoursToLocalStr(localStr, hours) {
    const date = new Date(localStr);
    const resultDate = addHours(date, hours);
    return format(resultDate, "yyyy-MM-dd'T'HH:mm:ss");
}

export function getIanaTimeZone(seg) {
    const codeFrom = (seg.from || '').split(' ')[0]; 
    const codeTo   = (seg.to || '').split(' ')[0];
    const table = {
        TPE: 'Asia/Taipei', TSA: 'Asia/Taipei', KHH: 'Asia/Taipei', RMQ: 'Asia/Taipei',
        NRT: 'Asia/Tokyo', HND: 'Asia/Tokyo', KIX: 'Asia/Tokyo', CTS: 'Asia/Tokyo', FUK: 'Asia/Tokyo', OKA: 'Asia/Tokyo',
        BKK: 'Asia/Bangkok', DMK: 'Asia/Bangkok', SIN: 'Asia/Singapore', HKG: 'Asia/Hong_Kong',
    };
    return table[codeFrom] || table[codeTo] || 'Asia/Taipei';
}
