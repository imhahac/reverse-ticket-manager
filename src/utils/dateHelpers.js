export const formatDateWithDay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const days = ['(日)', '(一)', '(二)', '(三)', '(四)', '(五)', '(六)'];
    return `${dateStr} ${days[date.getDay()]}`;
};

export const calculateTripDays = (outboundDate, inboundDate) => {
    if (!outboundDate || !inboundDate) return null;
    const start = new Date(outboundDate);
    const end = new Date(inboundDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    const diffTime = end - start;
    if (diffTime < 0) return null;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
};
