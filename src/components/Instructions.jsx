/**
 * Instructions.jsx ── 頁面頂部可折疊的「使用說明與操作指南」元件。
 *
 * ・預設展開（isOpen = true），使用者可點擊標題列收合。
 * ・說明文字隨功能迭代需同步更新（最後更新：v7.1）。
 */
import React, { useState } from 'react';
import { BookOpen, AlertCircle, CheckCircle2, Banknote, Plane } from 'lucide-react';

export default function Instructions() {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl mb-8 overflow-hidden shadow-sm transition-all duration-300">
            {/* ── 標題列（點擊可收合） ──────────────────────────────────────── */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-blue-100/50 hover:bg-blue-100 text-blue-900 transition-colors"
            >
                <span className="flex items-center text-lg font-bold">
                    <BookOpen className="w-5 h-5 mr-2" />
                    使用說明與操作指南 v7.1
                </span>
                <span className="text-sm font-medium">{isOpen ? '收起 ▴' : '展開 ▾'}</span>
            </button>

            {/* ── 說明內容（可折疊） ─────────────────────────────────────────── */}
            {isOpen && (
                <div className="p-5 text-blue-900">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* 左欄：系統運作邏輯 */}
                        <div>
                            <h3 className="font-bold flex items-center mb-2">
                                <AlertCircle className="w-4 h-4 mr-1" /> 系統運作邏輯
                            </h3>
                            <p className="text-sm mb-2 leading-relaxed">
                                本系統專門處理解決「混買來回票」造成的日期混淆與成本計算難題。系統會自動拆解訂單並按照<strong>時間順序重新堆疊</strong>，精準拼湊出你實際的出行趟次。
                            </p>
                            <ul className="list-disc list-inside text-sm space-y-1.5">
                                <li><strong>正/反向與單程票</strong>：支援複雜票種邏輯，自動判定出發與抵達的相對關係。</li>
                                <li><strong>⚡ 航班 API 自動帶入</strong>：輸入航班編號與日期後，點擊「⚡」即可自動連線 AviationStack / AirLabs 抓取確切時刻表（支援紅眼航班自動 +1 天）。</li>
                                <li><strong>🗺️ 全球機場支援</strong>：內建擴充的國際機場座標資料庫，精準計算跨國旅行的地點矛盾警告。</li>
                                <li><strong>全局保險機制</strong>：系統具備核彈級防護。若遭遇資料毀損，不再出現萬年白畫面，而是提供獨立的安全模式介面讓您一鍵重設。</li>
                            </ul>
                        </div>

                        {/* 右欄：操作步驟 */}
                        <div>
                            <h3 className="font-bold flex items-center mb-2">
                                <CheckCircle2 className="w-4 h-4 mr-1" /> 操作步驟
                            </h3>
                            <ol className="list-decimal list-inside text-sm space-y-2 leading-relaxed">
                                <li>在 <strong>機票與住宿管理</strong> 區塊輸入訂單，支援多幣別換算，航班更可一鍵連線 API 生成時間。</li>
                                <li>在 <strong>「實際飛行配對」</strong> 中，查看系統精算出的所有趟次（可拖曳航段、自訂趟次名稱）。若住宿或活動安排有缺口或重疊，系統會紅字警示！</li>
                                <li>利用頂部 <strong>搜尋列</strong> 輕鬆過濾特定的機場、航班、飯店、活動名稱或標籤。</li>
                                <li><strong>【Dashboard 預算分析】</strong>：首頁圖表自動剖析機票/住宿/活動的費用佔比，且每趟行程皆會計算「每日 CP 值」。</li>
                                <li><strong>【雲端備份與日曆】</strong>：登入 Google 授權後，一鍵將資料完整備份至 Drive，或將所有航班、住宿及<strong>活動票卷</strong>無縫同步至行事曆！</li>
                            </ol>
                        </div>
                    </div>

                    {/* ── 費用統計說明 ──────────────────────────────────────────── */}
                    <div className="mt-4 pt-3 border-t border-blue-200/60">
                        <h3 className="font-bold flex items-center mb-2 text-sm">
                            <Banknote className="w-4 h-4 mr-1" /> 費用統計說明
                        </h3>
                        <ul className="list-disc list-inside text-xs text-blue-800 space-y-1 leading-relaxed">
                            <li><strong>機票與住宿佔比</strong>：一目了然旅費的資源配置。</li>
                            <li><strong>未來待出行</strong>：尚未出發的趟次分攤成本；每張來回票費用平均分給兩段航班。</li>
                            <li><strong>已實現與沉沒成本</strong>：歷史趟次成本總結，以及未被配對的孤兒機票（標橘色）警示。</li>
                        </ul>
                    </div>

                    {/* ── 底部隱私說明 + 狀態徽章 ──────────────────────────────── */}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-blue-700">
                        <span className="bg-blue-100 flex items-center px-2 py-1 rounded shadow-sm">
                            🛡️ 100% 隱私保證：離線優先架構，資料預設僅存於本機瀏覽器
                        </span>
                        <span className="bg-blue-100 flex items-center px-2 py-1 rounded shadow-sm">
                            <Plane className="w-3 h-3 mr-1" /> 完美支援 Open-Jaw (不同點進出) 與跨日轉機計算
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
