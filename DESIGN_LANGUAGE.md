# Discovery — Design Language

**Referans:** Bump (iOS) — Gen-Z sosyal harita uygulaması
**Dosyalar:** `/design-taste/Screenshot 0-4.jpg`

---

## 1. Genel Karakter

| Özellik | Tanım |
|---|---|
| **Ton** | Enerjik, oyuncu, cesur, sosyal |
| **Yaş hissi** | 16-24 — üniversite kampüs enerjisi |
| **Görsel yoğunluk** | Yüksek — katmanlı, zengin, canlı |
| **Hareket** | Her şey yaşıyor — 3D objeler, floating elementler, pulse animasyonları |

---

## 2. Renk Paleti

### Ana Renkler
| Rol | Hex | Kullanım |
|---|---|---|
| **Electric Blue** | `#3366FF` | Birincil aksiyon, navigasyon vurgusu, harita overlay |
| **Deep Indigo** | `#1A0E4F` | Koyu arka planlar, gradient base |
| **Vivid Purple** | `#6B3FA0` | Gradient geçiş, derinlik |
| **Pure White** | `#FFFFFF` | Kartlar, metin, kontrast |

### Accent Renkler
| Rol | Hex | Kullanım |
|---|---|---|
| **Hot Red** | `#FF2D2D` | Dikkat çekici badge, vurgu text |
| **Neon Green** | `#00E676` | Canlı durum, aktif/online göstergesi |
| **Warm Amber** | `#FFB800` | Skor, puan, ödül |

### Gradientler
- **Hero Gradient:** `#3366FF` → `#6B3FA0` → `#1A0E4F` (mavi → mor → koyu)
- **Card Glow:** Radial beyaz glow, `opacity 0.15`, elementlerin arkasında

---

## 3. Tipografi

| Seviye | Stil | Kullanım |
|---|---|---|
| **Display** | Bold/Black, 48-72pt, beyaz, 3D perspektif drop shadow | Hero başlıklar, harita üstü büyük text |
| **Headline** | Bold, 28-36pt, beyaz veya siyah | Ekran başlıkları, section header |
| **Title** | Semibold, 20-24pt | Kart başlıkları, mekan isimleri |
| **Body** | Regular, 16-17pt | Açıklama, adres bilgisi |
| **Caption** | Medium, 12-14pt | Badge text, etiketler, metadata |

### Tipografi Kuralları
- Başlıklar **büyük harfle** yazılmaz, doğal case kullanılır
- Display text'te **3D extrude / perspective** efekti signature eleman
- Beyaz text + koyu arka plan birincil kombinasyon
- Kalın/ince kontrast aşırı: Display Black ile Caption Regular yan yana

---

## 4. Harita Tasarım Dili

Bu uygulamanın kalbi harita. Referans görsellerdeki harita yaklaşımı:

| Eleman | Stil |
|---|---|
| **Harita tonu** | Hafif mavi/mor tint overlay — ham Apple Maps değil, branded hissiyat |
| **Pin'ler** | Yuvarlak profil fotoğrafı çerçeveleri (beyaz border, drop shadow) |
| **Overlay metrikleri** | Harita üstünde floating badge'ler (mesafe, süre, yüzde) |
| **Bölge vurgusu** | Hexagonal heat-map glow efekti (turuncu/sarı) |
| **Rota çizgisi** | Kalın, mavi, yuvarlak köşeli, animasyonlu |
| **Şehir/semt ismi** | Sol üst köşede büyük bold text, haritanın üstünde |

---

## 5. Kart & Yüzey Tasarımı

| Özellik | Değer |
|---|---|
| **Border Radius** | 20-24pt (büyük, yumuşak) |
| **Arka plan** | Beyaz veya yarı-saydam frosted glass |
| **Gölge** | Yumuşak, geniş yayılımlı (blur 20-40, opacity 0.1-0.15) |
| **İç padding** | Cömert — 16-24pt |
| **Kart içi elementler** | Avatar + text + badge yan yana, kompakt ama nefes alan |

