import PropTypes from 'prop-types';

export const FlightSegmentPropType = PropTypes.shape({
    id: PropTypes.string.isRequired,
    from: PropTypes.string,
    to: PropTypes.string,
    date: PropTypes.string,
    time: PropTypes.string,
    flightNo: PropTypes.string,
    ticket: PropTypes.shape({
        airline: PropTypes.string,
        priceTWD: PropTypes.number,
        type: PropTypes.string,
    }),
});

export const HotelPropType = PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    checkIn: PropTypes.string,
    checkOut: PropTypes.string,
    priceTWD: PropTypes.number,
});

export const ActivityPropType = PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    category: PropTypes.string,
    priceTWD: PropTypes.number,
});

export const TripPropType = PropTypes.shape({
    id: PropTypes.string.isRequired,
    isExternalOnly: PropTypes.bool,
    isComplete: PropTypes.bool,
    isOpenJaw: PropTypes.bool,
    isPast: PropTypes.bool,
    totalCostTWD: PropTypes.number,
    totalHotelCostTWD: PropTypes.number,
    tripDays: PropTypes.number,
    segments: PropTypes.arrayOf(FlightSegmentPropType),
    matchedHotels: PropTypes.arrayOf(HotelPropType),
    matchedActivities: PropTypes.arrayOf(ActivityPropType),
    hotelWarnings: PropTypes.arrayOf(PropTypes.string),
});

/** TripMap 用：含座標的飯店 */
export const HotelForMapPropType = PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    address: PropTypes.string,
    lat: PropTypes.number,
    lng: PropTypes.number,
});

/** TripMap 用：含 segments 與 matchedActivities 的行程 */
export const TripForMapPropType = PropTypes.shape({
    id: PropTypes.string.isRequired,
    segments: PropTypes.arrayOf(FlightSegmentPropType),
    matchedActivities: PropTypes.arrayOf(PropTypes.shape({
        title: PropTypes.string,
        location: PropTypes.string,
        lat: PropTypes.number,
        lng: PropTypes.number,
    })),
});
