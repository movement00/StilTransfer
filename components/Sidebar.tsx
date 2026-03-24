
import React from 'react';
import { LayoutDashboard, Briefcase, Wand2, Grid, Layers, Zap } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'brands', label: 'Marka Profilleri', icon: Briefcase },
    { id: 'analyzer', label: 'Stil Stüdyosu', icon: Wand2 },
    { id: 'pipeline', label: 'Otomasyon Pipeline', icon: Zap },
    { id: 'bulk', label: 'Toplu Üretim', icon: Layers },
    { id: 'library', label: 'Stil Kütüphanesi', icon: Grid },
  ];

  return (
    <div className="w-64 bg-lumina-950 border-r border-lumina-800 flex flex-col h-screen fixed left-0 top-0 z-20">
      <div className="p-8 border-b border-lumina-800">
        <h1 className="font-serif text-2xl font-bold bg-gradient-to-r from-white to-lumina-gold bg-clip-text text-transparent">
          Lumina.
        </h1>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">AI Marka Suiti</p>
      </div>

      <nav className="flex-1 py-8 px-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewState)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-lumina-gold/10 text-lumina-gold' 
                  : 'text-slate-400 hover:bg-lumina-900 hover:text-white'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-lumina-gold' : 'text-slate-500 group-hover:text-white'} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-lumina-800">
        <div className="flex items-center gap-3 px-4 py-3">
           <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500"></div>
           <div>
             <p className="text-sm font-medium text-white">Pro Çalışma Alanı</p>
             <p className="text-xs text-slate-500">Bağlandı</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
