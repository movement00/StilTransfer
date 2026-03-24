
import { GoogleGenAI, Type } from "@google/genai";
import { Brand, StyleAnalysis } from "../types";

// ═══ API Key Management ═══
const API_KEY_STORAGE = 'lumina_gemini_api_key';

export function getApiKey(): string {
  // 1. Build-time env (Vercel / AI Studio)
  const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  if (envKey) return envKey;
  // 2. User-provided (localStorage)
  try { return localStorage.getItem(API_KEY_STORAGE) || ''; } catch { return ''; }
}

export function setApiKey(key: string) {
  try { localStorage.setItem(API_KEY_STORAGE, key); } catch {}
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

function getAI(): GoogleGenAI {
  const key = getApiKey();
  if (!key) throw new Error('API_KEY_MISSING');
  return new GoogleGenAI({ apiKey: key });
}

// Helper to convert file to base64 for API
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to resize image for storage optimization (Max 500px)
export const resizeImageToRawBase64 = (file: File, maxWidth: number = 500): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
             height = Math.round((height * maxWidth) / width);
             width = maxWidth;
          } else {
             width = Math.round((width * maxWidth) / height);
             height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
           reject(new Error("Canvas context not available"));
           return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Get data url
        const dataUrl = canvas.toDataURL('image/png');
        // Return raw base64 (remove prefix)
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      if (e.target && typeof e.target.result === 'string') {
          img.src = e.target.result;
      }
    };
    reader.readAsDataURL(file);
  });
};

// 1. Analyze Style (Gemini 3 Pro)
export const analyzeImageStyle = async (imageBase64: string): Promise<StyleAnalysis> => {
  const ai = getAI();
  
  const prompt = `
    Sen ödüllü bir sanat yönetmenisin ve teknik görsel analistisin. Bu görseli REPLİKA üretimi için analiz et.
    
    ÇOK ÖNEMLİ DETAY: Görseldeki sadece ana objeye odaklanma. Arka plandaki "görünmez" gibi duran detayları yakalamalısın.
    Şunlara özellikle dikkat et ve raporda belirt:
    1. ARKA PLAN GRADYANLARI: Düz renk gibi görünse bile çok hafif ton geçişleri var mı?
    2. ŞEFFAF İKONLAR/DESENLER: Arka planda opacity (saydamlık) değeri düşürülmüş geometrik şekiller, ikonlar, logolar veya watermark benzeri desenler var mı?
    3. FLU ŞEKİLLER: Arka planda bokeh efekti veya blur verilmiş renkli ışık hüzmeleri var mı?

    Aşağıdaki JSON formatında teknik bir analiz çıkar.
    
    Analiz Kriterleri:
    - composition: Görselin yerleşimi, ızgara yapısı.
    - lighting: Işık kaynağı, gölgeler.
    - colorPaletteDescription: Renk atmosferi.
    - mood: Duygu.
    - textureDetails: Materyal detayları.
    - cameraAngle: Kamera açısı.
    - artisticStyle: Sanatsal akım.
    - backgroundDetails: (KRİTİK) Arka plandaki şeffaf öğeler, gradyanlar, desenler, dokular ve flu şekillerin detaylı tarifi.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          composition: { type: Type.STRING },
          lighting: { type: Type.STRING },
          colorPaletteDescription: { type: Type.STRING },
          mood: { type: Type.STRING },
          textureDetails: { type: Type.STRING },
          cameraAngle: { type: Type.STRING },
          artisticStyle: { type: Type.STRING },
          backgroundDetails: { type: Type.STRING },
        },
        required: ['composition', 'lighting', 'colorPaletteDescription', 'mood', 'textureDetails', 'cameraAngle', 'artisticStyle', 'backgroundDetails']
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Analiz yapılamadı.");
  return JSON.parse(text) as StyleAnalysis;
};

// 1.5 Smart Matching Logic
export const matchTopicsToStyles = async (
  topics: string[], 
  analyzedStyles: { id: string, analysis: StyleAnalysis }[]
): Promise<{ topicIndex: number, styleId: string }[]> => {
  const ai = getAI();

  // Create a summary of available styles for the prompt
  const styleDescriptions = analyzedStyles.map((s, index) => {
    return `Style ID: ${s.id} -> Mood: ${s.analysis.mood}, Composition: ${s.analysis.composition}, Style: ${s.analysis.artisticStyle}`;
  }).join('\n');

  const topicList = topics.map((t, i) => `Topic Index ${i}: "${t}"`).join('\n');

  const prompt = `
    GÖREV: Elimde bir dizi içerik konusu (Topics) ve bir dizi görsel stil analizi (Styles) var.
    Her konu için en uygun görsel stilini eşleştirmen gerekiyor.

    KURALLAR:
    1. Her 'Topic Index' için mutlaka bir 'Style ID' seçmelisin.
    2. Konunun duygusuna ve bağlamına en uygun stili seç.
    3. Eğer konu sayısı stil sayısından fazlaysa, stilleri tekrar kullanabilirsin.
    4. Sadece JSON formatında cevap ver.

    TOPICS:
    ${topicList}

    AVAILABLE STYLES:
    ${styleDescriptions}
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', // Faster model is enough for matching logic
    contents: { text: prompt },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            topicIndex: { type: Type.INTEGER },
            styleId: { type: Type.STRING }
          },
          required: ['topicIndex', 'styleId']
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Eşleştirme yapılamadı.");
  return JSON.parse(text);
};


