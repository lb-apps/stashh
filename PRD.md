# PRD: Discovery (iOS)

**Versiyon:** 1.0 — Taslak
**Tarih:** 26 Mart 2026
**Yazar:** Emirhan Erdoğan
**Dil:** Sadece İngilizce
**Monetizasyon:** Yok (MVP'de monetizasyon planlanmıyor)

---

## 1. Problem Tanımı

İnsanlar her gün Instagram'da onlarca Reel, Story ve Post aracılığıyla yeni mekanlar keşfediyor. Ancak bu keşifleri aksiyona dönüştürmek neredeyse imkansız:

- **Kaydetme sorunu:** Instagram'da tek seçenek Bookmark. Liste oluşturma, kategorize etme veya haritaya ekleme gibi bir özellik yok.
- **Geri dönüş sorunu:** Bookmark'lanan içerikler yüzlerce diğer kayıtın arasında kayboluyor. Aradığını bulmak çok zor.
- **Bilgi çıkarma sorunu:** Video içinde geçen mekan adını kopyalayamıyorsun. Kopyalasan bile Google'da aratman, doğru yeri bulman, adres bilgisine ulaşman gerekiyor.
- **Sonuç:** Mekanların ziyaret edilme oranları düşüyor, insanlar keşif potansiyellerini gerçekleştiremiyor.

Bu sürtünme, hem kullanıcılar hem de mekan sahipleri için ciddi bir kayıp yaratıyor.

---

## 2. Çözüm Özeti

Kullanıcı Instagram'da gördüğü içeriğin linkini kopyalar → Uygulamamıza gelir → Link otomatik yapıştırılır → Uygulama içerikteki mekanları AI ile analiz eder → Mekanlar liste halinde sunulur → Kullanıcı bunları Spotify playlist mantığıyla düzenler ve kaydeder → Harita üzerinde veya liste görünümünde tüm kayıtlı mekanlarına erişir.

---

## 3. Hedef Kullanıcı

### 3.1 Birincil Segment — Lise & Üniversite Öğrencileri (16-24 yaş)

Uygulamanın çekirdek kitlesi. Instagram Reels bu yaş grubunun ana keşif kanalı ve mekan keşfi sosyal hayatlarının merkezinde.

| Özellik | Detay |
|---|---|
| **Yaş aralığı** | 16-24 |
| **Davranış** | Günde 1-3+ saat Instagram/TikTok tüketimi, Reels-first keşif alışkanlığı |
| **Motivasyon** | Arkadaşlarla buluşacak yeni mekanlar bulmak, trend mekanlarda olmak, sosyal çevrede öne çıkmak |
| **Mekan türleri** | Kafeler, brunch mekanları, fotoğenik/instagramlık yerler, öğrenci bütçesine uygun mekanlar, pop-up etkinlikler |
| **Acı noktası** | Reels'de gördükleri mekanı 2-3 gün sonra hatırlayamıyorlar, bookmark kaosunda kayboluyor |
| **Cihaz** | Neredeyse tamamı iPhone (hedef kitle iOS-first stratejisiyle uyumlu) |

### 3.2 İkincil Segment — Genç Profesyoneller / Beyaz Yaka (24-32 yaş)

Mezun olmuş, çalışan, hafta içi yoğun ama hafta sonu mekan keşfi ve sosyalleşmeye vakit ayıran kitle.

| Özellik | Detay |
|---|---|
| **Yaş aralığı** | 24-32 |
| **Davranış** | Hafta içi sınırlı sosyal medya, hafta sonu yoğun mekan araştırması, planlı çıkışlar |
| **Motivasyon** | Kaliteli vakit geçirmek, yeni açılan mekanları denemek, date night / arkadaş buluşmaları planlamak |
| **Mekan türleri** | Restoranlar, barlar, rooftop'lar, brunch mekanları, konsept mekanlar, fine dining |
| **Acı noktası** | Hafta içi gördükleri içerikleri hafta sonuna kadar organize edemiyorlar, karar verme süreci uzun sürüyor |
| **Ödeme gücü** | Daha yüksek — premium özellikler ve abonelik modeli için uygun segment |

### 3.3 Üçüncül Segment — Seyahat Planlayanlar & Şehir Değiştirenler

| Özellik | Detay |
|---|---|
| **Profil** | Yeni şehre taşınanlar, tatil planlayanlar, Erasmus/exchange öğrencileri |
| **Motivasyon** | Gidecekleri şehir hakkında önceden mekan listesi oluşturmak |
| **Acı noktası** | Onlarca Instagram içeriğinden derleme yaparak gezi planı oluşturmak çok zaman alıyor |

---

## 4. Temel Kullanıcı Hikayeleri

### 4.1 Link Yapıştırma & Mekan Çıkarma
> *Kullanıcı olarak, Instagram'da gördüğüm bir Reel'in linkini yapıştırarak içindeki mekanları otomatik olarak çıkarmak istiyorum, böylece tek tek araştırmak zorunda kalmayayım.*

**Kabul Kriterleri:**
- Kullanıcı uygulamayı açtığında clipboard'da Instagram linki varsa otomatik algılanır ve yapıştırma önerilir
- Reel, Post ve Story linkleri desteklenir
- AI analizi sonucunda içerikteki mekan adları, şehir/semt bilgileri çıkarılır
- Çıkarılan mekanlar Google Places / Apple Maps API ile eşleştirilerek zenginleştirilir (adres, fotoğraf, puan, kategori)
- Sonuçlar kullanıcıya onay için liste halinde sunulur

### 4.2 Mekan Listesi Oluşturma & Yönetme
> *Kullanıcı olarak, keşfettiğim mekanları tematik listeler halinde düzenlemek istiyorum (örn. "İstanbul Kahvecileri", "Bali Gezisi"), tıpkı Spotify playlist'leri gibi.*

**Kabul Kriterleri:**
- Kullanıcı yeni liste oluşturabilir (isim, kapak görseli, açıklama)
- Çıkarılan mekanlar mevcut listeye eklenebilir veya yeni liste oluşturulabilir
- Listeler arasında mekan taşıma / kopyalama yapılabilir
- Liste içinde mekanların sırası sürükle-bırak ile değiştirilebilir
- Listeler "Ziyaret Edildi" / "Gidilecek" olarak işaretlenebilir

### 4.3 Harita Görünümü
> *Kullanıcı olarak, kaydettiğim tüm mekanları harita üzerinde görmek istiyorum, böylece yakınımdaki veya belirli bir bölgedeki kayıtlı mekanlarımı kolayca bulabileyim.*

**Kabul Kriterleri:**
- Tüm kayıtlı mekanlar harita üzerinde pin olarak görünür
- Pin'ler liste rengine / kategorisine göre farklılaşır
- Pin'e tıklanınca mekan detay kartı açılır (isim, adres, puan, fotoğraf, kaynak link)
- "Google Maps'te Aç" butonu ile navigasyona yönlendirme yapılabilir
- Harita filtresi: liste bazlı, kategori bazlı, ziyaret durumu bazlı

### 4.4 Mekan Detay Görüntüleme
> *Kullanıcı olarak, kaydettiğim bir mekanın detaylarını görmek ve oraya nasıl gideceğimi kolayca öğrenmek istiyorum.*

**Kabul Kriterleri:**
- Mekan kartında: isim, adres, kategori, puan, fotoğraflar, çalışma saatleri
- Kaynak Instagram linki (orijinal içeriğe geri dönüş)
- "Google Maps'te Aç" / "Apple Maps'te Aç" aksiyonları
- Kişisel not ekleme alanı
- "Ziyaret Ettim" toggle'ı

---

## 5. MVP Kapsamı (v1.0)

### Dahil
- Instagram Reel/Post link yapıştırma ve mekan çıkarma (AI-powered)
- Mekan listesi oluşturma ve yönetme
- Harita görünümü (tüm mekanlar + liste filtresi)
- Mekan detay kartı + Google Maps yönlendirme
- Temel kullanıcı hesabı (Telefon numarası + SMS doğrulama kodu)

---

## 6. Teknik Mimari (Yüksek Seviye)

```
┌─────────────────────────────────────────────┐
│                iOS App (Swift)               │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Link    │  │ Listeler │  │  Harita    │  │
│  │ Parser  │  │ & Mekan  │  │  Görünümü  │  │
│  │ UI      │  │ Yönetimi │  │            │  │
│  └────┬────┘  └─────┬────┘  └─────┬──────┘  │
│       │              │             │          │
│       └──────────┬───┘─────────────┘          │
│                  │                            │
└──────────────────┼────────────────────────────┘
                   │ API
┌──────────────────┼────────────────────────────┐
│            Backend (Node.js / Python)          │
│  ┌───────────────┼──────────────────────┐     │
│  │               ▼                      │     │
│  │  ┌──────────────────┐                │     │
│  │  │ Instagram Scraper│                │     │
│  │  │ (Link → İçerik)  │                │     │
│  │  └────────┬─────────┘                │     │
│  │           ▼                          │     │
│  │  ┌──────────────────┐                │     │
│  │  │ AI Mekan Çıkarma │                │     │
│  │  │ (LLM / NLP)      │                │     │
│  │  └────────┬─────────┘                │     │
│  │           ▼                          │     │
│  │  ┌──────────────────┐                │     │
│  │  │ Place Matching   │                │     │
│  │  │ (Google Places)  │                │     │
│  │  └──────────────────┘                │     │
│  └──────────────────────────────────────┘     │
│                                               │
│  ┌──────────────────────────────────────┐     │
│  │ Supabase (PostgreSQL + Auth + Storage)│     │
│  └──────────────────────────────────────┘     │
└───────────────────────────────────────────────┘
```

### Kritik Teknik Bileşenler

| Bileşen | Teknoloji Önerisi | Not |
|---|---|---|
| iOS App | SwiftUI + Combine | Modern, deklaratif UI |
| Backend | Python (FastAPI) veya Node.js | AI entegrasyonu için Python avantajlı |
| AI Mekan Çıkarma | Claude API / GPT-4 Vision | Video caption + görsel analiz |
| Mekan Eşleştirme | Google Places API | Adres, fotoğraf, puan verisi |
| Harita | MapKit (Apple) | Native iOS deneyimi |
| Veritabanı | Supabase (PostgreSQL + PostGIS) | Konum bazlı sorgular, realtime subscriptions |
| Auth | Supabase Auth (Phone OTP) | Telefon numarası + SMS doğrulama kodu, built-in kullanıcı yönetimi |
| Depolama | Supabase Storage | Mekan görselleri cache, CDN ile dağıtım |

---

## 7. Kullanıcı Akışı (Core Flow)

```
1. Kullanıcı Instagram'da ilginç bir Reel görür
         │
         ▼
2. "Paylaş" → "Bağlantıyı Kopyala"
         │
         ▼
3. Uygulamamızı açar
         │
         ▼
4. Uygulama clipboard'ı algılar → "Bu içerikten mekan çıkarmak ister misin?"
         │
         ▼
5. Kullanıcı onaylar → Yükleniyor animasyonu (2-5 sn)
         │
         ▼
6. Çıkarılan mekanlar listelenir:
   ┌─────────────────────────────┐
   │  📍 Café X — Kadıköy       │  ☑️
   │  📍 Restoran Y — Beşiktaş  │  ☑️
   │  📍 Bar Z — Beyoğlu        │  ☐
   └─────────────────────────────┘
         │
         ▼
7. Kullanıcı seçim yapar → "Listeye Ekle" → Mevcut liste veya yeni liste
         │
         ▼
8. Mekanlar kaydedilir → Liste veya Harita görünümünde erişilebilir
```

---

*Bu doküman canlı bir taslaktır. Tartışma ve iterasyon ile geliştirilecektir.*
