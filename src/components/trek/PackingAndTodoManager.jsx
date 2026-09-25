/**
 * PackingAndTodoManager.jsx
 * 行李清單、行前待辦事項與 50MB/500MB 檔案管理中心：
 * - 行李清單：範本套用、分類篩選、三級能見度、行李重量累計滾動
 * - 待辦事項：到期倒數、優先級標籤、逾期預警
 * - 檔案中心：50MB 大檔與 500MB 影片直傳 Google Drive、軟刪除垃圾桶與一鍵還原
 */

import React, { useState, useEffect } from 'react';
import { 
    CheckSquare, 
    Square, 
    Plus, 
    Trash2, 
    Scale, 
    Calendar, 
    AlertCircle, 
    UploadCloud, 
    FileText, 
    Video, 
    Image as ImageIcon, 
    RotateCcw, 
    ExternalLink, 
    Layers, 
    SlidersHorizontal,
    Sparkles,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useTrek } from '../../contexts/TrekContext';
import { packingRepo, todoRepo, fileRepo } from '../../services/db';
import { PACKING_CATEGORIES, PACKING_TEMPLATES, calculatePackingStats } from '../../services/packing/packingTemplates';
import { uploadLargeFileToDrive } from '../../services/files/gdriveUploadService';
import { useSyncContext } from '../../contexts/SyncContext';