// 2. Generate Image (Nano Banana Pro / Gemini 3 Pro Image)
export const generateBrandedImage = async (
  brand: Brand,
  style: StyleAnalysis,
  referenceImageBase64: string | null,
  productImageBase64: string | null,
  contextDescription: string,
  aspectRatio: string = "1:1"
): Promise<string> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
           throw new Error("API_KEY_MISSING");
      }
  }

  const ai = getAI();

  // Construct color palette string from the enhanced brand profile
  let colorInstruction = "";
  if (brand.palette && brand.palette.length > 0) {
    colorInstruction = `
      KESİN RENK KURALLARI (BU KODLARI KULLAN):
      ${brand.palette.map(c => `- ${c.name}: ${c.hex}`).join('\n')}
      
      Yalnızca ve yalnızca yukarıdaki marka renk paletini kullan. Başka renkler ekleme.
    `;
  } else {
    colorInstruction = `RENKLER: ${brand.primaryColor}, ${brand.secondaryColor}`;
  }

  // --- INDUSTRY & FORMAT SPECIFIC RULES ---
  const isEducation = brand.industry.toLowerCase().includes('eğitim') || 
                      brand.industry.toLowerCase().includes('okul') || 
                      brand.industry.toLowerCase().includes('kolej') ||
                      brand.industry.toLowerCase().includes('kurs');
  
  const isStory = aspectRatio === "9:16";

  let ctaInstruction = "Eğer metin veya buton gerekiyorsa, estetik ve minimalist bir şekilde yerleştir.";
  
  if (isEducation && isStory) {
    ctaInstruction = `
      KRİTİK HİKAYE (STORY) KURALI: 
      Bu bir sosyal medya hikayesi olduğu için ASLA 'Kaydır', 'Tıkla', 'Keşfet', 'Web Sitesine Git' gibi web yönlendirme (link) CTA butonları KULLANMA.
      Bunun yerine, sadece SINAV ve BAŞARI ODAKLI MOTİVASYON butonları veya etiketleri kullan.
      
      Kullanılabilecek Örnek İfadeler:
      - "Başarabilirsin"
      - "Hedefine Odaklan"
      - "Asla Pes Etme"
      - "Gelecek Senin"
      - "Zamanı İyi Kullan"
    `;
  }

  // Sophisticated prompt instructing to ADAPT the subject matter based on industry
  const finalPrompt = `
    GÖREV: Yaratıcı bir Sanat Yönetmeni olarak hareket et. Referans görselin kompozisyonunu ve stilini al, ancak RENKLERİ ve KONUYU markanın kimliğine uyarla.

    HEDEF MARKA KİMLİĞİ:
    İsim: ${brand.name}
    Sektör: ${brand.industry}
    ${brand.description ? `Marka Açıklaması: ${brand.description}` : ''}
    Ton: ${brand.tone}
    
    ${colorInstruction}
    
    İSTENEN İÇERİK BAĞLAMI: ${contextDescription}

    REFERANS GÖRSEL ANALİZİ (Sadece Kompozisyon ve Tarz için kullan):
    Stil: ${style.artisticStyle}
    Kompozisyon: ${style.composition}
    Işık: ${style.lighting}
    Arka Plan Yapısı: ${style.backgroundDetails}
    
    *** KRİTİK ADAPTASYON TALİMATLARI ***:
    1. KONUYU DÖNÜŞTÜR: Referans görseldeki ana karakteri veya nesneyi, doğrudan kopyalamak yerine, MARKANIN SEKTÖRÜNE (${brand.industry}) uygun hale getir.
       - ÖRNEK: Eğer referans görselde "Pelerinli bir çocuk süper kahraman" varsa ve Marka "E-Sim / Teknoloji" sektöründeyse; karakteri koru ama eline kılıç yerine akıllı telefon ver, pelerinini dijital bir veri akışına dönüştür veya kostümünü fütüristik teknolojiyle güncelle.
       
    2. RENK DEVRİMİ (ÖNEMLİ): 
       - Referans görselin renklerini KULLANMA. 
       - Arka plan rengini ve genel renk atmosferini YUKARIDAKİ MARKA RENK PALETİNE göre değiştir.
       - Eğer analizde belirli bir renk (örn: "mavi arka plan") belirtilmişse bile bunu marka rengiyle (örn: "turuncu arka plan") değiştir.
       
    3. STİLİ KORU: Işıklandırma, gölgelendirme, kamera açısı ve çizim tekniği referans görselle aynı kalmalı.

    4. LOGO VE METİN: 
    ${brand.logo ? 'Referans görseldeki en uygun boş alana veya logonun olduğu yere EKLENECEK MARKA LOGOSU\'nu net bir şekilde yerleştir.' : 'Marka ismini estetik bir şekilde tasarıma yedir.'}

    5. CTA VE BUTONLAR:
    ${ctaInstruction}

    6. KALİTE: Fotoğraf gerçekçiliğinde (photorealistic) veya referansın stilinde, 4K kalite.
  `;

  // Construct parts array properly handling multiple images
  const parts: any[] = [];
  
  // 1. Reference Image
  if (referenceImageBase64) {
    parts.push({ text: "REFERANS GÖRSEL (Stil, ışık ve kompozisyon kaynağı):" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: referenceImageBase64
      }
    });
  }

  // 2. Product Image
  if (productImageBase64) {
    parts.push({ text: "EKLENECEK ÜRÜN GÖRSELİ (Bunu sahneye, sektörel bağlama uygun şekilde yerleştir):" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: productImageBase64
      }
    });
  }

  // 3. Brand Logo
  if (brand.logo) {
    parts.push({ text: "EKLENECEK MARKA LOGOSU (Tasarımda net ve okunabilir şekilde kullan):" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: brand.logo
      }
    });
  }

  parts.push({ text: finalPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: "2K"
      }
    }
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) throw new Error("Görsel oluşturulamadı.");
  
  const contentParts = candidates[0].content.parts;
  const imagePart = contentParts.find(p => p.inlineData);

  if (!imagePart || !imagePart.inlineData) {
     throw new Error("Yanıtta görsel verisi bulunamadı.");
  }

  return imagePart.inlineData.data;
};


