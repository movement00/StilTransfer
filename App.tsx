
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import BrandManager from './components/BrandManager';
import StyleAnalyzer from './components/StyleAnalyzer';
import StyleLibrary from './components/StyleLibrary';
import BulkGenerator from './components/BulkGenerator';
import PipelineDashboard from './components/PipelineDashboard';
import ContentScout from './components/ContentScout';
import { ViewState, Brand, SavedTemplate, GeneratedAsset, TemplateFolder } from './types';
import { hasApiKey, setApiKey, getApiKey } from './services/geminiService';

// Initial Mock Data (Translated)
const INITIAL_BRANDS: Brand[] = [
  {
    id: '1',
    name: 'Qoolline',
    industry: 'Telekomünikasyon & E-SIM',
    description: 'Qoolline, dünyayı birbirine bağlayan, seyahatseverler ve global işletmeler için kesintisiz, uygun fiyatlı ve anında aktif olan yeni nesil dijital e-SIM çözümleri sunar.',
    logo: null,
    primaryColor: '#F8BE00',
    secondaryColor: '#201C1D',
    tone: 'Yenilikçi, Global, Teknolojik, Hızlı, Kullanıcı Dostu',
    palette: [
      { name: 'Brand Yellow', hex: '#F8BE00' },
      { name: 'Brand Black', hex: '#201C1D' },
      { name: 'Tech Blue', hex: '#6B63FF' },
      { name: 'Subtext Grey', hex: '#737485' },
      { name: 'Brand Yellow %10', hex: '#FFFAEA' },
      { name: 'Brand Yellow %8', hex: '#FEF5D7' },
      { name: 'Tech Blue Tint', hex: '#E9E8FF' }
    ]
  },
  {
    id: '3',
    name: 'Düzce Kültür Koleji',
    industry: 'Eğitim (K12)',
    description: 'Modern eğitim anlayışı, akademik disiplin ve öğrenci enerjisini birleştiren köklü eğitim kurumu.',
    logo: null,
    primaryColor: '#E6007E',
    secondaryColor: '#1CB6C9',
    tone: 'Enerjik, Güvenilir, Akademik, Modern, Öğrenci Odaklı',
    palette: [
      { name: 'Canlı Pembe (Ana Marka)', hex: '#E6007E' },
      { name: 'Turkuaz (Eğitim & Güven)', hex: '#1CB6C9' },
      { name: 'Canlı Sarı (Okul Enerjisi)', hex: '#FFD400' },
      { name: 'Lacivert (Kurumsal)', hex: '#0F2A44' },
      { name: 'Beyaz (Temel Zemin)', hex: '#FFFFFF' },
      { name: 'Açık Gri (Arka Plan)', hex: '#F2F4F7' }
    ]
  },
  {
    id: '7',
    name: 'Düzce Kültür Anaokulu',
    industry: 'Okul Öncesi Eğitim & Çocuk Gelişimi',
    description: 'Düzce Kültür Anaokulu, "Mutlu Çocuk, Başarılı Gelecek" mottosuyla; çocukların doğuştan gelen merak duygusunu oyun temelli öğrenme ile birleştiren, duygusal zeka ve yaşam becerilerini geliştirmeye odaklanan sevgi dolu bir eğitim yuvasıdır. Çocukları sadece okula değil, hayata hazırlayan, özgüvenli ve yaratıcı bireyler yetiştirmeyi hedefler.',
    logo: null,
    primaryColor: '#E6007E',
    secondaryColor: '#1CB6C9',
    tone: 'Sevecen, Eğlenceli, Yaratıcı, Merak Uyandıran, Güvenli, Geliştirici',
    palette: [
      { name: 'Güneş Sarısı (Baskın - Neşe)', hex: '#FFD400' },
      { name: 'Kültür Pembesi (Ana)', hex: '#E6007E' },
      { name: 'Kültür Turkuazı (İkincil)', hex: '#1CB6C9' },
      { name: 'Fıstık Yeşili (Büyüme & Doğa)', hex: '#8BC34A' },
      { name: 'Gök Mavisi (Huzur)', hex: '#4FC3F7' },
      { name: 'Sıcak Turuncu (Enerji)', hex: '#FF9800' },
      { name: 'Krem (Yumuşak Zemin)', hex: '#FFFDE7' }
    ]
  },
  {
    id: '4',
    name: 'Düzce Kültür Kurs',
    industry: 'Sınava Hazırlık Merkezi',
    description: 'Üniversite sınavlarına hazırlanan lise ve mezun öğrencilere yönelik; disiplinli, hedef odaklı ve akademik başarıyı garantileyen profesyonel öğretim merkezi.',
    logo: null,
    primaryColor: '#E6007E',
    secondaryColor: '#1CB6C9',
    tone: 'Motivasyon Dolu, Disiplinli, Hedef Odaklı, Dinamik, Başarı',
    palette: [
      { name: 'Canlı Pembe (Vurgu & Enerji)', hex: '#E6007E' },
      { name: 'Turkuaz (Odak & Başarı)', hex: '#1CB6C9' },
      { name: 'Lacivert (Akademik Ciddiyet)', hex: '#0F2A44' },
      { name: 'Canlı Sarı (Motivasyon)', hex: '#FFD400' },
      { name: 'Beyaz (Netlik)', hex: '#FFFFFF' },
      { name: 'Gri (Zemin)', hex: '#F2F4F7' }
    ]
  },
  {
    id: '5',
    name: 'Düzce Teknokent Koleji',
    industry: 'Özel Lise / Teknik & Anadolu',
    description: 'Düzce Teknokent Koleji, yalnızca lise düzeyinde eğitim veren; teknik ve Anadolu lisesi müfredatını birlikte uygulayan, devlet destekli özel okul modeliyle akademik ve mesleki eğitimi bir araya getiren yenilikçi bir eğitim kurumudur. Teknoloji odaklı yaklaşımı ve güçlü akademik yapısıyla öğrencilerini üniversiteye ve geleceğin mesleklerine hazırlar.',
    logo: null,
    primaryColor: '#F26A1B',
    secondaryColor: '#0B1C2D',
    tone: 'Yenilikçi, Teknolojik, Disiplinli, Üretken, Akademik',
    palette: [
      { name: 'Teknokent Turuncu (Enerji & Teknoloji)', hex: '#F26A1B' },
      { name: 'Kurumsal Lacivert (Güven & Ciddiyet)', hex: '#0B1C2D' },
      { name: 'Siyah (Netlik)', hex: '#000000' },
      { name: 'Beyaz (Denge)', hex: '#FFFFFF' }
    ]
  },
  {
    id: '6',
    name: 'Happy Scarfs',
    industry: 'Tesettür Giyim & Eşarp',
    description: 'Happy Scarfs, modern tesettür modasında zarafeti ve konforu buluşturan; ipek, pamuk ve keten gibi doğal dokularla tasarlanmış geniş eşarp ve şal koleksiyonları sunan öncü bir markadır. Her mevsime uygun renkleri ve desenleriyle şıklığınızı tamamlar.',
    logo: null,
    primaryColor: '#D48C94',
    secondaryColor: '#8D7B68',
    tone: 'Zarif, Modern, Doğal, Sofistike, Yumuşak, Feminen',
    palette: [
      { name: 'Dusty Rose (Zarafet)', hex: '#D48C94' },
      { name: 'Warm Taupe (Doğallık)', hex: '#8D7B68' },
      { name: 'Soft Cream (Zemin)', hex: '#F9F4EF' },
      { name: 'Deep Burgundy (Kontrast)', hex: '#592E38' },
      { name: 'Antique Gold (Lüks Detay)', hex: '#C5A059' }
    ]
  },
  {
    id: '2',
    name: 'Aura Living',
    industry: 'İç Mimarlık',
    description: 'Aura Living, minimalist ve sürdürülebilir yaşam alanları tasarlayan butik bir iç mimarlık stüdyosudur.',
    logo: null,
    primaryColor: '#e2e8f0',
    secondaryColor: '#94a3b8',
    tone: 'Minimalist, Sakin, Modern',
    palette: [
      { name: 'Slate 200', hex: '#e2e8f0' },
      { name: 'Slate 400', hex: '#94a3b8' }
    ]
  }
];

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('analyzer');
  const [showApiKeyModal, setShowApiKeyModal] = useState(!hasApiKey());
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());

  // Safe Storage Loader
  const loadFromStorage = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      console.error(`Error loading ${key}`, e);
      return fallback;
    }
  };

  // Initialize state with Intelligent Merge
  const [brands, setBrands] = useState<Brand[]>(() => {
    const stored = loadFromStorage<Brand[]>('lumina_brands', []);
    if (stored.length === 0) return INITIAL_BRANDS;

    const initialMap = new Map(INITIAL_BRANDS.map(b => [b.id, b]));
    
    // Merge Code Updates with Stored User Data (e.g. Logo)
    const merged = INITIAL_BRANDS.map(initBrand => {
       const storedBrand = stored.find(b => b.id === initBrand.id);
       if (storedBrand) {
          // If stored brand exists, use Code's text fields (to ensure updates apply)
          // BUT preserve the stored LOGO if user uploaded one.
          return {
             ...initBrand,
             logo: storedBrand.logo || initBrand.logo,
             // You can also preserve other fields if user editing is priority, 
             // but for this request, we prioritize code updates for text fields.
          };
       }
       return initBrand;
    });

    // Add purely user-created brands
    const userCreated = stored.filter(b => !initialMap.has(b.id));
    
    return [...merged, ...userCreated];
  });

  const [templates, setTemplates] = useState<SavedTemplate[]>(() => loadFromStorage('lumina_templates', []));
  const [folders, setFolders] = useState<TemplateFolder[]>(() => loadFromStorage('lumina_folders', []));
  const [history, setHistory] = useState<GeneratedAsset[]>(() => loadFromStorage('lumina_history', []));

  // State to pass selected template to Analyzer
  const [templateToLoad, setTemplateToLoad] = useState<SavedTemplate | null>(null);

  // Safe Storage Saver
  const saveToStorage = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.error("Storage limit reached.");
        alert("Depolama alanı doldu! Çok fazla büyük görsel yüklemiş olabilirsiniz. Bazı eski verileri temizlemeniz gerekebilir.");
      } else {
        console.error("Local storage error:", e);
      }
    }
  };

  // Persistence Effects
  useEffect(() => { saveToStorage('lumina_brands', brands); }, [brands]);
  useEffect(() => { saveToStorage('lumina_templates', templates); }, [templates]);
  useEffect(() => { saveToStorage('lumina_folders', folders); }, [folders]);
  useEffect(() => { saveToStorage('lumina_history', history); }, [history]);

  const addToHistory = (asset: GeneratedAsset) => {
    setHistory(prev => {
      const newHistory = [asset, ...prev].slice(0, 10);
      return newHistory;
    });
  };

  const handleSelectTemplate = (template: SavedTemplate) => {
    setTemplateToLoad(template);
    setCurrentView('analyzer');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <div className="p-4 lg:p-8">
            <h2 className="text-2xl lg:text-3xl font-serif text-white mb-6">Panel</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 mb-8">
               <div className="bg-lumina-900 border border-lumina-800 p-6 rounded-xl">
                  <h3 className="text-slate-400 text-sm uppercase tracking-wider">Yönetilen Markalar</h3>
                  <p className="text-4xl text-white font-serif mt-2">{brands.length}</p>
               </div>
               <div className="bg-lumina-900 border border-lumina-800 p-6 rounded-xl">
                  <h3 className="text-slate-400 text-sm uppercase tracking-wider">Kaydedilen Stiller</h3>
                  <p className="text-4xl text-lumina-gold font-serif mt-2">{templates.length}</p>
               </div>
               <div className="bg-lumina-900 border border-lumina-800 p-6 rounded-xl">
                  <h3 className="text-slate-400 text-sm uppercase tracking-wider">Oluşturulan Görseller</h3>
                  <p className="text-4xl text-white font-serif mt-2">{history.length}</p>
               </div>
            </div>
            <h3 className="text-xl text-white mb-4">Son Üretimler (Son 10)</h3>
            {history.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {history.slice(0, 4).map(h => (
                  <div key={h.id} className="aspect-square rounded-lg overflow-hidden border border-lumina-800 group relative">
                    <img src={`data:image/png;base64,${h.url}`} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <a href={`data:image/png;base64,${h.url}`} download="lumina-asset.png" className="text-white text-xs bg-lumina-accent px-2 py-1 rounded">İndir</a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">Henüz görsel oluşturulmadı.</p>
            )}
          </div>
        );
      case 'brands':
        return <BrandManager brands={brands} setBrands={setBrands} />;
      case 'analyzer':
        return (
          <StyleAnalyzer 
            brands={brands} 
            templates={templates} 
            folders={folders}
            setTemplates={setTemplates} 
            addToHistory={addToHistory}
            initialTemplate={templateToLoad}
            clearInitialTemplate={() => setTemplateToLoad(null)}
          />
        );
      case 'pipeline':
        return (
          <PipelineDashboard
            brands={brands}
            templates={templates}
            folders={folders}
            setTemplates={setTemplates}
            addToHistory={addToHistory}
          />
        );
      case 'scout':
        return <ContentScout brands={brands} addToHistory={addToHistory} />;
      case 'bulk':
        return <BulkGenerator brands={brands} addToHistory={addToHistory} />;
      case 'library':
        return (
          <StyleLibrary 
            templates={templates} 
            setTemplates={setTemplates} 
            folders={folders}
            setFolders={setFolders}
            onSelectTemplate={handleSelectTemplate}
          />
        );
      default:
        return <div>Henüz uygulanmadı</div>;
    }
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      setShowApiKeyModal(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-lumina-950 text-slate-200 selection:bg-lumina-gold selection:text-black">
      <Sidebar currentView={currentView} setView={setCurrentView} onApiKeyClick={() => { setApiKeyInput(getApiKey()); setShowApiKeyModal(true); }} />
      <main className="w-full pt-14 lg:pt-0 lg:ml-64 h-screen overflow-y-auto">
        {renderContent()}
      </main>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-lumina-900 border border-lumina-800 rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-xl font-serif text-white mb-2">Gemini API Anahtarı</h2>
            <p className="text-sm text-slate-400 mb-6">
              Görsel üretimi ve stil analizi için Google Gemini API anahtarınızı girin.
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-indigo-400 ml-1 hover:underline">Buradan alabilirsiniz.</a>
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()}
              placeholder="AIzaSy..."
              className="w-full bg-lumina-950 border border-lumina-800 rounded-lg px-4 py-3 text-sm text-white mb-4 focus:outline-none focus:border-lumina-gold/50"
              autoFocus
            />
            <div className="flex gap-3">
              {hasApiKey() && (
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 border border-lumina-800 hover:bg-lumina-800 transition-all"
                >
                  İptal
                </button>
              )}
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-lumina-gold to-amber-500 text-black hover:from-amber-500 hover:to-lumina-gold transition-all disabled:opacity-40"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
