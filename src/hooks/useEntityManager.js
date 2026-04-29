import { useState } from 'react';
import { toast } from 'sonner';
import { processGeocodedEntity } from '../utils/entityUtils';

/**
 * 通用的實體管理 Hook (處理 CRUD 的 UI 狀態與防呆)
 */
export function useEntityManager({
    itemName,
    titleField,
    locationField,
    addFn,
    updateFn,
    deleteFn,
}) {
    const [editingItem, setEditingItem] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (item) => {
        setIsSaving(true);
        try {
            const { enrichedItem, geoSuccess, query } = await processGeocodedEntity(item, titleField, locationField);

            if (editingItem) {
                updateFn(enrichedItem);
            } else {
                addFn(enrichedItem);
            }
            setEditingItem(null);

            if (geoSuccess || (item.lat && item.lng)) {
                toast.success(`${itemName}已成功儲存！`, { description: '已成功取得精確地圖座標。' });
            } else if (query) {
                toast.warning(`${itemName}已儲存，但無法解析地圖座標`, {
                    description: '無法找到該地點的地圖位置，這將無法為您計算地點落差警告。請檢查拼寫。',
                    duration: 6000
                });
            } else {
                toast.success(`${itemName}已成功儲存！`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : '儲存時發生未知錯誤';
            toast.error(`${itemName}儲存失敗`, { description: message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
    };

    const handleDelete = (id) => {
        toast(`確定要刪除這筆${itemName}記錄嗎？`, {
            action: { label: '確認刪除', onClick: () => deleteFn(id) },
            cancel: { label: '取消', onClick: () => {} },
            duration: 8000,
        });
    };

    return {
        editingItem,
        isSaving,
        handleSave,
        handleEdit,
        handleCancelEdit,
        handleDelete
    };
}