// 3. Revise Generated Image
export const reviseGeneratedImage = async (
  originalImageBase64: string,
  revisionPrompt: string,
  revisionImageBase64: string | null
): Promise<string> => {
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
           throw new Error("API_KEY_MISSING");
      }
  }

  const ai = getAI();

  const prompt = `
    GÖREV: Bu görseli aşağıdaki talimatlara göre REVIZE ET (DÜZENLE).
    
    REVİZE TALİMATI: ${revisionPrompt}
    
    KURALLAR:
    1. Görselin orijinal stilini, kompozisyonunu ve kalitesini KORU. Sadece talimat verilen kısımları değiştir.
    2. Eğer ek bir referans görsel verildiyse, o görseldeki ilgili nesneyi veya stili bu görsele entegre et.
    3. Sonuç yine yüksek kaliteli ve fotogerçekçi olmalıdır.
  `;

  const parts: any[] = [];

  // Original Generated Image (Source)
  parts.push({ text: "DÜZENLENECEK GÖRSEL:" });
  parts.push({
    inlineData: {
      mimeType: 'image/png',
      data: originalImageBase64
    }
  });

  // Optional Revision Reference Image (e.g., "Add this icon")
  if (revisionImageBase64) {
    parts.push({ text: "EKLENECEK/REFERANS ALINACAK NESNE:" });
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: revisionImageBase64
      }
    });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts },
    config: {
      imageConfig: {
        imageSize: "2K"
        // Preserve aspect ratio is usually implicit in image-to-image but we let model decide based on input
      }
    }
  });

  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) throw new Error("Revize işlemi başarısız.");

  const contentParts = candidates[0].content.parts;
  const imagePart = contentParts.find(p => p.inlineData);

  if (!imagePart || !imagePart.inlineData) {
     throw new Error("Yanıtta görsel verisi bulunamadı.");
  }

  return imagePart.inlineData.data;
};

