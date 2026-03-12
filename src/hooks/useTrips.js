import { useMemo } from 'react';

const isTaiwan = (regionStr) => {
    const twCodes = ['TPE', 'TSA', 'KHH', 'RMQ'];
    return twCodes.some(code => regionStr.includes(code));
};

export const useTrips = (tickets) => {
    return useMemo(() => {
        let segments = [];
        tickets.forEach(t => {
            const outTime = t.outboundTime ? `T${t.outboundTime}:00` : 'T00:00:00';
            const inTime = t.inboundTime ? `T${t.inboundTime}:00` : 'T00:00:00';
            
            const outDateTime = new Date(`${t.outboundDate}${outTime}`);
            const inDateTime = new Date(`${t.inboundDate}${inTime}`);

            if (t.type === 'normal') {
                if (t.outboundDate) segments.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, time: t.outboundTime || '', flightNo: t.outboundFlightNo || '', dateTime: outDateTime, from: t.departRegion, to: t.returnRegion });
                if (t.inboundDate) segments.push({ id: t.id + '-2', ticket: t, date: t.inboundDate, time: t.inboundTime || '', flightNo: t.inboundFlightNo || '', dateTime: inDateTime, from: t.returnRegion, to: t.departRegion });
            } else if (t.type === 'reverse') {
                if (t.outboundDate) segments.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, time: t.outboundTime || '', flightNo: t.outboundFlightNo || '', dateTime: outDateTime, from: t.returnRegion, to: t.departRegion });
                if (t.inboundDate) segments.push({ id: t.id + '-2', ticket: t, date: t.inboundDate, time: t.inboundTime || '', flightNo: t.inboundFlightNo || '', dateTime: inDateTime, from: t.departRegion, to: t.returnRegion });
            } else {
                if (t.outboundDate) segments.push({ id: t.id + '-1', ticket: t, date: t.outboundDate, time: t.outboundTime || '', flightNo: t.outboundFlightNo || '', dateTime: outDateTime, from: t.departRegion, to: t.returnRegion });
            }
        });

        segments.sort((a, b) => a.dateTime - b.dateTime);

        let trips = [];
        let currentTrip = null;

        segments.forEach(seg => {
            if (!currentTrip) {
                currentTrip = {
                    id: seg.id, 
                    outbound: seg,
                    connections: [],
                    inbound: null,
                    isComplete: false
                };
                if (isTaiwan(seg.to)) {
                    // It already arrived in Taiwan, so it's an inbound-only trip
                    currentTrip.inbound = seg;
                    currentTrip.outbound = null;
                    currentTrip.isComplete = true;
                    trips.push(currentTrip);
                    currentTrip = null;
                }
            } else {
                if (isTaiwan(seg.to)) {
                    // Back to Taiwan, end trip
                    currentTrip.inbound = seg;
                    currentTrip.isComplete = true;
                    trips.push(currentTrip);
                    currentTrip = null;
                } else if (isTaiwan(seg.from)) {
                    // It departed from Taiwan again, start a new trip without closing properly
                    trips.push(currentTrip);
                    currentTrip = {
                        id: seg.id,
                        outbound: seg,
                        connections: [],
                        inbound: null,
                        isComplete: false
                    };
                } else {
                    currentTrip.connections.push(seg);
                }
            }
        });

        if (currentTrip) {
            trips.push(currentTrip);
        }

        // 標記「純外站行程」（完全不含台灣）
        trips = trips.map(trip => {
            const segs = [
                ...(trip.outbound ? [trip.outbound] : []),
                ...trip.connections,
                ...(trip.inbound ? [trip.inbound] : []),
            ];
            const hasTW = segs.some(s => isTaiwan(s.from) || isTaiwan(s.to));
            return { ...trip, isExternalOnly: !hasTW };
        });

        return { segments, trips };
    }, [tickets]);
};
