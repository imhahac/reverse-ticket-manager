/**
 * errors.js
 * 統一管理系統內部的錯誤訊息、提示文字與警告。
 * 方便多語言支援或一致性的使用者體驗。
 */

export const ERRORS = {
    // Auth & Google API
    AUTH_EXPIRED: '您的 Google 登入已過期，請重新登入以進行同步。',
    DRIVE_SYNC_FAILED: '雲端備份失敗，請檢查網路狀態。',
    CALENDAR_SYNC_FAILED: '日曆同步失敗，請確認是否具備寫入權限。',
    MISSING_CLIENT_ID: '系統配置錯誤：遺失 Google Client ID。請在環境變數或 Secrets 中設定 VITE_GOOGLE_CLIENT_ID。',

    // Form Validation: Tickets
    TICKET_MISSING_FIELDS: '請填寫完整資訊 (航空公司、價格、去程日期)',
    TICKET_NEGATIVE_PRICE: '機票價格必須大於 0。',
    TICKET_INVALID_DATE_ORDER: '回程日期/時間不能早於去程段喔！',
    TICKET_INVALID_DATE_FORMAT: '日期格式無效，請檢查輸入。',
    TICKET_AIRPORT_EMPTY: '出發與抵達機場不能為空！',

    // Form Validation: Hotels
    HOTEL_MISSING_FIELDS: '請填寫飯店名稱、入住日期與退房日期。',
    HOTEL_NEGATIVE_PRICE: '住宿金額不能為負數。',
    HOTEL_INVALID_NIGHTS: '退房日期必須晚於入住日期。',

    // Form Validation: Activities
    ACTIVITY_MISSING_FIELDS: '請填寫完整資訊 (活動名稱、開始日期、地點、價格)。',
    ACTIVITY_NEGATIVE_PRICE: '活動價格不能為負數。',
    ACTIVITY_INVALID_DATE_ORDER: '結束日期不能早於開始日期。',

    // System
    IMPORT_FAILED: '匯入失敗，檔案格式可能已損毀或不相容。',
    RENDER_CRITICAL: '程式發生非預期錯誤，建議重設本地資料。',
};
