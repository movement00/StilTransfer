
import React, { useState } from 'react';
import { LayoutDashboard, Briefcase, Wand2, Grid, Layers, Zap, Compass, Key, Menu, X } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  onApiKeyClick?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onApiKeyClick }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
    { id: 'brands', label: 'Marka Profilleri', icon: Briefcase },
    { id: 'analyzer', label: 'Stil Stüdyosu', icon: Wand2 },
    { id: 'scout', label: 'İçerik Keşfet', icon: Compass },
    { id: 'pipeline', label: 'Otomasyon Pipeline', icon: Zap },
    { id: 'bulk', label: 'Toplu Üretim', icon: Layers },
    { id: 'library', label: 'Stil Kütüphanesi', icon: Grid },
  ];

  const handleNav = (id: string) => {
    setView(id as ViewState);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      <div className="p-6 lg:p-8 border-b border-lumina-800 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold bg-gradient-to-r from-white to-lumina-gold bg-clip-text text-transparent">
            Lumina.
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">AI Marka Suiti</p>
        </div>
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-slate-400 hover:text-white p-1"
        >
          <X size={24} />
        </button>
      </div>

      <nav className="flex-1 py-6 lg:py-8 px-3 lg:px-4 space-y-1 lg:space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
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

      <div className="p-4 border-t border-lumina-800 space-y-2">
        {onApiKeyClick && (
          <button
            onClick={() => { onApiKeyClick(); setMobileOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-lumina-900 hover:text-white transition-all group"
          >
            <Key size={16} className="text-slate-500 group-hover:text-lumina-gold" />
            <span className="text-sm">API Ayarları</span>
          </button>
        )}
        <div className="flex items-center gap-3 px-4 py-3">
           <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500"></div>
           <div>
             <p className="text-sm font-medium text-white">Pro Çalışma Alanı</p>
             <p className="text-xs text-slate-500">Bağlandı</p>
           </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-lumina-950 border-b border-lumina-800 flex items-center justify-between px-4 py-3">
        <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white p-1">
          <Menu size={24} />
        </button>
        <h1 className="font-serif text-lg font-bold bg-gradient-to-r from-white to-lumina-gold bg-clip-text text-transparent">
          Lumina.
        </h1>
        <div className="w-8" /> {/* Spacer for centering */}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-lumina-950 z-50 flex flex-col transform transition-transform duration-300 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 bg-lumina-950 border-r border-lumina-800 flex-col h-screen fixed left-0 top-0 z-20">
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
