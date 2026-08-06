# SIMPEL Hukum Brebes VPS — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memindahkan SIMPEL Hukum Brebes dari Google Apps Script ke aplikasi mandiri di VPS, dengan paritas fitur penuh terhadap `GAS_version/`.

**Architecture:** Express (Node 22, TypeScript) melayani `/api/*` di belakang Caddy, yang sekaligus menyajikan hasil `vite build` sebagai berkas statis dari satu origin. MariaDB lokal jadi sumber kebenaran. Berkas diunggah browser langsung ke Google Drive lewat sesi bertahap yang dibuat server, sehingga bytes tidak pernah melewati Express. Setiap perubahan dicerminkan ke Google Sheets supaya Bagian Hukum tetap punya spreadsheet untuk dibuka.

**Tech Stack:** Node 22 · TypeScript · Express 4 · `mysql2/promise` · MariaDB · React 19 · Vite · Tailwind 4 · React Router 7 · `bcryptjs` · `jsonwebtoken` · `exceljs` · Vitest · systemd · Caddy

## Global Constraints

Berlaku untuk **setiap** tugas. Persyaratan tiap tugas secara implisit mencakup bagian ini.

- **Kriteria penerimaan utama: paritas fitur dengan `GAS_version/`.** Tidak ada fitur yang boleh hilang. Rujukan perilaku adalah `GAS_version/Code.gs` dan `GAS_version/Index.html`.
- **Bahasa kode:** nama fungsi, variabel, komentar, dan kunci JSON dalam bahasa Indonesia, mengikuti `GAS_version/`.
- **TypeScript ketat.** `strict: true`. Tidak ada `any` implisit.
- **Batas memori:** proses server harus muat dalam `MemoryMax=200M`. VPS hanya punya 842 MB dan dibagi dengan `semar`, `combis-queue`, `php8.3-fpm`, `mariadb`, dan `caddy`.
- **Bytes berkas tidak boleh melewati Express.** Server hanya menerbitkan URL sesi unggah.
- **Tidak ada kredensial di repositori.** Semua lewat `.env` yang di-`.gitignore`. `.env.contoh` berisi nama kunci tanpa nilai.
- **Batas berkas 30 MB.** Divalidasi dua kali: sebelum unggah dan setelah berkas ada di Drive.
- **Palet warna** (persis dari desain): `--biru-utama #1B6FB8`, `--biru-tua #0F4C81`, `--biru-muda #E8F2FA`, `--latar #F5F8FB`, `--putih #FFFFFF`, `--teks-utama #1A2B3C`, `--teks-lemah #5A6B7C`, `--garis #DCE5EC`. Status: `PROSES #E8A317`, `SELESAI #2D9D5F`, `DIKEMBALIKAN #D64545`.
- **Mobile-first.** Tata letak satu kolom di layar sempit; tabel menggeser di dalam wadahnya, halaman tidak pernah menggeser mendatar.
- **Zona waktu `Asia/Jakarta`.** Tanggal disimpan `DATE`/`DATETIME`, ditampilkan `23 Juli 2026`.
- **Tahap riwayat** — daftar baku: `BERKAS_MASUK`, `REVIU_HUKUM`, `PRA_HARMONISASI`, `RAPAT_HARMONISASI`, `SELESAI_HARMONISASI`, `FASILITASI`, `HASIL_FASILITASI`, `DIKEMBALIKAN`, `PERBAIKAN`, `PENETAPAN`, `LAINNYA`.
- **Status pengajuan** — hanya `PROSES`, `SELESAI`, `DIKEMBALIKAN`.
- **Nomor pengajuan** `BRB-YYYY-NNNN`, urut per tahun, empat digit.
- **Uji:** `npm test` menjalankan Vitest. Setiap tugas harus hijau sebelum commit.
- **Commit:** satu commit per tugas, Conventional Commits berbahasa Inggris.

---

## Struktur Berkas

```
vps/
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.contoh
│   ├── sql/
│   │   ├── 001-skema.sql          # seluruh tabel
│   │   └── 002-seed.sql           # pengaturan awal
│   └── src/
│       ├── index.ts               # bootstrap Express
│       ├── konfig.ts              # baca & validasi env
│       ├── db.ts                  # pool mysql2 + helper transaksi
│       ├── murni/                 # fungsi murni, tanpa I/O  [dipindah dari GAS]
│       │   ├── skema.ts
│       │   ├── validasi.ts
│       │   ├── penomoran.ts
│       │   ├── parser-riwayat.ts
│       │   └── rekap.ts
│       ├── repo/
│       │   ├── pengajuan.ts
│       │   ├── riwayat.ts
│       │   ├── berkas.ts
│       │   ├── opd.ts
│       │   ├── admin.ts
│       │   ├── pengaturan.ts
│       │   └── log.ts
│       ├── layanan/
│       │   ├── google.ts          # token OAuth + pemanggil REST
│       │   ├── drive.ts
│       │   ├── sheets.ts
│       │   ├── cermin.ts
│       │   └── excel.ts
│       ├── tengah/                # middleware
│       │   ├── auth.ts
│       │   ├── rate-limit.ts
│       │   └── galat.ts
│       ├── rute/
│       │   ├── publik.ts          # monitoring, detail
│       │   ├── pengajuan.ts       # kirim
│       │   ├── unggah.ts          # izin, daftar, batal
│       │   ├── admin.ts
│       │   └── export.ts
│       └── perintah/
│           ├── migrasi-spreadsheet.ts
│           └── backup.ts
├── web/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                # router
│       ├── gaya.css               # variabel palet + Tailwind
│       ├── lib/
│       │   ├── api.ts             # pembungkus fetch
│       │   ├── unggah.ts          # unggah bertahap ke Drive
│       │   └── format.ts
│       ├── komponen/
│       │   ├── Kerangka.tsx
│       │   ├── LencanaStatus.tsx
│       │   ├── KotakHitungan.tsx
│       │   └── LiniMasa.tsx
│       └── halaman/
│           ├── Monitoring.tsx
│           ├── Detail.tsx
│           ├── Pengajuan.tsx
│           ├── Masuk.tsx
│           └── admin/
│               ├── Antrean.tsx
│               ├── Rekap.tsx
│               ├── Pengaturan.tsx
│               └── Log.tsx
└── deploy/
    ├── simpel.service
    ├── Caddyfile.contoh
    └── backup.sh
```

**Kenapa `murni/` dipisah.** Kelima berkas itu tidak menyentuh database, jaringan, atau waktu sistem. Mereka pindah dari `simple_go/src/*.gs` nyaris apa adanya berikut 90 ujinya, dan tetap bisa diuji tanpa MariaDB.

**Kenapa `repo/` dan `layanan/` dipisah dari `rute/`.** Rute hanya menerjemahkan HTTP ke pemanggilan fungsi. Semua SQL ada di `repo/`, semua panggilan Google ada di `layanan/`. Kalau nanti ada masalah kuota Drive atau query lambat, hanya satu folder yang perlu dibaca.

---

## Urutan Tugas

| # | Isi | Hasil yang bisa dilihat |
|---|---|---|
| 1 | Kerangka repo, konfig, tsconfig, Vitest | `npm test` jalan |
| 2 | Skema SQL, pool db, helper transaksi | Tabel terbentuk di MariaDB |
| 3 | Pindahkan 5 modul murni + 90 uji | Seluruh uji lama hijau di TypeScript |
| 4 | Auth admin: bcryptjs, JWT, middleware | Bisa masuk dan ditolak |
| 5 | Repo pengajuan/riwayat/berkas + penomoran transaksional | Nomor dijamin unik |
| 6 | Rute publik + kerangka React + halaman Monitoring | Monitoring tampil di browser |
| 7 | Halaman Detail + lini masa | Riwayat terbaca rapi |
| 8 | Google OAuth + layanan Drive | Berkas uji terunggah dari server |
| 9 | Unggah bertahap browser → Drive | Berkas 30 MB terbukti naik |
| 10 | Form pengajuan 4 langkah + rate limit + honeypot | Menggantikan Google Form |
| 11 | Admin: antrean, tambah riwayat, ubah status | Bagian Hukum berhenti mengetik di sel |
| 12 | Admin: rekap, OPD, kelola admin, pengaturan, log | Paritas dashboard tercapai |
| 13 | Migrasi dari spreadsheet + laporan | 29 baris hidup di MariaDB |
| 14 | Cermin ke Google Sheets + penanda tertunda | Spreadsheet selalu mutakhir |
| 15 | Export Excel + kirim ke Drive | Rekap bisa diunduh dan diarsipkan |
| 16 | Backup `mysqldump` → Drive | Data punya cadangan di luar VPS |
| 17 | systemd, Caddy, subdomain, panduan | Live di subdomain |

Tugas 9 sengaja mendahului form pengajuan: unggah berkas adalah bagian yang paling mungkin gagal, jadi dibuktikan lebih dulu sebelum banyak pekerjaan menumpuk di atasnya.

---

### Task 1: Kerangka repo, konfigurasi, dan penjalan uji

**Files:**
- Create: `vps/server/package.json`, `vps/server/tsconfig.json`, `vps/server/.env.contoh`
- Create: `vps/server/src/konfig.ts`
- Create: `vps/server/src/uji/konfig.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces:
  - `konfig` — objek beku `{ port, db: {host, port, user, password, database}, jwtSecret, google: {clientId, clientSecret, refreshToken}, driveFolderId, sheetsId, nodeEnv }`
  - `bacaKonfig(env: NodeJS.ProcessEnv) -> Konfig` — melempar `Error` yang menyebut **semua** kunci yang hilang sekaligus

- [ ] **Step 1: Buat `vps/server/package.json`**

```json
{
  "name": "simpel-server",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "exceljs": "^4.4.0",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.11.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Tanpa `dotenv`: Node 22 punya `--env-file` bawaan, dan systemd memuat `EnvironmentFile` sendiri.

- [ ] **Step 2: Buat `vps/server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Buat `vps/server/.env.contoh`**

```bash
PORT=3101

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=simpel
DB_PASSWORD=
DB_NAME=simpel

JWT_SECRET=

# OAuth akun Bagian Hukum. Jangan pakai Service Account: service account tidak
# punya kuota Drive sendiri dan unggahan ke Drive Gmail biasa akan gagal.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=

# Folder Drive tujuan berkas, dan spreadsheet yang dicerminkan
DRIVE_FOLDER_ID=
SHEETS_ID=
```

- [ ] **Step 4: Tulis uji yang gagal**

`vps/server/src/uji/konfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { bacaKonfig } from '../konfig.js';

const LENGKAP = {
  PORT: '3101',
  DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_USER: 'simpel',
  DB_PASSWORD: 'rahasia', DB_NAME: 'simpel',
  JWT_SECRET: 'x'.repeat(32),
  GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs', GOOGLE_REFRESH_TOKEN: 'rt',
  DRIVE_FOLDER_ID: 'folder', SHEETS_ID: 'sheet'
};

describe('bacaKonfig', () => {
  it('membaca seluruh nilai dengan tipe yang benar', () => {
    const k = bacaKonfig(LENGKAP);
    expect(k.port).toBe(3101);
    expect(k.db.port).toBe(3306);
    expect(k.db.host).toBe('127.0.0.1');
    expect(k.google.refreshToken).toBe('rt');
  });

  it('memakai port bawaan bila tidak diisi', () => {
    const { PORT, ...tanpaPort } = LENGKAP;
    expect(bacaKonfig(tanpaPort).port).toBe(3101);
  });

  it('menyebut SEMUA kunci yang hilang sekaligus, bukan satu per satu', () => {
    const { DB_HOST, JWT_SECRET, SHEETS_ID, ...kurang } = LENGKAP;
    expect(() => bacaKonfig(kurang)).toThrow(/DB_HOST.*JWT_SECRET.*SHEETS_ID/s);
  });

  it('menolak JWT_SECRET yang terlalu pendek', () => {
    expect(() => bacaKonfig({ ...LENGKAP, JWT_SECRET: 'pendek' }))
      .toThrow(/JWT_SECRET.*32/);
  });

  it('hasilnya beku supaya tidak bisa diubah saat berjalan', () => {
    const k = bacaKonfig(LENGKAP);
    expect(Object.isFrozen(k)).toBe(true);
  });
});
```

- [ ] **Step 5: Jalankan uji untuk memastikan gagal**

Run: `cd vps/server && npm install && npm test`
Expected: FAIL — `Cannot find module '../konfig.js'`

- [ ] **Step 6: Tulis `vps/server/src/konfig.ts`**

```ts
/**
 * konfig.ts - membaca dan memvalidasi environment sekali di awal.
 *
 * Semua kunci yang hilang dilaporkan sekaligus. Melaporkannya satu per satu
 * memaksa orang menjalankan ulang berkali-kali hanya untuk menemukan bahwa
 * ada lima yang belum diisi.
 */

export interface Konfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly db: {
    readonly host: string; readonly port: number; readonly user: string;
    readonly password: string; readonly database: string;
  };
  readonly jwtSecret: string;
  readonly google: {
    readonly clientId: string; readonly clientSecret: string; readonly refreshToken: string;
  };
  readonly driveFolderId: string;
  readonly sheetsId: string;
}

const WAJIB = [
  'DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN',
  'DRIVE_FOLDER_ID', 'SHEETS_ID'
] as const;

