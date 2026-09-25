/**
 * emailParser.js
 * EML、HTML 與 TXT 郵件確認信智能萃取服務
 */

import { extractReservationFromText } from './pdfParser';
import { logger } from '../../utils/logger';

export async function parseEmailOrTextFile(file) {
    try {
        const text = await file.text();
        
        // 若為 HTML，簡易剔除標籤
        let cleanText = text;
        if (file.name.endsWith('.html') || file.name.endsWith('.htm') || text.includes('<html')) {
            cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        }

        return extractReservationFromText(cleanText, file.name);
    } catch (err) {
        logger.error('Failed to parse email/text file:', err);
        return { success: false, error: err.message };
    }
}
