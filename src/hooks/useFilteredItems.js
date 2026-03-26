import { useMemo } from 'react';

const safeMatch = (val, search) => {
    try {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(search);
    } catch (e) { return false; }
};

export function useFilteredItems(items, searchTerm, filterStatus, type, tripLabels) {
    const searchLower = (searchTerm || '').toLowerCase();

    return useMemo(() => {
        try {
            const safeItems = Array.isArray(items) ? items : [];
            return safeItems.filter(item => {
                if (!item || typeof item !== 'object') return false;
                
                let matchesSearch = true;
                if (searchTerm) {
                    let fields = [];
                    if (type === 'tickets') {
                        fields = [item.airline, item.outboundFlightNo, item.inboundFlightNo, item.departRegion, item.returnRegion, item.note];
                    } else if (type === 'hotels') {
                        fields = [item.name, item.confirmationNo, item.address, item.note];
                    } else if (type === 'activities') {
                        fields = [item.title, item.location, item.notes, item.category];
                    } else if (type === 'itinerary') {
                        const customLabel = (tripLabels && item.id) ? (tripLabels[item.id] || '') : '';
                        fields = [customLabel];
                        if (Array.isArray(item.segments)) {
                            item.segments.forEach(s => {
                                if (s && typeof s === 'object') {
                                    fields.push(s.from, s.to, s.flightNo);
                                    if (s.ticket && typeof s.ticket === 'object') {
                                        fields.push(s.ticket.airline);
                                    }
                                }
                            });
                        }
                    }
                    matchesSearch = fields.some(f => safeMatch(f, searchLower));
                }
                
                if (filterStatus === 'upcoming') {
                    let dateStr = null;
                    if (type === 'tickets') dateStr = item.outboundDate;
                    if (type === 'hotels') dateStr = item.checkIn;
                    if (type === 'activities') dateStr = item.startDate;
                    
                    if (type === 'itinerary') return matchesSearch && !item.isPast;
                    
                    if (dateStr) {
                        const d = new Date(dateStr);
                        return matchesSearch && !isNaN(d) && d.getTime() >= new Date().setHours(0,0,0,0);
                    }
                    return false;
                }
                if (filterStatus === 'warning' && type === 'itinerary') {
                    return matchesSearch && item.hasWarning;
                }
                return matchesSearch;
            });
        } catch (e) { 
            console.error(`Filter ${type} error:`, e); 
            return Array.isArray(items) ? items : []; 
        }
    }, [items, searchTerm, filterStatus, searchLower, type, tripLabels]);
}