export function bacaKonfig(env: NodeJS.ProcessEnv): Konfig {
  const hilang = WAJIB.filter((k) => !env[k]);
  if (hilang.length) {
    throw new Error(
      'Environment belum lengkap. Kunci yang hilang: ' + hilang.join(', ') +
      '. Salin .env.contoh jadi .env lalu isi.'
    );
  }

  const rahasia = env.JWT_SECRET!;
  if (rahasia.length < 32) {
    throw new Error('JWT_SECRET terlalu pendek: minimal 32 karakter.');
  }

  return Object.freeze({
    port: Number(env.PORT ?? 3101),
    nodeEnv: env.NODE_ENV ?? 'development',
    db: Object.freeze({
      host: env.DB_HOST!,
      port: Number(env.DB_PORT ?? 3306),
      user: env.DB_USER!,
      password: env.DB_PASSWORD ?? '',
      database: env.DB_NAME!
    }),
    jwtSecret: rahasia,
    google: Object.freeze({
      clientId: env.GOOGLE_CLIENT_ID!,
      clientSecret: env.GOOGLE_CLIENT_SECRET!,
      refreshToken: env.GOOGLE_REFRESH_TOKEN!
    }),
    driveFolderId: env.DRIVE_FOLDER_ID!,
    sheetsId: env.SHEETS_ID!
  });
}
```

- [ ] **Step 7: Jalankan uji untuk memastikan lulus**

Run: `npm test`
Expected: PASS — 5 uji lulus

- [ ] **Step 8: Commit**

```bash
git add vps/server
git commit -m "chore: server scaffold with validated environment config"
```

---

### Task 2: Skema SQL, pool database, dan helper transaksi

**Files:**
- Create: `vps/server/sql/001-skema.sql`, `vps/server/sql/002-seed.sql`
- Create: `vps/server/src/db.ts`
- Create: `vps/server/src/uji/db.test.ts`

**Interfaces:**
- Consumes: `bacaKonfig` (Task 1)
- Produces:
  - `pool` — `mysql2` connection pool
  - `kueri<T>(sql: string, nilai?: unknown[]) -> Promise<T[]>`
  - `satu<T>(sql: string, nilai?: unknown[]) -> Promise<T | null>`
  - `transaksi<T>(fn: (conn: PoolConnection) => Promise<T>) -> Promise<T>` — commit otomatis, rollback bila melempar
  - `siapkanSkema() -> Promise<void>` — jalankan `sql/*.sql` berurut, idempoten

- [ ] **Step 1: Tulis `vps/server/sql/001-skema.sql`**

```sql
-- Seluruh tabel SIMPEL. Idempoten: aman dijalankan berulang.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS opd (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  kode         VARCHAR(32)  NOT NULL UNIQUE,
  nama_resmi   VARCHAR(255) NOT NULL,
  nama_singkat VARCHAR(64)  NOT NULL DEFAULT '',
  aktif        TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pengajuan (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  -- UNIQUE inilah yang membuat nomor kembar mustahil, bukan kunci buatan sendiri
  nomor            VARCHAR(20)  NOT NULL UNIQUE,
  opd_id           INT          NULL,
  opd_teks         VARCHAR(255) NOT NULL DEFAULT '',
  jenis_peraturan  ENUM('Daerah','Bupati') NOT NULL,
  judul            TEXT         NOT NULL,
  nama_pemohon     VARCHAR(255) NOT NULL,
  wa_pemohon       VARCHAR(20)  NOT NULL,
  email_pemohon    VARCHAR(255) NOT NULL DEFAULT '',
  status           ENUM('PROSES','SELESAI','DIKEMBALIKAN') NOT NULL DEFAULT 'PROSES',
  keterangan       TEXT         NOT NULL,
  dibuat_pada      DATETIME     NOT NULL,
  diperbarui_pada  DATETIME     NOT NULL,
  diperbarui_oleh  VARCHAR(255) NOT NULL DEFAULT '',
  sinkron_tertunda TINYINT(1)   NOT NULL DEFAULT 1,
  CONSTRAINT fk_pengajuan_opd FOREIGN KEY (opd_id) REFERENCES opd(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_dibuat (dibuat_pada),
  INDEX idx_sinkron (sinkron_tertunda)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS berkas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  pengajuan_id  INT          NOT NULL,
  kolom         VARCHAR(40)  NOT NULL,
  nama          VARCHAR(512) NOT NULL,
  ukuran        BIGINT       NOT NULL,
  mime          VARCHAR(128) NOT NULL DEFAULT '',
  drive_file_id VARCHAR(128) NOT NULL,
  url           TEXT         NOT NULL,
  diunggah_pada DATETIME     NOT NULL,
  CONSTRAINT fk_berkas_pengajuan FOREIGN KEY (pengajuan_id) REFERENCES pengajuan(id) ON DELETE CASCADE,
  INDEX idx_berkas_pengajuan (pengajuan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS riwayat (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  pengajuan_id INT         NOT NULL,
  tanggal      DATE        NOT NULL,
  tahap        VARCHAR(32) NOT NULL,
  keterangan   TEXT        NOT NULL,
  dicatat_oleh VARCHAR(255) NOT NULL DEFAULT '',
  dicatat_pada DATETIME    NOT NULL,
  CONSTRAINT fk_riwayat_pengajuan FOREIGN KEY (pengajuan_id) REFERENCES pengajuan(id) ON DELETE CASCADE,
  INDEX idx_riwayat_pengajuan (pengajuan_id, tanggal, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  nama          VARCHAR(255) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  aktif         TINYINT(1)   NOT NULL DEFAULT 1,
  dibuat_pada   DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pengaturan (
  kunci      VARCHAR(64) PRIMARY KEY,
  nilai      TEXT NOT NULL,
  keterangan VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  waktu        DATETIME     NOT NULL,
  aktor        VARCHAR(255) NOT NULL DEFAULT '',
  aksi         VARCHAR(64)  NOT NULL,
  pengajuan_id INT          NULL,
  rincian      TEXT         NOT NULL,
  ip           VARCHAR(64)  NOT NULL DEFAULT '',
  INDEX idx_log_waktu (waktu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`opd_teks` disimpan berdampingan dengan `opd_id` supaya nama yang diketik pemohon saat daftar OPD belum lengkap tidak hilang.

- [ ] **Step 2: Tulis `vps/server/sql/002-seed.sql`**

```sql
-- Nilai awal pengaturan. INSERT IGNORE supaya tidak menimpa yang sudah diubah.
INSERT IGNORE INTO pengaturan (kunci, nilai, keterangan) VALUES
  ('publik_tampilkan_wa','TRUE','FALSE membuat nomor WA tampil tersamar bagi bukan admin'),
  ('publik_tampilkan_berkas','TRUE','FALSE menyembunyikan tautan berkas dari pengunjung umum'),
  ('batas_surat_permohonan','5','MB - Surat Permohonan'),
  ('batas_keterangan_na','5','MB - Keterangan/Penjelasan atau NA Perda'),
  ('batas_rancangan','10','MB - Rancangan Perda/Perbup'),
  ('batas_lampiran','30','MB - Lampiran Raperda/Raperbup (maksimal 30)'),
  ('batas_paraf','5','MB - Paraf Koordinasi'),
  ('batas_dasar_hukum','5','MB - Dasar Hukum Penyusunan'),
  ('batas_sk_tim','5','MB - SK Tim Penyusunan RAPERDA'),
  ('batas_ba_pansus','5','MB - Berita Acara Rapat PANSUS AKHIR'),
  ('batas_hasil_konsultasi','30','MB - Hasil Konsultasi (maksimal 30)'),
  ('maks_berkas_ba_pansus','5','Jumlah berkas maksimal untuk Berita Acara PANSUS'),
  ('pengumuman','','Teks pengumuman di halaman depan; kosongkan bila tidak ada'),
  ('ambang_mandek_hari','7','Pengajuan PROSES yang tidak bergerak sekian hari diberi tanda');
```

Berbeda dengan versi Apps Script, `nomor_terakhir` **tidak ada** — nomor sekarang diterbitkan dari tabel `pengajuan` di dalam transaksi, jadi menyimpannya terpisah justru menciptakan sumber kebenaran kedua yang bisa bertentangan.

- [ ] **Step 3: Tulis uji yang gagal**

`vps/server/src/uji/db.test.ts` — butuh MariaDB berjalan dan database `simpel_uji`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, kueri, satu, transaksi, siapkanSkema } from '../db.js';

beforeAll(async () => { await siapkanSkema(); });
afterAll(async () => { await pool.end(); });

describe('lapisan database', () => {
  it('siapkanSkema membuat seluruh tabel dan aman diulang', async () => {
    await siapkanSkema();
    const tabel = await kueri<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE()`
    );
    const nama = tabel.map((t) => t.TABLE_NAME.toLowerCase());
    for (const t of ['opd', 'pengajuan', 'berkas', 'riwayat', 'admin', 'pengaturan', 'log']) {
      expect(nama).toContain(t);
    }
  });

  it('seed mengisi pengaturan dengan batas 30 MB', async () => {
    const baris = await satu<{ nilai: string }>(
      `SELECT nilai FROM pengaturan WHERE kunci = 'batas_lampiran'`
    );
    expect(baris?.nilai).toBe('30');
  });

  it('satu mengembalikan null bila tidak ada baris', async () => {
    expect(await satu(`SELECT 1 AS x FROM pengaturan WHERE kunci = 'tidak-ada'`)).toBeNull();
  });

  it('transaksi melakukan rollback saat callback melempar', async () => {
    await kueri(`DELETE FROM opd WHERE kode = 'UJI-RB'`);
    await expect(transaksi(async (conn) => {
      await conn.query(`INSERT INTO opd (kode, nama_resmi) VALUES ('UJI-RB','Uji Rollback')`);
      throw new Error('sengaja gagal');
    })).rejects.toThrow('sengaja gagal');

    const sisa = await satu(`SELECT id FROM opd WHERE kode = 'UJI-RB'`);
    expect(sisa).toBeNull();
  });

  it('transaksi melakukan commit saat callback selesai', async () => {
    await kueri(`DELETE FROM opd WHERE kode = 'UJI-CM'`);
    await transaksi(async (conn) => {
      await conn.query(`INSERT INTO opd (kode, nama_resmi) VALUES ('UJI-CM','Uji Commit')`);
    });
    const ada = await satu<{ id: number }>(`SELECT id FROM opd WHERE kode = 'UJI-CM'`);
    expect(ada).not.toBeNull();
    await kueri(`DELETE FROM opd WHERE kode = 'UJI-CM'`);
  });

  it('constraint UNIQUE menolak nomor pengajuan kembar', async () => {
    await kueri(`DELETE FROM pengajuan WHERE nomor = 'BRB-1999-0001'`);
    const sisip = () => kueri(
      `INSERT INTO pengajuan (nomor, jenis_peraturan, judul, nama_pemohon, wa_pemohon,
        keterangan, dibuat_pada, diperbarui_pada)
       VALUES ('BRB-1999-0001','Bupati','Uji','Uji','08120000000','',NOW(),NOW())`
    );
    await sisip();
    await expect(sisip()).rejects.toThrow(/Duplicate|ER_DUP_ENTRY/i);
    await kueri(`DELETE FROM pengajuan WHERE nomor = 'BRB-1999-0001'`);
  });
});
```

- [ ] **Step 4: Siapkan database uji**

```bash
sudo mariadb -e "CREATE DATABASE IF NOT EXISTS simpel_uji CHARACTER SET utf8mb4;"
sudo mariadb -e "CREATE DATABASE IF NOT EXISTS simpel CHARACTER SET utf8mb4;"
sudo mariadb -e "CREATE USER IF NOT EXISTS 'simpel'@'localhost' IDENTIFIED BY 'GANTI_SANDI';"
sudo mariadb -e "GRANT ALL ON simpel.* TO 'simpel'@'localhost';"
sudo mariadb -e "GRANT ALL ON simpel_uji.* TO 'simpel'@'localhost';"
sudo mariadb -e "FLUSH PRIVILEGES;"
```

Buat `vps/server/.env.test` berisi kredensial yang sama tapi `DB_NAME=simpel_uji`, lalu tambahkan ke `vps/server/package.json`:

```json
"test": "vitest run --env-file=.env.test"
```

`.env.test` juga masuk `.gitignore` lewat pola `.env.*`.

- [ ] **Step 5: Jalankan uji untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `Cannot find module '../db.js'`

- [ ] **Step 6: Tulis `vps/server/src/db.ts`**

```ts
/**
 * db.ts - pool MariaDB dan helper transaksi.
 *
 * Semua SQL di aplikasi ini lewat sini. connectionLimit sengaja kecil: VPS
 * hanya punya 842 MB dan dibagi dengan tiga aplikasi lain, sementara beban
 * nyata sistem ini sekitar 10 pengajuan per bulan.
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql, { type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { bacaKonfig } from './konfig.js';

const konfig = bacaKonfig(process.env);
const DIR = path.dirname(fileURLToPath(import.meta.url));

export const pool = mysql.createPool({
  host: konfig.db.host,
  port: konfig.db.port,
  user: konfig.db.user,
  password: konfig.db.password,
  database: konfig.db.database,
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4_general_ci',
  timezone: '+07:00',
  multipleStatements: false
});

export async function kueri<T>(sql: string, nilai: unknown[] = []): Promise<T[]> {
  const [baris] = await pool.query<RowDataPacket[]>(sql, nilai);
  return baris as T[];
}

export async function satu<T>(sql: string, nilai: unknown[] = []): Promise<T | null> {
  const baris = await kueri<T>(sql, nilai);
  return baris.length ? baris[0]! : null;
}

/**
 * Jalankan fn di dalam transaksi. Commit bila selesai, rollback bila melempar.
 * Koneksi selalu dikembalikan ke pool, termasuk saat galat.
 */
export async function transaksi<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const hasil = await fn(conn);
    await conn.commit();
    return hasil;
  } catch (galat) {
    try { await conn.rollback(); } catch { /* koneksi mungkin sudah putus */ }
    throw galat;
  } finally {
    conn.release();
  }
}

/**
 * Jalankan seluruh berkas sql/*.sql berurut menurut nama.
 * Setiap berkas ditulis idempoten (CREATE TABLE IF NOT EXISTS / INSERT IGNORE),
 * jadi aman dijalankan tiap kali server naik.
 */
