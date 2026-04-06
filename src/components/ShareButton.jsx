/**
 * ShareButton.jsx ── 分享按鈕
 *
 * 點擊後呼叫 shareService 建立分享快照，並複製連結到剪貼板。
 */
import React, { useState } from 'react';
import { Share2, Check, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { createShareSnapshot } from '../services/shareService';
import { useFilterContext } from '../contexts/FilterContext';
import { useTicketDataContext } from '../contexts/DataContext';

const PROXY_BASE = import.meta.env.VITE_FLIGHT_PROXY_URL || '';

export default function ShareButton() {
    const [isSharing, setIsSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const { filteredItinerary, safeHotels, safeActivities } = useFilterContext();
    const { tripLabels } = useTicketDataContext();

    const handleShare = async () => {
        if (!PROXY_BASE) {
            toast.error('分享功能未啟用', {
                description: '請設定 VITE_FLIGHT_PROXY_URL (Cloudflare Worker 網址) 才能使用分享功能。'
            });
            return;
        }

        setIsSharing(true);
        try {
            const snapshot = {
                itinerary: filteredItinerary,
                tripLabels,
                hotels: safeHotels,
                activities: safeActivities,
                createdAt: new Date().toISOString(),
            };

            const id = await createShareSnapshot(snapshot);
            const shareUrl = `${window.location.origin}${window.location.pathname}?view=${id}`;

            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success('分享連結已複製到剪貼板！', {
                description: `連結有效期為 30 天。`,
            });
            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            toast.error('建立分享連結失敗', { description: err.message });
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <button
            onClick={handleShare}
            disabled={isSharing}
            title="產生唯讀分享連結"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isSharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
                <Share2 className="w-3.5 h-3.5" />
            )}
            {copied ? '已複製！' : isSharing ? '建立中...' : '分享行程'}
            {!PROXY_BASE && <Lock className="w-3 h-3 text-slate-400 ml-1" />}
        </button>
    );
}
