# Yoklama

Sabah yoklaması için sade, statik bir web uygulaması. Veritabanı ve build adımı yoktur.

## Liste ve şifre

Yayında sadece kriptolu `data/employees.enc.json` durur. Düz liste `private/employees.json` dosyasındadır, git'e ve yayına girmez. Bu dosya kaybolursa liste yalnızca şifreyle çözülerek geri alınabilir, o yüzden yedeğini ayrıca sakla.

Listeyi değiştirdikten veya şifreyi yenilemek istediğinde:

```bash
node tools/encrypt.mjs
```

Şifre en az 12 karakter olmalıdır, terminalde görünmez. Sonra `data/employees.enc.json` dosyasını commit edip gönder. Şifre unutulursa aynı komutla yenisi belirlenir.

## Çalıştırma

```bash
npx serve -l 4173 .
```

Sonra http://localhost:4173 adresini aç. Şifre çözme yalnızca `localhost` veya `https` üzerinde çalışır.

## Çalışan güncelleme

Tüm liste `private/employees.json` dosyasındadır. Değişiklikten sonra kriptolama komutunu çalıştır.

- `whatsappNumber`: boşsa WhatsApp kişi/grup seçtirir. Doluysa ülke koduyla yaz (`905xxxxxxxxx`), mesaj o kişiye açılır.
- `offices`: `floors` boşsa kat seçimi çıkmaz. `defaultStatus` verilen ofistekiler (örn. `"remote"`) yoklamaya o durumla işaretli başlar.
- `departments`: departman listesi ve sırası.
- `employees`: `department` alanı bu listedeki adlardan biri olmalı. `office` alanı ofisin `id` değeriyle eşleşmeli; `floor` değeri ofisin `floors` listesindekiyle aynı olmalı, katsız ofislerde `null` olur.
- `photo`: tam bağlantı ya da `photos/` klasöründeki dosyanın yolu (`"photos/mehmet-unal.jpg"`). Boşsa baş harfler görünür. Kare yakın plan fotoğraflar en iyi sonucu verir.
