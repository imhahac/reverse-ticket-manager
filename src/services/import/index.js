/**
 * import/index.js
 * 統一雙軌票券匯入服務接口：
 * 支援 PKPass、PDF、EML、HTML、TXT 憑證解析，
 * 自動優先使用自建 KItinerary 微服務，無微服務時走純前端輕量引擎！
 */

import { parsePKPass } from './pkpassParser';
import { parsePDFDocument } from './pdfParser';
import { parseEmailOrTextFile } from './emailParser';
import { extractWithKItinerary } from './kitineraryClient';
import { logger } from '../../utils/logger';

export async function importBookingFile(file) {
    if (!file) return { success: false, error: '未選擇任何檔案' };

    const name = file.name.toLowerCase();

    // 1. 若為 Apple Wallet PKPass 檔案，直接走純前端解壓縮
    if (name.endsWith('.pkpass')) {
        return parsePKPass(file);
    }

    // 2. 先嘗試自建 KItinerary 微服務 (若有配置)
    try {
        const kitineraryRes = await extractWithKItinerary(file);
        if (kitineraryRes && kitineraryRes.success) {
            logger.info('Parsed successfully using KItinerary microservice');
            return kitineraryRes;
        }
    } catch (e) {
        logger.warn('KItinerary microservice failed, falling back to client-side engine:', e);
    }

    // 3. 純前端解析引擎回退
    if (name.endsWith('.pdf')) {
        return parsePDFDocument(file);
    }

    if (name.endsWith('.eml') || name.endsWith('.html') || name.endsWith('.htm') || name.endsWith('.txt')) {
        return parseEmailOrTextFile(file);
    }

    return { success: false, error: `不支援的檔案格式: ${file.name} (支援 .pkpass, .pdf, .eml, .html, .txt)` };
}
