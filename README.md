# Expert Forum — print your mark

Live Sketch → AI → Digital Wall untuk booth Astragraphia & AGIT di **Astra Expert Forum 2026**
(Rabu, 11 November 2026, 08.00–12.00 WIB, Catur Dharma Hall, Menara Astra lt. 5).
Tema: *15 Years of Astra Expert: Strengthen Value Creation for Business Impact.*

Konsep dan alur sama dengan *print your mark* WCCE 2026. Tampilan memakai KV Expert Forum
(expertforum2026.com):

- Logo **astragraphia · 70 Tahun Astra · AGIT** di kiosk, wall, cetak A4, label, halaman
  download, email dan kartu unduhan (`public/brand/`).
- Palet KV: navy `#0b1f3a`, royal `#2040da`, blue `#0380e1`, sky, red, amber `#fba500`,
  cream, brown (`src/app/globals.css`).
- Ornamen geometris KV dibuat bergerak (`src/lib/ornament.ts`, Canvas 2D): kluster di
  sudut wall dan kiosk, gelombang yang mengubah bentuk tiap beberapa detik, dan bingkai
  ornamen yang mekar saat karya baru tampil di wall. Di kiosk ornamen berhenti saat
  menggambar dan bergerak lebih cepat saat AI melukis.

**Production:** https://expertforum.vercel.app (Vercel `tech-mindsetlabs-projects/expertforum`,
deploy otomatis dari GitHub `main`, region sin1). Data di project Neon yang sama dengan
WCCE (`sparkling-mud-92936396`, branch `production`) tetapi terpisah: database
`expertforum` dan bucket `expertforum`. Nilai env production ada di
`.env.vercel-production` (tidak di-commit). Petunjuk di bawah masih memakai URL WCCE; ganti
`astragraphia-rho.vercel.app` dengan `expertforum.vercel.app`.

---

## Asal: print your mark — Astragraphia × WCCE 2026

Live Sketch → AI → Digital Wall untuk booth Astragraphia di WCCE 2026
(21–25 Oktober 2026, MGP Space - SCBD Park, Jakarta).

Peserta menulis nama (+ email opsional) di tablet, menggambar dengan S Pen (maks. 3 menit),
AI melukis ulang sketsanya, karya tampil di TV wall bernomor, dicetak A4 dengan QR (+ label
95 × 110 mm di printer kedua), dan dikirim ke email kalau diisi.

**Production:** https://astragraphia-rho.vercel.app

| Halaman | Perangkat | Keterangan |
| --- | --- | --- |
| `/kiosk` | Galaxy Tab A 10.1 + S Pen, portrait | Alur peserta 3 langkah |
| `/wall` | TV landscape + CPU | Mosaik karya + animasi karya baru |
| `/print` | Laptop meja cetak | Antrian cetak A4 (Apeos) + label (printer kedua), auto-print |
| `/print/[id]` | — | Layout poster A4 (tanda tangan Momo Signature) |
| `/print/[id]/label` | — | Label 95 × 110 mm: poster A4 tanpa footer (tanpa QR & badge Apeos) |
| `/admin` | Laptop operator | Statistik, sembunyikan karya, kirim ulang email, CSV |
| `/a/[id]` | Ponsel peserta (QR) | Replay sketsa → karya AI, unduh, bagikan |
| `/booth` | Presentasi klien | Mockup 3D island booth 4 × 3,8 m (Three.js), unduh PNG |

`/admin` dan `/print` memakai `ADMIN_PASSWORD`.

## Setup di booth

**Tablet (kiosk)**
1. Buka sekali: `https://astragraphia-rho.vercel.app/kiosk?key=<KIOSK_KEY>&kiosk=1`
   (ganti `kiosk=2`, `3`, … untuk tablet berikutnya). Kunci tersimpan di tablet.
2. Chrome → menu → *Add to Home screen* (fullscreen, portrait), atau pakai Fully Kiosk Browser.
3. Matikan auto-rotate, sleep, dan notifikasi. Nyalakan volume media (SFX goresan, countdown,
   AI melukis, sukses).

**TV wall**: Chrome fullscreen ke `/wall` dengan suara diizinkan:
`chrome --kiosk --autoplay-policy=no-user-gesture-required https://astragraphia-rho.vercel.app/wall`.
Tanpa flag itu muncul tombol *Klik untuk menyalakan suara* — klik sekali (atau tekan tombol apa saja).
Karya baru: bunyi *success* saat muncul + suara *sketching* selama replay goresan.
Wall tetap beranimasi kalau internet putus dan menyusul saat online lagi.

**SFX**: file di `src/assets/sounds`, dipetakan di `src/lib/sfx.ts` (ganti file = ganti di sana).

**Meja cetak (2 printer: Apeos A4 + printer label)**: satu jendela Chrome per printer, masing-masing
dengan profil sendiri (Chrome mengingat printer terakhir per profil, dan login `/print` juga per profil).
1. Printer label: di driver Windows set ukuran kertas default ke custom **95 × 110 mm** (portrait).
2. Sekali per profil, buka tanpa `--kiosk-printing`, login, klik *Print A4* (profil A4) atau
   *Print Label* (profil label), lalu pilih printernya + margin *none*, skala 100%:
   `chrome --user-data-dir=C:ag-print-a4 https://astragraphia-rho.vercel.app/print`
   `chrome --user-data-dir=C:ag-print-label https://astragraphia-rho.vercel.app/print`
