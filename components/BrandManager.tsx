
import React, { useState } from 'react';
import { Brand, BrandColor, BrandAsset, BrandAssetCategory, BrandPricing } from '../types';
import { Plus, Trash2, Upload, Instagram, Phone, MapPin, Palette, X, Edit2, Check, QrCode, Smartphone, Tag, Globe, Star, Image, Package } from 'lucide-react';
import { resizeImageToRawBase64 } from '../services/geminiService';

const ASSET_CATEGORIES_MAP: Record<string, string> = {
  qr_code: 'QR', app_store_badge: 'iOS', play_store_badge: 'Android', app_icon: 'App',
  social_icon: 'Social', product_photo: 'Ürün', badge: 'Rozet', custom_icon: 'İkon',
  watermark: 'WM', pattern: 'Desen', other: 'Diğer',
};

interface BrandManagerProps {
  brands: Brand[];
  setBrands: React.Dispatch<React.SetStateAction<Brand[]>>;
}

const BrandManager: React.FC<BrandManagerProps> = ({ brands, setBrands }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newBrand, setNewBrand] = useState<Brand>({
    id: '',
    name: '',
    industry: '',
    description: '',
    logo: null,
    primaryColor: '#F8BE00',
    secondaryColor: '#201C1D',
    palette: [],
    tone: 'Profesyonel, Güvenilir, Premium',
    outputLanguage: 'tr' as const,
    instagram: '',
    phone: '',
    address: ''
  });

  // Temp state for adding a single color to the palette
  const [tempColorName, setTempColorName] = useState('');
  const [tempColorHex, setTempColorHex] = useState('#000000');

  // Asset Vault state
  const [tempAssetName, setTempAssetName] = useState('');
  const [tempAssetCategory, setTempAssetCategory] = useState<BrandAssetCategory>('qr_code');
  const [tempAssetDescription, setTempAssetDescription] = useState('');
  const [tempAssetUsageRule, setTempAssetUsageRule] = useState('');
  const [tempAssetImage, setTempAssetImage] = useState<string | null>(null);

  // Pricing state
  const [tempPricingName, setTempPricingName] = useState('');
  const [tempPricingPrice, setTempPricingPrice] = useState('');
  const [tempPricingFeatures, setTempPricingFeatures] = useState('');
  const [tempPricingHighlighted, setTempPricingHighlighted] = useState(false);

  // Slogan state
  const [tempSlogan, setTempSlogan] = useState('');

  const resetForm = () => {
    setNewBrand({
      id: '', name: '', industry: '', description: '', logo: null,
      primaryColor: '#F8BE00', secondaryColor: '#201C1D', palette: [],
      tone: 'Profesyonel',
      instagram: '', phone: '', address: '', website: '',
      assets: [], pricing: [], slogans: [],
      appStoreUrl: '', playStoreUrl: '',
    });
    setEditingId(null);
    setIsEditing(false);
    setTempAssetImage(null);
    setTempAssetName('');
    setTempAssetDescription('');
    setTempAssetUsageRule('');
  };

  const handleCreateNew = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleEdit = (brand: Brand) => {
    setNewBrand({ ...brand });
    setEditingId(brand.id);
    setIsEditing(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        // Resize image to max 500px to save local storage space
        const base64 = await resizeImageToRawBase64(e.target.files[0], 500);
        setNewBrand({ ...newBrand, logo: base64 });
      } catch (error) {
        console.error("Logo işleme hatası:", error);
        alert("Logo yüklenirken bir sorun oluştu. Lütfen tekrar deneyin.");
      }
    }
  };

  const addColorToPalette = () => {
    if (tempColorName && tempColorHex) {
      setNewBrand({
        ...newBrand,
        palette: [...(newBrand.palette || []), { name: tempColorName, hex: tempColorHex }]
      });
      setTempColorName('');
      setTempColorHex('#000000');
    }
  };

  const removeColorFromPalette = (index: number) => {
    const newPalette = [...(newBrand.palette || [])];
    newPalette.splice(index, 1);
    setNewBrand({ ...newBrand, palette: newPalette });
  };

  // Asset handlers
  const handleAssetImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await resizeImageToRawBase64(e.target.files[0], 400);
        setTempAssetImage(base64);
      } catch { alert('Görsel yüklenemedi.'); }
    }
  };

  const addAsset = () => {
    if (!tempAssetName || !tempAssetImage) return;
    const asset: BrandAsset = {
      id: `asset-${Date.now()}`,
      category: tempAssetCategory,
      name: tempAssetName,
      description: tempAssetDescription,
      imageBase64: tempAssetImage,
      usageRule: tempAssetUsageRule,
      createdAt: Date.now(),
    };
    setNewBrand({ ...newBrand, assets: [...(newBrand.assets || []), asset] });
    setTempAssetName(''); setTempAssetDescription(''); setTempAssetUsageRule(''); setTempAssetImage(null);
  };

  const removeAsset = (id: string) => {
    setNewBrand({ ...newBrand, assets: (newBrand.assets || []).filter(a => a.id !== id) });
  };

  const addPricing = () => {
    if (!tempPricingName || !tempPricingPrice) return;
    const plan: BrandPricing = {
      id: `plan-${Date.now()}`,
      name: tempPricingName,
      price: tempPricingPrice,
      features: tempPricingFeatures.split(',').map(f => f.trim()).filter(Boolean),
      highlighted: tempPricingHighlighted,
    };
    setNewBrand({ ...newBrand, pricing: [...(newBrand.pricing || []), plan] });
    setTempPricingName(''); setTempPricingPrice(''); setTempPricingFeatures(''); setTempPricingHighlighted(false);
  };

  const removePricing = (id: string) => {
    setNewBrand({ ...newBrand, pricing: (newBrand.pricing || []).filter(p => p.id !== id) });
  };

  const addSlogan = () => {
    if (!tempSlogan.trim()) return;
    setNewBrand({ ...newBrand, slogans: [...(newBrand.slogans || []), tempSlogan.trim()] });
    setTempSlogan('');
  };

  const removeSlogan = (index: number) => {
    const s = [...(newBrand.slogans || [])];
    s.splice(index, 1);
    setNewBrand({ ...newBrand, slogans: s });
  };

  const ASSET_CATEGORIES: { value: BrandAssetCategory; label: string; icon: string }[] = [
    { value: 'qr_code', label: 'QR Kod', icon: '📱' },
    { value: 'app_store_badge', label: 'App Store Badge', icon: '🍎' },
    { value: 'play_store_badge', label: 'Play Store Badge', icon: '▶️' },
    { value: 'app_icon', label: 'Uygulama İkonu', icon: '📲' },
    { value: 'social_icon', label: 'Sosyal Medya İkonu', icon: '💬' },
    { value: 'product_photo', label: 'Ürün Fotoğrafı', icon: '📦' },
    { value: 'badge', label: 'Güven Rozeti', icon: '🏅' },
    { value: 'custom_icon', label: 'Özel İkon', icon: '✨' },
    { value: 'watermark', label: 'Watermark', icon: '💧' },
    { value: 'pattern', label: 'Desen/Pattern', icon: '🎨' },
    { value: 'other', label: 'Diğer', icon: '📎' },
  ];

  const saveBrand = () => {
    if (!newBrand.name) return;

    if (editingId) {
      // Update existing
      setBrands(brands.map(b => b.id === editingId ? { ...newBrand, id: editingId } : b));
    } else {
      // Create new
      setBrands([...brands, { ...newBrand, id: Date.now().toString() }]);
    }
    
    resetForm();
  };

  const deleteBrand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click if any
    if (confirm("Bu markayı silmek istediğinize emin misiniz?")) {
      setBrands(brands.filter(b => b.id !== id));
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-serif text-white mb-2">Marka Profilleri</h2>
          <p className="text-slate-400">Kurumlarınız için kimlikleri ve kurumsal renk paletlerini yönetin.</p>
        </div>
        <button 
          onClick={handleCreateNew}
          className="bg-lumina-gold text-lumina-950 px-6 py-2 rounded-full font-semibold hover:bg-yellow-500 transition-colors flex items-center gap-2 shadow-lg shadow-yellow-500/20"
        >
          <Plus size={18} /> Yeni Marka Ekle
        </button>
      </div>

      {isEditing && (
        <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-6 mb-8 shadow-2xl relative animate-fade-in-up">
           <div className="absolute top-4 right-4">
             <button onClick={resetForm} className="text-slate-500 hover:text-white p-2">
               <X size={20} />
             </button>
           </div>
          <h3 className="text-xl font-medium text-white mb-6 flex items-center gap-2">
            {editingId ? <Edit2 size={20} className="text-lumina-gold" /> : <Plus size={20} className="text-lumina-gold" />}
            {editingId ? 'Profili Düzenle' : 'Yeni Profil Oluştur'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Identity & Palette */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-lumina-gold uppercase tracking-wider mb-2">Kimlik</h4>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Marka Adı</label>
                  <input 
                    type="text" 
                    value={newBrand.name}
                    onChange={e => setNewBrand({...newBrand, name: e.target.value})}
                    className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-3 text-white focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                    placeholder="Örn: Qoolline"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Sektör</label>
                  <input 
                    type="text" 
                    value={newBrand.industry}
                    onChange={e => setNewBrand({...newBrand, industry: e.target.value})}
                    className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-3 text-white focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                    placeholder="Örn: Eğitim Teknolojileri"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Marka Açıklaması</label>
                  <textarea 
                    value={newBrand.description || ''}
                    onChange={e => setNewBrand({...newBrand, description: e.target.value})}
                    className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-3 text-white focus:border-lumina-gold focus:outline-none placeholder-slate-600 resize-none h-20"
                    placeholder="Markanın ne yaptığını ve misyonunu kısaca anlatın..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Marka Tonu (Tone of Voice)</label>
                  <textarea 
                    value={newBrand.tone}
                    onChange={e => setNewBrand({...newBrand, tone: e.target.value})}
                    className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-3 text-white focus:border-lumina-gold focus:outline-none placeholder-slate-600 resize-none h-16"
                    placeholder="Örn: Yenilikçi, Enerjik, Modern, Samimi"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Çıktı Dili</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewBrand({...newBrand, outputLanguage: 'tr'})}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                        newBrand.outputLanguage !== 'en'
                          ? 'bg-lumina-gold/20 border-lumina-gold/50 text-lumina-gold'
                          : 'bg-lumina-950 border-lumina-800 text-slate-400 hover:border-lumina-700'
                      }`}
                    >
                      Türkçe
                    </button>
                    <button
                      onClick={() => setNewBrand({...newBrand, outputLanguage: 'en'})}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                        newBrand.outputLanguage === 'en'
                          ? 'bg-lumina-gold/20 border-lumina-gold/50 text-lumina-gold'
                          : 'bg-lumina-950 border-lumina-800 text-slate-400 hover:border-lumina-700'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Color Palette */}
              <div className="bg-lumina-950 border border-lumina-800 rounded-xl p-4">
                 <h4 className="text-sm font-bold text-lumina-gold uppercase tracking-wider mb-4 flex items-center gap-2">
                   <Palette size={16} /> Kurumsal Renk Paleti
                 </h4>
                 
                 {/* Palette Inputs */}
                 <div className="flex items-end gap-2 mb-4">
                   <div className="flex-1">
                     <label className="block text-xs text-slate-500 mb-1">Renk Adı</label>
                     <input 
                       type="text" 
                       value={tempColorName}
                       onChange={e => setTempColorName(e.target.value)}
                       className="w-full bg-lumina-900 border border-lumina-800 rounded px-2 py-2 text-sm text-white focus:border-lumina-gold outline-none"
                       placeholder="Örn: Brand Yellow"
                     />
                   </div>
                   <div>
                     <label className="block text-xs text-slate-500 mb-1">Kod</label>
                     <div className="flex items-center gap-2 bg-lumina-900 border border-lumina-800 rounded px-2 py-1.5 h-[38px]">
                        <input 
                          type="color" 
                          value={tempColorHex}
                          onChange={e => setTempColorHex(e.target.value)}
                          className="w-6 h-6 bg-transparent border-none cursor-pointer"
                        />
                        <span className="text-xs text-slate-400 font-mono hidden sm:block">{tempColorHex}</span>
                     </div>
                   </div>
                   <button 
                     onClick={addColorToPalette}
                     className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm transition-colors h-[38px] flex items-center"
                   >
                     <Plus size={16} />
                   </button>
                 </div>

                 {/* Palette List */}
                 <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {newBrand.palette && newBrand.palette.map((color, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-lumina-900/50 p-2 rounded border border-lumina-800/50 group">
                         <div className="flex items-center gap-3">
                           <div className="w-6 h-6 rounded-full border border-white/10 shadow-sm" style={{ backgroundColor: color.hex }}></div>
                           <div>
                             <p className="text-xs font-bold text-white">{color.name}</p>
                             <p className="text-[10px] text-slate-500 font-mono">{color.hex}</p>
                           </div>
                         </div>
                         <button onClick={() => removeColorFromPalette(idx)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                           <X size={14} />
                         </button>
                      </div>
                    ))}
                    {(!newBrand.palette || newBrand.palette.length === 0) && (
                      <p className="text-xs text-slate-600 italic text-center py-2">Henüz renk eklenmedi.</p>
                    )}
                 </div>
              </div>
            </div>

            {/* Right Column: Visuals & Contact */}
            <div className="space-y-6">
              
              {/* LOGO UPLOAD SECTION - IMPROVED */}
              <div className="bg-lumina-950 border border-lumina-800 rounded-xl p-4">
                 <h4 className="text-sm font-bold text-lumina-gold uppercase tracking-wider mb-4 flex items-center gap-2">
                   <Upload size={16} /> Marka Logosu
                 </h4>
                 
                 <div className="flex flex-col items-center gap-4">
                    <label className="w-full cursor-pointer group">
                      <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all h-40 flex flex-col items-center justify-center relative overflow-hidden ${newBrand.logo ? 'border-lumina-gold bg-lumina-900' : 'border-lumina-800 hover:border-slate-600 hover:bg-lumina-900/50'}`}>
                        <input 
                          type="file" 
                          onChange={handleLogoUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          accept="image/*"
                        />
                        
                        {newBrand.logo ? (
                          <>
                            <img src={`data:image/png;base64,${newBrand.logo}`} alt="Logo Preview" className="h-full w-full object-contain p-2" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-white text-xs font-bold flex items-center gap-2"><Edit2 size={14} /> Değiştir</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-lumina-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                               <Upload className="text-slate-400" size={20} />
                            </div>
                            <span className="text-slate-400 text-sm font-medium">Logo Yüklemek İçin Tıkla</span>
                            <span className="text-slate-600 text-xs mt-1">PNG (Şeffaf) önerilir (Otomatik Sıkıştırılır)</span>
                          </>
                        )}
                      </div>
                    </label>
                    
                    {newBrand.logo && (
                       <button 
                         onClick={() => setNewBrand({...newBrand, logo: null})}
                         className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                       >
                         <Trash2 size={12} /> Logoyu Kaldır
                       </button>
                    )}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Ana Renk (UI)</label>
                  <div className="flex items-center gap-2 bg-lumina-950 border border-lumina-800 rounded-lg p-2">
                    <input 
                      type="color" 
                      value={newBrand.primaryColor}
                      onChange={e => setNewBrand({...newBrand, primaryColor: e.target.value})}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                    />
                    <span className="text-slate-300 text-sm font-mono">{newBrand.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">İkincil Renk (UI)</label>
                  <div className="flex items-center gap-2 bg-lumina-950 border border-lumina-800 rounded-lg p-2">
                    <input 
                      type="color" 
                      value={newBrand.secondaryColor}
                      onChange={e => setNewBrand({...newBrand, secondaryColor: e.target.value})}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                    />
                    <span className="text-slate-300 text-sm font-mono">{newBrand.secondaryColor}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-lumina-800">
                <h4 className="text-sm font-bold text-lumina-gold uppercase tracking-wider">İletişim (Opsiyonel)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input 
                      type="text" 
                      value={newBrand.instagram || ''}
                      onChange={e => setNewBrand({...newBrand, instagram: e.target.value})}
                      className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-2 text-white text-sm focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                      placeholder="@instagram_adi"
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      value={newBrand.phone || ''}
                      onChange={e => setNewBrand({...newBrand, phone: e.target.value})}
                      className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-2 text-white text-sm focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                      placeholder="Tel No"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="text" 
                      value={newBrand.address || ''}
                      onChange={e => setNewBrand({...newBrand, address: e.target.value})}
                      className="w-full bg-lumina-950 border border-lumina-800 rounded-lg p-2 text-white text-sm focus:border-lumina-gold focus:outline-none placeholder-slate-600"
                      placeholder="Açık Adres"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ═══ ASSET VAULT ═══ */}
          <div className="mt-6 pt-6 border-t border-lumina-800">
            <h4 className="text-sm font-bold text-lumina-gold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Package size={16} /> Marka Varlık Kasası (Asset Vault)
            </h4>
            <p className="text-xs text-slate-500 mb-4">QR kod, app store ikonları, güven rozetleri gibi gerçek marka varlıklarını yükleyin. AI üretim sırasında hangisini kullanacağına otomatik karar verir.</p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Add Asset Form */}
              <div className="lg:col-span-1 bg-lumina-950 border border-lumina-800 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-white">Yeni Varlık Ekle</p>
                <select
                  value={tempAssetCategory}
                  onChange={e => setTempAssetCategory(e.target.value as BrandAssetCategory)}
                  className="w-full bg-lumina-900 border border-lumina-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                >
                  {ASSET_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                  ))}
                </select>
                <input
                  type="text" value={tempAssetName} onChange={e => setTempAssetName(e.target.value)}
                  className="w-full bg-lumina-900 border border-lumina-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                  placeholder="Varlık adı (QR Kod — Uygulama İndirme)"
                />
                <input
                  type="text" value={tempAssetDescription} onChange={e => setTempAssetDescription(e.target.value)}
                  className="w-full bg-lumina-900 border border-lumina-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                  placeholder="Açıklama (ne zaman kullanılmalı)"
                />
                <input
                  type="text" value={tempAssetUsageRule} onChange={e => setTempAssetUsageRule(e.target.value)}
                  className="w-full bg-lumina-900 border border-lumina-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                  placeholder="AI Kuralı (Use when topic mentions app download)"
                />
                <label className="block cursor-pointer">
                  <div className={`border-2 border-dashed rounded-lg p-3 text-center transition-all ${tempAssetImage ? 'border-lumina-gold bg-lumina-900' : 'border-lumina-800 hover:border-slate-600'}`}>
                    <input type="file" onChange={handleAssetImageUpload} className="hidden" accept="image/*" />
                    {tempAssetImage ? (
                      <img src={`data:image/png;base64,${tempAssetImage}`} alt="Preview" className="h-16 mx-auto object-contain" />
                    ) : (
                      <span className="text-xs text-slate-500">Görsel Yükle (PNG önerilir)</span>
                    )}
                  </div>
                </label>
                <button onClick={addAsset} disabled={!tempAssetName || !tempAssetImage}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-lumina-gold/20 text-lumina-gold border border-lumina-gold/30 hover:bg-lumina-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Plus size={12} className="inline mr-1" /> Varlık Ekle
                </button>
              </div>

              {/* Right: Asset List */}
              <div className="lg:col-span-2 space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {(newBrand.assets || []).map(asset => (
                  <div key={asset.id} className="flex items-center gap-3 bg-lumina-950 border border-lumina-800 rounded-lg p-2.5 group">
                    <img src={`data:image/png;base64,${asset.imageBase64}`} alt={asset.name} className="w-12 h-12 object-contain rounded bg-white/5 p-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{ASSET_CATEGORIES.find(c => c.value === asset.category)?.icon}</span>
                        <p className="text-xs font-bold text-white truncate">{asset.name}</p>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{asset.description || asset.usageRule}</p>
                    </div>
                    <button onClick={() => removeAsset(asset.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {(!newBrand.assets || newBrand.assets.length === 0) && (
                  <div className="text-center py-8 text-slate-600">
                    <Package size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Henüz varlık eklenmedi</p>
                    <p className="text-[10px] text-slate-700 mt-1">QR kod, App Store badge, ürün fotoğrafı vb.</p>
                  </div>
                )}
              </div>
            </div>

            {/* App Store URLs */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <input
                type="text" value={newBrand.appStoreUrl || ''} onChange={e => setNewBrand({...newBrand, appStoreUrl: e.target.value})}
                className="bg-lumina-950 border border-lumina-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                placeholder="App Store URL"
              />
              <input
                type="text" value={newBrand.playStoreUrl || ''} onChange={e => setNewBrand({...newBrand, playStoreUrl: e.target.value})}
                className="bg-lumina-950 border border-lumina-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                placeholder="Play Store URL"
              />
            </div>

            {/* Slogans */}
            <div className="mt-4">
              <p className="text-xs font-bold text-white mb-2">Sloganlar / Tagline'lar</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text" value={tempSlogan} onChange={e => setTempSlogan(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSlogan()}
                  className="flex-1 bg-lumina-950 border border-lumina-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                  placeholder="Slogan ekle (Enter ile)"
                />
                <button onClick={addSlogan} className="px-3 py-2 bg-lumina-800 text-white text-xs rounded-lg hover:bg-lumina-700"><Plus size={12} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(newBrand.slogans || []).map((s, i) => (
                  <span key={i} className="flex items-center gap-1 bg-lumina-950 border border-lumina-800 text-xs text-slate-300 px-2 py-1 rounded-full">
                    "{s}"
                    <button onClick={() => removeSlogan(i)} className="text-slate-600 hover:text-red-400"><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Pricing Plans */}
            <div className="mt-4">
              <p className="text-xs font-bold text-white mb-2">Fiyatlandırma Planları</p>
              <div className="flex gap-2 mb-2">
                <input type="text" value={tempPricingName} onChange={e => setTempPricingName(e.target.value)}
                  className="flex-1 bg-lumina-950 border border-lumina-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                  placeholder="Plan adı"
                />
                <input type="text" value={tempPricingPrice} onChange={e => setTempPricingPrice(e.target.value)}
                  className="w-24 bg-lumina-950 border border-lumina-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                  placeholder="$9.99/mo"
                />
                <input type="text" value={tempPricingFeatures} onChange={e => setTempPricingFeatures(e.target.value)}
                  className="flex-1 bg-lumina-950 border border-lumina-800 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50"
                  placeholder="Özellikler (virgülle ayır)"
                />
                <label className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer shrink-0">
                  <input type="checkbox" checked={tempPricingHighlighted} onChange={e => setTempPricingHighlighted(e.target.checked)} className="accent-lumina-gold" />
                  <Star size={12} />
                </label>
                <button onClick={addPricing} className="px-3 py-2 bg-lumina-800 text-white text-xs rounded-lg hover:bg-lumina-700"><Plus size={12} /></button>
              </div>
              <div className="space-y-1.5">
                {(newBrand.pricing || []).map(plan => (
                  <div key={plan.id} className={`flex items-center justify-between bg-lumina-950 border rounded-lg px-3 py-2 group ${plan.highlighted ? 'border-lumina-gold/50' : 'border-lumina-800'}`}>
                    <div className="flex items-center gap-3">
                      {plan.highlighted && <Star size={12} className="text-lumina-gold shrink-0" />}
                      <span className="text-xs font-bold text-white">{plan.name}</span>
                      <span className="text-xs text-lumina-gold font-mono">{plan.price}</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-48">{plan.features.join(' · ')}</span>
                    </div>
                    <button onClick={() => removePricing(plan.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-lumina-800">
            <button
              onClick={resetForm}
              className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={saveBrand}
              className="bg-lumina-gold text-lumina-950 px-8 py-2 rounded-lg font-bold hover:bg-yellow-500 flex items-center gap-2 shadow-lg shadow-yellow-500/20"
            >
              <Check size={18} /> {editingId ? 'Değişiklikleri Kaydet' : 'Profili Oluştur'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {brands.map(brand => (
          <div key={brand.id} className="bg-lumina-900 border border-lumina-800 rounded-xl p-6 hover:border-lumina-gold/50 transition-all group relative flex flex-col h-full">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-lumina-900/80 backdrop-blur p-1 rounded-lg border border-lumina-800">
               <button 
                 onClick={() => handleEdit(brand)} 
                 className="text-slate-400 hover:text-white p-1.5 hover:bg-lumina-800 rounded"
                 title="Düzenle"
               >
                 <Edit2 size={16} />
               </button>
               <button 
                 onClick={(e) => deleteBrand(brand.id, e)} 
                 className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-900/20 rounded"
                 title="Sil"
               >
                 <Trash2 size={16} />
               </button>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-slate-700 shrink-0">
                {brand.logo ? (
                  <img src={`data:image/png;base64,${brand.logo}`} alt={brand.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-2xl font-bold text-slate-800">{brand.name[0]}</span>
                )}
              </div>
              <div className="overflow-hidden">
                <h3 className="text-lg font-bold text-white truncate">{brand.name}</h3>
                <p className="text-sm text-slate-400 truncate">{brand.industry}</p>
              </div>
            </div>
            
            {brand.description && (
               <p className="text-xs text-slate-400 mb-4 leading-relaxed line-clamp-2 min-h-[2.5em]">
                 {brand.description}
               </p>
            )}
            
            <div className="space-y-2 mb-4 mt-auto">
              {brand.instagram && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Instagram size={14} className="text-lumina-gold" />
                  <span className="truncate">{brand.instagram}</span>
                </div>
              )}
              {brand.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone size={14} className="text-lumina-gold" />
                  <span className="truncate">{brand.phone}</span>
                </div>
              )}
              {brand.assets && brand.assets.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Package size={14} className="text-lumina-gold" />
                  <span>{brand.assets.length} varlık</span>
                  <span className="text-slate-600">({brand.assets.map(a => ASSET_CATEGORIES_MAP[a.category] || a.category).filter((v, i, arr) => arr.indexOf(v) === i).join(', ')})</span>
                </div>
              )}
              {brand.slogans && brand.slogans.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Tag size={14} className="text-lumina-gold" />
                  <span className="truncate italic">"{brand.slogans[0]}"</span>
                </div>
              )}
            </div>

            {/* Color Palette Display */}
            <div className="mt-4 pt-4 border-t border-lumina-800">
              {brand.palette && brand.palette.length > 0 ? (
                 <div>
                    <div className="flex flex-wrap gap-1.5">
                      {brand.palette.slice(0, 7).map((c, i) => (
                        <div key={i} className="group/color relative cursor-help">
                          <div className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: c.hex }}></div>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/color:block bg-black text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 border border-slate-700">
                            {c.name}
                          </div>
                        </div>
                      ))}
                      {brand.palette.length > 7 && (
                        <div className="w-5 h-5 rounded-full bg-lumina-800 border border-lumina-700 flex items-center justify-center text-[9px] text-slate-400">
                          +{brand.palette.length - 7}
                        </div>
                      )}
                    </div>
                 </div>
              ) : (
                 <div className="flex gap-2">
                   <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: brand.primaryColor }}></div>
                   <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: brand.secondaryColor }}></div>
                 </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrandManager;