export default function PackingAndTodoManager() {
    const { activeTrip } = useTrek();
    const { accessToken } = useSyncContext();

    const [activeSubTab, setActiveSubTab] = useState('packing'); // 'packing' | 'todos' | 'files'

    // ── 行李狀態 ──────────────────────────────────────────────────────────
    const [packingItems, setPackingItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedVisibility, setSelectedVisibility] = useState('all');
    const [showWeightRollup, setShowWeightRollup] = useState(true);
    const [newPackingName, setNewPackingName] = useState('');
    const [newPackingCategory, setNewPackingCategory] = useState('clothes');
    const [newPackingWeight, setNewPackingWeight] = useState(200);
    const [newPackingVisibility, setNewPackingVisibility] = useState('all');
    const [newPackingAssignee, setNewPackingAssignee] = useState('全體');

    // ── 待辦狀態 ──────────────────────────────────────────────────────────
    const [todos, setTodos] = useState([]);
    const [newTodoTitle, setNewTodoTitle] = useState('');
    const [newTodoPriority, setNewTodoPriority] = useState('medium');
    const [newTodoDueDate, setNewTodoDueDate] = useState('');
    const [newTodoAssignee, setNewTodoAssignee] = useState('我');

    // ── 檔案狀態 ──────────────────────────────────────────────────────────
    const [files, setFiles] = useState([]);
    const [showTrash, setShowTrash] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);

    // 1. 載入資料
    const loadAllData = async () => {
        if (!activeTrip) return;
        const pItems = await packingRepo.getByTrip(activeTrip.id);
        setPackingItems(pItems);

        const tItems = await todoRepo.getByTrip(activeTrip.id);
        tItems.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
        setTodos(tItems);

        const fItems = await fileRepo.getByTrip(activeTrip.id);
        setFiles(fItems);
    };

    useEffect(() => {
        loadAllData();
    }, [activeTrip?.id]);

    if (!activeTrip) return null;

    // ── 行李操作 ──────────────────────────────────────────────────────────
    const handleTogglePacked = async (item) => {
        const updated = { ...item, isPacked: !item.isPacked };
        await packingRepo.save(updated);
        setPackingItems(prev => prev.map(i => i.id === item.id ? updated : i));
    };

    const handleAddPackingItem = async (e) => {
        e.preventDefault();
        if (!newPackingName.trim()) return;

        const newItem = {
            id: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tripId: activeTrip.id,
            category: newPackingCategory,
            itemName: newPackingName.trim(),
            isPacked: false,
            assignee: newPackingAssignee.trim() || '全體',
            visibilityTier: newPackingVisibility, // 'all' | 'travellers' | 'private'
            weightGrams: Number(newPackingWeight) || 0,
            createdAt: Date.now()
        };

        await packingRepo.save(newItem);
        setPackingItems(prev => [...prev, newItem]);
        setNewPackingName('');
        toast.success(`已加入行李清單：${newItem.itemName}`);
    };

    const handleApplyTemplate = async (templateId) => {
        const tpl = PACKING_TEMPLATES.find(t => t.id === templateId);
        if (!tpl) return;

        const newItems = tpl.items.map(item => ({
            id: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tripId: activeTrip.id,
            category: item.category,
            itemName: item.name,
            isPacked: false,
            assignee: '全體',
            visibilityTier: 'all',
            weightGrams: item.weightGrams,
            createdAt: Date.now()
        }));

        await packingRepo.saveBatch(newItems);
        setPackingItems(prev => [...prev, ...newItems]);
        toast.success(`✨ 已套用「${tpl.title}」範本 (共加入 ${newItems.length} 項)`);
    };

    const handleDeletePackingItem = async (id) => {
        await packingRepo.delete(id);
        setPackingItems(prev => prev.filter(i => i.id !== id));
    };

    const packingStats = calculatePackingStats(packingItems);

    // ── 待辦操作 ──────────────────────────────────────────────────────────
    const handleToggleTodo = async (todo) => {
        const updated = { ...todo, completed: !todo.completed };
        await todoRepo.save(updated);
        setTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
    };

    const handleAddTodo = async (e) => {
        e.preventDefault();
        if (!newTodoTitle.trim()) return;

        const newTodo = {
            id: `todo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            tripId: activeTrip.id,
            title: newTodoTitle.trim(),
            priority: newTodoPriority,
            dueDate: newTodoDueDate || activeTrip.startDate,
            assignee: newTodoAssignee || '我',
            completed: false,
            createdAt: Date.now()
        };

        await todoRepo.save(newTodo);
        setTodos(prev => [...prev, newTodo]);
        setNewTodoTitle('');
        toast.success('已新增待辦事項');
    };

    const handleDeleteTodo = async (id) => {
        await todoRepo.delete(id);
        setTodos(prev => prev.filter(t => t.id !== id));
    };

    // 計算待辦倒數狀態
    const getTodoDueStatus = (dueDate) => {
        if (!dueDate) return null;
        const today = new Date().toISOString().split('T')[0];
        const diffMs = new Date(dueDate).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0);
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { text: `逾期 ${Math.abs(diffDays)} 天`, className: 'text-red-700 bg-red-50 border-red-200' };
        if (diffDays === 0) return { text: '今天截止', className: 'text-amber-800 bg-amber-50 border-amber-200' };
        if (diffDays <= 3) return { text: `剩 ${diffDays} 天`, className: 'text-orange-700 bg-orange-50 border-orange-200' };
        return { text: `還有 ${diffDays} 天`, className: 'text-slate-600 bg-slate-50 border-slate-200' };
    };

    // ── 檔案操作 (Google Drive 50MB/500MB Resumable) ──────────────────────
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isVideo = file.type.startsWith('video/');
        const limitBytes = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024;

        if (file.size > limitBytes) {
            toast.error(`檔案過大！${isVideo ? '影片上限 500MB' : '檔案上限 50MB'}`);
            return;
        }

        setUploadProgress(1);

        try {
            let gdriveId = null;
            if (accessToken) {
                const uploadRes = await uploadLargeFileToDrive(file, accessToken, (pct) => {
                    setUploadProgress(pct);
                });
                if (uploadRes.success) {
                    gdriveId = uploadRes.fileId;
                }
            }

            const newFile = {
                id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                tripId: activeTrip.id,
                parentId: activeTrip.id,
                parentType: 'trip',
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                gdriveFileId: gdriveId,
                isTrash: false,
                uploadedAt: Date.now()
            };

            await fileRepo.save(newFile);
            setFiles(prev => [...prev, newFile]);
            toast.success(`檔案已上傳成功：${file.name}`);
        } catch (err) {
            toast.error(`上傳失敗: ${err.message}`);
        } finally {
            setUploadProgress(null);
            e.target.value = '';
        }
    };

    const handleMoveToTrash = async (id) => {
        await fileRepo.moveToTrash(id);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, isTrash: true, trashedAt: Date.now() } : f));
        toast.info('檔案已移至垃圾桶');
    };

    const handleRestoreFile = async (id) => {
        await fileRepo.restore(id);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, isTrash: false, trashedAt: null } : f));
        toast.success('檔案已還原');
    };

    const handlePermanentDelete = async (id) => {
        if (confirm('確定要永久刪除此檔案嗎？此動作無法復原。')) {
            await fileRepo.permanentDelete(id);
            setFiles(prev => prev.filter(f => f.id !== id));
            toast.info('檔案已永久刪除');
        }
    };

    const activeFiles = files.filter(f => !f.isTrash);
    const trashedFiles = files.filter(f => f.isTrash);

    const filteredPackingItems = packingItems.filter(item => {
        const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
        const matchVisibility = selectedVisibility === 'all' || item.visibilityTier === selectedVisibility;
        return matchCategory && matchVisibility;
    });

    return (
        <div className="space-y-4">
            {/* 1. 主功能切換按鈕 (行李 / 待辦 / 檔案) */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                <button
                    onClick={() => setActiveSubTab('packing')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        activeSubTab === 'packing'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'
                    }`}
                >
                    <span>🎒 行李清單 ({packingItems.length})</span>
                </button>
                <button
                    onClick={() => setActiveSubTab('todos')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        activeSubTab === 'todos'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'
                    }`}
                >
                    <span>✅ 行前待辦 ({todos.length})</span>
                </button>
                <button
                    onClick={() => setActiveSubTab('files')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        activeSubTab === 'files'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-gray-200'
                    }`}
                >
                    <span>📁 附件檔案 ({activeFiles.length})</span>
                </button>
            </div>

            {/* ── SubTab 1: 行李清單 ─────────────────────────────────────── */}
            {activeSubTab === 'packing' && (
                <div className="space-y-4">
                    {/* 進度與重量加總總覽 */}
                    <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex-1 w-full">
                            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                <span className="text-slate-700">打包進度 ({packingStats.packedCount}/{packingStats.totalCount})</span>
                                <span className="text-indigo-600 font-mono">{packingStats.progressPercent}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                                    style={{ width: `${packingStats.progressPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {showWeightRollup && (
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs shrink-0">
                                    <Scale className="w-4 h-4 text-indigo-600" />
                                    <div>
                                        <span className="text-slate-400 font-medium">行李預估重量:</span>
                                        <span className="font-bold font-mono text-slate-800 ml-1">
                                            {packingStats.packedWeightKg} kg / {packingStats.totalWeightKg} kg
                                        </span>
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={() => setShowWeightRollup(!showWeightRollup)}
                                title={showWeightRollup ? '隱藏重量統計' : '顯示重量統計'}
                                className={`p-2 rounded-xl border text-xs transition ${
                                    showWeightRollup ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-slate-400'
                                }`}
                            >
                                <Scale className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* 快速套用範本與分類篩選 */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            <button
                                onClick={() => setSelectedCategory('all')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                                    selectedCategory === 'all' ? 'bg-slate-900 text-white' : 'bg-white border text-slate-600'
                                }`}
                            >
                                全部
                            </button>
                            {PACKING_CATEGORIES.map(cat => (
                                <button
                                    key={cat.key}
                                    onClick={() => setSelectedCategory(cat.key)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1 ${
                                        selectedCategory === cat.key ? 'bg-indigo-600 text-white' : 'bg-white border text-slate-600'
                                    }`}
                                >
                                    <span>{cat.emoji}</span>
                                    <span>{cat.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* 範本選擇器 */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-bold hidden sm:inline">快速套用範本:</span>
                            {PACKING_TEMPLATES.map(tpl => (
                                <button
                                    key={tpl.id}
                                    onClick={() => handleApplyTemplate(tpl.id)}
                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition border border-indigo-100"
                                >
                                    {tpl.title}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 權限能見度篩選與標籤 */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-bold">能見度篩選:</span>
                        {[
                            { key: 'all', label: '所有項目' },
                            { key: 'travellers', label: '👥 僅同伴' },
                            { key: 'private', label: '🔒 私人' }
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => setSelectedVisibility(t.key)}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                                    selectedVisibility === t.key
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* 新增行李項目輸入行 */}
                    <form onSubmit={handleAddPackingItem} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-2">
                        <input
                            type="text"
                            placeholder="輸入行李物品名稱 (例如: 護照、行動電源、防曬乳)"
                            value={newPackingName}
                            onChange={(e) => setNewPackingName(e.target.value)}
                            className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <select
                            value={newPackingCategory}
                            onChange={(e) => setNewPackingCategory(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                        >
                            {PACKING_CATEGORIES.map(c => (
                                <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                            ))}
                        </select>
                        <select
                            value={newPackingVisibility}
                            onChange={(e) => setNewPackingVisibility(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                            title="能見度"
                        >
                            <option value="all">🌐 全員可見</option>
                            <option value="travellers">👥 旅伴可見</option>
                            <option value="private">🔒 僅自己可見</option>
                        </select>
                        <input
                            type="text"
                            placeholder="指派 (例: 我/全體)"
                            value={newPackingAssignee}
                            onChange={(e) => setNewPackingAssignee(e.target.value)}
                            className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                        />
                        <input
                            type="number"
                            placeholder="重量 (克)"
                            value={newPackingWeight}
                            onChange={(e) => setNewPackingWeight(e.target.value)}
                            className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>加入</span>
                        </button>
                    </form>

                    {/* 行李清單 */}
                    <div className="space-y-2">
                        {filteredPackingItems.length === 0 ? (
                            <div className="bg-white p-8 rounded-xl text-center text-slate-400 border border-gray-200">
                                尚未加入符合條件的行李物品，請點擊上方輸入加入或套用範本
                            </div>
                        ) : (
                            filteredPackingItems.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => handleTogglePacked(item)}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                        item.isPacked ? 'bg-slate-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-indigo-300 shadow-sm'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {item.isPacked ? (
                                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                                        ) : (
                                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                        )}
                                        <div>
                                            <span className={`text-xs font-semibold ${item.isPacked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                {item.itemName}
                                            </span>
                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                                <span>負責: {item.assignee || '全體'}</span>
                                                {item.visibilityTier === 'private' && (
                                                    <span className="text-amber-600 bg-amber-50 px-1 rounded">🔒 私人</span>
                                                )}
                                                {item.visibilityTier === 'travellers' && (
                                                    <span className="text-indigo-600 bg-indigo-50 px-1 rounded">👥 旅伴</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {item.weightGrams > 0 && (
                                            <span className="text-[11px] font-mono text-slate-400">
                                                {item.weightGrams}g
                                            </span>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeletePackingItem(item.id); }}
                                            className="p-1 text-slate-300 hover:text-red-600 rounded transition"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ── SubTab 2: 行前待辦 ─────────────────────────────────────── */}
            {activeSubTab === 'todos' && (
                <div className="space-y-4">
                    {/* 新增待辦輸入行 */}
                    <form onSubmit={handleAddTodo} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-2.5">
                        <input
                            type="text"
                            placeholder="輸入行前待辦任務 (例如: 辦理國際駕照、購買 eSIM、換日幣)"
                            value={newTodoTitle}
                            onChange={(e) => setNewTodoTitle(e.target.value)}
                            className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <select
                            value={newTodoPriority}
                            onChange={(e) => setNewTodoPriority(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                        >
                            <option value="low">低優先級</option>
                            <option value="medium">中優先級</option>
                            <option value="high">高優先級</option>
                            <option value="urgent">🔥 緊急</option>
                        </select>
                        <input
                            type="date"
                            value={newTodoDueDate}
                            onChange={(e) => setNewTodoDueDate(e.target.value)}
                            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <button
                            type="submit"
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>新增待辦</span>
                        </button>
                    </form>

                    {/* 待辦列表 */}
                    <div className="space-y-2">
                        {todos.length === 0 ? (
                            <div className="bg-white p-8 rounded-xl text-center text-slate-400 border border-gray-200">
                                尚無待辦事項，請新增出發前需完成的任務
                            </div>
                        ) : (
                            todos.map(todo => {
                                const isUrgent = todo.priority === 'urgent';
                                const isHigh = todo.priority === 'high';
                                const dueStatus = getTodoDueStatus(todo.dueDate);

                                return (
                                    <div
                                        key={todo.id}
                                        onClick={() => handleToggleTodo(todo)}
                                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                            todo.completed ? 'bg-slate-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-indigo-300 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {todo.completed ? (
                                                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                            )}
                                            <div>
                                                <span className={`text-xs font-bold ${todo.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                    {todo.title}
                                                </span>
                                                <div className="text-[10px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                                                    {todo.dueDate && (
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" /> 截止: {todo.dueDate}
                                                        </span>
                                                    )}
                                                    {dueStatus && !todo.completed && (
                                                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${dueStatus.className}`}>
                                                            {dueStatus.text}
                                                        </span>
                                                    )}
                                                    <span>負責: {todo.assignee}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                isUrgent ? 'bg-red-100 text-red-700' : isHigh ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {todo.priority.toUpperCase()}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteTodo(todo.id); }}
                                                className="p-1 text-slate-300 hover:text-red-600 rounded transition"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ── SubTab 3: 50MB/500MB 附件檔案與垃圾桶 ───────────────────── */}
            {activeSubTab === 'files' && (
                <div className="space-y-4">
                    {/* 上傳橫幅 */}
                    <div className="relative border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50/80 rounded-2xl p-6 text-center transition-all cursor-pointer">
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            disabled={uploadProgress !== null}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center pointer-events-none">
                            <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                                {uploadProgress !== null ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                            </div>
                            <p className="text-sm font-bold text-slate-800">
                                {uploadProgress !== null ? `正在上傳 Google Drive (${uploadProgress}%)...` : '上傳行程附件或旅遊紀錄影片'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                檔案上限 <strong>50MB</strong> · 影片上限 <strong>500MB</strong> · 分塊串流直傳個人 Google Drive
                            </p>
                        </div>
                    </div>

                    {/* 工具列：切換一般與垃圾桶 */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">
                            {showTrash ? `垃圾桶 (${trashedFiles.length})` : `所有檔案 (${activeFiles.length})`}
                        </span>
                        <button
                            onClick={() => setShowTrash(!showTrash)}
                            className="text-indigo-600 font-bold hover:underline"
                        >
                            {showTrash ? '返回檔案清單' : `查看垃圾桶 (${trashedFiles.length})`}
                        </button>
                    </div>

                    {/* 檔案卡片列表 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(showTrash ? trashedFiles : activeFiles).length === 0 ? (
                            <div className="col-span-2 bg-white p-8 rounded-xl text-center text-slate-400 border border-gray-200">
                                {showTrash ? '垃圾桶是空的' : '尚無附件檔案'}
                            </div>
                        ) : (
                            (showTrash ? trashedFiles : activeFiles).map(file => {
                                const isVideo = file.mimeType?.startsWith('video/');
                                const isImg = file.mimeType?.startsWith('image/');
                                const sizeMB = (file.fileSize / (1024 * 1024)).toFixed(1);

                                return (
                                    <div key={file.id} className="bg-white rounded-xl p-3.5 border border-gray-200 shadow-sm flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                                                {isVideo ? <Video className="w-5 h-5" /> : isImg ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                            </div>
                                            <div className="truncate flex-1">
                                                <div className="font-bold text-xs text-slate-800 truncate">{file.fileName}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                                    {sizeMB} MB · {file.gdriveFileId ? '☁️ 已同步 Google Drive' : '本地暫存'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {file.gdriveFileId && (
                                                <a
                                                    href={`https://drive.google.com/file/d/${file.gdriveFileId}/view`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="在 Google 雲端硬碟開啟"
                                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}
                                            {showTrash ? (
                                                <>
                                                    <button
                                                        onClick={() => handleRestoreFile(file.id)}
                                                        title="還原檔案"
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(file.id)}
                                                        title="永久刪除"
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleMoveToTrash(file.id)}
                                                    title="移至垃圾桶"
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
