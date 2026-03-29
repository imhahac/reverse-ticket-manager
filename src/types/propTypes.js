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
