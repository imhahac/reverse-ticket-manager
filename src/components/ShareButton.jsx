/**
 * ShareButton.jsx ── 分享行程按鈕
 *
 * 支援將當前旅程透過 Cloudflare Worker 建立唯讀分享連結，
 * 或在未設定 Worker 時自動降級為系統原生分享 (Web Share API) 與剪貼簿文字摘要。
 */
import React, { useState } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createShareSnapshot } from '../services/shareService';
import { useFilterContext } from '../contexts/FilterContext';
import { useTicketDataContext } from '../contexts/DataContext';
import { useTrek } from '../contexts/TrekContext';

const PROXY_BASE = import.meta.env.VITE_FLIGHT_PROXY_URL || '';

export default function ShareButton({ variant = 'default', className = '' }) {
    const [isSharing, setIsSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const { filteredItinerary, safeHotels, safeActivities } = useFilterContext();
    const { tripLabels } = useTicketDataContext();
    const { activeTrip, dayPlans, reservations } = useTrek();

    const handleShare = async () => {
        setIsSharing(true);
        try {
            // 1. 若有配置 Cloudflare Worker，走雲端快照連結分享
            if (PROXY_BASE) {
                const snapshot = {
                    trip: activeTrip,
                    itinerary: filteredItinerary,
                    tripLabels,
                    hotels: safeHotels,
                    activities: safeActivities,
                    dayPlans: dayPlans || [],
                    reservations: reservations || [],
                    createdAt: new Date().toISOString(),
                };

                const id = await createShareSnapshot(snapshot);
                const shareUrl = `${window.location.origin}${window.location.pathname}?view=${id}`;

                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                toast.success('分享連結已複製到剪貼簿！', {
                    description: '連結有效期為 30 天，可傳送給好友唯讀檢視。',
                });
                setTimeout(() => setCopied(false), 3000);
                return;
            }

            // 2. 備援方案 A：原生 Web Share API（手機或 macOS 支援原生分享）
            const tripTitle = activeTrip?.title || '精彩旅程';
            const tripDates = activeTrip?.startDate && activeTrip?.endDate 
                ? `${activeTrip.startDate} ~ ${activeTrip.endDate}`
                : '';
            const shareText = `🎒 【${tripTitle}】\n${tripDates ? `📅 日期：${tripDates}\n` : ''}🔗 行程連結：${window.location.href}`;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: tripTitle,
                        text: shareText,
                        url: window.location.href
                    });
                    setCopied(true);
                    toast.success('已開啟分享選單！');
                    setTimeout(() => setCopied(false), 3000);
                    return;
                } catch (shareErr) {
                    if (shareErr.name === 'AbortError') return; // 使用者主動取消
                }
            }

            // 3. 備援方案 B：直接複製行程純文字摘要至剪貼簿
            await navigator.clipboard.writeText(shareText);
            setCopied(true);
            toast.success('行程資訊已複製到剪貼簿！', {
                description: '可直接貼上傳送給同行旅伴。'
            });
            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            toast.error('分享失敗', { description: err.message });
        } finally {
            setIsSharing(false);
        }
    };

    // 樣式判斷：Header 專用深色風格 vs 預設淺色風格
    const isHeader = variant === 'header';

    const headerClasses = isSharing
        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
        : copied
            ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40'
            : 'bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-100 hover:text-white border-indigo-400/30 hover:border-indigo-300/50 shadow-xs';

    const defaultClasses = isSharing
        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
        : copied
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100';

    return (
        <button
            onClick={handleShare}
            disabled={isSharing}
            title="分享此行程連結給好友"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isHeader ? headerClasses : defaultClasses
            } ${className}`}
        >
            {isSharing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
                <Share2 className="w-3.5 h-3.5" />
            )}
            <span>{copied ? '已複製！' : isSharing ? '建立中...' : '分享行程'}</span>
        </button>
    );
}

