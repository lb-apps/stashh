# Plan: recognition_tasks + recognition_results

Repoda tutulan şema özeti. Uygulama tamamlanınca migrasyonlar bu alanlarla hizalanır.

---

## `normalized_source_url` neden var?

İsim olarak **normalized** tercih edildi: `source_url` (ham) ile yan yana okuyunca “normalize edilmiş kopya” hemen anlaşılır. Literatürde bazen *canonical URL* denir; aynı rol.

Önbellek ve global dedup için **tek tip bir anahtar** gerekir. `source_url` ham giriş olduğu için aynı içerik farklı yazımlarla gelebilir (http/https, `www`, sonda `/`, query parametreleri). `recognition_results` üzerinde `UNIQUE (normalized_source_url)` ve worker’daki “önceden işlendi mi?” sorgusu bu normalize edilmiş değere bağlanır; ham URL ile yapılsaydı yanlışlıkla **aynı reel için birden fazla cache satırı** oluşabilirdi.

İki kolonu birlikte tutmanın nedeni: **denetim / ürün** için orijinal `source_url`, **veri katmanı** için sabit `normalized_source_url`.

Alternatif (aynı mantık, farklı şekil): Postgres’te ayrı kolon yerine `source_url` üzerinde **generated stored column** veya normalize fonksiyonu ile **expression unique index** — tek anahtar mantığı kalır, sütun sayısı azalır.

### Örnek: aynı reel, farklı `source_url`

İki kullanıcı paylaşım linkini farklı kopyalamış olsun:

| Alan | Değer |
|------|--------|
| `source_url` (kullanıcı A) | `https://www.instagram.com/reel/AbCdEfGh123/?igsh=ZWZzaWxsYW5k` |
| `source_url` (kullanıcı B) | `http://instagram.com/reel/AbCdEfGh123` |

İkisi de **aynı reel**; worker ve `recognition_results` tek satır görmeli. Normalizasyon (şema + host küçük harf, `www` kaldırma, `https`, gereksiz query strip, vb.) sonucu her iki task için aynı anahtar üretilir:

| Alan | Değer |
|------|--------|
| `normalized_source_url` (ikisi için de) | `https://instagram.com/reel/AbCdEfGh123` |

Böylece ikinci task cache sorgusunda **aynı** `recognition_results` satırını bulur; farklı `source_url` değerleri yine de satırda saklanır (kimin ne yapıştırdığı kaybolmaz).

---

## 1. `public.recognition_tasks` (hedef)

İş kuyruğu satırı. Eski tablo adı: `recognitions` (rename).

| Alan | Tip | Null | Açıklama |
|------|-----|------|----------|
| `id` | `uuid` | hayır | PK, `gen_random_uuid()` |
| `owner_user_id` | `uuid` | hayır | FK → `auth.users(id)`, `on delete cascade` |
| `source_url` | `text` | hayır | Kullanıcının gönderdiği ham Instagram URL’i |
| `normalized_source_url` | `text` | hayır | Normalize edilmiş tek anahtar; cache / dedup için (`recognition_results` ile eşleşir) |
| `result_id` | `uuid` | evet | FK → `recognition_results(id)`, `on delete restrict` (veya `set null` — migrasyonda netleştir); tamamlanınca dolar |
| `status` | `text` | hayır | `queued`, `processing`, `completed`, `committed`, `cancelled`, `failed`, `expired` |
| `started_at` | `timestamptz` | evet | **`processing` işine gerçekten başlama** anı (pipeline başlar); claim/reservasyon ile aynı saniyede olmak zorunda değil |
| `finished_at` | `timestamptz` | evet | `processing` bitişi — başarılı (`completed`) veya kalıcı hata (`failed`) |
| `error_message` | `text` | evet | Hata özeti |
| `retry_count` | `integer` | hayır | Default `0`, `>= 0` check |
| `created_at` | `timestamptz` | hayır | Default `now()` |
| `updated_at` | `timestamptz` | hayır | Default `now()`, `set_updated_at` trigger |

