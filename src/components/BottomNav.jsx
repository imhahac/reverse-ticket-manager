import React from 'react';
import PropTypes from 'prop-types';

export default function BottomNav({ TABS, activeTab, setActiveTab }) {
    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center px-2 py-2 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
            {TABS.map(tab => {
                const isActive = activeTab === tab.key;
                const [emoji, ...textParts] = tab.label.split(' ');
                const text = textParts.join(' ');
                
                return (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex flex-col items-center justify-center w-full py-1 ${
                            isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <span className={`text-xl mb-1 ${isActive ? 'scale-110' : 'grayscale opacity-70'} transition-transform`}>{emoji}</span>
                        <span className={`text-[10px] font-bold ${isActive ? 'font-black' : ''}`}>{text}</span>
                    </button>
                );
            })}
        </div>
    );
}

BottomNav.propTypes = {
    TABS: PropTypes.array.isRequired,
    activeTab: PropTypes.string.isRequired,
    setActiveTab: PropTypes.func.isRequired
};