// ══════════════════════════════════════════════════
// 5. Smart Scout: Generate search queries for brand
// ══════════════════════════════════════════════════
export const generateSmartSearchQueries = async (brand: Brand): Promise<string[]> => {
  const ai = getAI();

  const prompt = `
    Sen dünya çapında bir sosyal medya tasarım uzmanısın. Aşağıdaki marka için Pinterest, Google ve Dribbble'da arama yaparak en iyi sosyal medya gönderi tasarımlarını bulmak istiyorum.

    MARKA BİLGİSİ:
    - İsim: ${brand.name}
    - Sektör: ${brand.industry}
    - Açıklama: ${brand.description || 'Yok'}
    - Ton: ${brand.tone}
    - Renkler: ${brand.palette.map(c => `${c.name} (${c.hex})`).join(', ')}

    GÖREV: Bu markanın sosyal medya içeriklerinde kullanabileceği EN İYİ referans tasarımları bulmak için İngilizce arama sorguları üret.

    KURALLAR:
    1. Sektöre özel, kaliteli tasarım bulmaya odaklan
    2. Genel "social media" aramaları YAPMA - çok spesifik ol
    3. Farklı içerik türleri için sorgular üret (tanıtım, kampanya, bilgi, motivasyon, ürün)
    4. Dribbble/Behance kalitesinde tasarımları hedefle
    5. Her sorgu İngilizce olmalı
    6. 8-12 sorgu üret

    Örnek kötü sorgu: "social media post design" (çok genel)
    Örnek iyi sorgu: "esim travel promotion instagram story premium design" (spesifik)
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-05-20',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          queries: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          reasoning: { type: Type.STRING },
        },
        required: ['queries'],
      },
    },
  });

  const text = response.text;
  if (!text) return [];
  const parsed = JSON.parse(text);
  return parsed.queries || [];
};

// ══════════════════════════════════════════════════
// 6. Smart Scout: Score images by design quality + brand relevance
// ══════════════════════════════════════════════════
export const scoreDesignQuality = async (
  imagesBase64: string[],
  brand: Brand
): Promise<{ scores: number[]; reasons: string[] }> => {
  const ai = getAI();

  const parts: any[] = [];

  imagesBase64.forEach((img, i) => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } });
    parts.push({ text: `[Görsel ${i + 1}]` });
  });

  parts.push({
    text: `
    Sen profesyonel bir sanat yönetmeni ve sosyal medya tasarım uzmanısın.
    Yukarıdaki ${imagesBase64.length} görseli aşağıdaki MARKA için değerlendir.

    MARKA: ${brand.name}
    SEKTÖR: ${brand.industry}
    TON: ${brand.tone}

    HER GÖRSELİ ŞU KRİTERLERE GÖRE 0-100 ARASI PUANLA:

    1. TASARIM KALİTESİ (40 puan):
       - Profesyonel kompozisyon ve layout
       - Tipografi kalitesi
       - Renk uyumu ve kontrast
       - Görsel hiyerarşi
       - Genel estetik

    2. MARKA UYUMU (30 puan):
       - Bu sektöre uygunluk (${brand.industry})
       - Markanın tonuna yakınlık (${brand.tone})
       - Hedef kitleye hitap etme
       - Uyarlanabilirlik potansiyeli

    3. TREND & GÜNCELLIK (15 puan):
       - Modern tasarım trendlerine uyum
       - 2024-2025 sosyal medya estetiği
       - Dikkat çekicilik

    4. TEKNİK KALİTE (15 puan):
       - Çözünürlük ve netlik
       - Profesyonel üretim kalitesi
       - Stok fotoğraf DEĞİL, özgün tasarım olması

    DÜŞÜK PUAN VER: Stok fotoğraflar, düşük kaliteli tasarımlar, sektörle alakasız görseller, amatör çalışmalar.
    YÜKSEK PUAN VER: Dribbble/Behance kalitesinde, sektöre uygun, modern, ilham verici tasarımlar.
  `,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-05-20',
    contents: { parts },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          evaluations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                imageIndex: { type: Type.NUMBER },
                score: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ['imageIndex', 'score', 'reason'],
            },
          },
        },
        required: ['evaluations'],
      },
    },
  });

  const text = response.text;
  if (!text) return { scores: imagesBase64.map(() => 50), reasons: imagesBase64.map(() => 'Değerlendirilemedi') };

  const parsed = JSON.parse(text);
  const evals = parsed.evaluations || [];

  const scores = imagesBase64.map((_, i) => {
    const ev = evals.find((e: any) => e.imageIndex === i);
    return ev?.score ?? 50;
  });
  const reasons = imagesBase64.map((_, i) => {
    const ev = evals.find((e: any) => e.imageIndex === i);
    return ev?.reason ?? '';
  });

  return { scores, reasons };
};

// ══════════════════════════════════════════════════
// 7. Pipeline: AI-powered topic generation for brand
// ══════════════════════════════════════════════════
export const generatePipelineTopics = async (
  brand: Brand,
  count: number,
  aspectRatio: string
): Promise<string[]> => {
  const ai = getAI();

  const formatMap: Record<string, string> = {
    '1:1': 'Instagram kare post',
    '4:5': 'Instagram portre post',
    '9:16': 'Instagram/TikTok Story',
    '16:9': 'YouTube thumbnail / LinkedIn banner',
  };
  const format = formatMap[aspectRatio] || 'sosyal medya gönderi';

  const today = new Date();
  const monthNames = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const currentMonth = monthNames[today.getMonth()];
  const currentYear = today.getFullYear();

  const prompt = `
    Sen dünyanın en büyük reklam ajanslarında (Wieden+Kennedy, Ogilvy, BBDO) çalışmış,
    Cannes Lions ödüllü bir Kreatif Direktör ve Sosyal Medya Stratejistisin.

    MARKA BİLGİSİ:
    - İsim: ${brand.name}
    - Sektör: ${brand.industry}
    - Açıklama: ${brand.description || 'Belirtilmemiş'}
    - Marka Tonu: ${brand.tone}
    - Renk Paleti: ${brand.palette.map(c => `${c.name} (${c.hex})`).join(', ')}

    TARİH: ${currentMonth} ${currentYear}
    FORMAT: ${format} (${aspectRatio})

    GÖREV: Bu marka için tam olarak ${count} adet REKLAM GÖRSELİ KONUSU üret.
    Her konu bir tasarımcıya brief olarak verilecek — yani görsel olarak tasarlanabilir,
    somut ve spesifik olmalı.

    ÖNEMLİ KURALLAR:
    1. Her konu bir REKLAM GÖRSELİ teması olacak (poster, banner, sosyal medya görseli)
    2. Soyut değil SOMUT ol: "Yaz kampanyası" yerine "${brand.name} Yaz İndirimi — Seçili Ürünlerde %40'a Varan Fırsatlar" gibi
    3. Her konuda markanın sektörüne (${brand.industry}) özgü ürün/hizmet/değer önerisi olsun
    4. Konu çeşitliliği sağla:
       - Ürün/hizmet tanıtımı (en az 2)
       - Kampanya/indirim/fırsat görseli (en az 1)
       - Motivasyonel/ilham verici paylaşım (en az 1)
       - Sezonsal/güncel etkinlik (${currentMonth} ${currentYear} için uygun)
       - Müşteri güveni/sosyal kanıt (referans, başarı hikayesi)
       - Bilgilendirici/eğitici içerik (sektörel ipucu, nasıl yapılır)
    5. Her konu 1-2 cümle, Türkçe
    6. Görselde kullanılacak ana mesaj/slogan önerisi de konuya dahil olsun
    7. Markanın tonuna (${brand.tone}) sadık kal
    8. Konular birbirinden FARKLI olsun, tekrar etme
    9. Gerçek bir markanın gerçekten paylaşabileceği, profesyonel konular olsun
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-05-20',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['topics'],
      },
    },
  });

  const text = response.text;
  if (!text) return [];
  const parsed = JSON.parse(text);
  return (parsed.topics || []).slice(0, count);
};