**Hedefte task tablosunda olmayanlar (kaldırılacak / taşınacak):**

| Alan | Not |
|------|-----|
| `results` | Kaldırılır; çıktı sadece `recognition_results.items` |
| `expires_at` | Kaldırılır (plan) |
| `status_metadata` | Kaldırılır (plan) |
| `max_retries` | Kaldırılır; sabit limit uygulama katmanında |
| `last_transition_at` | Kaldırılır (plan) |
| `run_at` | **Kaldırılır (plan kararı).** Aşağıdaki worker bölümüne bakın. |
| `claimed_at` | **Kaldırılır.** Stale recovery **`started_at`** üzerinden (aşağıda). |

### Worker claim (`run_at` olmadan)

`claim_*` RPC: `status = 'queued'` ve `for update skip locked`, sıra **`created_at` artan (FIFO)**. Ek zaman filtresi yok. `started_at`, **`processing` işine fiilen başlandığında** set edilir (claim/reserve anı ile aynı transaction olmak zorunda değil; POC’ta çoğu zaman birlikte yazılır).

**Retry / backoff (sade model):** Worker işi claim eder (`processing`), pipeline’ı çalıştırır. Olmazsa **aynı worker içinde** exponential backoff ile bekleyip **tekrar dener**; limit dolana veya başarıya kadar bu döngü. Arada satırı `queued` yapıp başka sürece devretmek zorunlu değil — karmaşık kuyruk choreography yok. Bittiğinde tek seferde `completed` / `failed` + gerekirse `retry_count` güncellenir.

*Stale recovery:* `status = 'processing'` ve `started_at` eşikten eskiyse tekrar `queued` (veya uygun reset). Toplam backoff, bu eşikten uzun sürerse uzun işlerde `started_at` periyodik tazelenir (heartbeat) veya eşik geniş tutulur — operasyonel ayar.

---

**İndeks / kısıtlar (özet):** `owner_user_id` + `status` + `created_at`; worker için `status`, `created_at`; stale için `status`, `started_at`; isteğe bağlı `normalized_source_url` ile arama (cache path).

---

## 2. `public.recognition_results` (hedef)

Global önbellek: **normalize edilmiş URL başına** tek satır (tüm kullanıcılar aynı sonucu paylaşır).

| Alan | Tip | Null | Açıklama |
|------|-----|------|----------|
| `id` | `uuid` | hayır | PK, `gen_random_uuid()` |
| `normalized_source_url` | `text` | hayır | **Unique**; `recognition_tasks.normalized_source_url` ile birebir |
| `items` | `jsonb` | hayır | Slim yer dizisi (aşağıdaki şema); pipeline tam objeyi buraya map’ler |
| `created_at` | `timestamptz` | hayır | Default `now()` |
| `updated_at` | `timestamptz` | hayır | Default `now()`, `set_updated_at` trigger |

**Yazım:** Worker `INSERT ... ON CONFLICT (normalized_source_url) DO UPDATE` ile idempotent upsert.

---

## 3. `items` jsonb — dizi elemanı (slim)

`recognition_results.items` bir JSON **dizisi**dir. **Ürün kuralı:** Sistem Google Places’a bağlı; kullanıcıya ve `public.places` ile hizaya giden **görünen isim yalnızca `place.name`**. **Kalıcı jsonb’de `rawName` yok** — LLM’den çıkan isim yalnızca eşleştirme pipeline’ında (matcher girdisi) kullanılır.

Dizide **yalnızca başarıyla Google’a eşlenen** mekanlar (`place` zorunlu). Eşlenemeyen çıkarımlar sonuca yazılmaz (veya yalnızca log/metrik).

| Alan | Tip (JSON) | Kalıcı mı | Açıklama |
|------|------------|-----------|----------|
| `thumbnailUrl` | string \| null | evet | **Kendi storage/CDN** thumbnail URL’i (kalıcı). `recognition_results` reuse için tutulur. |
| `instagramUsername` | string \| null | evet | `@` olmadan handle |
| `recommendations` | array | evet | Obje listesi: `summary` (string), `kind` (string enum) |
| `confidenceScore` | number | evet | 0..1 veya model skalası |
| `place` | object | evet | **Zorunlu**; yapı §4. Kart / liste başlığı: `place.name`. |

