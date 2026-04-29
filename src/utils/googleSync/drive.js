import { logger } from '../logger';

async function findDriveFile(accessToken) {
    const query = encodeURIComponent(`name="reverse-tickets.json" and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (searchRes.status === 401) return { expired: true };
    if (!searchRes.ok) throw new Error(`搜尋 Drive 失敗: [${searchRes.status}] ${await searchRes.text()}`);
    
    let searchData;
    try {
        searchData = await searchRes.json();
    } catch (e) {
        throw new Error('Google Drive 搜尋回傳格式錯誤 (非 JSON)');
    }

    const files = Array.isArray(searchData.files) ? searchData.files : [];
    return { files };
}

/**
 * 上傳/覆寫資料到 Google Drive 的 reverse-tickets.json
 */
export const syncToDrive = async (tickets, tripLabels, hotels = [], accessToken, activities = [], tripBudgets = {}) => {
    try {
        const findRes = await findDriveFile(accessToken);
        if (findRes.expired) return { success: false, expired: true };
        
        const files = findRes.files;
        const existingFile = files.length > 0 ? files[0] : null;

        const fileContent = { tickets, tripLabels, hotels, activities, tripBudgets };

        let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media';
        let method = 'POST';
        
        if (existingFile) {
            uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
            method = 'PATCH';
        }

        const res = await fetch(uploadUrl, {
            method,
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(fileContent)
        });

        if (method === 'POST' && res.ok) {
            const uploadedData = await res.json();
            await fetch(`https://www.googleapis.com/drive/v3/files/${uploadedData.id}`, {
                method: 'PATCH',
                headers: { 
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: 'reverse-tickets.json' })
            });
            return { success: true, fileId: uploadedData.id };
        } else if (res.ok) {
            const resData = await res.json();
            return { success: true, fileId: resData.id };
        } else {
            if (res.status === 401) return { success: false, expired: true };
            throw new Error(`上傳檔案失敗: [${res.status}] ${await res.text()}`);
        }
    } catch (e) {
        logger.error('Drive API Error:', e);
        return { success: false, error: e.message };
    }
};

/**
 * 從 Google Drive 下載 reverse-tickets.json
 */
export const loadFromDrive = async (accessToken) => {
    try {
        const findRes = await findDriveFile(accessToken);
        if (findRes.expired) return { success: false, expired: true };
        
        const files = findRes.files;
        if (files.length === 0) {
            return { success: false, error: `雲端找不到 reverse-tickets.json 的檔案。\n近期您是否有清除資料或變更帳號？` };
        }

        const existingFile = files[0];
        const allFoundFiles = files.map(f => `${f.name} (ID: ${f.id})`).join('\n');

        const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (downloadRes.status === 401) return { success: false, expired: true };
        if (!downloadRes.ok) {
            throw new Error(`下載 Content 失敗: [${downloadRes.status}] ${await downloadRes.text()}`);
        }
        
        let data;
        try {
            data = await downloadRes.json();
        } catch (e) {
            throw new Error('雲端檔案內容解析失敗 (非有效 JSON)');
        }
        
        let tickets = [];
        let tripLabels = {};
        let tripBudgets = {};
        let hotels = [];
        let activities = [];
        
        if (Array.isArray(data)) {
            tickets = data;
        } else if (data && typeof data === 'object') {
            tickets = Array.isArray(data.tickets) ? data.tickets : [];
            tripLabels = (data.tripLabels && typeof data.tripLabels === 'object') ? data.tripLabels : {};
            tripBudgets = (data.tripBudgets && typeof data.tripBudgets === 'object') ? data.tripBudgets : {};
            hotels = Array.isArray(data.hotels) ? data.hotels : [];
            activities = Array.isArray(data.activities) ? data.activities : [];
        } else {
            throw new Error('雲端檔案內容格式毀損或不相容');
        }

        return { success: true, tickets, tripLabels, hotels, activities, tripBudgets, foundFilesLog: allFoundFiles };
    } catch (e) {
        logger.error('Drive API Error:', e);
        return { success: false, error: e.message };
    }
};
