/**
 * Instructions.jsx ── 頁面頂部可折疊的「使用說明與操作指南」元件。
 *
 * ・預設展開（isOpen = true），使用者可點擊標題列收合。
 * ・說明文字隨功能迭代需同步更新（最後更新：v6.0）。
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
                    使用說明與操作指南
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
                                本系統專門用來解決「混買來回票」所造成的日期混淆。系統會將你買的每一筆來回訂單拆解成兩張單程票，接著按照<strong>時間順序重新排列</strong>，自動拼出你實際的出行趟次。
                            </p>
                            <ul className="list-disc list-inside text-sm space-y-1.5">
                                <li><strong>正向票</strong>：第一段「出發地 → 目的地」，第二段「目的地 → 出發地」。</li>
                                <li><strong>反向票</strong>：第一段「目的地 → 出發地」，第二段「出發地 → 目的地」（方向顛倒）。</li>
                                <li><strong>單程票</strong>：只有一段，系統直接列入切確日期行程。</li>
                                <li><strong>紅眼航班</strong>：填入抵達時間時，若早於出發時間，系統會<strong>自動修正抵達日期 +1 天</strong>，無須手動計算。</li>
                            </ul>
                        </div>

                        {/* 右欄：操作步驟 */}
                        <div>
                            <h3 className="font-bold flex items-center mb-2">
                                <CheckCircle2 className="w-4 h-4 mr-1" /> 操作步驟
                            </h3>
                            <ol className="list-decimal list-inside text-sm space-y-2 leading-relaxed">
                                <li>在下方表單輸入機票資訊，支援 <strong>單程票</strong> 與 <strong>多幣別換算 (TWD/JPY/USD)</strong>。所有時間皆精確到分鐘。</li>
                                <li>在 <strong>「購買清單管理」</strong> 分頁可以隨時 ✏️ <strong>修改訂單</strong> 或 🗑️ 刪除。</li>
                                <li>切換至 <strong>「實際飛行配對」</strong>，查看系統拼好的趟次與精算成本。點 ✏️ 可<strong>自訂行程命名</strong>，也可<strong>拖曳航段</strong>手動調整配對。</li>
                                <li><strong>【雲端同步】</strong>點右上角「登入 Google」，授權後可一鍵<strong>備份/載入</strong>到你的個人 Google Drive。</li>
                                <li><strong>【日曆推播】</strong>登入後點「同步日曆」，航班自動排入 Google 行事曆；搭配 GitHub Actions 每日 LINE 推播行前提醒！</li>
                            </ol>
                        </div>
                    </div>

                    {/* ── 費用統計說明 ──────────────────────────────────────────── */}
                    <div className="mt-4 pt-3 border-t border-blue-200/60">
                        <h3 className="font-bold flex items-center mb-2 text-sm">
                            <Banknote className="w-4 h-4 mr-1" /> 費用統計說明
                        </h3>
                        <ul className="list-disc list-inside text-xs text-blue-800 space-y-1 leading-relaxed">
                            <li><strong>入帳總計</strong>：你實際付出的所有機票金額加總。</li>
                            <li><strong>未來待出行</strong>：尚未出發的趟次分攤成本。每張來回票的費用平均分給兩段航班。</li>
                            <li><strong>歷史已實現</strong>：所有已完成趟次的分攤成本。</li>
                            <li><strong>未配對成本</strong>：入帳總計中，尚未被任何趟次使用的孤兒票費用（橘色警示代表有資料需要確認）。</li>
                        </ul>
                    </div>

                    {/* ── 底部隱私說明 + 狀態徽章 ──────────────────────────────── */}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-blue-700">
                        <span className="bg-blue-100 flex items-center px-2 py-1 rounded">
                            🛡️ 隱私保證：資料只存在你的瀏覽器，不會自動上傳（Google 功能需主動操作）
                        </span>
                        <span className="bg-blue-100 flex items-center px-2 py-1 rounded">
                            <Plane className="w-3 h-3 mr-1" /> 支援不同點進出 (Open-Jaw)・外站轉機顯示等待時間
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