**Kalıcı olarak yazılmayanlar** (pipeline içi veya senkron API):

| Alan | Not |
|------|-----|
| `rawName` | Çıkarılır, matcher ile tüketilir; **jsonb’de tutulmaz** |
| `photoUrls` | Kalıcı tutulmaz; detayda on-demand (ileride endpoint/redis) |
| `source` | `caption` / `video` / `both` — DB’de tutulmaz |
| `locationHint` | DB’de tutulmaz |

---

## 4. `place` (nested object)

Her `items[]` öğesinde **`place` zorunlu** (Google bağlılığı). Alanlar:

| Alan | Tip (JSON) | Açıklama |
|------|------------|----------|
| `googlePlaceId` | string | |
| `name` | string | |
| `address` | string | |
| `city` | string \| null | |
| `district` | string \| null | |
| `country` | string \| null | |
| `latitude` | number | |
| `longitude` | number | |
| `category` | string \| null | |
| `rating` | number \| null | |
| `priceLevel` | number \| null | |
| `phoneNumber` | string \| null | |
| `websiteUrl` | string \| null | |

### Google foto URL’leri ve ömür (bu plana etkisi)

- **Sabit TTL yok:** Dokümantasyon foto `name` için “**expire** olabilir” der; süre gün/saniye olarak yayınlanmaz. [`Place Photos` uyarısı](https://developers.google.com/maps/documentation/places/web-service/place-photos): `name` önbelleğe alınmamalı, yeni istek için Text Search / Place Details cevabından alınmalı.
- **Media yanıtı:** `getMedia` / redirect akışında dönen hedef URI bazen **kısa ömürlü** (`photoUri` için “short-lived” ifadesi geçer). Yani DB’de **aylarca tutulan ham Google foto URL’leri** ileride kırılabilir.
- **Bu plan kararı:** Kalıcı olarak sadece **thumbnail** saklanır (`items[].thumbnailUrl`, internal storage/CDN). Diğer foto URL’leri kalıcı DB alanı olmaz; mekan detayında on-demand üretilir.

---

## 5. Referans: bugünkü `public.recognitions` (migrasyon öncesi)

Yeşil + mevcut migrasyonlardaki kolonlar; hedefe giderken rename + yukarıdaki farklar uygulanır.

| Alan | Tip | Not |
|------|-----|-----|
| `id` | `uuid` | PK |
| `owner_user_id` | `uuid` | FK users |
| `source_url` | `text` | |
| `results` | `jsonb` | Hedefte kalkar |
| `status` | `text` | Aynı enum ailesi |
| `run_at` | `timestamptz` | |
| `started_at` | `timestamptz` | |
| `finished_at` | `timestamptz` | |
| `claimed_at` | `timestamptz` | Hedefte kalkar; stale → `started_at` |
| `last_transition_at` | `timestamptz` | Hedefte kalkar (plan) |
| `error_message` | `text` | |
| `retry_count` | `integer` | |
| `max_retries` | `integer` | Hedefte kalkar (plan) |
| `status_metadata` | `jsonb` | Hedefte kalkar (plan) |
| `expires_at` | `timestamptz` | Hedefte kalkar (plan) |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

## 6. Kısa akış

1. **POST** → `recognition_tasks` insert (`queued`, `normalized_source_url` dolu; `run_at` yok).
2. **Worker claim** → cache: `recognition_results` by `normalized_source_url`.
3. **Hit** → task `completed`, `result_id` set, pipeline yok.
4. **Miss** → pipeline → upsert `recognition_results` → task `completed`.
5. **GET** → task + join veya ikinci sorgu ile `places`.

RLS ve Realtime ayrıntıları üst seviye planda; tablo alanları yukarıda tam listelenmiştir.
