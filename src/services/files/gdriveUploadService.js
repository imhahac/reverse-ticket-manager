/**
 * gdriveUploadService.js
 * Google Drive 分塊斷點續傳 (Resumable Upload) 服務：
 * 專門支援 50MB 檔案與 500MB 影片直傳 Google Drive，
 * 採用 5MB 分塊串流 (Blob.slice) 傳輸，徹底避免一次讀入記憶體引發的 OOM 崩潰。
 * 內建中斷重試與 Content-Range 狀態查詢 (Query Status) 機制，網路瞬斷可自斷點接續上傳。
 */

import { logger } from '../../utils/logger';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk (Google Drive 規範需為 256KB 的整數倍)
const MAX_CHUNK_RETRIES = 3;

/**
 * 查詢 Google Drive 上傳工作階段目前已接收的位元組偏移量
 * @param {string} sessionUri
 * @param {number} totalSize
 * @returns {Promise<number | { completed: boolean, fileId: string } | null>}
 */
async function queryResumableOffset(sessionUri, totalSize) {
    try {
        const res = await fetch(sessionUri, {
            method: 'PUT',
            headers: {
                'Content-Range': `bytes */${totalSize}`
            }
        });

        if (res.status === 308) {
            const range = res.headers.get('Range');
            if (range) {
                const match = range.match(/bytes=0-(\d+)/);
                if (match) {
                    return parseInt(match[1], 10) + 1;
                }
            }
            return 0;
        } else if (res.status === 200 || res.status === 201) {
            const json = await res.json();
            return { completed: true, fileId: json.id };
        }
    } catch (err) {
        logger.warn('Failed to query resumable status from Google Drive:', err);
    }
    return null;
}

/**
 * 分塊上傳檔案至 Google Drive
 * @param {File} file - 瀏覽器 File 物件
 * @param {string} accessToken - Google OAuth Bearer Token
 * @param {Function} onProgress - 進度回調 (percent: number)
 * @returns {Promise<{success: boolean, fileId?: string, error?: string}>}
 */
export async function uploadLargeFileToDrive(file, accessToken, onProgress = null) {
    if (!accessToken) {
        return { success: false, error: '未登入 Google 帳號，請先連結 Google Drive' };
    }

    try {
        // ── Step 1: 發起 Resumable Upload Session ────────────────────────────
        const metadata = {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            description: `Uploaded by TREK-Lite on ${new Date().toISOString()}`
        };

        const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': file.type || 'application/octet-stream',
                'X-Upload-Content-Length': file.size.toString()
            },
            body: JSON.stringify(metadata)
        });

        if (!initRes.ok) {
            const errText = await initRes.text();
            throw new Error(`發起上傳工作階段失敗: [${initRes.status}] ${errText}`);
        }

        const sessionUri = initRes.headers.get('Location');
        if (!sessionUri) {
            throw new Error('Google Drive API 未返還上傳工作階段 URI (Location Header)');
        }

        // ── Step 2: 分塊傳輸 (Chunk-by-chunk with Auto-Resume) ───────────────
        const totalSize = file.size;
        let start = 0;
        let uploadedFileId = null;

        while (start < totalSize) {
            const end = Math.min(start + CHUNK_SIZE, totalSize);
            const chunk = file.slice(start, end);
            let retries = 0;
            let chunkSuccess = false;

            while (retries < MAX_CHUNK_RETRIES && !chunkSuccess) {
                try {
                    const uploadRes = await fetch(sessionUri, {
                        method: 'PUT',
                        headers: {
                            'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`
                        },
                        body: chunk
                    });

                    if (uploadRes.status === 308) {
                        // 308 Resume Incomplete: 區塊上傳成功，推進入下一區塊
                        start = end;
                        chunkSuccess = true;
                        if (onProgress) {
                            onProgress(Math.round((start / totalSize) * 100));
                        }
                    } else if (uploadRes.status === 200 || uploadRes.status === 201) {
                        // 200/201: 全部上傳完成
                        const result = await uploadRes.json();
                        uploadedFileId = result.id;
                        chunkSuccess = true;
                        start = totalSize;
                        if (onProgress) onProgress(100);
                        break;
                    } else {
                        throw new Error(`區塊上傳非預期狀態碼: [${uploadRes.status}]`);
                    }
                } catch (chunkErr) {
                    retries++;
                    logger.warn(`區塊 ${start}-${end} 上傳遭遇異常 (嘗試 ${retries}/${MAX_CHUNK_RETRIES}):`, chunkErr);

                    if (retries >= MAX_CHUNK_RETRIES) {
                        throw new Error(`上傳中斷且重試次數超限: ${chunkErr.message}`);
                    }

                    // 等待指數退避
                    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries)));

                    // 向 Google Drive 查詢目前已接收之 Range 進行斷點續傳
                    const statusRes = await queryResumableOffset(sessionUri, totalSize);
                    if (statusRes != null) {
                        if (typeof statusRes === 'object' && statusRes.completed) {
                            uploadedFileId = statusRes.fileId;
                            start = totalSize;
                            chunkSuccess = true;
                            if (onProgress) onProgress(100);
                            break;
                        } else if (typeof statusRes === 'number') {
                            start = statusRes; // 接續雲端已記錄之 byte offset
                            chunkSuccess = true; // 跳出內層重試，使用新 offset 重新 slice
                        }
                    }
                }
            }
        }

        return {
            success: true,
            fileId: uploadedFileId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type
        };
    } catch (err) {
        logger.error('Google Drive 大檔案上傳失敗:', err);
        return {
            success: false,
            error: err.message || '上傳失敗'
        };
    }
}