export async function siapkanSkema(): Promise<void> {
  const dirSql = path.join(DIR, '..', 'sql');
  const berkas = (await readdir(dirSql)).filter((n) => n.endsWith('.sql')).sort();

  for (const nama of berkas) {
    const isi = await readFile(path.join(dirSql, nama), 'utf8');
    // multipleStatements dimatikan demi keamanan, jadi dipecah manual.
    const pernyataan = isi
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--'));
    for (const p of pernyataan) await pool.query(p);
  }
}
```

- [ ] **Step 7: Jalankan uji untuk memastikan lulus**

Run: `npm test`
Expected: PASS — 6 uji lulus, termasuk uji yang membuktikan nomor kembar ditolak database

- [ ] **Step 8: Commit**

```bash
git add vps/server/sql vps/server/src/db.ts vps/server/src/uji/db.test.ts vps/server/package.json
git commit -m "feat: database schema, pool, and transaction helper"
```

---

### Task 3: Pindahkan lima modul murni beserta 90 ujinya

Kelima modul ini sudah selesai, sudah lulus 90 uji, dan tidak menyentuh I/O apa pun. Yang dikerjakan di sini adalah pemindahan mekanis dari JavaScript Apps Script ke TypeScript — bukan penulisan ulang.

**Sumber:** `simple_go/src/{Skema,Validasi,Penomoran,ParserRiwayat,Rekap}.gs`
**Uji sumber:** `simple_go/tests/{skema,validasi,penomoran,parser-riwayat,rekap}.test.js`

> Perhatian: pakai `GAS_version/Code.gs` sebagai rujukan untuk `Skema`, bukan `simple_go/src/Skema.gs`. Versi GAS sudah dikoreksi agar cocok dengan header spreadsheet asli (`Keterangan/Penjelasan **Rancangan** Perbup atau NA Perda` dan `Dasar Hukum Penyusunan **Raperda/Raperbup**`) berikut dukungan alias. Versi di `simple_go/` masih memakai ejaan dokumen desain yang ternyata keliru.

**Files:**
- Create: `vps/server/src/murni/{skema,validasi,penomoran,parser-riwayat,rekap}.ts`
- Create: `vps/server/src/uji/murni/{skema,validasi,penomoran,parser-riwayat,rekap}.test.ts`

**Interfaces:**
- Consumes: tidak ada — seluruhnya fungsi murni
- Produces:

```ts
// skema.ts
export interface KolomForm {
  kunci: string; judul: string;
  jenis: 'waktu' | 'teks' | 'pilihan' | 'berkas' | 'wa';
  wajib?: boolean; hanyaPerda?: boolean; alias?: string[];
}
export const KOLOM_FORM: readonly KolomForm[];
export const TAHAP_RIWAYAT: readonly string[];
export const STATUS_PENGAJUAN: readonly ['PROSES','SELESAI','DIKEMBALIKAN'];
export type Tahap = (typeof TAHAP_RIWAYAT)[number];
export type Status = (typeof STATUS_PENGAJUAN)[number];
export function normalisasiHeader(teks: unknown): string;
export function judulKolom(kunci: string): string;
export function cocokkanHeader(barisHeader: unknown[]): {
  jenis: 'KOSONG' | 'SIMPEL' | 'FORM' | 'ASING';
  peta: Record<string, number>; dikenali: number;
  hilang: string[]; asing: string[];
};

// validasi.ts
export interface AturanBerkas { kunciBatas: string; ekstensi: string[]; kunciMaksBerkas?: string }
export const ATURAN_BERKAS: Record<string, AturanBerkas>;
export function ekstensiDari(nama: string): string;
export function normalisasiWa(teks: unknown): string | null;
export function formatWa(nomor: string): string;
export function samarkanWa(nomor: string): string;
export function validasiBerkas(
  berkas: { kolom: string; nama: string; ukuran: number },
  pengaturan: Record<string, string>
): { sah: boolean; pesan: string };
export function validasiPengajuan(
  data: { jenis_peraturan?: string; opd?: string; judul?: string; nama_pemohon?: string;
          wa_pemohon?: string; berkas?: Record<string, { nama: string; ukuran: number }[]> },
  pengaturan: Record<string, string>
): { sah: boolean; galat: { kolom: string; pesan: string }[] };

// penomoran.ts
export function uraiNomor(kode: unknown): { prefiks: string; tahun: number; urut: number } | null;
export function nomorBerikutnya(tahun: number, nomorTerakhir: string | null): string;
export function nomorTerbesar(daftarKode: (string | null)[]): string;

// parser-riwayat.ts
export interface BarisRiwayat { tanggal: string; tahap: string; keterangan: string; mentah: string }
export function uraiTanggalIndonesia(teks: unknown, tahunBawaan: number): { iso: string; sisa: string } | null;
export function formatTanggalIndonesia(iso: unknown): string;
export function tebakTahap(keterangan: unknown): string;
export function uraiKolomProses(teks: unknown, tahunBawaan: number): BarisRiwayat[];
export function susunKolomProses(daftar: { tanggal: string; keterangan: string }[]): string;

// rekap.ts
export function rekapPerStatus(daftar: { status?: string }[]):
  { TOTAL: number; PROSES: number; SELESAI: number; DIKEMBALIKAN: number };
export function rekapPerOpd(daftar: { opd?: string }[]): { opd: string; jumlah: number }[];
export function rekapPerBulan(daftar: { masuk?: string }[]): { bulan: string; jumlah: number }[];
export function selisihHari(isoAwal: unknown, isoAkhir: unknown): number | null;
export function rataLamaProsesHari(daftar: { status?: string; masuk?: string; diperbarui?: string }[]): number | null;
export function cariMandek(daftar: { id: string; status?: string; diperbarui?: string }[],
                           ambangHari: number, isoHariIni: string): string[];
