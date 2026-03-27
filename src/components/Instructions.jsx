import React from 'react';

export default function Instructions() {
    return (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 mb-8 mt-2 text-indigo-900 shadow-sm">
            <h2 className="text-xl font-extrabold mb-4 flex items-center">
                <span className="text-indigo-600 mr-2 text-2xl">✨</span> 系統使用指南 (v8.0)
            </h2>
            
            <div className="space-y-6">
                <div>
                    <h3 className="font-bold text-lg mb-2 text-indigo-800">什麼是反向機票？</h3>
                    <p className="text-sm leading-relaxed text-indigo-700">
                        當您頻繁往返兩地，有時候購買「去程起點為外站的機票（例如：東京發、回東京）」會比「台北發、回台北」便宜許多。
                        這套系統能將您東拼西湊的「正向來回機票」、「反向來回機票」或是「單程票」，透過大數據運算，自動重構成您<strong className="text-indigo-900 bg-indigo-200 px-1 rounded mx-1">實際出門到回家</strong>的「完整旅程 (Trip)」。
                    </p>
                </div>

                <div>
                    <h3 className="font-bold text-lg mb-2 text-indigo-800">核心亮點功能</h3>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-indigo-700">
                        <li>
                            <strong>✈️ 智慧航班自動帶入</strong>：只需輸入航班代碼 (如 CI101)，這系統不僅支援自動爬取，更內建了 API 配備 Multi-Proxy 備援演算法來克服網路封鎖，精準載入航班時間。
                        </li>
                        <li>
                            <strong>🗺️ 即時地圖與防呆機制</strong>：自動為您加上飯店與活動的地點。系統會運用您的航班到達時間與預定入住處的地理坐標，若在短時間內需要跨越大幅度距離 (例如東京飛到福岡，卻訂了札幌的飯店)，系統將觸發智慧警告 (Warning Filters)。
                        </li>
                        <li>
                            <strong>📊 獨立預算儀表板</strong>：【首頁 Dashboard】會將您每趟的交通、住宿與票卷成本根據即時匯率做總額拆分，並為您精算「每日平均開銷 (CP值)」。
                        </li>
                        <li>
                            <strong>☁️ 雲端無縫整合</strong>：不需要繁瑣的手動下載與匯入。只要登入 Google，可一鍵將所有的機票行程「打卡」成為 Google Calendar 具備精確時間與時區的事件，並安全地同步資料庫至 Google Drive，隨時切換裝置不流失！
                        </li>
                    </ul>
                </div>

                <div className="bg-white p-4 rounded-lg border border-indigo-100">
                    <h3 className="font-bold mb-3 text-indigo-800">🚀 新手上路三部曲</h3>
                    <ol className="list-decimal pl-5 space-y-2 text-sm text-indigo-700">
                        <li><strong>新增機票</strong>：切換到「🎟️ 機票管理」分頁，輸入您買的航班並新增。支援外站與 Open-Jaw 的複雜行程。</li>
                        <li><strong>加入住宿與活動</strong>：切換至「🏨 飯店管理」或「🎫 票卷活動」，輸入訂房資料或票卷。即使幣值不同也不用擔心，匯率將即刻幫您轉換！</li>
                        <li><strong>檢視視覺化行程</strong>：於「📆 行程 Timeline」與「🗺️ 地圖」中，用上帝視角俯瞰您優雅的旅行計畫，任何時間重疊或地點落差都能立刻浮現！</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
