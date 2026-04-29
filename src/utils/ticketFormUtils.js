import { ERRORS } from '../constants/errors';
import { buildLocalDateTimeStr, validateFlightNo, validatePositiveNumber } from './formUtils';
import { createStableId } from './id';

/**
 * 回傳第一個驗證錯誤訊息；若通過則回傳 null。
 */
export const validateTicketForm = (formData) => {
    if (!formData.airline || !formData.price || !formData.outboundDate) {
        return ERRORS.TICKET_MISSING_FIELDS;
    }

    if (!validatePositiveNumber(formData.price)) {
        return ERRORS.TICKET_NEGATIVE_PRICE;
    }

    if (!validatePositiveNumber(formData.exchangeRate)) {
        return '匯率必須大於 0';
    }

    if (!validateFlightNo(formData.outboundFlightNo)) {
        return '去程航班號格式不正確 (例如 BR192)';
    }

    if (formData.type !== 'oneway' && !validateFlightNo(formData.inboundFlightNo)) {
        return '回程航班號格式不正確 (例如 BR192)';
    }

    if (!formData.departRegion || !formData.returnRegion) {
        return ERRORS.TICKET_AIRPORT_EMPTY;
    }

    if (formData.type !== 'oneway' && !formData.inboundDate) {
        return '請填寫第 2 段日期';
    }

    const outDateTimeStr = buildLocalDateTimeStr(formData.outboundDate, formData.outboundTime);
    const outDateObj = new Date(outDateTimeStr || formData.outboundDate);
    if (Number.isNaN(outDateObj.getTime())) {
        return ERRORS.TICKET_INVALID_DATE_FORMAT;
    }

    if (formData.type !== 'oneway') {
        const inDateTimeStr = buildLocalDateTimeStr(formData.inboundDate, formData.inboundTime);
        const inDateObj = new Date(inDateTimeStr || formData.inboundDate);

        if (Number.isNaN(inDateObj.getTime())) {
            return ERRORS.TICKET_INVALID_DATE_FORMAT;
        }

        if (inDateTimeStr && outDateTimeStr && inDateObj < outDateObj) {
            return ERRORS.TICKET_INVALID_DATE_ORDER;
        }
    }

    return null;
};

export const buildTicketPayload = ({ formData, editingTicket, seg1Fix, seg2Fix }) => ({
    ...formData,
    outboundArrivalDate: seg1Fix.arrivalDate,
    outboundArrivalTime: seg1Fix.arrivalTime,
    inboundArrivalDate: seg2Fix.arrivalDate,
    inboundArrivalTime: seg2Fix.arrivalTime,
    id: editingTicket ? editingTicket.id : createStableId('ticket-'),
    calendarIds: editingTicket ? editingTicket.calendarIds : undefined,
    price: Number(formData.price),
    exchangeRate: Number(formData.exchangeRate),
    priceTWD: Math.round(Number(formData.price) * Number(formData.exchangeRate)),
    outboundFlightNo: (formData.outboundFlightNo || '').toUpperCase(),
    inboundFlightNo: (formData.inboundFlightNo || '').toUpperCase(),
});