export function keCsv(daftar: Record<string, unknown>[], kolom: { kunci: string; judul: string }[]): string;
```

- [ ] **Step 1: Pindahkan berkas uji lebih dulu**

Salin kelima berkas uji dari `simple_go/tests/` ke `vps/server/src/uji/murni/`, lalu ubah tiga hal di tiap berkas:

1. Ganti header CommonJS:
   ```js
   const test = require('node:test');
   const assert = require('node:assert');
   const { muat } = require('./harness');
   ```
   jadi:
   ```ts
   import { describe, it, expect } from 'vitest';
   import * as skema from '../../murni/skema.js';
   ```
2. Ganti `muat('Skema.gs', 'Validasi.gs')` jadi import langsung modulnya.
3. Terjemahkan asersi:
   | node:assert | Vitest |
   |---|---|
   | `assert.strictEqual(a, b)` | `expect(a).toBe(b)` |
   | `assert.deepStrictEqual(a, b)` | `expect(a).toEqual(b)` |
   | `assert.ok(x)` | `expect(x).toBeTruthy()` |
   | `assert.match(s, /re/)` | `expect(s).toMatch(/re/)` |

Bungkus tiap berkas dengan `describe('<nama modul>', () => { ... })` dan ubah `test('...', () => {})` jadi `it('...', () => {})`.

**Jangan mengubah satu pun asersi atau data ujinya.** Uji-uji ini yang membuktikan riwayat 29 pengajuan tidak berubah bentuk; mengubahnya berarti kehilangan jaminan itu.

Berkas `simple_go/tests/harness.js` **tidak ikut dipindahkan** — ia hanya dibutuhkan untuk memuat `.gs`, dan TypeScript mengimpor modul secara langsung.

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `Cannot find module '../../murni/skema.js'` untuk kelima modul

- [ ] **Step 3: Pindahkan kelima modul sumber**

Untuk tiap berkas, terapkan konversi berikut dan **tidak ada perubahan logika apa pun**:

| Apps Script | TypeScript |
|---|---|
| `var NAMA = [...]` di tingkat atas | `export const NAMA = [...] as const` bila daftar baku, atau bertipe eksplisit |
| `function f(a) {` | `export function f(a: Tipe): Kembalian {` |
| Objek literal tanpa tipe | Beri `interface` sesuai blok Interfaces di atas |
| Akses indeks array | Tambahkan penjagaan `?? ''` karena `noUncheckedIndexedAccess` menyala |

Ambil isi `Skema` dari `GAS_version/Code.gs` bagian `// Skema.gs` (memuat koreksi header dan dukungan `alias`), sedangkan `Validasi`, `Penomoran`, `ParserRiwayat`, dan `Rekap` boleh dari `simple_go/src/` karena keempatnya identik di kedua versi.

Satu penyesuaian yang **wajib** pada `skema.ts` — `cocokkanHeader` harus mencocokkan judul beserta aliasnya:

```ts
for (const kol of semua) {
  const target = [kol.judul, ...(kol.alias ?? [])].map(normalisasiHeader);
  for (let j = 0; j < header.length; j++) {
    if (terpakai.has(j)) continue;
    if (target.includes(header[j] ?? '')) {
      peta[kol.kunci] = j;
      terpakai.add(j);
      break;
    }
  }
}
```

- [ ] **Step 4: Jalankan uji untuk memastikan lulus**

Run: `npm test`
Expected: PASS — seluruh uji lama hijau, termasuk uji perjalanan bolak-balik kolom 16

- [ ] **Step 5: Tambahkan uji header spreadsheet asli**

`vps/server/src/uji/murni/skema.test.ts`, di bawah uji yang dipindahkan:

```ts
// Header ini disalin persis dari spreadsheet PERMOHONAN RAPERDA/RAPERBUP
// pada 4 Agustus 2026, termasuk empat kolom kosong sisa rekap manual lama.
const HEADER_ASLI = [
  'Timestamp', 'Nama OPD Pemohon', 'Jenis Rancangan Peraturan', 'Judul Raperda/Raperbup',
  'Surat Permohonan Rancangan Perda/Perbup',
  'Keterangan/Penjelasan Rancangan Perbup atau NA Perda',
  'Rancangan Perda/Perbup', 'Lampiran Raperda/Raperbup', 'Paraf Koordinasi',
  'Dasar Hukum Penyusunan Raperda/Raperbup', 'SK Tim Penyusunan RAPERDA',
  'Berita Acara Rapat PANSUS AKHIR', 'Hasil Konsultasi', 'Nama Pemohon',
  'Nomor WhatsApp Pemohon', 'Tanggal dan Detail Proses', 'Keterangan', 'Status',
  '', '', '', ''
];

it('mengenali header spreadsheet Linktree yang sungguhan', () => {
  const hasil = cocokkanHeader(HEADER_ASLI);
  expect(hasil.jenis).toBe('FORM');
  expect(hasil.hilang).toEqual([]);
  expect(hasil.asing).toEqual([]);
  expect(hasil.peta.keterangan_na).toBe(5);
  expect(hasil.peta.dasar_hukum).toBe(9);
});

it('tetap menerima ejaan versi dokumen desain lewat alias', () => {
  const varian = [...HEADER_ASLI];
  varian[5] = 'Keterangan/Penjelasan Raperbup atau NA Perda';
  varian[9] = 'Dasar Hukum Penyusunan';
  expect(cocokkanHeader(varian).hilang).toEqual([]);
});
```

- [ ] **Step 6: Jalankan uji dan commit**

Run: `npm test`
Expected: PASS

```bash
git add vps/server/src/murni vps/server/src/uji/murni
git commit -m "feat: port pure validation, numbering, timeline, and recap modules to TypeScript"
```

---

### Task 4: Auth admin — bcryptjs, JWT, dan middleware

**Files:**
- Create: `vps/server/src/repo/admin.ts`, `vps/server/src/tengah/auth.ts`, `vps/server/src/rute/auth.ts`
- Create: `vps/server/src/uji/auth.test.ts`

**Interfaces:**
- Consumes: `kueri`, `satu` (Task 2); `konfig.jwtSecret` (Task 1)
- Produces:
  - `adminCari(email: string) -> Promise<Admin | null>` dengan `Admin = { id, email, nama, password_hash, aktif }`
  - `adminBuat(email, nama, sandi) -> Promise<number>` — mengembalikan id
  - `adminDaftar() -> Promise<Omit<Admin,'password_hash'>[]>`
  - `adminNonaktifkan(id: number) -> Promise<void>`
  - `adminGantiSandi(id: number, sandiBaru: string) -> Promise<void>`
  - `adminHitungAktif() -> Promise<number>`
  - `buatToken(admin: {id, email}) -> string`
  - `periksaToken(token: string) -> { id: number; email: string } | null`
  - `wajibAdmin` — middleware Express; membalas 401 bila tidak sah
  - Rute: `POST /api/auth/masuk`, `POST /api/auth/keluar`, `GET /api/auth/saya`

- [ ] **Step 1: Tulis uji yang gagal**

`vps/server/src/uji/auth.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, kueri, siapkanSkema } from '../db.js';
import { adminBuat, adminCari, adminDaftar, adminNonaktifkan, adminHitungAktif } from '../repo/admin.js';
import { buatToken, periksaToken } from '../tengah/auth.js';
import bcrypt from 'bcryptjs';

beforeAll(async () => {
  await siapkanSkema();
  await kueri(`DELETE FROM admin WHERE email LIKE '%@uji.local'`);
});
afterAll(async () => {
  await kueri(`DELETE FROM admin WHERE email LIKE '%@uji.local'`);
  await pool.end();
});

describe('repo admin', () => {
  it('menyimpan sandi sebagai hash, tidak pernah apa adanya', async () => {
    await adminBuat('a@uji.local', 'Admin A', 'sandi-rahasia-123');
    const a = await adminCari('a@uji.local');
    expect(a).not.toBeNull();
    expect(a!.password_hash).not.toBe('sandi-rahasia-123');
    expect(await bcrypt.compare('sandi-rahasia-123', a!.password_hash)).toBe(true);
  });

  it('email disimpan huruf kecil supaya pencarian tidak meleset', async () => {
    await adminBuat('B@UJI.LOCAL', 'Admin B', 'sandi-lain-456');
    expect(await adminCari('b@uji.local')).not.toBeNull();
    expect(await adminCari('B@Uji.Local')).not.toBeNull();
  });

  it('menolak email kembar', async () => {
    await expect(adminBuat('a@uji.local', 'Duplikat', 'sandi-lain-789')).rejects.toThrow();
  });

  it('menolak sandi yang terlalu pendek', async () => {
    await expect(adminBuat('c@uji.local', 'Admin C', 'pendek')).rejects.toThrow(/8/);
  });

  it('adminDaftar tidak pernah membocorkan hash', async () => {
    const daftar = await adminDaftar();
    expect(daftar.length).toBeGreaterThan(0);
    for (const a of daftar) expect(a).not.toHaveProperty('password_hash');
  });

  it('menonaktifkan admin mengeluarkannya dari hitungan aktif', async () => {
    const sebelum = await adminHitungAktif();
    const a = await adminCari('b@uji.local');
    await adminNonaktifkan(a!.id);
    expect(await adminHitungAktif()).toBe(sebelum - 1);
  });
});

describe('token', () => {
  it('token yang sah bisa dibaca kembali', () => {
    const t = buatToken({ id: 7, email: 'x@uji.local' });
    expect(periksaToken(t)).toEqual({ id: 7, email: 'x@uji.local' });
  });

  it('token yang diutak-atik ditolak', () => {
    const t = buatToken({ id: 7, email: 'x@uji.local' });
    expect(periksaToken(t.slice(0, -3) + 'aaa')).toBeNull();
  });

  it('token karangan ditolak', () => {
    expect(periksaToken('bukan.token.sama.sekali')).toBeNull();
    expect(periksaToken('')).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `Cannot find module '../repo/admin.js'`

- [ ] **Step 3: Tulis `vps/server/src/repo/admin.ts`**

```ts
import bcrypt from 'bcryptjs';
import { kueri, satu } from '../db.js';

export interface Admin {
  id: number; email: string; nama: string;
  password_hash: string; aktif: number;
}
export type AdminPublik = Omit<Admin, 'password_hash'>;

const PUTARAN = 10;
const PANJANG_SANDI_MIN = 8;

function bakukanEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export async function adminCari(email: string): Promise<Admin | null> {
  return satu<Admin>(
    `SELECT id, email, nama, password_hash, aktif FROM admin WHERE email = ? AND aktif = 1`,
    [bakukanEmail(email)]
  );
}

export async function adminBuat(email: string, nama: string, sandi: string): Promise<number> {
  const bersih = bakukanEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(bersih)) throw new Error('Alamat email tidak sah.');
  if (String(sandi).length < PANJANG_SANDI_MIN) {
    throw new Error(`Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`);
  }
  const hash = await bcrypt.hash(sandi, PUTARAN);
  const [hasil] = await kueri<{ insertId: number }>(
    `INSERT INTO admin (email, nama, password_hash, aktif, dibuat_pada)
     VALUES (?, ?, ?, 1, NOW())`,
    [bersih, nama ?? '', hash]
  ) as unknown as [{ insertId: number }];
  return hasil.insertId;
}

export async function adminDaftar(): Promise<AdminPublik[]> {
  // password_hash sengaja tidak ikut SELECT: hash tidak punya alasan meninggalkan
  // lapisan ini, sekalipun cuma menuju dashboard.
  return kueri<AdminPublik>(
    `SELECT id, email, nama, aktif FROM admin WHERE aktif = 1 ORDER BY email`
  );
}

export async function adminNonaktifkan(id: number): Promise<void> {
  await kueri(`UPDATE admin SET aktif = 0 WHERE id = ?`, [id]);
}

export async function adminGantiSandi(id: number, sandiBaru: string): Promise<void> {
  if (String(sandiBaru).length < PANJANG_SANDI_MIN) {
    throw new Error(`Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`);
  }
  await kueri(`UPDATE admin SET password_hash = ? WHERE id = ?`,
    [await bcrypt.hash(sandiBaru, PUTARAN), id]);
}

export async function adminHitungAktif(): Promise<number> {
  const b = await satu<{ n: number }>(`SELECT COUNT(*) AS n FROM admin WHERE aktif = 1`);
  return Number(b?.n ?? 0);
}

export async function adminPeriksaSandi(email: string, sandi: string): Promise<Admin | null> {
  const a = await adminCari(email);
  // bcrypt.compare tetap dijalankan pada hash palsu saat admin tidak ditemukan,
  // supaya lama jawaban tidak membocorkan email mana yang terdaftar.
  const hash = a?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidooo';
  const cocok = await bcrypt.compare(sandi, hash);
  return a && cocok ? a : null;
}
```

- [ ] **Step 4: Tulis `vps/server/src/tengah/auth.ts`**

```ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { bacaKonfig } from '../konfig.js';

const konfig = bacaKonfig(process.env);
const NAMA_COOKIE = 'simpel_sesi';
const UMUR_JAM = 12;

export interface Sesi { id: number; email: string }

export function buatToken(admin: { id: number; email: string }): string {
  return jwt.sign({ id: admin.id, email: admin.email }, konfig.jwtSecret, {
    expiresIn: `${UMUR_JAM}h`
  });
}

export function periksaToken(token: string): Sesi | null {
  try {
    const isi = jwt.verify(token, konfig.jwtSecret) as jwt.JwtPayload;
    if (typeof isi.id !== 'number' || typeof isi.email !== 'string') return null;
    return { id: isi.id, email: isi.email };
  } catch {
    return null;
  }
}

export function pasangCookie(res: Response, token: string): void {
  res.cookie(NAMA_COOKIE, token, {
    httpOnly: true,                              // tidak terbaca JavaScript
    sameSite: 'strict',                          // tidak ikut terkirim dari situs lain
    secure: konfig.nodeEnv === 'production',     // hanya lewat HTTPS
    maxAge: UMUR_JAM * 60 * 60 * 1000,
    path: '/'
  });
}

export function hapusCookie(res: Response): void {
  res.clearCookie(NAMA_COOKIE, { path: '/' });
}

export function bacaSesi(req: Request): Sesi | null {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[NAMA_COOKIE];
  return token ? periksaToken(token) : null;
}

/** Middleware: hentikan permintaan yang bukan dari admin. */
export function wajibAdmin(req: Request, res: Response, next: NextFunction): void {
  const sesi = bacaSesi(req);
  if (!sesi) {
    res.status(401).json({ galat: 'Halaman ini hanya untuk Bagian Hukum.' });
    return;
  }
  (req as Request & { sesi?: Sesi }).sesi = sesi;
  next();
}
```

- [ ] **Step 5: Jalankan uji untuk memastikan lulus**

Run: `npm test`
Expected: PASS — 9 uji auth lulus

- [ ] **Step 6: Tulis rute `vps/server/src/rute/auth.ts`**

```ts
import { Router } from 'express';
import { adminPeriksaSandi } from '../repo/admin.js';
import { buatToken, pasangCookie, hapusCookie, bacaSesi, wajibAdmin } from '../tengah/auth.js';
import { batasMasuk } from '../tengah/rate-limit.js';
import { logCatat } from '../repo/log.js';

export const ruteAuth = Router();

ruteAuth.post('/masuk', batasMasuk, async (req, res, next) => {
  try {
    const { email, sandi } = req.body ?? {};
    const admin = await adminPeriksaSandi(String(email ?? ''), String(sandi ?? ''));
    if (!admin) {
      // Pesan sengaja tidak menyebut mana yang salah, email atau sandinya.
      res.status(401).json({ galat: 'Email atau kata sandi salah.' });
      return;
    }
    pasangCookie(res, buatToken(admin));
    await logCatat({ aktor: admin.email, aksi: 'MASUK', rincian: '', ip: req.ip ?? '' });
    res.json({ email: admin.email, nama: admin.nama });
  } catch (e) { next(e); }
});

ruteAuth.post('/keluar', (req, res) => {
  hapusCookie(res);
  res.json({ sukses: true });
});

ruteAuth.get('/saya', wajibAdmin, (req, res) => {
  res.json({ sesi: bacaSesi(req) });
});
```

- [ ] **Step 7: Commit**

```bash
git add vps/server/src/repo/admin.ts vps/server/src/tengah/auth.ts vps/server/src/rute/auth.ts vps/server/src/uji/auth.test.ts
git commit -m "feat: admin authentication with bcrypt hashing and JWT cookie sessions"
```

---

### Task 5: Repo pengajuan, riwayat, berkas — dengan penomoran transaksional

Bagian paling penting di seluruh rencana: nomor pengajuan diterbitkan **di dalam transaksi** dan dijaga `UNIQUE`. Di versi Apps Script ini dijaga `LockService` buatan sendiri; di sini database yang menjaminnya.

**Files:**
- Create: `vps/server/src/repo/{pengajuan,riwayat,berkas,opd,pengaturan,log}.ts`
- Create: `vps/server/src/uji/repo.test.ts`

**Interfaces:**
- Consumes: `kueri`, `satu`, `transaksi` (Task 2); `nomorBerikutnya`, `uraiNomor` (Task 3)
- Produces:

```ts
// pengajuan.ts
export interface Pengajuan {
  id: number; nomor: string; opd_id: number | null; opd_teks: string;
  jenis_peraturan: 'Daerah' | 'Bupati'; judul: string;
  nama_pemohon: string; wa_pemohon: string; email_pemohon: string;
  status: Status; keterangan: string;
  dibuat_pada: string; diperbarui_pada: string; diperbarui_oleh: string;
  sinkron_tertunda: number;
}
export interface PengajuanBaru {
  opd_id: number | null; opd_teks: string;
  jenis_peraturan: 'Daerah' | 'Bupati'; judul: string;
  nama_pemohon: string; wa_pemohon: string; email_pemohon: string;
}
export function pengajuanBuat(data: PengajuanBaru, conn?: PoolConnection): Promise<{ id: number; nomor: string }>;
export function pengajuanSemua(): Promise<Pengajuan[]>;
export function pengajuanCariNomor(nomor: string): Promise<Pengajuan | null>;
export function pengajuanUbahStatus(nomor: string, status: Status, alasan: string, oleh: string): Promise<void>;
export function pengajuanTandaiTertunda(id: number): Promise<void>;
export function pengajuanTandaiTersinkron(id: number): Promise<void>;
export function pengajuanTertunda(): Promise<Pengajuan[]>;

// riwayat.ts
export interface Riwayat { id: number; pengajuan_id: number; tanggal: string; tahap: string;
                           keterangan: string; dicatat_oleh: string; dicatat_pada: string }
export function riwayatUntuk(pengajuanId: number): Promise<Riwayat[]>;
export function riwayatTambah(pengajuanId: number, isi: { tanggal: string; tahap: string; keterangan: string }, oleh: string, conn?: PoolConnection): Promise<void>;
export function riwayatTerakhirPerPengajuan(): Promise<Map<number, Riwayat>>;

// berkas.ts
export interface Berkas { id: number; pengajuan_id: number; kolom: string; nama: string;
                          ukuran: number; mime: string; drive_file_id: string; url: string }
export function berkasTambah(pengajuanId: number, b: Omit<Berkas,'id'|'pengajuan_id'>, conn?: PoolConnection): Promise<void>;
export function berkasUntuk(pengajuanId: number): Promise<Berkas[]>;

// opd.ts
export function opdSemua(): Promise<{ id: number; kode: string; nama_resmi: string; nama_singkat: string }[]>;
export function opdTambah(kode: string, namaResmi: string, namaSingkat: string): Promise<number>;
export function opdCocokkan(nama: string): Promise<number | null>;

// pengaturan.ts
export function pengaturanSemua(): Promise<Record<string, string>>;
export function pengaturanSetel(kunci: string, nilai: string): Promise<void>;
export function pengaturanBenar(peta: Record<string,string>, kunci: string): boolean;

// log.ts
export function logCatat(x: { aktor: string; aksi: string; pengajuanId?: number | null; rincian: string; ip?: string }): Promise<void>;
export function logTerakhir(jumlah: number): Promise<{ waktu: string; aktor: string; aksi: string; rincian: string }[]>;
```

- [ ] **Step 1: Tulis uji yang gagal**

`vps/server/src/uji/repo.test.ts` — yang paling penting uji nomor berbarengan:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, kueri, siapkanSkema } from '../db.js';
import { pengajuanBuat, pengajuanSemua, pengajuanCariNomor, pengajuanUbahStatus } from '../repo/pengajuan.js';
import { riwayatTambah, riwayatUntuk } from '../repo/riwayat.js';

const CONTOH = {
  opd_id: null, opd_teks: 'BPKAD', jenis_peraturan: 'Bupati' as const,
  judul: 'Uji Pengajuan', nama_pemohon: 'Uji', wa_pemohon: '082299989690',
  email_pemohon: 'uji@uji.local'
};

beforeAll(async () => { await siapkanSkema(); await kueri(`DELETE FROM pengajuan`); });
afterAll(async () => { await kueri(`DELETE FROM pengajuan`); await pool.end(); });

describe('penomoran pengajuan', () => {
  it('nomor pertama tahun ini berakhiran 0001', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    expect(nomor).toMatch(/^BRB-\d{4}-0001$/);
  });

  it('nomor berikutnya berurut', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    expect(nomor).toMatch(/^BRB-\d{4}-0002$/);
  });

  /**
   * Inilah uji yang paling berarti. Di versi Apps Script, dua pengiriman pada
   * detik yang sama bisa mendapat nomor sama dan salah satunya menimpa baris
   * yang lain. Di sini database yang menjaminnya.
   */
  it('20 pengiriman berbarengan menghasilkan 20 nomor berbeda', async () => {
    await kueri(`DELETE FROM pengajuan`);
    const hasil = await Promise.all(
      Array.from({ length: 20 }, () => pengajuanBuat(CONTOH))
    );
    const nomor = hasil.map((h) => h.nomor);
    expect(new Set(nomor).size).toBe(20);
    const urut = [...nomor].sort();
    expect(urut[0]).toMatch(/0001$/);
    expect(urut[19]).toMatch(/0020$/);
  });
});

describe('status dan riwayat', () => {
  it('DIKEMBALIKAN tanpa alasan ditolak', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    await expect(pengajuanUbahStatus(nomor, 'DIKEMBALIKAN', '', 'a@uji.local'))
      .rejects.toThrow(/[Aa]lasan/);
  });

  it('DIKEMBALIKAN dengan alasan tersimpan ke keterangan', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    await pengajuanUbahStatus(nomor, 'DIKEMBALIKAN', 'Belum ada hasil konsultasi', 'a@uji.local');
    const p = await pengajuanCariNomor(nomor);
    expect(p!.status).toBe('DIKEMBALIKAN');
    expect(p!.keterangan).toBe('Belum ada hasil konsultasi');
  });

  it('status di luar daftar ditolak', async () => {
    const { nomor } = await pengajuanBuat(CONTOH);
    await expect(pengajuanUbahStatus(nomor, 'ENTAH' as never, '', 'a@uji.local')).rejects.toThrow();
  });

  it('riwayat terurut menurut tanggal lalu urutan tulis', async () => {
    const { id } = await pengajuanBuat(CONTOH);
    await riwayatTambah(id, { tanggal: '2026-07-23', tahap: 'REVIU_HUKUM', keterangan: 'B' }, 'a@uji.local');
    await riwayatTambah(id, { tanggal: '2026-07-22', tahap: 'BERKAS_MASUK', keterangan: 'A' }, 'a@uji.local');
    const r = await riwayatUntuk(id);
    expect(r.map((x) => x.keterangan)).toEqual(['A', 'B']);
  });

  it('tahap di luar daftar baku ditolak', async () => {
    const { id } = await pengajuanBuat(CONTOH);
    await expect(riwayatTambah(id, { tanggal: '2026-07-22', tahap: 'NGAWUR', keterangan: '' }, 'a@uji.local'))
      .rejects.toThrow(/[Tt]ahap/);
  });

  it('mengubah status menandai baris perlu disinkron ulang', async () => {
    const { id, nomor } = await pengajuanBuat(CONTOH);
    await kueri(`UPDATE pengajuan SET sinkron_tertunda = 0 WHERE id = ?`, [id]);
    await pengajuanUbahStatus(nomor, 'SELESAI', '', 'a@uji.local');
    const p = await pengajuanCariNomor(nomor);
    expect(p!.sinkron_tertunda).toBe(1);
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `Cannot find module '../repo/pengajuan.js'`

- [ ] **Step 3: Tulis `vps/server/src/repo/pengajuan.ts`**

Bagian penomorannya:

```ts
import type { PoolConnection } from 'mysql2/promise';
import { kueri, satu, transaksi } from '../db.js';
import { nomorBerikutnya } from '../murni/penomoran.js';
import { STATUS_PENGAJUAN, type Status } from '../murni/skema.js';

function tahunSekarang(): number {
  // Zona waktu pool sudah +07:00, tapi tahun dihitung eksplisit supaya tidak
  // bergantung pada zona waktu proses Node.
  return Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric'
  }).format(new Date()));
}

