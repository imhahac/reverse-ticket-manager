import { describe, it, expect } from 'vitest';
import { extractReservationFromText } from '../pdfParser';

describe('Booking Import Parsers', () => {
    it('should extract flight reservation from airline e-ticket text', () => {
        const sampleETicketText = `
            CHINA AIRLINES ELECTRONIC TICKET PASSENGER ITINERARY RECEIPT
            BOOKING REFERENCE: WF89KJ
            PASSENGER NAME: CHOU / HAHA MR
            FLIGHT: CI 100
            DATE: 2025-04-01
            FROM: TPE TAIPEI TAOYUAN TERMINAL 2
            TO: NRT TOKYO NARITA TERMINAL 2
            SEAT: 18A
            CLASS: ECONOMY
        `;

        const result = extractReservationFromText(sampleETicketText, 'eticket.pdf');

        expect(result.success).toBe(true);
        expect(result.type).toBe('flight');
        expect(result.confirmationCode).toBe('WF89KJ');
        expect(result.flightDetails.flightNumber).toBe('CI100');
        expect(result.flightDetails.from).toBe('TPE');
        expect(result.flightDetails.to).toBe('NRT');
    });

    it('should extract hotel reservation from Booking.com confirmation text', () => {
        const sampleHotelText = `
            Booking.com Confirmation Number: 489201934
            Hotel: Shinjuku Prince Hotel Tokyo
            Check-in: 2025-04-01
            Check-out: 2025-04-06
            Guest Name: Haha Chou
            Total Price: TWD 24,000
        `;

        const result = extractReservationFromText(sampleHotelText, 'booking_confirmation.pdf');

        expect(result.success).toBe(true);
        expect(result.type).toBe('accommodation');
        expect(result.confirmationCode).toBe('489201934');
        expect(result.accommodationDetails.name).toContain('Shinjuku Prince Hotel');
        expect(result.accommodationDetails.checkInDate).toBe('2025-04-01');
        expect(result.accommodationDetails.checkOutDate).toBe('2025-04-06');
    });
});
