/**
 * kitineraryClient.js
 * KItinerary C++ Docker 微服務連動與 AirTrail 自託管同步模組
 */

import { settingsRepo } from '../db';
import { logger } from '../../utils/logger';

export async function extractWithKItinerary(file) {
    const endpoint = await settingsRepo.get('kitinerary_endpoint', '');
    if (!endpoint) return null; // 未配置端點，回退至純前端解析

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            logger.warn(`KItinerary microservice responded with status: ${res.status}`);
            return null;
        }

        const jsonLd = await res.json();
        return parseKItineraryJsonLd(jsonLd);
    } catch (err) {
        logger.error('Failed to communicate with KItinerary microservice:', err);
        return null;
    }
}

/**
 * 將 KItinerary 回傳的 Schema.org JSON-LD 轉為本應用之 Reservation 模型
 */
function parseKItineraryJsonLd(data) {
    if (!data) return null;
    const item = Array.isArray(data) ? data[0] : data;
    const type = item['@type'];

    if (type === 'FlightReservation') {
        const flight = item.reservationFor || {};
        return {
            success: true,
            type: 'flight',
            title: `${flight.flightNumber || '航班'} (${flight.departureAirport?.iataCode || ''} → ${flight.arrivalAirport?.iataCode || ''})`,
            confirmationCode: item.reservationNumber || '',
            flightDetails: {
                airline: flight.airline?.name || '',
                flightNumber: flight.flightNumber || '',
                from: flight.departureAirport?.iataCode || '',
                to: flight.arrivalAirport?.iataCode || '',
                departureTime: flight.departureTime || '',
                arrivalTime: flight.arrivalTime || ''
            }
        };
    }

    if (type === 'LodgingReservation') {
        const hotel = item.reservationFor || {};
        return {
            success: true,
            type: 'accommodation',
            title: hotel.name || '住宿預訂',
            confirmationCode: item.reservationNumber || '',
            accommodationDetails: {
                name: hotel.name || '',
                checkInDate: item.checkinDate || '',
                checkOutDate: item.checkoutDate || '',
                address: hotel.address?.streetAddress || ''
            }
        };
    }

    return null;
}

/**
 * AirTrail 自託管實例航班同步 (預設關閉)
 */
export async function syncFromAirTrail() {
    const enabled = await settingsRepo.get('airtrail_enabled', false);
    const endpoint = await settingsRepo.get('airtrail_endpoint', '');
    const apiKey = await settingsRepo.get('airtrail_api_key', '');

    if (!enabled || !endpoint || !apiKey) return [];

    try {
        const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/flights`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!res.ok) return [];
        const flights = await res.json();

        return (flights || []).map(f => ({
            id: `airtrail_${f.id}`,
            type: 'flight',
            status: 'confirmed',
            confirmationCode: f.pnr || '',
            flightDetails: {
                airline: f.airline || '',
                flightNumber: f.flightNumber || '',
                from: f.origin || '',
                to: f.destination || '',
                departureTime: f.departureTime || ''
            }
        }));
    } catch (err) {
        logger.error('Failed to sync from AirTrail:', err);
        return [];
    }
}
