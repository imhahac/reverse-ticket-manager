import { describe, it, expect } from 'vitest';
import { parseEmailOrTextFile } from '../emailParser';

describe('emailParser - EML & HTML Booking Extraction', () => {
    it('should parse HTML confirmation email and strip HTML tags before parsing', async () => {
        const mockHtml = `
            <!DOCTYPE html>
            <html>
                <body>
                    <h1>EVA Air 訂位確認</h1>
                    <p>電子機票收據 / 電子行程單</p>
                    <p>訂位代號 (PNR): <strong>EV789X</strong></p>
                    <p>航班號碼: BR198</p>
                    <p>出發日期: 2026-05-10 08:50</p>
                    <p>航段: TPE 台北桃園 至 NRT 東京成田</p>
                </body>
            </html>
        `;

        const mockFile = {
            name: 'confirmation.html',
            text: async () => mockHtml
        };

        const result = await parseEmailOrTextFile(mockFile);

        expect(result.success).toBe(true);
        expect(result.type).toBe('flight');
        expect(result.flightDetails.flightNumber).toBe('BR198');
        expect(result.confirmationCode).toBe('EV789X');
    });

    it('should parse plain text confirmation email correctly', async () => {
        const mockText = `
            Booking.com 預訂確認信
            預訂確認碼: BK998877
            飯店名稱: 東京椿山莊大飯店 (Hotel Chinzanso Tokyo)
            入住日期: 2026-05-10
            退房日期: 2026-05-14
            地址: 2-10-8 Sekiguchi, Bunkyo-ku, Tokyo
        `;

        const mockFile = {
            name: 'booking_email.txt',
            text: async () => mockText
        };

        const result = await parseEmailOrTextFile(mockFile);

        expect(result.success).toBe(true);
        expect(result.type).toBe('accommodation');
        expect(result.confirmationCode).toBe('BK998877');
        expect(result.accommodationDetails.name).toContain('東京椿山莊');
    });
});
