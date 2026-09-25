/**
 * pkpassParser.js
 * 純前端 Apple Wallet PKPass 登機證與票券解壓縮與解析服務 (免後端)
 */

import { logger } from '../../utils/logger';

export async function parsePKPass(file) {
    try {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(file);

        const passJsonFile = zip.file('pass.json');
        if (!passJsonFile) {
            throw new Error('無效的 pkpass 檔案：未找到 pass.json');
        }

        const passJsonText = await passJsonFile.async('text');
        const pass = JSON.parse(passJsonText);

        const orgName = pass.organizationName || pass.logoText || '票券';
        const description = pass.description || '';
        const barcodeValue = pass.barcode?.message || pass.barcodes?.[0]?.message || '';

        // 1. 判斷是否為登機證 (boardingPass)
        if (pass.boardingPass) {
            const bp = pass.boardingPass;
            const transitType = bp.transitType; // PKTransitTypeAir, PKTransitTypeTrain, etc.

            const primary = bp.primaryFields || [];
            const secondary = bp.secondaryFields || [];
            const auxiliary = bp.auxiliaryFields || [];

            const fromField = primary.find(f => f.key === 'origin' || f.key === 'from') || primary[0];
            const toField = primary.find(f => f.key === 'destination' || f.key === 'to') || primary[1];

            const flightField = secondary.find(f => f.key === 'flight' || f.key === 'flightNumber' || f.key === 'flight-number');
            const passengerField = secondary.find(f => f.key === 'passenger' || f.key === 'passenger-name');
            const seatField = secondary.find(f => f.key === 'seat');
            const gateField = auxiliary.find(f => f.key === 'gate');
            const classField = auxiliary.find(f => f.key === 'class');
            const pnrField = auxiliary.find(f => f.key === 'pnr' || f.key === 'booking-ref' || f.key === 'confirmationCode');

            const isTrain = transitType === 'PKTransitTypeTrain';
            const resType = isTrain ? 'train' : 'flight';

            return {
                success: true,
                type: resType,
                title: `${orgName} ${fromField?.value || ''} → ${toField?.value || ''}`,
                confirmationCode: pnrField?.value || barcodeValue.slice(0, 6) || '',
                travellers: passengerField?.value ? [passengerField.value] : [],
                flightDetails: resType === 'flight' ? {
                    airline: orgName,
                    flightNumber: flightField?.value || '',
                    from: fromField?.value || fromField?.label || '',
                    to: toField?.value || toField?.label || '',
                    seat: seatField?.value || '',
                    gate: gateField?.value || '',
                    cabinClass: classField?.value || 'Economy',
                    departureTime: pass.relevantDate || ''
                } : null,
                trainDetails: resType === 'train' ? {
                    trainNumber: flightField?.value || '',
                    fromStation: fromField?.value || '',
                    toStation: toField?.value || '',
                    seat: seatField?.value || '',
                    departureTime: pass.relevantDate || ''
                } : null
            };
        }

        // 2. 一般活動/票券 (eventTicket, generic)
        const generic = pass.eventTicket || pass.generic || pass.coupon || {};
        return {
            success: true,
            type: 'activity',
            title: description || orgName,
            confirmationCode: barcodeValue.slice(0, 8) || '',
            activityDetails: {
                title: description || orgName,
                date: pass.relevantDate ? pass.relevantDate.slice(0, 10) : ''
            }
        };
    } catch (err) {
        logger.error('PKPass parse error:', err);
        return { success: false, error: err.message };
    }
}
