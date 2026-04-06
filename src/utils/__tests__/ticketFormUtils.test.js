import { describe, it, expect, vi } from 'vitest';
import { validateTicketForm, buildTicketPayload } from '../ticketFormUtils';

const baseForm = {
    airline: 'EVA Air',
    price: '10000',
    currency: 'TWD',
    exchangeRate: '1',
    departRegion: 'TPE (台北桃園)',
    returnRegion: 'NRT (東京成田)',
    outboundDate: '2026-04-01',
    outboundTime: '10:00',
    outboundArrivalDate: '',
    outboundArrivalTime: '',
    inboundDate: '2026-04-05',
    inboundTime: '18:00',
    inboundArrivalDate: '',
    inboundArrivalTime: '',
    outboundFlightNo: 'br192',
    inboundFlightNo: 'br191',
    type: 'normal',
};

describe('ticketFormUtils -> validateTicketForm', () => {
    it('returns null for valid normal ticket', () => {
        expect(validateTicketForm(baseForm)).toBeNull();
    });

    it('requires mandatory fields', () => {
        expect(validateTicketForm({ ...baseForm, airline: '' })).toBe('請填寫完整資訊 (航空公司、價格、去程日期)');
    });

    it('rejects non-positive price', () => {
        expect(validateTicketForm({ ...baseForm, price: '0' })).toBe('機票價格必須大於 0。');
    });

    it('requires positive exchange rate', () => {
        expect(validateTicketForm({ ...baseForm, exchangeRate: '0' })).toBe('匯率必須大於 0');
    });

    it('validates outbound flight number', () => {
        expect(validateTicketForm({ ...baseForm, outboundFlightNo: 'bad-no-*' })).toBe('去程航班號格式不正確 (例如 BR192)');
    });

    it('requires inbound date for non-oneway ticket', () => {
        expect(validateTicketForm({ ...baseForm, inboundDate: '' })).toBe('請填寫第 2 段日期');
    });

    it('validates date order for non-oneway ticket', () => {
        expect(
            validateTicketForm({
                ...baseForm,
                outboundDate: '2026-04-05',
                outboundTime: '18:00',
                inboundDate: '2026-04-01',
                inboundTime: '10:00',
            })
        ).toBe('回程日期/時間不能早於去程段喔！');
    });

    it('allows one-way ticket without inbound date', () => {
        expect(validateTicketForm({ ...baseForm, type: 'oneway', inboundDate: '', inboundFlightNo: '' })).toBeNull();
    });
});

describe('ticketFormUtils -> buildTicketPayload', () => {
    it('builds payload with converted numeric fields and uppercased flight numbers', () => {
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890);

        const payload = buildTicketPayload({
            formData: baseForm,
            editingTicket: null,
            seg1Fix: { arrivalDate: '2026-04-01', arrivalTime: '14:00' },
            seg2Fix: { arrivalDate: '2026-04-05', arrivalTime: '20:00' },
        });

        expect(payload.id).toBe('1234567890');
        expect(payload.price).toBe(10000);
        expect(payload.exchangeRate).toBe(1);
        expect(payload.priceTWD).toBe(10000);
        expect(payload.outboundFlightNo).toBe('BR192');
        expect(payload.inboundFlightNo).toBe('BR191');
        expect(payload.outboundArrivalDate).toBe('2026-04-01');
        expect(payload.inboundArrivalDate).toBe('2026-04-05');

        nowSpy.mockRestore();
    });

    it('keeps editing ticket id and calendarIds when editing', () => {
        const payload = buildTicketPayload({
            formData: baseForm,
            editingTicket: { id: 'ticket-edit-1', calendarIds: { outbound: 'abc' } },
            seg1Fix: { arrivalDate: '', arrivalTime: '' },
            seg2Fix: { arrivalDate: '', arrivalTime: '' },
        });

        expect(payload.id).toBe('ticket-edit-1');
        expect(payload.calendarIds).toEqual({ outbound: 'abc' });
    });
});