3. Tutup, jalankan ulang perintah yang sama + `--kiosk-printing` (cetak senyap ke printer profil itu).
   Jendela A4: centang *Auto-print A4*. Jendela label: centang *Auto-print labels*.
   Tombol manual *Print A4* / *Print Label* juga ikut printer profil jendelanya — cetak A4 dari jendela
   A4, label dari jendela label.

## AI (Higgsfield marketing-studio)

- Default hanya **Higgsfield `marketing-studio/image`** (satu-satunya yang berbayar). Kalau gagal,
  peserta dapat "versi kertas" dari sketsa (gratis). Cadangan bisa dinyalakan lagi lewat env:
  `AI_PROVIDERS=higgsfield,gemini` dan/atau `HF_MODELS=marketing-studio/image,ideogram/v4.0`.
- Tiap peserta maks. **2 gambar AI** (`MAX_ATTEMPTS` di `src/lib/config.ts`): generate pertama +
  1× *Buat ulang* atau *Gambar ulang*. Yang diblokir moderasi, gagal, atau jadi versi kertas tidak
  dihitung.
- **Higgsfield** (`HF_KEY` = `id:secret` dari open.higgsfield.ai): sketsa dikirim lewat URL
  publiknya, permintaan async di-poll sampai selesai, hasil disalin ke storage kita
  (Higgsfield hanya menyimpan output ≥ 7 hari). Batas tunggu 90 dtk (`HF_TIMEOUT_MS`; rata-rata
  ±48 dtk). Yang gagal/moderasi tidak ditagih; yang timeout saat antre dibatalkan.
- **Gemini** (cadangan, mati secara default): model dicoba berurutan (`GEMINI_IMAGE_MODEL`, dipisah koma). Default:
  `gemini-3.1-flash-image,gemini-3-pro-image`.
- **Model image Gemini tidak punya kuota gratis** — aktifkan billing di Google AI Studio.
  Tanpa billing, aplikasi tetap jalan dengan fallback "versi kertas" dari sketsa.
- Prompt + negative prompt per gaya: `src/lib/ai/prompt.ts`. Tiap gaya punya `variants` yang diacak per
  generate supaya wall tidak didominasi satu warna:
  - *Ilustrasi Digital Art* (id `fashion`): sapuan kuas gouache tebal + aksen tinta hitam di kertas putih;
    warna diacak: ungu/pink/merah, biru/coral, magenta/kuning, atau emerald/scarlet.
  - *Pop Art WPAP*: background geometris diacak biru (teal/cyan/navy), kuning, atau magenta.
- Uji cepat di luar app: `node --env-file-if-exists=.env.development.local scripts/ai-test.mjs [sketsa.png]`.
- Gambar yang ditolak filter keamanan tidak pernah tampil di wall; peserta diminta menggambar ulang.

## Environment variables

| Variabel | Fungsi |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (kosong di lokal → PGlite) |
| `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Neon Object Storage, bucket `gallery` (public) |
| `AI_PROVIDERS`, `AI_TOTAL_TIMEOUT_MS` | Urutan provider AI & batas waktu total |
| `HF_KEY`, `HF_MODELS`, `HF_QUALITY`, `HF_RESOLUTION`, `HF_IMAGE_WEIGHT`, `HF_TIMEOUT_MS` | AI image utama (Higgsfield) |
| `GEMINI_API_KEY`, `GEMINI_IMAGE_MODEL`, `GEMINI_IMAGE_SIZE` | AI image cadangan (Gemini) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email QR karya (kosong → tidak dikirim, hanya log) |
| `ADMIN_PASSWORD` | Akses `/admin` & `/print` |
| `KIOSK_KEY` | Kunci tablet untuk API kiosk |
| `APP_URL` | Opsional; domain publik untuk link & QR |

Lihat `.env.example`.

## Development

```bash
npm install
npx neon@latest checkout dev      # branch Neon dev → .env.local
npm run dev                       # http://localhost:3000
node scripts/seed-demo.mjs        # isi karya contoh ke branch dev
```

- Stack: Next.js 16, React 19, GSAP (SplitText), Three.js, perfect-freehand, Drizzle + Neon,
  Neon Object Storage, Gemini, Resend.
- Migrasi: `npm run db:generate` setelah ubah `src/lib/db/schema.ts`; migrasi otomatis jalan
  sebelum setiap `next build` (deploy Vercel).
- Booth 3D: muka backdrop = FA desainer (`design/booth-backdrop-FA-4000x2400mm.pdf`). Kalau FA
  direvisi, timpa PDF itu lalu `npm run booth:backdrop` → `public/booth/backdrop-fa.webp` (1 px = 1 mm).
- Deploy: `npm run deploy` (deploy salinan bersih HEAD tanpa metadata git — Vercel memblokir deploy CLI
  bila author commit bukan anggota tim `mbustanai`). Commit dulu perubahan sebelum deploy.
