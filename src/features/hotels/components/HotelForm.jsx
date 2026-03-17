/**
 * HotelForm.jsx ── 新增/修改飯店住宿表單（骨架）
 *
 * TODO：實作飯店功能時，此表單需支援：
 *   - 飯店名稱、地址
 *   - 入住日期 (checkIn) / 退房日期 (checkOut)
 *   - 房型 (roomType)
 *   - 每晚費用 (pricePerNight) + 幣別 + 匯率換算
 *   - 確認碼 (confirmationNo)
 *   - 備註 (notes)
 *
 * Props（預期）：
 *   onAddHotel    {Function}
 *   editingHotel  {Object|null}
 *   onCancelEdit  {Function}
 *   exchangeRates {Object}
 */
import React from 'react';

export default function HotelForm({ onAddHotel, editingHotel, onCancelEdit, exchangeRates }) {
    // TODO: 實作飯店住宿新增/修改表單
    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-dashed border-gray-300 mb-8 text-center text-gray-400">
            <p className="text-lg font-bold mb-1">🏨 飯店住宿管理</p>
            <p className="text-sm">即將推出 — 此功能正在開發中</p>
        </div>
    );
}
