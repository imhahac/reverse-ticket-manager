import React, { useState } from 'react';
import { BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Instructions() {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl mb-8 overflow-hidden shadow-sm transition-all duration-300">
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

            {isOpen && (
                <div className="p-5 text-blue-900">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-bold flex items-center mb-2"><AlertCircle className="w-4 h-4 mr-1" /> 系統運作邏輯</h3>
                            <p className="text-sm mb-2 leading-relaxed">
                                本系統專門用來解決「混買來回票」所造成的日期混淆。系統會將你買的每一筆來回訂單拆解成兩張單程票，接著按照**時間順序重新排列**。
                            </p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                <li><strong>正向票</strong>：第一段是「出發地 → 目的地」，第二段是「目的地 → 出發地」。</li>
                                <li><strong>反向票</strong>：第一段是「目的地 → 出發地」，第二段是「出發地 → 目的地」。</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-bold flex items-center mb-2"><CheckCircle2 className="w-4 h-4 mr-1" /> 操作步驟 & 新功能</h3>
                            <ul className="list-decimal list-inside text-sm space-y-2 leading-relaxed">
                                <li>於下方表單輸入機票資訊，支援 <strong>單程票 (One-way)</strong> 與 <strong>多幣別換算 (TWD/JPY/USD)</strong>。可以輸入精確航班時間！</li>
                                <li>切換 <strong>「實際飛行配對」</strong>，系統為你拼湊真正的趟次並精算成本。點擊趟次標題旁的 ✏️ 即可<strong>自訂行程命名</strong>。</li>
                                <li><strong>【雲端跨裝置同步】</strong>點擊右上角「登入 Google」，授權後即可一鍵 <strong>雲端備份/載入</strong> 到你私人的 Google Drive。</li>
                                <li><strong>【行事曆與推播】</strong>登入後點擊「同步日曆」，航班將自動排入你的 Google 行事曆；若有設定 GitHub Actions，系統還會每日透過 LINE 推播提醒！</li>
                                <li>或者，你也可以點擊右上角使用傳統的 <strong>「本地匯出 / 匯入 JSON」</strong> 來搬移資料。</li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-blue-200/50 flex space-x-2 text-xs text-blue-700">
                        <span className="bg-blue-100 flex items-center px-2 py-1 rounded">🛡️ 隱私保證：你的資料只存在自己瀏覽器內，不會上傳雲端。(匯入匯出亦在本地完成)</span>
                    </div>
                </div>
            )}
        </div>
    );
}