/**
 * Terbitkan nomor lalu sisipkan barisnya dalam satu transaksi.
 *
 * SELECT ... FOR UPDATE mengunci baris pengajuan tahun berjalan sampai commit,
 * sehingga dua permintaan berbarengan tidak bisa membaca nomor terakhir yang
 * sama. Constraint UNIQUE pada `nomor` jadi jaring pengaman terakhir: kalau
 * penguncian pun lolos, database yang menolak.
 */
export async function pengajuanBuat(
  data: PengajuanBaru, connLuar?: PoolConnection
): Promise<{ id: number; nomor: string }> {
  const jalankan = async (conn: PoolConnection) => {
    const tahun = tahunSekarang();
    const [baris] = await conn.query<RowDataPacket[]>(
      `SELECT nomor FROM pengajuan
        WHERE nomor LIKE ?
        ORDER BY nomor DESC LIMIT 1
        FOR UPDATE`,
      [`BRB-${tahun}-%`]
    );
    const terakhir = baris.length ? String(baris[0]!.nomor) : null;
    const nomor = nomorBerikutnya(tahun, terakhir);

    const [hasil] = await conn.query<ResultSetHeader>(
      `INSERT INTO pengajuan
        (nomor, opd_id, opd_teks, jenis_peraturan, judul, nama_pemohon, wa_pemohon,
         email_pemohon, status, keterangan, dibuat_pada, diperbarui_pada,
         diperbarui_oleh, sinkron_tertunda)
       VALUES (?,?,?,?,?,?,?,?, 'PROSES', '', NOW(), NOW(), ?, 1)`,
      [nomor, data.opd_id, data.opd_teks, data.jenis_peraturan, data.judul,
       data.nama_pemohon, data.wa_pemohon, data.email_pemohon, data.email_pemohon]
    );
    return { id: hasil.insertId, nomor };
  };

  return connLuar ? jalankan(connLuar) : transaksi(jalankan);
}

export async function pengajuanUbahStatus(
  nomor: string, status: Status, alasan: string, oleh: string
): Promise<void> {
  if (!STATUS_PENGAJUAN.includes(status)) throw new Error('Status tidak dikenali.');
  if (status === 'DIKEMBALIKAN' && !String(alasan).trim()) {
    throw new Error('Alasan wajib diisi saat mengembalikan pengajuan.');
  }
  const hasil = await kueri(
    `UPDATE pengajuan
        SET status = ?,
            keterangan = CASE WHEN ? <> '' THEN ? ELSE keterangan END,
            diperbarui_pada = NOW(), diperbarui_oleh = ?,
            sinkron_tertunda = 1
      WHERE nomor = ?`,
    [status, alasan.trim(), alasan.trim(), oleh, nomor]
  );
  void hasil;
}
```

`riwayat.ts` memvalidasi `tahap` terhadap `TAHAP_RIWAYAT` dan menandai `sinkron_tertunda = 1` pada pengajuan induknya setiap kali baris riwayat ditambahkan.

- [ ] **Step 4: Jalankan uji untuk memastikan lulus**

Run: `npm test`
Expected: PASS — termasuk uji 20 pengiriman berbarengan menghasilkan 20 nomor berbeda

- [ ] **Step 5: Commit**

```bash
git add vps/server/src/repo vps/server/src/uji/repo.test.ts
git commit -m "feat: repositories with transactional submission numbering"
```

---

### Task 6: Rute publik, kerangka React, dan halaman Monitoring

**Files:**
- Create: `vps/server/src/rute/publik.ts`, `vps/server/src/index.ts`, `vps/server/src/tengah/galat.ts`
- Create: `vps/web/` (package.json, vite.config.ts, tailwind, src/main.tsx, src/App.tsx, src/gaya.css)
- Create: `vps/web/src/lib/api.ts`, `vps/web/src/lib/format.ts`
- Create: `vps/web/src/komponen/{Kerangka,LencanaStatus,KotakHitungan}.tsx`
- Create: `vps/web/src/halaman/Monitoring.tsx`
- Create: `vps/server/src/uji/publik.test.ts`

**Interfaces:**
- Consumes: seluruh repo (Task 5), `rekapPerStatus` (Task 3), `formatWa`/`samarkanWa` (Task 3)
- Produces:
  - `GET /api/publik/monitoring` → `{ hitungan, tahun, daftar }`
  - `GET /api/publik/detail/:nomor` → `{ ada, pengajuan, riwayat, berkas, boleh }`
  - `GET /api/publik/konteks` → `{ pengumuman, opd, tahap, status }`
  - Web: `panggilApi<T>(jalur, opsi?) -> Promise<T>` yang melempar `Error` berisi pesan server

- [ ] **Step 1: Tulis uji rute publik yang gagal**

`vps/server/src/uji/publik.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buatApp } from '../index.js';
import { pool, kueri, siapkanSkema } from '../db.js';
import { pengajuanBuat } from '../repo/pengajuan.js';
import { pengaturanSetel } from '../repo/pengaturan.js';

const app = buatApp();

beforeAll(async () => {
  await siapkanSkema();
  await kueri(`DELETE FROM pengajuan`);
  await pengajuanBuat({
    opd_id: null, opd_teks: 'BPKAD', jenis_peraturan: 'Bupati',
    judul: 'Raperbup Percontohan', nama_pemohon: 'Mayasari',
    wa_pemohon: '082299989690', email_pemohon: 'm@uji.local'
  });
});
afterAll(async () => { await kueri(`DELETE FROM pengajuan`); await pool.end(); });

describe('GET /api/publik/monitoring', () => {
  it('mengembalikan hitungan dan daftar tanpa perlu masuk', async () => {
    const r = await request(app).get('/api/publik/monitoring').expect(200);
    expect(r.body.hitungan.TOTAL).toBe(1);
    expect(r.body.hitungan.PROSES).toBe(1);
    expect(r.body.daftar[0].judul).toBe('Raperbup Percontohan');
  });

  it('menyamarkan nomor WA saat sakelar dimatikan', async () => {
    await pengaturanSetel('publik_tampilkan_wa', 'FALSE');
    const r = await request(app).get('/api/publik/monitoring').expect(200);
    expect(r.body.daftar[0].wa_pemohon).toBe('0822****9690');
    await pengaturanSetel('publik_tampilkan_wa', 'TRUE');
  });

  it('tidak pernah mengirim email pemohon ke publik', async () => {
    const r = await request(app).get('/api/publik/monitoring').expect(200);
    expect(JSON.stringify(r.body)).not.toContain('m@uji.local');
  });
});

describe('GET /api/publik/detail/:nomor', () => {
  it('nomor yang tidak ada dijawab 404 dengan pesan, bukan halaman kosong', async () => {
    const r = await request(app).get('/api/publik/detail/BRB-1900-9999').expect(404);
    expect(r.body.galat).toMatch(/tidak ditemukan/i);
  });
});

describe('penjagaan admin', () => {
  it('rute admin ditolak tanpa sesi', async () => {
    await request(app).get('/api/admin/antrean').expect(401);
  });
});
```

Tambahkan `supertest` dan `@types/supertest` ke `devDependencies`.

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `buatApp` belum ada

- [ ] **Step 3: Tulis `vps/server/src/index.ts`**

```ts
import express from 'express';
import cookieParser from 'cookie-parser';
import { bacaKonfig } from './konfig.js';
import { siapkanSkema } from './db.js';
import { rutePublik } from './rute/publik.js';
import { ruteAuth } from './rute/auth.js';
import { ruteAdmin } from './rute/admin.js';
import { ruteUnggah } from './rute/unggah.js';
import { rutePengajuan } from './rute/pengajuan.js';
import { ruteExport } from './rute/export.js';
import { tangkapGalat } from './tengah/galat.js';