// ══════════════════════════════════════════════════
// 8. Design Review Agent - World-class design eye
// ══════════════════════════════════════════════════
export interface DesignReview {
  score: number; // 0-100
  needsRevision: boolean;
  issues: string[];
  revisionPrompt: string; // auto-generated revision instructions
}

export const reviewDesignQuality = async (
  imageBase64: string,
  brand: Brand,
  topic: string
): Promise<DesignReview> => {
  const ai = getAI();

  const prompt = `
    Sen dünyanın en prestijli reklam ajanslarında çalışmış, Cannes Lions, D&AD, One Show ödüllü bir
    Kreatif Direktörsün. Elindeki görseli profesyonel bir tasarım denetimine tabi tut.

    MARKA: ${brand.name} (${brand.industry})
    KONU: ${topic}
    MARKA RENKLERİ: ${brand.palette.map(c => `${c.name}: ${c.hex}`).join(', ')}

    AŞAĞIDAKİ KRİTERLERE GÖRE DEĞERLENDİR (her biri 0-100):

    1. TİPOGRAFİ (Ağırlık: %20)
       - Font seçimi marka tonuna uygun mu?
       - Okunabilirlik: boyut, kontrast, satır aralığı
       - Hiyerarşi: başlık > alt başlık > gövde metin düzgün mü?
       - Metin hizalama ve boşluklar tutarlı mı?
       - Yazım/gramer hatası var mı?

    2. GÖRSEL HİYERARŞİ & KOMPOZİSYON (Ağırlık: %25)
       - Göz akışı mantıklı mı? (Z-pattern, F-pattern veya merkezi odak)
       - Ana mesaj ilk 2 saniyede okunabiliyor mu?
       - CTA (call-to-action) yeterince belirgin mi?
       - Boşluk (whitespace) dengesi: sıkışık mı yoksa çok boş mu?
       - Öğeler arası alignment (hizalama) düzgün mü?

    3. RENK DAĞILIMI & MARKA UYUMU (Ağırlık: %25)
       - Marka renkleri doğru kullanılmış mı? (60-30-10 kuralı)
       - Kontrast yeterli mi? (WCAG standartları)
       - Renk harmonisi sağlanmış mı?
       - Marka kimliğiyle uyumlu mu?
       - Logo görünür ve doğru konumda mı?

    4. GENEL TASARIM KALİTESİ (Ağırlık: %30)
       - Profesyonel görünüm: ajans kalitesinde mi yoksa amatör mü?
       - Görsel netlik ve çözünürlük
       - Tutarlılık: tüm öğeler bir bütün oluşturuyor mu?
       - Sektöre uygunluk (${brand.industry})
       - Sosyal medya platformuna uygunluk
       - Duygusal etki ve dikkat çekicilik

    PUANLAMA: 85+ = mükemmel (revizyon gerekmez), 70-84 = iyi ama iyileştirilebilir, <70 = revizyon gerekli.

    ÖNEMLİ: Eğer puan 85'in altındaysa, tespit ettiğin sorunları düzeltmek için Türkçe,
    net ve spesifik bir revizyon talimatı yaz. Bu talimat doğrudan bir görsel düzenleme AI'ına
    gönderilecek, o yüzden "şunu yap, bunu değiştir" formatında yaz.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-05-20',
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          { text: prompt }
        ]
      }
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          needsRevision: { type: Type.BOOLEAN },
          issues: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          revisionPrompt: { type: Type.STRING },
        },
        required: ['score', 'needsRevision', 'issues', 'revisionPrompt'],
      },
    },
  });

  const text = response.text;
  if (!text) return { score: 75, needsRevision: true, issues: ['Değerlendirme yapılamadı'], revisionPrompt: 'Genel kaliteyi artır, tipografiyi iyileştir, renk dengesini düzelt.' };

  const parsed = JSON.parse(text);
  return {
    score: parsed.score ?? 75,
    needsRevision: parsed.needsRevision ?? (parsed.score < 85),
    issues: parsed.issues || [],
    revisionPrompt: parsed.revisionPrompt || '',
  };
};
