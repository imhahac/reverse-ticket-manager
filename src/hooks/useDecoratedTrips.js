import { useMemo } from 'react';
import { calculateTripDays } from '../utils/dateHelpers';

export function useDecoratedTrips(displayTrips, tickets, hotels, activities) {
    return useMemo(() => {
        try {
            const safeTickets = Array.isArray(tickets) ? tickets : [];
            const safeHotels = Array.isArray(hotels) ? hotels : [];
            const safeActivities = Array.isArray(activities) ? activities : [];

            // 1. 基本費用
            const _totalPriceTWD = safeTickets.reduce((s, t) => s + (Number(t?.priceTWD || t?.price || 0)), 0);
            const _totalHotelTWD = safeHotels.reduce((s, h) => s + (Number(h?.priceTWD || 0)), 0);
            const _totalActivityTWD = safeActivities.reduce((s, a) => s + (Number(a?.priceTWD || 0)), 0);

            // 2. 裝飾趟次
            const getSegs = (trip) => {
                if (!trip) return [];
                let list = [];
                if (Array.isArray(trip.segments)) list = trip.segments;
                else {
                    if (trip.outbound) list.push(trip.outbound);
                    if (Array.isArray(trip.connections)) list.push(...trip.connections);
                    if (trip.inbound) list.push(trip.inbound);
                }
                return list.filter(s => s && typeof s === 'object' && s.date);
            };

            const _decoratedTrips = displayTrips.map(trip => {
                try {
                    if (!trip) return null;
                    const segs = getSegs(trip);
                    if (!segs.length) return { ...trip, segments: [], tripStartAt: null, tripEndAt: null, isPast: false, totalCostTWD: 0, isOpenJaw: false, tripDays: null, costPerDay: null };

                    const first = segs[0];
                    const last = segs[segs.length - 1];
                    const now = new Date().setHours(0,0,0,0);

                    const dt = (date, time) => {
                        if (!date) return null;
                        const t = (time && time.length === 5) ? time : '00:00';
                        const d = new Date(`${date}T${t}:00`);
                        return isNaN(d.getTime()) ? null : d;
                    };

                    const tripStartAt = dt(first.date, first.time);
                    const tripEndAt   = dt(last.arrivalDate || last.date, last.arrivalTime || last.time);
                    const isPast      = tripEndAt ? tripEndAt.getTime() < now : false;

                    const _cost = segs.reduce((sum, s) => {
                        const ticket = s.ticket || {};
                        const price = Number(ticket.priceTWD || 0);
                        const weight = (ticket.type === 'normal' || ticket.type === 'reverse') ? 0.5 : 1.0;
                        return sum + (price * weight);
                    }, 0);

                    const outCode = (first.to || '').split(' ')[0];
                    const inCode  = (last.from || '').split(' ')[0];
                    const isOpenJaw = segs.length >= 2 && Boolean(outCode && inCode && outCode !== inCode);
                    const tripDays = (tripStartAt && tripEndAt) ? calculateTripDays(first.date, last.date) : null;
                    const costPerDay = (tripDays && tripDays > 0) ? Math.round(_cost / tripDays) : null;

                    return { ...trip, segments: segs, tripStartAt, tripEndAt, isPast, totalCostTWD: _cost, isOpenJaw, tripDays, costPerDay };
                } catch (e) { return null; }
            }).filter(Boolean);

            const _past = _decoratedTrips.reduce((s, t) => s + (t.isPast ? (t.totalCostTWD || 0) : 0), 0);
            const _future = _decoratedTrips.reduce((s, t) => s + (!t.isPast ? (t.totalCostTWD || 0) : 0), 0);
            const _days = _decoratedTrips.reduce((s, t) => s + (t.tripDays || 0), 0);
            const _sunk = Math.max(0, _totalPriceTWD - _past - _future);

            return {
                decoratedTrips: _decoratedTrips,
                totalPriceTWD: _totalPriceTWD,
                totalHotelTWD: _totalHotelTWD,
                totalActivityTWD: _totalActivityTWD,
                pastCostTWD: _past,
                futureCostTWD: _future,
                totalTripDays: _days,
                sunkCostTWD: _sunk,
                renderError: null,
                safeTickets,
                safeHotels,
                safeActivities
            };
        } catch (e) {
            console.error("Critical calculation error:", e);
            return { 
                decoratedTrips: [], totalPriceTWD: 0, totalHotelTWD: 0, totalActivityTWD: 0,
                pastCostTWD: 0, futureCostTWD: 0, totalTripDays: 0, 
                sunkCostTWD: 0, renderError: e.message,
                safeTickets: [], safeHotels: [], safeActivities: []
            };
        }
    }, [displayTrips, tickets, hotels, activities]);
}