export function buatApp() {
  const app = express();
  app.set('trust proxy', 1);          // Caddy yang di depan; supaya req.ip benar
  app.use(express.json({ limit: '256kb' }));  // badan permintaan selalu kecil:
                                              // bytes berkas tidak lewat sini
  app.use(cookieParser());

  app.get('/api/sehat', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/publik', rutePublik);
  app.use('/api/auth', ruteAuth);
  app.use('/api/pengajuan', rutePengajuan);
  app.use('/api/unggah', ruteUnggah);
  app.use('/api/admin', ruteAdmin);
  app.use('/api/export', ruteExport);

  app.use(tangkapGalat);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const konfig = bacaKonfig(process.env);
  await siapkanSkema();
  buatApp().listen(konfig.port, '127.0.0.1', () => {
    console.log(`SIMPEL siap di 127.0.0.1:${konfig.port}`);
  });
}
```

Server sengaja hanya mendengar di `127.0.0.1`: Caddy yang menghadap internet, jadi port aplikasi tidak perlu terbuka ke luar sama sekali.

- [ ] **Step 4: Tulis `vps/server/src/rute/publik.ts`**

Kunci keamanannya: **sakelar keterbukaan diterapkan di server**. Menyaring di browser berarti datanya tetap terkirim dan bisa dibaca siapa pun yang membuka panel jaringan.

```ts
import { Router } from 'express';
import { pengajuanSemua, pengajuanCariNomor } from '../repo/pengajuan.js';
import { riwayatUntuk, riwayatTerakhirPerPengajuan } from '../repo/riwayat.js';
import { berkasUntuk } from '../repo/berkas.js';
import { pengaturanSemua, pengaturanBenar } from '../repo/pengaturan.js';
import { opdSemua } from '../repo/opd.js';
import { rekapPerStatus } from '../murni/rekap.js';
import { formatWa, samarkanWa } from '../murni/validasi.js';
import { TAHAP_RIWAYAT, STATUS_PENGAJUAN } from '../murni/skema.js';
import { bacaSesi } from '../tengah/auth.js';

export const rutePublik = Router();

rutePublik.get('/monitoring', async (req, res, next) => {
  try {
    const pengaturan = await pengaturanSemua();
    const admin = bacaSesi(req) !== null;
    const bolehWa = admin || pengaturanBenar(pengaturan, 'publik_tampilkan_wa');
    const semua = await pengajuanSemua();
    const terakhir = await riwayatTerakhirPerPengajuan();

    const daftar = semua.map((p) => ({
      nomor: p.nomor, judul: p.judul,
      opd: p.opd_teks, jenis_peraturan: p.jenis_peraturan,
      status: p.status, keterangan: p.keterangan,
      masuk: String(p.dibuat_pada).slice(0, 10),
      diperbarui: String(p.diperbarui_pada).slice(0, 10),
      nama_pemohon: p.nama_pemohon,
      wa_pemohon: bolehWa ? formatWa(p.wa_pemohon) : samarkanWa(p.wa_pemohon),
      // email_pemohon sengaja TIDAK ikut: tidak ada alasan alamat surel
      // pemohon tersebar di halaman publik.
      terakhir: terakhir.get(p.id)
        ? { tanggal: terakhir.get(p.id)!.tanggal, tahap: terakhir.get(p.id)!.tahap,
            keterangan: terakhir.get(p.id)!.keterangan }
        : null
    }));

    const tahun = [...new Set(daftar.map((d) => d.masuk.slice(0, 4)).filter(Boolean))]
      .sort().reverse();

    res.json({ hitungan: rekapPerStatus(daftar), tahun, daftar });
  } catch (e) { next(e); }
});

rutePublik.get('/detail/:nomor', async (req, res, next) => {
  try {
    const p = await pengajuanCariNomor(String(req.params.nomor));
    if (!p) { res.status(404).json({ galat: 'Pengajuan tidak ditemukan.' }); return; }

    const pengaturan = await pengaturanSemua();
    const admin = bacaSesi(req) !== null;
    const bolehBerkas = admin || pengaturanBenar(pengaturan, 'publik_tampilkan_berkas');
    const bolehWa = admin || pengaturanBenar(pengaturan, 'publik_tampilkan_wa');

    res.json({
      ada: true,
      pengajuan: {
        nomor: p.nomor, judul: p.judul, opd: p.opd_teks,
        jenis_peraturan: p.jenis_peraturan, status: p.status,
        masuk: String(p.dibuat_pada).slice(0, 10),
        keterangan: p.keterangan, nama_pemohon: p.nama_pemohon,
        wa_pemohon: bolehWa ? formatWa(p.wa_pemohon) : samarkanWa(p.wa_pemohon)
      },
      riwayat: await riwayatUntuk(p.id),
      berkas: bolehBerkas ? await berkasUntuk(p.id) : [],
      boleh: { berkas: bolehBerkas, wa: bolehWa }
    });
  } catch (e) { next(e); }
});

rutePublik.get('/konteks', async (_req, res, next) => {
  try {
    const pengaturan = await pengaturanSemua();
    res.json({
      pengumuman: pengaturan.pengumuman ?? '',
      opd: await opdSemua(),
      tahap: TAHAP_RIWAYAT, status: STATUS_PENGAJUAN
    });
  } catch (e) { next(e); }
});
```

- [ ] **Step 5: Tulis `vps/server/src/tengah/galat.ts`**

```ts
import type { Request, Response, NextFunction } from 'express';

/**
 * Penangan galat terakhir. Pesan galat internal tidak pernah dikirim apa adanya
 * ke klien di produksi -- pesan MySQL bisa memuat nama tabel dan potongan query.
 */
export function tangkapGalat(
  galat: Error, _req: Request, res: Response, _next: NextFunction
): void {
  console.error('[galat]', galat.message);
  const pesan = process.env.NODE_ENV === 'production'
    ? 'Terjadi kesalahan di server. Coba lagi beberapa saat.'
    : galat.message;
  res.status(500).json({ galat: pesan });
}
```

- [ ] **Step 6: Buat kerangka React**

`vps/web/package.json` dengan `react@19`, `react-dom@19`, `react-router-dom@7`, `vite`, `@vitejs/plugin-react`, `tailwindcss@4`, `@tailwindcss/vite`, `typescript`.

`vps/web/vite.config.ts` — proxy ke server saat pengembangan supaya tidak perlu CORS:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  build: { outDir: 'dist', sourcemap: false },
  server: { proxy: { '/api': 'http://127.0.0.1:3101' } }
});
```

`vps/web/src/gaya.css` — palet desain sebagai variabel CSS, dipakai lewat Tailwind:

```css
@import "tailwindcss";

@theme {
  --color-biru-utama: #1B6FB8;
  --color-biru-tua:   #0F4C81;
  --color-biru-muda:  #E8F2FA;
  --color-latar:      #F5F8FB;
  --color-teks-utama: #1A2B3C;
  --color-teks-lemah: #5A6B7C;
  --color-garis:      #DCE5EC;
  --color-proses:       #E8A317;
  --color-selesai:      #2D9D5F;
  --color-dikembalikan: #D64545;
}

body { background: var(--color-latar); color: var(--color-teks-utama); }
```

Huruf memakai tumpukan sistem, tanpa Google Fonts — satu permintaan jaringan lebih sedikit dan teks langsung tampil tanpa kedipan.

`vps/web/src/lib/api.ts`:

```ts
export async function panggilApi<T>(jalur: string, opsi: RequestInit = {}): Promise<T> {
  const jawab = await fetch(jalur, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opsi.headers ?? {}) },
    ...opsi
  });
  const isi = await jawab.json().catch(() => ({}));
  if (!jawab.ok) throw new Error((isi as { galat?: string }).galat ?? `Gagal (HTTP ${jawab.status}).`);
  return isi as T;
}
```

- [ ] **Step 7: Tulis halaman Monitoring**

`vps/web/src/halaman/Monitoring.tsx` — empat kotak hitungan, pencarian, tiga saringan (jenis, status, tahun), dan daftar kartu yang menaut ke `/detail/:nomor`. Penyaringan dilakukan di sisi klien atas data yang sudah diambil, karena jumlah barisnya ratusan, bukan ribuan.

- [ ] **Step 8: Jalankan uji dan commit**

Run: `npm test`
Expected: PASS — 5 uji rute publik lulus

```bash
git add vps/server/src vps/web
git commit -m "feat: public monitoring API and React frontend shell"
```

---

### Task 7: Halaman Detail dan lini masa

**Files:**
- Create: `vps/web/src/halaman/Detail.tsx`, `vps/web/src/komponen/LiniMasa.tsx`

**Interfaces:**
- Consumes: `GET /api/publik/detail/:nomor` (Task 6)
- Produces: rute `/detail/:nomor` di React Router

- [ ] **Step 1: Tulis `LiniMasa.tsx`**

Lini masa vertikal: tiap kejadian punya titik dan garis penghubung; kejadian terakhir bertitik penuh. Tanggal ditampilkan `23 Juli 2026` lewat `formatTanggal`, tahap ditampilkan sebagai label yang dibaca manusia (`REVIU_HUKUM` → `Reviu Hukum`).

- [ ] **Step 2: Tulis `Detail.tsx`**

Menampilkan: nomor + lencana status, judul, meta (OPD · jenis · tanggal masuk), kotak keterangan bila ada, lini masa, daftar berkas, dan data pemohon.

Tiga keadaan yang wajib ditangani, bukan hanya jalur bahagia:
- Nomor tidak ditemukan → pesan jelas plus tombol kembali ke monitoring, bukan halaman kosong
- `boleh.berkas === false` → keterangan bahwa tautan hanya untuk pemohon dan Bagian Hukum
- `riwayat.length === 0` → "Belum ada riwayat tercatat"

- [ ] **Step 3: Verifikasi manual**

Jalankan `npm run dev` di kedua folder. Buka `/detail/BRB-2026-0001` dan `/detail/TIDAK-ADA`. Perkecil jendela sampai 360 px — halaman tidak boleh bergeser mendatar.

- [ ] **Step 4: Commit**

```bash
git add vps/web/src/halaman/Detail.tsx vps/web/src/komponen/LiniMasa.tsx
git commit -m "feat: submission detail page with vertical timeline"
```

---

### Task 8: Google OAuth dan layanan Drive

**Files:**
- Create: `vps/server/src/layanan/google.ts`, `vps/server/src/layanan/drive.ts`
- Create: `vps/server/src/perintah/dapatkan-refresh-token.ts`
- Create: `vps/server/src/uji/google.test.ts`

**Interfaces:**
- Consumes: `konfig.google` (Task 1)
- Produces:
  - `ambilAccessToken() -> Promise<string>` — menukar refresh token, di-cache sampai 60 detik sebelum kedaluwarsa
  - `googleFetch(url, opsi?) -> Promise<unknown>` — melempar `GalatGoogle` ber-properti `kode`
  - `driveBuatSesiUnggah(nama, mime, idFolder) -> Promise<string>` — URL sesi
  - `driveMeta(id) -> Promise<{ id, name, size, mimeType, webViewLink }>`
  - `drivePindahDanNamai(id, idFolder, nama) -> Promise<{ id, webViewLink, size }>`
  - `driveFolderPastikan(nama, idInduk) -> Promise<string>`
  - `driveHapus(id) -> Promise<void>`
  - `driveUnggahKecil(nama, mime, isi: Buffer, idFolder) -> Promise<string>` — untuk export & backup

**Kenapa bukan Service Account.** Service account tidak punya kuota penyimpanan Drive sendiri, sehingga mengunggah ke Drive akun Gmail biasa gagal dengan `Service Accounts do not have storage quota`. Banyak tutorial menyarankannya dan baru ketahuan salah setelah semuanya terpasang. Yang dipakai adalah refresh token milik akun Bagian Hukum.

- [ ] **Step 1: Tulis uji yang gagal**

`vps/server/src/uji/google.test.ts` — tanpa memanggil Google sungguhan:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ambilAccessToken, _resetCacheToken, GalatGoogle } from '../layanan/google.js';

beforeEach(() => { _resetCacheToken(); vi.restoreAllMocks(); });

describe('ambilAccessToken', () => {
  it('menukar refresh token jadi access token', async () => {
    const ambil = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'at-1', expires_in: 3600 }), { status: 200 })
    );
    expect(await ambilAccessToken()).toBe('at-1');
    expect(ambil).toHaveBeenCalledOnce();
  });

  it('memakai ulang token dari cache, tidak menukar tiap permintaan', async () => {
    const ambil = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'at-2', expires_in: 3600 }), { status: 200 })
    );
    await ambilAccessToken();
    await ambilAccessToken();
    await ambilAccessToken();
    expect(ambil).toHaveBeenCalledOnce();
  });

  it('menukar ulang bila token hampir kedaluwarsa', async () => {
    const ambil = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'at-3', expires_in: 30 }), { status: 200 })
    );
    await ambilAccessToken();
    await ambilAccessToken();
    expect(ambil).toHaveBeenCalledTimes(2);
  });

  it('refresh token yang dicabut memberi pesan yang bisa ditindaklanjuti', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
    );
    await expect(ambilAccessToken()).rejects.toThrow(/izin Google.*disetujui ulang/i);
  });
});

describe('GalatGoogle', () => {
  it('membawa kode HTTP supaya pemanggil bisa membedakan sebab', () => {
    const g = new GalatGoogle(403, 'Rate limit');
    expect(g.kode).toBe(403);
    expect(g.message).toMatch(/403/);
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — `Cannot find module '../layanan/google.js'`

- [ ] **Step 3: Tulis `vps/server/src/layanan/google.ts`**

```ts
import { bacaKonfig } from '../konfig.js';

const konfig = bacaKonfig(process.env);
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const AMBANG_MS = 60_000;   // tukar ulang 60 detik sebelum kedaluwarsa

export class GalatGoogle extends Error {
  constructor(public readonly kode: number, pesan: string) {
    super(`Google ${kode}: ${pesan}`);
    this.name = 'GalatGoogle';
  }
}

let cache: { token: string; kedaluwarsaPada: number } | null = null;

/** Hanya untuk uji. */
export function _resetCacheToken(): void { cache = null; }

/**
 * Tukar refresh token jadi access token, lalu simpan sampai hampir kedaluwarsa.
 * Menukar tiap permintaan akan menghabiskan kuota OAuth tanpa alasan.
 */
export async function ambilAccessToken(): Promise<string> {
  if (cache && Date.now() < cache.kedaluwarsaPada) return cache.token;

  const jawab = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: konfig.google.clientId,
      client_secret: konfig.google.clientSecret,
      refresh_token: konfig.google.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const isi = await jawab.json() as { access_token?: string; expires_in?: number; error?: string };

  if (!jawab.ok || !isi.access_token) {
    if (isi.error === 'invalid_grant') {
      throw new GalatGoogle(401,
        'Refresh token tidak berlaku lagi. Izin Google harus disetujui ulang: ' +
        'jalankan `npm run token` lalu perbarui GOOGLE_REFRESH_TOKEN di .env.');
    }
    throw new GalatGoogle(jawab.status, isi.error ?? 'gagal menukar refresh token');
  }

  cache = {
    token: isi.access_token,
    kedaluwarsaPada: Date.now() + (isi.expires_in ?? 3600) * 1000 - AMBANG_MS
  };
  return cache.token;
}

export async function googleFetch<T = unknown>(url: string, opsi: RequestInit = {}): Promise<T> {
  const token = await ambilAccessToken();
  const jawab = await fetch(url, {
    ...opsi,
    headers: { Authorization: `Bearer ${token}`, ...(opsi.headers ?? {}) }
  });
  const teks = await jawab.text();
  if (!jawab.ok) {
    let pesan = teks.slice(0, 300);
    try { pesan = (JSON.parse(teks) as { error?: { message?: string } }).error?.message ?? pesan; } catch { /* biarkan mentah */ }
    throw new GalatGoogle(jawab.status, pesan);
  }
  return (teks ? JSON.parse(teks) : {}) as T;
}
```

- [ ] **Step 4: Tulis `vps/server/src/layanan/drive.ts`**

Yang paling penting — pembuatan sesi unggah, karena ini yang menjaga bytes tidak melewati server:

```ts
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UNGGAH = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Buat sesi unggah bertahap dan kembalikan URL-nya.
 *
 * URL sesi adalah kredensial sekali pakai untuk SATU berkas: ia hanya bisa
 * menerima bytes, tidak bisa dipakai membaca apa pun. Karena itu aman dikirim
 * ke browser, sementara access token tidak pernah keluar dari server.
 */
export async function driveBuatSesiUnggah(
  nama: string, mime: string, idFolder: string
): Promise<string> {
  const token = await ambilAccessToken();
  const jawab = await fetch(`${UNGGAH}?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mime || 'application/octet-stream'
    },
    body: JSON.stringify({ name: nama, parents: [idFolder] })
  });
  if (!jawab.ok) throw new GalatGoogle(jawab.status, (await jawab.text()).slice(0, 300));
  const lokasi = jawab.headers.get('location');
  if (!lokasi) throw new GalatGoogle(500, 'Drive tidak mengembalikan URL sesi unggah.');
  return lokasi;
}
```

Sisanya (`driveMeta`, `drivePindahDanNamai`, `driveFolderPastikan`, `driveHapus`, `driveUnggahKecil`) memanggil `googleFetch` terhadap `DRIVE` dengan `supportsAllDrives=true`.

- [ ] **Step 5: Tulis `vps/server/src/perintah/dapatkan-refresh-token.ts`**

Skrip sekali pakai: cetak URL persetujuan dengan `access_type=offline&prompt=consent` dan cakupan `drive.file` + `spreadsheets`, buka server sementara di `localhost:53682` untuk menangkap `code`, tukar jadi refresh token, cetak ke layar. Tambahkan `"token": "tsx src/perintah/dapatkan-refresh-token.ts"` ke `scripts`.

- [ ] **Step 6: Jalankan uji, verifikasi manual, commit**

Run: `npm test` → PASS (5 uji)

Verifikasi manual: jalankan `npm run token`, isi `.env`, lalu jalankan skrip pendek yang memanggil `driveFolderPastikan('SIMPEL_UJI', konfig.driveFolderId)` — folder harus muncul di Drive akun Bagian Hukum.

```bash
git add vps/server/src/layanan vps/server/src/perintah vps/server/src/uji/google.test.ts
git commit -m "feat: Google OAuth token exchange and Drive service"
```

---

### Task 9: Unggah bertahap browser → Drive

Tahap ini sengaja mendahului form pengajuan. Unggah berkas adalah bagian yang paling mungkin gagal; membuktikannya lebih dulu berarti kalau ada halangan tak terduga, kita mengetahuinya sebelum banyak pekerjaan menumpuk di atasnya.

**Files:**
- Create: `vps/server/src/rute/unggah.ts`, `vps/server/src/tengah/rate-limit.ts`
- Create: `vps/web/src/lib/unggah.ts`
- Create: `vps/server/src/uji/unggah.test.ts`

**Interfaces:**
- Consumes: `driveBuatSesiUnggah`, `driveMeta`, `driveHapus`, `driveFolderPastikan` (Task 8); `validasiBerkas` (Task 3)
- Produces:
  - `POST /api/unggah/draf` → `{ draf: string }`
  - `POST /api/unggah/izin` `{ draf, kolom, nama, ukuran, mime }` → `{ urlSesi }`
  - `POST /api/unggah/daftar` `{ draf, kolom, idBerkas }` → `{ idBerkas, kolom, nama, ukuran, url }`
  - `POST /api/unggah/batal` `{ draf, idBerkas }` → `{ sukses: true }`
  - `batasKirim`, `batasMasuk`, `batasUnggah` — middleware rate limit
  - Web: `unggahBerkas(file, { draf, kolom, onProgress }) -> Promise<BerkasTerunggah>`

Draf disimpan di memori proses dengan umur 6 jam. Ini disengaja: draf hanya hidup selama satu sesi pengisian form, dan menyimpannya di database berarti membersihkan sampah draf yang ditinggalkan selamanya.

- [ ] **Step 1: Tulis uji yang gagal**

```ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buatApp } from '../index.js';
import { pool, siapkanSkema } from '../db.js';
import * as drive from '../layanan/drive.js';