---

## 6. 3D & Dekoratif Elementler

Tasarım dilinin en ayırt edici özelliği **3D objeler ve sticker-like elementler**:

| Eleman | Açıklama |
|---|---|
| **3D Emoji / Objeler** | Bira bardağı, kahve fincanı, müzik notaları, boks eldiveni — floating, hafif gölgeli |
| **Profil halkaları** | Kalın renkli çerçeve (yeşil = aktif, mavi = hareket halinde) |
| **Pulsing ring** | Profil etrafında animasyonlu genişleyen halka |
| **Sparkle / Glint** | Parlama efektleri, özellikle ikonlar ve başlıklar üzerinde |
| **Badge'ler** | Pill shape, yarı-saydam arka plan, ikon + text |

---

## 7. Animasyon & İnteraksiyon Prensipleri

### Giriş Animasyonları
- **Staggered fade-in:** Elementler sırayla, hafif yukarıdan aşağı kayarak gelir
- **Scale bounce:** Kartlar ve pin'ler 0.8 → 1.0 scale ile spring animasyonu
- **3D objeler:** Hafif rotation ile sahneye giriş, floating idle animasyonu

### Harita Animasyonları
- **Pin drop:** Yukarıdan düşme + bounce
- **Pulse ring:** Pin etrafında sürekli genişleyen/kaybolan halka
- **Route draw:** Rota çizgisi baştan sona animasyonlu çizilir
- **Region reveal:** Hexagonal heat-map glow fade-in

### Mikro İnteraksiyonlar
- **Tap feedback:** Scale 0.95 + haptic (light impact)
- **Long press:** Scale büyüme + context menu
- **Swipe:** Smooth, momentum-based, rubber band efekti
- **Toggle:** Spring animasyonlu geçiş, renk değişimi
- **Pull to refresh:** Custom animasyonlu (3D obje döndürme veya bounce)

### Geçiş Animasyonları
- **Ekranlar arası:** Shared element transition (kart → detay)
- **Modal:** Bottom sheet, spring damping ile yukarı kayma
- **Tab geçişi:** Cross-fade + hafif horizontal slide

---

## 8. İkonografi

| Özellik | Stil |
|---|---|
| **Tarz** | SF Symbols + custom filled icons |
| **Ağırlık** | Medium-Bold, filled tercih edilir |
| **Renk** | Beyaz (koyu arka plan) veya Electric Blue (açık arka plan) |
| **Boyut** | 24-28pt navigasyon, 20pt inline |

---

## 9. Discovery'ye Adaptasyon Notları

Bump'ın tasarım dilini Discovery'nin mekan keşfi konseptine uyarlarken:

| Bump Elementi | Discovery Karşılığı |
|---|---|
| Arkadaş profil pinleri | Mekan pinleri (emoji/kategori ikonu çerçeveli) |
| ETA / mesafe badge | Mekan puanı / mesafe badge |
| Hexagonal heat-map | Yoğun mekan bölgeleri glow efekti |
| Profil kartları | Mekan detay kartları (fotoğraf + isim + puan + adres) |
| "Full Send" buton stili | "Listeye Ekle" / "Yol Tarifi" buton stili |
| 3D emoji (bira, kahve) | Mekan kategorisi 3D ikonları (kahve, restoran, bar, brunch) |
| Rota çizgisi | Instagram kaynak link → mekan akış çizgisi |
| Kampüs kartı | Liste kartı (kapak görseli + isim + mekan sayısı) |

---

## 10. Yapılmaması Gerekenler

- Düz, sıkıcı, generic iOS tasarımı yapma — her eleman personality taşımalı
- Gradient'leri flat renklerle değiştirme — derinlik hissi kritik
- Statik elementler bırakma — her şeyde en az subtle bir animasyon olmalı
- Küçük, sıkışık UI yapma — cömert spacing, büyük touch target
- Koyu tema'yı karanlık/kasvetli yapma — koyu ama enerjik olmalı (mavi/mor bazlı)