const app = buatApp();
beforeAll(async () => { await siapkanSkema(); });
afterAll(async () => { await pool.end(); });

async function buatDraf(): Promise<string> {
  const r = await request(app).post('/api/unggah/draf').expect(200);
  return r.body.draf as string;
}

describe('POST /api/unggah/izin', () => {
  it('menolak berkas melebihi batas SEBELUM satu byte pun terkirim', async () => {
    const sesi = vi.spyOn(drive, 'driveBuatSesiUnggah');
    const draf = await buatDraf();
    const r = await request(app).post('/api/unggah/izin')
      .send({ draf, kolom: 'surat_permohonan', nama: 's.pdf', ukuran: 6 * 1024 * 1024, mime: 'application/pdf' })
      .expect(400);
    expect(r.body.galat).toMatch(/5 MB/);
    expect(sesi).not.toHaveBeenCalled();
  });

  it('menolak jenis berkas yang tidak diizinkan untuk kolom itu', async () => {
    const draf = await buatDraf();
    const r = await request(app).post('/api/unggah/izin')
      .send({ draf, kolom: 'rancangan', nama: 'r.pdf', ukuran: 1000, mime: 'application/pdf' })
      .expect(400);
    expect(r.body.galat).toMatch(/doc, docx/);
  });

  it('menolak draf yang tidak dikenal', async () => {
    await request(app).post('/api/unggah/izin')
      .send({ draf: 'karangan', kolom: 'paraf', nama: 'p.pdf', ukuran: 1000, mime: 'application/pdf' })
      .expect(400);
  });

  it('mengembalikan URL sesi untuk berkas yang sah', async () => {
    vi.spyOn(drive, 'driveFolderPastikan').mockResolvedValue('folder-1');
    vi.spyOn(drive, 'driveBuatSesiUnggah').mockResolvedValue('https://upload.example/sesi-1');
    const draf = await buatDraf();
    const r = await request(app).post('/api/unggah/izin')
      .send({ draf, kolom: 'paraf', nama: 'p.pdf', ukuran: 1000, mime: 'application/pdf' })
      .expect(200);
    expect(r.body.urlSesi).toBe('https://upload.example/sesi-1');
  });
});

describe('POST /api/unggah/daftar', () => {
  it('memeriksa ULANG ukuran sebenarnya di Drive, bukan yang diklaim browser', async () => {
    vi.spyOn(drive, 'driveFolderPastikan').mockResolvedValue('folder-1');
    vi.spyOn(drive, 'driveBuatSesiUnggah').mockResolvedValue('https://upload.example/sesi-2');
    // Browser mengaku 1 KB, kenyataannya 20 MB.
    vi.spyOn(drive, 'driveMeta').mockResolvedValue({
      id: 'berkas-1', name: 's.pdf', size: 20 * 1024 * 1024,
      mimeType: 'application/pdf', webViewLink: 'https://drive/x'
    });
    const hapus = vi.spyOn(drive, 'driveHapus').mockResolvedValue();

    const draf = await buatDraf();
    await request(app).post('/api/unggah/izin')
      .send({ draf, kolom: 'surat_permohonan', nama: 's.pdf', ukuran: 1024, mime: 'application/pdf' })
      .expect(200);

    const r = await request(app).post('/api/unggah/daftar')
      .send({ draf, kolom: 'surat_permohonan', idBerkas: 'berkas-1' })
      .expect(400);

    expect(r.body.galat).toMatch(/5 MB/);
    // Berkas yang ditolak tidak boleh menggantung di Drive.
    expect(hapus).toHaveBeenCalledWith('berkas-1');
  });
});
```

- [ ] **Step 2: Jalankan uji untuk memastikan gagal**

Run: `npm test`
Expected: FAIL — rute `/api/unggah/*` belum ada

- [ ] **Step 3: Tulis rute unggah**

Inti pemeriksaan ulangnya:

```ts
ruteUnggah.post('/daftar', batasUnggah, async (req, res, next) => {
  try {
    const { draf, kolom, idBerkas } = req.body ?? {};
    const isi = drafBaca(String(draf));
    const meta = await driveMeta(String(idBerkas));
    const pengaturan = await pengaturanSemua();

    // Pemeriksaan ukuran di browser bisa dilewati siapa pun yang paham; hanya
    // pemeriksaan setelah berkas benar-benar ada di Drive yang bisa dipercaya.
    const periksa = validasiBerkas(
      { kolom: String(kolom), nama: meta.name, ukuran: meta.size }, pengaturan
    );
    if (!periksa.sah) {
      await driveHapus(meta.id).catch(() => { /* sudah ditolak, jangan berisik */ });
      res.status(400).json({ galat: periksa.pesan });
      return;
    }

    isi.berkas.push({ kolom: String(kolom), idBerkas: meta.id, nama: meta.name,
                      ukuran: meta.size, mime: meta.mimeType });
    res.json({ idBerkas: meta.id, kolom, nama: meta.name, ukuran: meta.size, url: meta.webViewLink });
  } catch (e) { next(e); }
});
```

- [ ] **Step 4: Tulis `vps/server/src/tengah/rate-limit.ts`**

Penghitung dalam memori berbasis jendela geser, tanpa dependensi tambahan:

| Middleware | Batas |
|---|---|
| `batasKirim` | 5 pengajuan per IP per jam, 20 per hari |
| `batasMasuk` | 10 percobaan masuk per IP per 15 menit |
| `batasUnggah` | 60 permintaan unggah per IP per jam |

Form terbuka ke internet tanpa akun, jadi tanpa ini satu skrip iseng bisa menghabiskan kuota Drive Bagian Hukum.

- [ ] **Step 5: Tulis `vps/web/src/lib/unggah.ts`**

Potongan 8 MB, `Content-Range` per potongan, `308` berarti Drive minta potongan berikutnya. Salin logikanya dari `GAS_version/Index.html` fungsi `kirimPotongan` — sudah terbukti bentuknya, tinggal diketikkan ulang dalam TypeScript.

- [ ] **Step 6: Jalankan uji, verifikasi manual, commit**

Run: `npm test` → PASS

Verifikasi manual — ini daftar yang paling penting di seluruh rencana:
1. Unggah PDF 2 MB → progress bergerak, berkas muncul di Drive
2. Unggah ZIP **30 MB** ke kolom Lampiran sampai selesai → 4 potongan, tanpa timeout
3. Unggah PDF 6 MB ke Surat Permohonan → ditolak sebelum satu byte terkirim
4. Putus koneksi di tengah lalu ulangi → tidak ada baris menggantung
5. Amati RAM proses selama unggah 30 MB: harus **datar**, membuktikan bytes tidak lewat server

```bash
git add vps/server/src/rute/unggah.ts vps/server/src/tengah/rate-limit.ts vps/web/src/lib/unggah.ts vps/server/src/uji/unggah.test.ts
git commit -m "feat: browser-to-Drive resumable upload with server-side revalidation"
```

---

### Task 10: Form pengajuan empat langkah

**Files:**
- Create: `vps/server/src/rute/pengajuan.ts`, `vps/web/src/halaman/Pengajuan.tsx`
- Create: `vps/server/src/uji/pengajuan.test.ts`

**Interfaces:**
- Consumes: `validasiPengajuan` (Task 3), `pengajuanBuat`/`riwayatTambah`/`berkasTambah` (Task 5), draf & Drive (Task 9)
- Produces: `POST /api/pengajuan/kirim` → `{ sukses, nomor, galat }`

- [ ] **Step 1: Tulis uji yang gagal**

```ts
it('Perda tanpa SK Tim dan BA PANSUS ditolak', async () => {
  const draf = await buatDrafDenganBerkasWajib();
  const r = await request(app).post('/api/pengajuan/kirim')
    .send({ ...DASAR, draf, jenis_peraturan: 'Daerah' }).expect(400);
  const kolom = r.body.galat.map((g: { kolom: string }) => g.kolom);
  expect(kolom).toContain('sk_tim');
  expect(kolom).toContain('ba_pansus');
});

it('Perbup yang menyertakan SK Tim ditolak karena kolom itu tidak berlaku', async () => { /* ... */ });

it('daftar berkas diambil dari catatan draf di server, bukan dari kiriman browser', async () => {
  const draf = await buatDrafDenganBerkasWajib();
  // Browser mengarang daftar berkas lengkap padahal draf hanya berisi satu.
  const r = await request(app).post('/api/pengajuan/kirim')
    .send({ ...DASAR, draf, berkas: { sk_tim: [{ nama: 'palsu.pdf', ukuran: 1 }] } })
    .expect(400);
  expect(JSON.stringify(r.body)).not.toContain('palsu.pdf');
});

it('honeypot yang terisi ditolak diam-diam sebagai sukses palsu', async () => {
  const draf = await buatDrafDenganBerkasWajib();
  const r = await request(app).post('/api/pengajuan/kirim')
    .send({ ...DASAR, draf, situs_web: 'https://spam.example' }).expect(200);
  expect(r.body.sukses).toBe(true);
  // Tidak ada baris yang benar-benar tersimpan.
  expect(await satu(`SELECT id FROM pengajuan WHERE nomor = ?`, [r.body.nomor])).toBeNull();
});

it('pengajuan sah tersimpan dengan riwayat BERKAS_MASUK', async () => { /* ... */ });
```

Honeypot menjawab `200` supaya bot tidak belajar mana yang lolos.

- [ ] **Step 2–4: Implementasi**

`POST /kirim` menjalankan: baca draf → susun `berkasPerKolom` **dari draf**, bukan dari badan permintaan → `validasiPengajuan` → transaksi { `pengajuanBuat`, pindahkan tiap berkas ke folder `SIMPEL/<tahun>/<nomor> - <judul singkat>` dengan nama baku, `berkasTambah`, `riwayatTambah` tahap `BERKAS_MASUK` } → hapus draf → `logCatat`.

Penamaan berkas mengikuti pola yang sama dengan `GAS_version`: `BREBES_{JenisBerkas}_{Raperda|Raperbup} tentang {JudulSingkat}_{KodeOPD}.{ext}`, dengan karakter `/ \ : * ? " < > |` dibuang. Pemohon tidak perlu tahu aturan penamaan sama sekali.

`Pengajuan.tsx` — empat langkah dengan penunjuk kemajuan: Jenis → Pemohon → Berkas → Periksa. Memilih *Bupati* menghilangkan SK Tim dan BA PANSUS sepenuhnya dari langkah Berkas; memilih *Daerah* menjadikan keduanya wajib. Berkas yang sudah terunggah untuk kolom yang jadi tidak berlaku dibatalkan lewat `/api/unggah/batal`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: four-step submission form with conditional Perda rules and spam guards"
```

---

### Task 11: Dashboard admin — antrean, riwayat, status

**Files:** `vps/server/src/rute/admin.ts`, `vps/web/src/halaman/admin/Antrean.tsx`, `vps/web/src/halaman/Masuk.tsx`, `vps/server/src/uji/admin.test.ts`

**Interfaces:**
- Produces: `GET /api/admin/antrean`, `POST /api/admin/riwayat`, `POST /api/admin/status` — semuanya di belakang `wajibAdmin`

Antrean: hanya `PROSES`, diurutkan dari yang paling lama tidak diperbarui, dengan penanda bagi yang melewati `ambang_mandek_hari`. Inilah yang paling sering terlewat dalam sistem manual.

Uji yang wajib ada:

```ts
it('seluruh rute admin menolak permintaan tanpa sesi', async () => {
  for (const [metode, jalur] of [['get','/api/admin/antrean'],
                                  ['post','/api/admin/riwayat'],
                                  ['post','/api/admin/status']] as const) {
    await request(app)[metode](jalur).expect(401);
  }
});

it('antrean menandai pengajuan yang tidak bergerak melewati ambang', async () => { /* ... */ });
it('tambah riwayat menandai pengajuan perlu disinkron ulang', async () => { /* ... */ });
```

```bash
git commit -m "feat: admin queue, timeline entry, and status change"
```

---

### Task 12: Dashboard admin — rekap, OPD, kelola admin, pengaturan, log

**Files:** lanjutan `rute/admin.ts`, `vps/web/src/halaman/admin/{Rekap,Pengaturan,Log}.tsx`

**Interfaces:** `GET /api/admin/rekap`, `GET|POST /api/admin/opd`, `GET|POST|DELETE /api/admin/admin`, `GET|POST /api/admin/pengaturan`, `GET /api/admin/log`

Aturan yang wajib ditegakkan dan diuji:

```ts
it('admin tidak bisa menghapus dirinya sendiri', async () => { /* 400 */ });
it('admin terakhir tidak bisa dinonaktifkan', async () => {
  // Tanpa ini, satu klik bisa membuat sistem tidak punya admin sama sekali
  // dan tidak ada jalan masuk untuk membetulkannya.
});
it('batas ukuran di atas 30 MB ditolak', async () => { /* 400, sebut 30 */ });
it('sakelar keterbukaan hanya menerima TRUE atau FALSE', async () => { /* 400 */ });
```

Halaman Pengaturan memakai kontrol yang sesuai jenisnya — centang untuk sakelar, `input[type=number]` dengan `max=30` untuk batas — bukan kotak teks bebas berisi kata `TRUE`.

```bash
git commit -m "feat: admin recap, OPD, admin management, settings, and audit log"
```

---

### Task 13: Migrasi dari spreadsheet

**Files:** `vps/server/src/perintah/migrasi-spreadsheet.ts`, `vps/server/src/layanan/sheets.ts`, `vps/server/src/uji/migrasi.test.ts`

**Interfaces:**
- Produces:
  - `sheetsBaca(idSs, rentang) -> Promise<string[][]>`
  - `migrasiJalankan(opsi: { idSs: string; namaSheet: string; ujiCoba: boolean }) -> Promise<Laporan>`
  - `Laporan = { barisDibaca, barisDisisipkan, riwayatTerurai, riwayatLainnya, opdPerluPeriksa: string[], selisihKolom16: string[], dilewati: string[] }`

- [ ] **Step 1: Uji migrasi dengan data spreadsheet tiruan**

```ts
const BARIS_CONTOH = [
  ['30/04/2026 09:15:00', 'BPKAD KABUPATEN BREBES', 'Bupati', 'Raperbup tentang Percontohan',
   '', '', '', '', '', '', '', '', '', 'Mayasari', '0822-9998-9690',
   '- 22 Juli 2026 Berkas masuk ke sistem\n- 23 Juli 2026 Berkas sedang direviu Bagian Hukum',
   '', 'PROSES']
];

it('memberi nomor berurut menurut timestamp terlama', async () => { /* BRB-2026-0001 */ });

it('memecah kolom 16 jadi baris riwayat terstruktur', async () => {
  const l = await migrasiJalankan({ ...OPSI, ujiCoba: false });
  expect(l.riwayatTerurai).toBe(2);
  const r = await riwayatUntuk(1);
  expect(r[0]!.tahap).toBe('BERKAS_MASUK');
  expect(r[1]!.tahap).toBe('REVIU_HUKUM');
});

it('perbandingan bolak-balik kolom 16 bersih', async () => {
  const l = await migrasiJalankan({ ...OPSI, ujiCoba: true });
  expect(l.selisihKolom16).toEqual([]);
});

it('mode uji-coba tidak menulis apa pun', async () => {
  await kueri(`DELETE FROM pengajuan`);
  const l = await migrasiJalankan({ ...OPSI, ujiCoba: true });
  expect(l.barisDibaca).toBe(1);
  expect(await pengajuanSemua()).toHaveLength(0);
});

it('memetakan BPKAD KABUPATEN BREBES ke OPD BPKAD lewat awalan', async () => { /* ... */ });

it('OPD yang tidak dikenali dilaporkan, bukan ditebak diam-diam', async () => { /* ... */ });

it('idempoten: dijalankan dua kali tidak menggandakan data', async () => {
  await migrasiJalankan({ ...OPSI, ujiCoba: false });
  const l2 = await migrasiJalankan({ ...OPSI, ujiCoba: false });
  expect(l2.barisDisisipkan).toBe(0);
  expect(l2.dilewati).toHaveLength(1);
  expect(await pengajuanSemua()).toHaveLength(1);
});

it('baris yang polanya tidak terbaca tetap masuk sebagai LAINNYA dengan teks utuh', async () => { /* ... */ });
```

Idempotensi dijaga dengan mencocokkan `judul` + `dibuat_pada`; baris yang sudah ada dilewati dan dicatat di `dilewati`.

Seluruh penyisipan berada dalam **satu transaksi**: kalau baris ke-20 gagal, tidak ada satu pun yang tersisip setengah jalan.

- [ ] **Step 2: Verifikasi manual — pada salinan spreadsheet lebih dulu**

```bash
npm run migrasi -- --sheet="PROGRES PENGAJUAN" --uji-coba
```

Baca laporannya. **`selisihKolom16` harus kosong.** Kalau tidak, buka pengajuan yang disebut dan bandingkan kolom 16 aslinya dengan hasil susun ulang sebelum melanjutkan. Baru setelah itu jalankan tanpa `--uji-coba`.

```bash
git commit -m "feat: one-time spreadsheet migration with dry-run and round-trip verification"
```

---

### Task 14: Cermin ke Google Sheets

**Files:** `vps/server/src/layanan/cermin.ts`, `vps/server/src/uji/cermin.test.ts`

**Interfaces:**
- Produces:
  - `cerminSatu(pengajuanId) -> Promise<void>`
  - `cerminTertunda() -> Promise<{ berhasil: number; gagal: number }>`
  - `cerminHitungTertunda() -> Promise<number>`

Kolom 16 disusun ulang dari tabel `riwayat` lewat `susunKolomProses`, bentuknya sama persis dengan yang selama ini diketik manual.

**Kegagalan cermin tidak boleh senyap.** Uji yang wajib:

```ts
it('kegagalan Sheets tidak membatalkan penyimpanan pengajuan', async () => {
  vi.spyOn(sheets, 'sheetsTulis').mockRejectedValue(new GalatGoogle(500, 'Sheets down'));
  const { id, nomor } = await pengajuanBuat(CONTOH);
  await expect(cerminSatu(id)).rejects.toThrow();
  // Pengajuannya tetap ada — data tidak boleh hilang gara-gara cermin.
  expect(await pengajuanCariNomor(nomor)).not.toBeNull();
});

it('baris yang gagal disalin tetap bertanda tertunda', async () => {
  vi.spyOn(sheets, 'sheetsTulis').mockRejectedValue(new GalatGoogle(500, 'Sheets down'));
  const { id } = await pengajuanBuat(CONTOH);
  await cerminSatu(id).catch(() => {});
  expect(await cerminHitungTertunda()).toBeGreaterThan(0);
});

it('penandaan hilang hanya setelah salinan benar-benar berhasil', async () => {
  vi.spyOn(sheets, 'sheetsTulis').mockResolvedValue(undefined);
  const { id } = await pengajuanBuat(CONTOH);
  await cerminSatu(id);
  const p = await satu<{ sinkron_tertunda: number }>(
    `SELECT sinkron_tertunda FROM pengajuan WHERE id = ?`, [id]);
  expect(p!.sinkron_tertunda).toBe(0);
});
```

Jumlah tertunda ikut di `GET /api/admin/antrean` dan muncul sebagai peringatan di dashboard. Cermin yang diam-diam ketinggalan lebih berbahaya daripada cermin yang jelas-jelas rusak. `cerminTertunda()` dijalankan `setInterval` tiap 5 menit.

```bash
git commit -m "feat: Google Sheets mirror with visible pending-sync flag"
```

---

### Task 15: Export Excel dan ke Google Drive

**Files:** `vps/server/src/layanan/excel.ts`, `vps/server/src/rute/export.ts`

**Interfaces:** `GET /api/export/excel` (unduh `.xlsx`), `POST /api/export/drive` → `{ url }`

Uji: header sesuai urutan yang ditentukan; judul bertanda koma dan kutip tidak menggeser kolom; berkas yang dihasilkan bisa dibuka `ExcelJS.Workbook().xlsx.load`.

```bash
git commit -m "feat: Excel export and archive-to-Drive"
```

---

### Task 16: Backup harian ke Drive

**Files:** `vps/server/src/perintah/backup.ts`, `vps/deploy/backup.sh`

`mysqldump --single-transaction` → gzip → `driveUnggahKecil` ke folder `SIMPEL/Backup` → hapus salinan Drive yang lebih tua dari 30 hari. Dipasang lewat cron pukul 02:00 WIB.

Verifikasi manual yang wajib: **unduh hasil backup, jalankan restore ke database kosong, dan pastikan jumlah barisnya sama.** Backup yang belum pernah dipulihkan bukan backup.

```bash
git commit -m "feat: nightly database backup to Google Drive"
```

---

### Task 17: Deploy — systemd, Caddy, subdomain, panduan

**Files:** `vps/deploy/simpel.service`, `vps/deploy/Caddyfile.contoh`, `vps/README.md`

`vps/deploy/simpel.service`:

```ini
[Unit]
Description=SIMPEL Hukum Brebes
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=finnacantik
WorkingDirectory=/opt/simpel/server
EnvironmentFile=/opt/simpel/server/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

# VPS hanya punya 842 MB dan dibagi dengan semar, combis, mariadb, dan caddy.
# Tanpa batas ini, kebocoran memori SIMPEL bisa membuat OOM killer memilih
# tetangganya sebagai korban.
MemoryMax=200M
MemoryHigh=160M

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/simpel

[Install]
WantedBy=multi-user.target
```

`Caddyfile` — tambahkan blok baru tanpa menyentuh dua domain yang sudah ada:

```
simpel.marazystudio.my.id {
    root * /opt/simpel/web
    handle /api/* {
        reverse_proxy 127.0.0.1:3101
    }
    handle {
        try_files {path} /index.html    # React Router butuh fallback SPA
        file_server
    }
    encode gzip zstd
}
```

Daftar periksa akhir:

- [ ] `npm test` hijau di `vps/server`
- [ ] `npm run build` sukses di kedua folder
- [ ] `sudo systemctl status simpel` aktif, `systemctl show simpel -p MemoryMax` menunjukkan 200 M
- [ ] `curl -s https://<subdomain>/api/sehat` → `{"status":"ok"}`
- [ ] **`jdih.marazystudio.my.id` dan `compbus.marazystudio.my.id` masih HTTP 200** — pastikan tetangganya tidak terganggu
- [ ] `free -h` masih menyisakan >150 MB setelah SIMPEL naik
- [ ] Buka tiap halaman di lebar 360 px: tidak ada geseran mendatar
- [ ] Backup dijalankan sekali dan **dipulihkan** ke database kosong
- [ ] Tautan Linktree diperbarui, Google Form lama ditutup

```bash
git commit -m "docs: deployment units, Caddy config, and operations guide"
```

---

## Self-Review

**Cakupan spesifikasi.** Tiap bagian spec punya tugas yang mengerjakannya:

| Bagian spec | Tugas |
|---|---|
| 4 Arsitektur | 1, 2, 6, 17 |
| 5 Model data | 2 |
| 6.1 Publik | 6, 7 |
| 6.2 Form pengajuan | 10 |
| 6.3 Perlindungan form terbuka | 9 (rate limit), 10 (honeypot) |
| 6.4 Admin | 4, 11, 12 |
| 6.5 Export | 15 |
| 6.6 Cermin Sheets | 14 |
| 6.7 Backup | 16 |
| 7 Migrasi | 13 |
| 8 Modul yang diselamatkan | 3 |
| 10 Penanganan galat | 6 (`tangkapGalat`), 8 (`GalatGoogle`), 14 (tertunda), 17 (`MemoryMax`) |
| 11 Pengujian | tersebar; verifikasi manual di 9, 13, 16, 17 |

**Paritas dengan `GAS_version`.** Diperiksa satu per satu: wizard penyiapan (digantikan `.env` + `siapkanSkema`), monitoring, detail, form 4 langkah, unggah bertahap, antrean, tambah riwayat, ubah status beralasan, rekap, CSV/Excel, kelola OPD, kelola admin, pengaturan, log audit, dua sakelar keterbukaan, penamaan berkas otomatis, migrasi kolom 16. Tidak ada yang hilang.

**Konsistensi nama.** `pengajuanBuat`, `riwayatTambah`, `berkasTambah`, `pengaturanSemua`, `validasiBerkas`, `susunKolomProses`, `driveBuatSesiUnggah`, `googleFetch`, `wajibAdmin` dipakai dengan tanda tangan yang sama di setiap tugas yang memanggilnya.

**Yang sengaja tidak dibangun:** pemberitahuan email (diputuskan tidak perlu), login OPD (diputuskan tidak perlu), wizard penyiapan berbasis web (digantikan `.env`, karena di VPS konfigurasi memang tempatnya di sana).
