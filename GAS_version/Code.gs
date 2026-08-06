

// ============================================================
// Skema.gs
// ============================================================

/**
 * Skema.gs - definisi kolom dan pencocokan header. Fungsi murni, tanpa
 * panggilan layanan Google, sehingga bisa diuji lewat tests/skema.test.js.
 *
 * Kolom 1-18 adalah struktur spreadsheet PERMOHONAN RAPERDA/RAPERBUP yang
 * sudah dipakai Bagian Hukum. Strukturnya tidak diubah supaya tautan
 * monitoring lama tetap hidup selama masa peralihan.
 */

/** Kolom 1-18: hasil Google Form ditambah tiga kolom manual Bagian Hukum. */
var KOLOM_FORM = [
  { kunci: 'timestamp',        judul: 'Timestamp',                                    jenis: 'waktu' },
  { kunci: 'opd',              judul: 'Nama OPD Pemohon',                             jenis: 'teks',    wajib: true },
  { kunci: 'jenis_peraturan',  judul: 'Jenis Rancangan Peraturan',                    jenis: 'pilihan', wajib: true },
  { kunci: 'judul',            judul: 'Judul Raperda/Raperbup',                       jenis: 'teks',    wajib: true },
  { kunci: 'surat_permohonan', judul: 'Surat Permohonan Rancangan Perda/Perbup',      jenis: 'berkas',  wajib: true },
  { kunci: 'keterangan_na',    judul: 'Keterangan/Penjelasan Rancangan Perbup atau NA Perda', jenis: 'berkas', wajib: true,
    alias: ['Keterangan/Penjelasan Raperbup atau NA Perda'] },
  { kunci: 'rancangan',        judul: 'Rancangan Perda/Perbup',                       jenis: 'berkas',  wajib: true },
  { kunci: 'lampiran',         judul: 'Lampiran Raperda/Raperbup',                    jenis: 'berkas' },
  { kunci: 'paraf',            judul: 'Paraf Koordinasi',                             jenis: 'berkas',  wajib: true },
  { kunci: 'dasar_hukum',      judul: 'Dasar Hukum Penyusunan Raperda/Raperbup',      jenis: 'berkas',  wajib: true,
    alias: ['Dasar Hukum Penyusunan'] },
  { kunci: 'sk_tim',           judul: 'SK Tim Penyusunan RAPERDA',                    jenis: 'berkas',  hanyaPerda: true },
  { kunci: 'ba_pansus',        judul: 'Berita Acara Rapat PANSUS AKHIR',              jenis: 'berkas',  hanyaPerda: true },
  { kunci: 'hasil_konsultasi', judul: 'Hasil Konsultasi',                             jenis: 'berkas' },
  { kunci: 'nama_pemohon',     judul: 'Nama Pemohon',                                 jenis: 'teks',    wajib: true },
  { kunci: 'wa_pemohon',       judul: 'Nomor WhatsApp Pemohon',                       jenis: 'wa',      wajib: true },
  { kunci: 'proses',           judul: 'Tanggal dan Detail Proses',                    jenis: 'teks' },
  { kunci: 'keterangan',       judul: 'Keterangan',                                   jenis: 'teks' },
  { kunci: 'status',           judul: 'Status',                                       jenis: 'pilihan' }
];

/** Kolom 19-23: ditambahkan di sebelah kanan tanpa mengganggu kolom lama. */
var KOLOM_TAMBAHAN = [
  { kunci: 'id',              judul: 'ID' },
  { kunci: 'email_pemohon',   judul: 'Email Pemohon' },
  { kunci: 'kode_opd',        judul: 'Kode OPD' },
  { kunci: 'diperbarui_pada', judul: 'Diperbarui Pada' },
  { kunci: 'diperbarui_oleh', judul: 'Diperbarui Oleh' }
];

var SKEMA_RIWAYAT = ['id_riwayat', 'id_pengajuan', 'tanggal', 'tahap', 'keterangan', 'dicatat_oleh', 'dicatat_pada'];
var SKEMA_OPD = ['kode_opd', 'nama_resmi', 'nama_singkat', 'aktif'];
var SKEMA_PENGATURAN = ['kunci', 'nilai', 'keterangan'];
var SKEMA_LOG = ['waktu', 'email', 'aksi', 'id_pengajuan', 'rincian', 'ip'];
var SKEMA_ADMIN = ['email', 'nama', 'aktif', 'ditambahkan_oleh', 'ditambahkan_pada'];

var TAHAP_RIWAYAT = [
  'BERKAS_MASUK', 'REVIU_HUKUM', 'PRA_HARMONISASI', 'RAPAT_HARMONISASI',
  'SELESAI_HARMONISASI', 'FASILITASI', 'HASIL_FASILITASI', 'DIKEMBALIKAN',
  'PERBAIKAN', 'PENETAPAN', 'LAINNYA'
];

var STATUS_PENGAJUAN = ['PROSES', 'SELESAI', 'DIKEMBALIKAN'];

var NAMA_SHEET_RIWAYAT = 'Riwayat';
var NAMA_SHEET_OPD = 'OPD';
var NAMA_SHEET_PENGATURAN = 'Pengaturan';
var NAMA_SHEET_LOG = 'Log';
var NAMA_SHEET_ADMIN = 'Admin';

/**
 * Seragamkan satu judul kolom supaya perbedaan ejaan tidak menghalangi
 * pencocokan: huruf kecil semua, tanda baca jadi spasi, spasi ganda dirapatkan.
 * Inilah yang membuat 'Judul Raperda / Raperbup' cocok dengan
 * 'Judul Raperda/Raperbup'.
 */
function normalisasiHeader(teks) {
  if (teks === null || teks === undefined) return '';
  return String(teks)
    .toLowerCase()
    .replace(/[\/\\\-_.,:;()\[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @returns {string} judul resmi untuk kunci kolom, '' bila tidak dikenal */
function judulKolom(kunci) {
  var semua = KOLOM_FORM.concat(KOLOM_TAMBAHAN);
  for (var i = 0; i < semua.length; i++) {
    if (semua[i].kunci === kunci) return semua[i].judul;
  }
  return '';
}

/**
 * Periksa baris header sebuah sheet dan simpulkan jenisnya.
 *
 * @param {Array} barisHeader isi baris pertama sheet
 * @returns {{jenis: string, peta: Object, dikenali: number, hilang: Array<string>, asing: Array<string>}}
 *   KOSONG - tidak ada judul kolom sama sekali
 *   SIMPEL - kolom form lengkap dan kelima kolom tambahan sudah ada
 *   FORM   - kolom form lengkap, belum pernah dipasang SIMPEL
 *   ASING  - ada isinya tapi tidak cocok; wizard menampilkan pencocokan manual
 */
function cocokkanHeader(barisHeader) {
  var header = (barisHeader || []).map(normalisasiHeader);
  if (!header.some(function (h) { return h !== ''; })) {
    return { jenis: 'KOSONG', peta: {}, dikenali: 0, hilang: [], asing: [] };
  }

  var semua = KOLOM_FORM.concat(KOLOM_TAMBAHAN);
  var peta = {};
  var terpakai = {};

  for (var i = 0; i < semua.length; i++) {
    // Judul resmi plus ejaan lain yang dipakai di lapangan. Satu kolom yang
    // tidak cocok membuat seluruh spreadsheet dinilai ASING dan penyiapan
    // ditolak, jadi ejaan yang beredar diterima semua.
    var target = [semua[i].judul].concat(semua[i].alias || []).map(normalisasiHeader);
    for (var j = 0; j < header.length; j++) {
      if (terpakai[j]) continue;
      if (target.indexOf(header[j]) >= 0) {
        peta[semua[i].kunci] = j;
        terpakai[j] = true;
        break;
      }
    }
  }

  var hilang = [];
  for (var k = 0; k < KOLOM_FORM.length; k++) {
    if (peta[KOLOM_FORM[k].kunci] === undefined) hilang.push(KOLOM_FORM[k].kunci);
  }

  var asing = [];
  for (var m = 0; m < barisHeader.length; m++) {
    if (!terpakai[m] && normalisasiHeader(barisHeader[m]) !== '') asing.push(String(barisHeader[m]));
  }

  // Ambang: seluruh kolom form harus ada. Setengah cocok bukan pertanda baik --
  // memuat data dengan pemetaan tebak-tebakan lebih berbahaya daripada meminta
  // pengguna memetakan sendiri.
  if (hilang.length > 0) {
    return { jenis: 'ASING', peta: peta, dikenali: Object.keys(peta).length, hilang: hilang, asing: asing };
  }

  var punyaTambahan = KOLOM_TAMBAHAN.every(function (kol) {
    return peta[kol.kunci] !== undefined;
  });

  return {
    jenis: punyaTambahan ? 'SIMPEL' : 'FORM',
    peta: peta,
    dikenali: Object.keys(peta).length,
    hilang: [],
    asing: asing
  };
}

/**
 * Isi awal sheet Pengaturan. Seluruh batas ukuran dan sakelar ada di sini,
 * bukan di kode, supaya Bagian Hukum bisa mengubahnya tanpa deploy ulang.
 * Batas dalam megabita.
 */
function pengaturanAwal() {
  return [
    ['publik_tampilkan_wa', 'TRUE', 'FALSE membuat nomor WA tampil tersamar bagi bukan admin'],
    ['publik_tampilkan_berkas', 'TRUE', 'FALSE menyembunyikan tautan berkas dari pengunjung umum'],
    ['batas_surat_permohonan', '5', 'MB - Surat Permohonan'],
    ['batas_keterangan_na', '5', 'MB - Keterangan/Penjelasan atau NA Perda'],
    ['batas_rancangan', '10', 'MB - Rancangan Perda/Perbup'],
    ['batas_lampiran', '30', 'MB - Lampiran Raperda/Raperbup (maksimal 30)'],
    ['batas_paraf', '5', 'MB - Paraf Koordinasi'],
    ['batas_dasar_hukum', '5', 'MB - Dasar Hukum Penyusunan'],
    ['batas_sk_tim', '5', 'MB - SK Tim Penyusunan RAPERDA'],
    ['batas_ba_pansus', '5', 'MB - Berita Acara Rapat PANSUS AKHIR'],
    ['batas_hasil_konsultasi', '30', 'MB - Hasil Konsultasi (maksimal 30)'],
    ['maks_berkas_ba_pansus', '5', 'Jumlah berkas maksimal untuk Berita Acara PANSUS'],
    ['pengumuman', '', 'Teks pengumuman di halaman depan; kosongkan bila tidak ada'],
    ['nomor_terakhir', '', 'Nomor pengajuan terakhir, contoh BRB-2026-0029. Jangan diubah manual'],
    ['id_folder_induk', '', 'ID folder Drive tujuan; diisi otomatis oleh wizard'],
    ['ambang_mandek_hari', '7', 'Pengajuan PROSES yang tidak bergerak sekian hari diberi tanda']
  ];
}



// ============================================================
// Konfigurasi.gs (tanpa Google Cloud / Picker)
// ============================================================

var KUNCI_ID_SPREADSHEET = 'ID_SPREADSHEET';
var KUNCI_NAMA_SHEET = 'NAMA_SHEET_PENGAJUAN';
var KUNCI_ID_FOLDER = 'ID_FOLDER';
var CACHE_PENGATURAN = 'pengaturan_v1';
var UMUR_CACHE_PENGATURAN = 300;

function propSkrip() { return PropertiesService.getScriptProperties(); }
function konfigIdSpreadsheet() { return propSkrip().getProperty(KUNCI_ID_SPREADSHEET) || ''; }
function konfigNamaSheet() { return propSkrip().getProperty(KUNCI_NAMA_SHEET) || ''; }
function konfigIdFolder() { return propSkrip().getProperty(KUNCI_ID_FOLDER) || ''; }
function konfigSudahSiap() { return !!(konfigIdSpreadsheet() && konfigNamaSheet()); }

function konfigSetelDasar(nilai) {
  var prop = propSkrip();
  if (nilai.idSpreadsheet) prop.setProperty(KUNCI_ID_SPREADSHEET, nilai.idSpreadsheet);
  if (nilai.namaSheet) prop.setProperty(KUNCI_NAMA_SHEET, nilai.namaSheet);
  if (nilai.idFolder) prop.setProperty(KUNCI_ID_FOLDER, nilai.idFolder);
  pengaturanBersihkanCache();
}

function konfigHapus() {
  var prop = propSkrip();
  [KUNCI_ID_SPREADSHEET, KUNCI_NAMA_SHEET, KUNCI_ID_FOLDER].forEach(function (k) { prop.deleteProperty(k); });
  pengaturanBersihkanCache();
}

function pengaturanSemua() {
  var cache = CacheService.getScriptCache();
  var tersimpan = cache.get(CACHE_PENGATURAN);
  if (tersimpan) { try { return JSON.parse(tersimpan); } catch (e) {} }
  var peta = {};
  pengaturanAwal().forEach(function (baris) { peta[baris[0]] = baris[1]; });
  var idSs = konfigIdSpreadsheet();
  if (idSs) {
    try {
      lembarBaca(idSs, NAMA_SHEET_PENGATURAN, 'A2:B').forEach(function (baris) {
        var kunci = String(baris[0] || '').trim();
        if (kunci) peta[kunci] = baris[1] === undefined || baris[1] === null ? '' : String(baris[1]);
      });
    } catch (e) {}
  }
  cache.put(CACHE_PENGATURAN, JSON.stringify(peta), UMUR_CACHE_PENGATURAN);
  return peta;
}

function pengaturanBenar(kunci) {
  var nilai = String(pengaturanSemua()[kunci] || '').trim().toUpperCase();
  return nilai === 'TRUE' || nilai === 'YA' || nilai === '1';
}

function pengaturanSetel(kunci, nilai) {
  var idSs = konfigIdSpreadsheet();
  var baris = lembarBaca(idSs, NAMA_SHEET_PENGATURAN, 'A2:C');
  for (var i = 0; i < baris.length; i++) {
    if (String(baris[i][0] || '').trim() === kunci) {
      lembarTulis(idSs, NAMA_SHEET_PENGATURAN, 'B' + (i + 2), [[String(nilai)]]);
      pengaturanBersihkanCache();
      return;
    }
  }
  lembarTambahBaris(idSs, NAMA_SHEET_PENGATURAN, [kunci, String(nilai), '']);
  pengaturanBersihkanCache();
}

function pengaturanBersihkanCache() { CacheService.getScriptCache().remove(CACHE_PENGATURAN); }

// ============================================================
// Lembar.gs (SpreadsheetApp, tanpa REST API)
// ============================================================

function lembarRentang(namaSheet, a1) {
  var nama = String(namaSheet).replace(/'/g, "''");
  return "'" + nama + "'" + (a1 ? '!' + a1 : '');
}

function lembarKolomHuruf(nomor) {
  var huruf = '';
  var n = nomor;
  while (n > 0) { var sisa = (n - 1) % 26; huruf = String.fromCharCode(65 + sisa) + huruf; n = Math.floor((n - 1) / 26); }
  return huruf;
}

function _bukaSheet(idSs, namaSheet) {
  try {
    var ss = SpreadsheetApp.openById(idSs);
  } catch (e) {
    throw new Error('Spreadsheet tidak bisa dibuka. Pastikan link benar dan Anda memiliki akses. (' + e.message + ')');
  }
  var sheet = ss.getSheetByName(namaSheet);
  if (!sheet) return null;
  return sheet;
}

function _kolKeNomor(kol) {
  var n = 0;
  for (var i = 0; i < kol.length; i++) n = n * 26 + (kol.charCodeAt(i) - 64);
  return n;
}

/**
 * Lebarkan grid sheet bila rentang yang dituju melewati batasnya.
 *
 * Inilah perbedaan paling menjebak antara REST API dan SpreadsheetApp: REST
 * melebarkan grid sendiri, SpreadsheetApp melempar "out of bounds". Menulis 23
 * kolom header ke sheet jawaban Form yang cuma punya 18 kolom akan gagal tanpa
 * fungsi ini -- tepat pada langkah migrasi data sungguhan.
 */
function _pastikanMuat(sheet, barisAkhir, kolomAkhir) {
  var maksBaris = sheet.getMaxRows();
  if (barisAkhir > maksBaris) sheet.insertRowsAfter(maksBaris, barisAkhir - maksBaris);
  var maksKolom = sheet.getMaxColumns();
  if (kolomAkhir > maksKolom) sheet.insertColumnsAfter(maksKolom, kolomAkhir - maksKolom);
}

function lembarDaftarSheet(idSs) {
  var ss = SpreadsheetApp.openById(idSs);
  return ss.getSheets().map(function (s) {
    return { judul: s.getName(), idSheet: s.getSheetId(), baris: s.getMaxRows(), kolom: s.getMaxColumns() };
  });
}

function lembarAdaSheet(idSs, judul) {
  return lembarDaftarSheet(idSs).some(function (s) { return s.judul === judul; });
}

function lembarBaca(idSs, namaSheet, a1) {
  var sheet = _bukaSheet(idSs, namaSheet);
  if (!sheet || sheet.getLastRow() === 0) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];

  // Parse A1: 'A2:AZ', '1:1', 'A2:A', 'A2:B', 'A2:C', 'A2:D'
  var barisMatch = a1.match(/^(\d+):(\d+)$/);
  if (barisMatch) {
    var r = parseInt(barisMatch[1], 10);
    if (r > lastRow) return [];
    var endR = Math.min(parseInt(barisMatch[2], 10), lastRow);
    return sheet.getRange(r, 1, endR - r + 1, lastCol).getValues()
      .map(function(row) { return row.map(function(v) { return v === null || v === undefined ? '' : v; }); });
  }

  var m = a1.match(/^([A-Z]+)(\d+):([A-Z]+)(\d*)$/);
  if (!m) return [];
  var sc = _kolKeNomor(m[1]), sr = parseInt(m[2], 10);
  var ec = _kolKeNomor(m[3]), er = m[4] ? parseInt(m[4], 10) : lastRow;
  if (sr > lastRow || sc > lastCol) return [];
  er = Math.min(er, lastRow);
  // 'A2:AZ' berarti kolom ke-52. Sheet pengajuan hanya punya 23 kolom, dan
  // meminta lebih dari yang ada membuat getRange melempar galat -- yang
  // mematikan seluruh halaman karena semuanya memanggil pengajuanSemua().
  ec = Math.min(ec, lastCol);
  var nr = er - sr + 1, nc = ec - sc + 1;
  if (nr <= 0 || nc <= 0) return [];
  var vals = sheet.getRange(sr, sc, nr, nc).getValues();
  while (vals.length > 0 && vals[vals.length - 1].every(function (v) { return v === '' || v === null; })) vals.pop();
  return vals;
}

function lembarBacaHeader(idSs, namaSheet) {
  var sheet = _bukaSheet(idSs, namaSheet);
  if (!sheet || sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (v) { return String(v === null || v === undefined ? '' : v); });
}

function lembarTulis(idSs, namaSheet, a1, nilai) {
  var sheet = _bukaSheet(idSs, namaSheet);
  if (!sheet) throw new Error('Sheet ' + namaSheet + ' tidak ditemukan.');
  try {
    // SpreadsheetApp butuh range yang cocok dimensinya dengan data.
    // REST API otomatis melebar, SpreadsheetApp tidak.
    var numRows = nilai.length;
    var numCols = nilai[0] ? nilai[0].length : 1;
    // Parse posisi awal dari A1 notation (misal 'A1', 'B5', 'A2')
    var m = a1.match(/^([A-Z]+)(\d+)/);
    if (m) {
      var startCol = _kolKeNomor(m[1]);
      var startRow = parseInt(m[2], 10);
      _pastikanMuat(sheet, startRow + numRows - 1, startCol + numCols - 1);
      sheet.getRange(startRow, startCol, numRows, numCols).setValues(nilai);
    } else {
      sheet.getRange(a1).setValues(nilai);
    }
    SpreadsheetApp.flush();
  } catch (e) {
    if (e.message && (e.message.indexOf('permission') >= 0 || e.message.indexOf('izin') >= 0)) {
      throw new Error('Tidak memiliki akses tulis ke spreadsheet. Minta pemilik untuk menambahkan Anda sebagai editor.');
    }
    throw e;
  }
}

function lembarTambahBaris(idSs, namaSheet, baris) {
  var sheet = _bukaSheet(idSs, namaSheet);
  if (!sheet) throw new Error('Sheet ' + namaSheet + ' tidak ditemukan.');
  try {
    var target = sheet.getLastRow() + 1;
    // Sheet baru punya 1000 baris. Tanpa pelebaran ini, setiap penulisan gagal
    // begitu baris terakhir tercapai -- Log yang paling cepat sampai ke sana.
    _pastikanMuat(sheet, target, baris.length);
    sheet.getRange(target, 1, 1, baris.length).setValues([baris]);
    SpreadsheetApp.flush();
    return target;
  } catch (e) {
    if (e.message && e.message.indexOf('permission') >= 0) {
      throw new Error('Tidak memiliki akses tulis ke spreadsheet.');
    }
    throw e;
  }
}

function lembarBuatSheet(idSs, judul, header) {
  var ss = SpreadsheetApp.openById(idSs);
  var sheet = ss.insertSheet(judul);
  if (sheet.getMaxRows() > 1) sheet.setFrozenRows(1);
  if (header && header.length) sheet.getRange(1, 1, 1, header.length).setValues([header]);
  SpreadsheetApp.flush();
  return sheet.getSheetId();
}

function lembarSalinSheet(idSs, judulAsal, judulSalinan) {
  var ss = SpreadsheetApp.openById(idSs);
  var asal = ss.getSheetByName(judulAsal);
  if (!asal) throw new Error('Sheet ' + judulAsal + ' tidak ditemukan.');
  var salinan = asal.copyTo(ss);
  salinan.setName(judulSalinan);
  return salinan.getSheetId();
}

// ============================================================
// Berkas.gs (DriveApp, tanpa REST API kecuali resumable upload)
// ============================================================

function berkasMeta(id) {
  try {
    var f = DriveApp.getFileById(id);
    return { id: f.getId(), name: f.getName(), size: f.getSize(), mimeType: f.getMimeType(), webViewLink: f.getUrl(), parents: [] };
  } catch (e) {
    throw new Error('Berkas tidak ditemukan atau akses ditolak.');
  }
}

function berkasFolderBuat(nama, idInduk) {
  var induk = idInduk ? DriveApp.getFolderById(idInduk) : DriveApp.getRootFolder();
  return induk.createFolder(nama).getId();
}

function berkasFolderCari(nama, idInduk) {
  var induk = idInduk ? DriveApp.getFolderById(idInduk) : DriveApp.getRootFolder();
  var iter = induk.getFoldersByName(nama);
  return iter.hasNext() ? iter.next().getId() : null;
}

function berkasFolderPastikan(nama, idInduk) {
  return berkasFolderCari(nama, idInduk) || berkasFolderBuat(nama, idInduk);
}

function berkasPindahDanNamai(id, idFolder, nama) {
  var f = DriveApp.getFileById(id);
  f.setName(nama);
  var tujuan = DriveApp.getFolderById(idFolder);
  f.moveTo(tujuan);
  return { id: f.getId(), name: f.getName(), size: f.getSize(), mimeType: f.getMimeType(), webViewLink: f.getUrl() };
}

function berkasHapus(id) {
  try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
}

function berkasIzin(id) {
  try {
    var ss = SpreadsheetApp.openById(id);
    var hasil = [];
    var pemilik = ss.getOwner();
    if (pemilik) hasil.push({ email: pemilik.getEmail().toLowerCase(), peran: 'owner' });
    ss.getEditors().forEach(function (u) { hasil.push({ email: u.getEmail().toLowerCase(), peran: 'writer' }); });
    return hasil;
  } catch (e) { return []; }
}

/** Resumable upload - satu-satunya yang masih pakai REST (butuh URL sesi). */
function berkasMulaiUnggah(nama, mime, idFolder) {
  var url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id';
  var muatan = { name: nama };
  if (idFolder) muatan.parents = [idFolder];
  var jawaban = UrlFetchApp.fetch(url, {
    method: 'post', muteHttpExceptions: true,
    contentType: 'application/json; charset=UTF-8',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime || 'application/octet-stream' },
    payload: JSON.stringify(muatan)
  });
  var kode = jawaban.getResponseCode();
  if (kode >= 400) throw new Error('Gagal memulai unggah (HTTP ' + kode + '): ' + jawaban.getContentText());
  var kepala = jawaban.getHeaders();
  var lokasi = kepala['Location'] || kepala['location'];
  if (!lokasi) throw new Error('Drive tidak mengembalikan URL sesi unggah.');
  return lokasi;
}

// ============================================================
// Auth.gs (SpreadsheetApp editors, tanpa Drive REST)
// ============================================================

var CACHE_ADMIN = 'daftar_admin_v1';
var UMUR_CACHE_ADMIN = 300;

function emailPengunjung() {
  try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
}

/** Pastikan sheet Admin ada. Pemasangan lama belum punya sheet ini. */
function _pastikanSheetAdmin() {
  var idSs = konfigIdSpreadsheet();
  if (!idSs) return false;
  if (!lembarAdaSheet(idSs, NAMA_SHEET_ADMIN)) {
    lembarBuatSheet(idSs, NAMA_SHEET_ADMIN, SKEMA_ADMIN);
  }
  return true;
}

/** @returns {Array<{email, nama, aktif, ditambahkan_oleh, ditambahkan_pada}>} */
function adminSheetBaca() {
  var idSs = konfigIdSpreadsheet();
  if (!idSs) return [];
  try {
    return lembarBaca(idSs, NAMA_SHEET_ADMIN, 'A2:E')
      .map(function (b, i) {
        return {
          barisKe: i + 2,
          email: String(b[0] || '').trim().toLowerCase(),
          nama: String(b[1] || ''),
          aktif: String(b[2] === undefined || b[2] === '' ? 'TRUE' : b[2]).toUpperCase() !== 'FALSE',
          ditambahkan_oleh: String(b[3] || ''),
          ditambahkan_pada: String(b[4] || '')
        };
      })
      .filter(function (a) { return a.email; });
  } catch (e) {
    return [];
  }
}

/**
 * Admin = pemilik/editor spreadsheet DITAMBAH isi sheet Admin.
 *
 * Editor spreadsheet sengaja tetap dihitung supaya tidak mungkin mengunci diri
 * sendiri: sheet Admin bisa saja terhapus atau salah isi, dan kalau itu
 * satu-satunya sumber, tidak ada seorang pun yang bisa masuk untuk membetulkan.
 */
function daftarAdmin() {
  var cache = CacheService.getScriptCache();
  var tersimpan = cache.get(CACHE_ADMIN);
  if (tersimpan) { try { return JSON.parse(tersimpan); } catch (e) {} }
  var idSs = konfigIdSpreadsheet();
  if (!idSs) return [];

  var daftar = [];
  try {
    daftar = berkasIzin(idSs)
      .filter(function (p) { return p.peran === 'owner' || p.peran === 'writer'; })
      .map(function (p) { return p.email; });
  } catch (e) { daftar = []; }

  adminSheetBaca().forEach(function (a) {
    if (a.aktif && daftar.indexOf(a.email) < 0) daftar.push(a.email);
  });

  cache.put(CACHE_ADMIN, JSON.stringify(daftar), UMUR_CACHE_ADMIN);
  return daftar;
}

/** Email pemilik spreadsheet; dia tidak boleh dihapus dari daftar admin. */
function adminPemilikSpreadsheet() {
  try {
    var pemilik = berkasIzin(konfigIdSpreadsheet())
      .filter(function (p) { return p.peran === 'owner'; })[0];
    return pemilik ? pemilik.email : '';
  } catch (e) { return ''; }
}

/**
 * Daftar admin untuk halaman pengaturan, lengkap dengan asal-usulnya supaya
 * jelas mana yang bisa dihapus dari sini dan mana yang harus lewat sharing.
 * @returns {Array<{email, nama, sumber, bisaHapus}>}
 */
function adminDaftar() {
  wajibAdmin();
  var dariSheet = {};
  adminSheetBaca().forEach(function (a) { if (a.aktif) dariSheet[a.email] = a; });

  var hasil = [];
  var sudah = {};
  try {
    berkasIzin(konfigIdSpreadsheet())
      .filter(function (p) { return p.peran === 'owner' || p.peran === 'writer'; })
      .forEach(function (p) {
        if (sudah[p.email]) return;
        sudah[p.email] = true;
        hasil.push({
          email: p.email,
          nama: (dariSheet[p.email] && dariSheet[p.email].nama) || '',
          sumber: p.peran === 'owner' ? 'Pemilik spreadsheet' : 'Editor spreadsheet',
          bisaHapus: false
        });
      });
  } catch (e) { /* daftar sheet tetap ditampilkan di bawah */ }

  Object.keys(dariSheet).forEach(function (email) {
    if (sudah[email]) return;
    hasil.push({
      email: email,
      nama: dariSheet[email].nama,
      sumber: 'Ditambahkan lewat aplikasi',
      bisaHapus: true
    });
  });

  return hasil;
}

function adminTambah(email, nama) {
  wajibAdmin();
  var bersih = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(bersih)) {
    throw new Error('Alamat email tidak sah.');
  }
  if (daftarAdmin().indexOf(bersih) >= 0) {
    throw new Error(bersih + ' sudah menjadi admin.');
  }

  _pastikanSheetAdmin();
  var sudahAda = adminSheetBaca().filter(function (a) { return a.email === bersih; })[0];
  if (sudahAda) {
    // Pernah ada tapi dinonaktifkan -- hidupkan kembali, jangan tulis baris kembar.
    lembarTulis(konfigIdSpreadsheet(), NAMA_SHEET_ADMIN, 'C' + sudahAda.barisKe, [['TRUE']]);
  } else {
    lembarTambahBaris(konfigIdSpreadsheet(), NAMA_SHEET_ADMIN, [
      bersih,
      String(nama || ''),
      'TRUE',
      emailPengunjung(),
      Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss')
    ]);
  }

  authBersihkanCache();
  logCatat('TAMBAH_ADMIN', '', bersih);
  return { sukses: true };
}

function adminHapus(email) {
  wajibAdmin();
  var bersih = String(email || '').trim().toLowerCase();

  if (bersih === emailPengunjung()) {
    throw new Error('Tidak bisa menghapus diri sendiri dari daftar admin.');
  }
  if (bersih === adminPemilikSpreadsheet()) {
    throw new Error('Pemilik spreadsheet tidak bisa dihapus dari sini.');
  }

  var baris = adminSheetBaca().filter(function (a) { return a.email === bersih; })[0];
  if (!baris) {
    throw new Error(bersih + ' berasal dari sharing spreadsheet. Cabut aksesnya lewat tombol Share di spreadsheet.');
  }

  // Ditandai tidak aktif, bukan dihapus barisnya -- jejak siapa menambahkan
  // dan kapan tetap tersimpan.
  lembarTulis(konfigIdSpreadsheet(), NAMA_SHEET_ADMIN, 'C' + baris.barisKe, [['FALSE']]);
  authBersihkanCache();
  logCatat('HAPUS_ADMIN', '', bersih);
  return { sukses: true };
}

function penggunaSekarang() {
  var email = emailPengunjung();
  if (!email) return { email: '', peran: 'PUBLIK' };
  return { email: email, peran: daftarAdmin().indexOf(email) >= 0 ? 'ADMIN' : 'PEMOHON' };
}
function apakahAdmin() { return penggunaSekarang().peran === 'ADMIN'; }
function wajibAdmin() { if (!apakahAdmin()) throw new Error('Halaman ini hanya untuk Bagian Hukum.'); }
function authBersihkanCache() { CacheService.getScriptCache().remove(CACHE_ADMIN); }
// ============================================================
// Validasi.gs
// ============================================================

/**
 * Validasi.gs - aturan wajib, ukuran, dan jenis berkas. Fungsi murni.
 *
 * Batas ukuran tidak ditulis di sini; yang ditulis hanya nama kunci
 * pengaturannya. Nilainya dibaca dari sheet Pengaturan dan diteruskan sebagai
 * argumen, supaya Bagian Hukum bisa mengubah batas tanpa deploy ulang.
 */

var ATURAN_BERKAS = {
  surat_permohonan: { kunciBatas: 'batas_surat_permohonan', ekstensi: ['pdf'] },
  keterangan_na:    { kunciBatas: 'batas_keterangan_na',    ekstensi: ['pdf'] },
  rancangan:        { kunciBatas: 'batas_rancangan',        ekstensi: ['pdf'] },
  lampiran:         { kunciBatas: 'batas_lampiran',         ekstensi: ['pdf'] },
  paraf:            { kunciBatas: 'batas_paraf',            ekstensi: ['pdf'] },
  dasar_hukum:      { kunciBatas: 'batas_dasar_hukum',      ekstensi: ['pdf'] },
  sk_tim:           { kunciBatas: 'batas_sk_tim',           ekstensi: ['pdf'] },
  ba_pansus:        { kunciBatas: 'batas_ba_pansus',        ekstensi: ['pdf'], kunciMaksBerkas: 'maks_berkas_ba_pansus' },
  hasil_konsultasi: { kunciBatas: 'batas_hasil_konsultasi', ekstensi: ['pdf'] }
};

var SATU_MB = 1024 * 1024;

/** @returns {string} ekstensi huruf kecil tanpa titik, '' bila tidak ada */
function ekstensiDari(nama) {
  var teks = String(nama || '');
  var titik = teks.lastIndexOf('.');
  if (titik < 0 || titik === teks.length - 1) return '';
  return teks.slice(titik + 1).toLowerCase();
}

/**
 * Seragamkan nomor WhatsApp jadi bentuk 08xxxxxxxxx.
 * Menerima 0822..., +62822..., 62822..., dengan spasi atau tanda hubung.
 * @returns {string|null} null bila tidak menyerupai nomor seluler Indonesia
 */
function normalisasiWa(teks) {
  if (teks === null || teks === undefined) return null;
  var angka = String(teks).replace(/[^0-9+]/g, '');
  if (angka.indexOf('+62') === 0) angka = '0' + angka.slice(3);
  else if (angka.indexOf('62') === 0 && angka.length > 10) angka = '0' + angka.slice(2);
  angka = angka.replace(/[^0-9]/g, '');
  if (angka.indexOf('08') !== 0) return null;
  if (angka.length < 10 || angka.length > 14) return null;
  return angka;
}

/** '082299989690' -> '0822-9998-9690' supaya salah ketik terlihat mata. */
function formatWa(nomor) {
  var angka = String(nomor || '');
  if (angka.length < 9) return angka;
  return angka.slice(0, 4) + '-' + angka.slice(4, 8) + '-' + angka.slice(8);
}

/** '082299989690' -> '0822****9690' untuk pengunjung bukan admin. */
function samarkanWa(nomor) {
  var angka = String(nomor || '');
  if (!angka) return '';
  if (angka.length <= 8) return angka.slice(0, 2) + '****';
  return angka.slice(0, 4) + '****' + angka.slice(-4);
}

/**
 * Periksa satu berkas terhadap aturan kolomnya.
 * @param {{kolom: string, nama: string, ukuran: number}} berkas ukuran dalam byte
 * @param {Object} pengaturan peta kunci->nilai dari sheet Pengaturan
 * @returns {{sah: boolean, pesan: string}}
 */
function validasiBerkas(berkas, pengaturan) {
  var aturan = ATURAN_BERKAS[berkas && berkas.kolom];
  if (!aturan) return { sah: false, pesan: 'Kolom berkas tidak dikenali.' };

  var ukuran = Number(berkas.ukuran) || 0;
  if (ukuran <= 0) return { sah: false, pesan: 'Berkas kosong atau ukurannya tidak terbaca.' };

  var ekst = ekstensiDari(berkas.nama);
  if (aturan.ekstensi.indexOf(ekst) < 0) {
    return {
      sah: false,
      pesan: 'Jenis berkas ' + (ekst ? '.' + ekst : 'tanpa ekstensi') +
             ' tidak diterima. Yang diterima: ' + aturan.ekstensi.join(', ') + '.'
    };
  }

  var batasMb = Number(pengaturan && pengaturan[aturan.kunciBatas]);
  if (!batasMb || batasMb <= 0) batasMb = 5;
  if (ukuran > batasMb * SATU_MB) {
    return { sah: false, pesan: 'Ukuran berkas melebihi batas ' + batasMb + ' MB.' };
  }

  return { sah: true, pesan: '' };
}

/**
 * Periksa satu pengajuan utuh.
 *
 * Kolom bersyarat ditegakkan di sini: memilih Daerah menjadikan SK Tim dan
 * Berita Acara PANSUS wajib, memilih Bupati membuat keduanya tidak berlaku.
 * Di form lama keduanya cuma keterangan tertulis yang boleh diabaikan, dan
 * pengajuan Perda tanpa lampiran itu tetap bisa terkirim.
 *
 * @param {Object} data kunci kolom teks + data.berkas: {kolom: [{nama, ukuran}]}
 * @param {Object} pengaturan peta kunci->nilai dari sheet Pengaturan
 * @returns {{sah: boolean, galat: Array<{kolom: string, pesan: string}>}}
 */
function validasiPengajuan(data, pengaturan) {
  var galat = [];
  data = data || {};
  var berkas = data.berkas || {};

  var jenis = String(data.jenis_peraturan || '').trim();
  if (jenis !== 'Daerah' && jenis !== 'Bupati') {
    galat.push({ kolom: 'jenis_peraturan', pesan: 'Pilih Peraturan Daerah atau Peraturan Bupati.' });
  }
  var perda = jenis === 'Daerah';

  ['opd', 'judul', 'nama_pemohon'].forEach(function (kunci) {
    if (String(data[kunci] || '').trim() === '') {
      galat.push({ kolom: kunci, pesan: judulKolom(kunci) + ' wajib diisi.' });
    }
  });

  if (normalisasiWa(data.wa_pemohon) === null) {
    galat.push({ kolom: 'wa_pemohon', pesan: 'Nomor WhatsApp tidak sah. Contoh: 0822-9998-9690.' });
  }

  KOLOM_FORM.forEach(function (kol) {
    if (kol.jenis !== 'berkas') return;

    var daftar = berkas[kol.kunci] || [];
    var wajib = kol.hanyaPerda ? perda : !!kol.wajib;

    if (wajib && daftar.length === 0) {
      galat.push({ kolom: kol.kunci, pesan: kol.judul + ' wajib dilampirkan.' });
      return;
    }
    if (kol.hanyaPerda && !perda && daftar.length > 0) {
      galat.push({
        kolom: kol.kunci,
        pesan: kol.judul + ' hanya berlaku untuk Rancangan Peraturan Daerah.'
      });
      return;
    }

    var aturan = ATURAN_BERKAS[kol.kunci];
    if (aturan && aturan.kunciMaksBerkas) {
      var maks = Number(pengaturan && pengaturan[aturan.kunciMaksBerkas]) || 5;
      if (daftar.length > maks) {
        galat.push({ kolom: kol.kunci, pesan: kol.judul + ' maksimal ' + maks + ' berkas.' });
      }
    }

    daftar.forEach(function (b) {
      var periksa = validasiBerkas({ kolom: kol.kunci, nama: b.nama, ukuran: b.ukuran }, pengaturan);
      if (!periksa.sah) galat.push({ kolom: kol.kunci, pesan: b.nama + ': ' + periksa.pesan });
    });
  });

  return { sah: galat.length === 0, galat: galat };
}


// ============================================================
// Penomoran.gs
// ============================================================

/**
 * Penomoran.gs - nomor pengajuan berurut. Fungsi murni.
 *
 * Fungsi di sini tidak membaca sheet dan tidak mengunci apa pun. Pemanggilnya
 * (RepoPengajuan.gs) yang bertanggung jawab membaca nomor terakhir, memanggil
 * nomorBerikutnya, dan menuliskan hasilnya kembali -- semuanya di dalam satu
 * LockService.getScriptLock(). Tanpa kunci itu, dua pengiriman pada detik yang
 * sama bisa membaca nomor terakhir yang sama dan salah satunya menimpa baris
 * yang lain.
 */

var PREFIKS_NOMOR = 'BRB';
var PANJANG_URUT = 4;

/**
 * @param {string} kode contoh 'BRB-2026-0029'
 * @returns {{prefiks: string, tahun: number, urut: number}|null}
 */
function uraiNomor(kode) {
  if (kode === null || kode === undefined) return null;
  var cocok = /^([A-Za-z]{2,5})-(\d{4})-(\d{4,})$/.exec(String(kode).trim());
  if (!cocok) return null;
  return {
    prefiks: cocok[1].toUpperCase(),
    tahun: parseInt(cocok[2], 10),
    urut: parseInt(cocok[3], 10)
  };
}

/** Tambahkan nol di depan sampai panjang minimal tercapai. */
function bantalNol(angka, panjang) {
  var teks = String(angka);
  while (teks.length < panjang) teks = '0' + teks;
  return teks;
}

/**
 * @param {number} tahun tahun pengajuan baru
 * @param {string} nomorTerakhir nomor terakhir yang tercatat; boleh kosong
 * @returns {string} nomor berikutnya
 */
function nomorBerikutnya(tahun, nomorTerakhir) {
  var urai = uraiNomor(nomorTerakhir);
  var urut = (urai && urai.tahun === Number(tahun)) ? urai.urut + 1 : 1;
  return PREFIKS_NOMOR + '-' + tahun + '-' + bantalNol(urut, PANJANG_URUT);
}

/**
 * @param {Array<string>} daftarKode
 * @returns {string} kode dengan tahun lalu urut tertinggi; '' bila tak ada yang sah
 */
function nomorTerbesar(daftarKode) {
  var terbaik = null;
  var kodeTerbaik = '';
  (daftarKode || []).forEach(function (kode) {
    var urai = uraiNomor(kode);
    if (!urai) return;
    if (!terbaik || urai.tahun > terbaik.tahun ||
        (urai.tahun === terbaik.tahun && urai.urut > terbaik.urut)) {
      terbaik = urai;
      kodeTerbaik = String(kode).trim().toUpperCase();
    }
  });
  return kodeTerbaik;
}


// ============================================================
// ============================================================
// ParserRiwayat.gs
// ============================================================

/**
 * ParserRiwayat.gs - mengubah kolom 16 'Tanggal dan Detail Proses' yang
 * diketik tangan menjadi baris terstruktur, dan menyusunnya kembali menjadi
 * teks dengan bentuk yang sama persis. Fungsi murni.
 *
 * Dua arah itu sengaja dibuat simetris. Sheet Riwayat jadi sumber kebenaran,
 * tapi kolom 16 tetap diisi dan selalu mutakhir, sehingga siapa pun yang
 * terbiasa membaca spreadsheet langsung tidak perlu berubah kebiasaan.
 */

var BULAN_INDONESIA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Ejaan alternatif yang muncul di data nyata dan di kebiasaan mengetik:
 * singkatan tiga huruf, 'Nopember' lama, 'Agt'.
 */
var ALIAS_BULAN = {
  jan: 1, januari: 1,
  feb: 2, februari: 2, pebruari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  ags: 8, agt: 8, agu: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, nop: 11, november: 11, nopember: 11,
  des: 12, desember: 12
};

/** Penanda butir yang pernah dipakai: -, *, bullet, en dash, '1.' */
var POLA_BUTIR = /^\s*(?:[-*•–—]+|\d+[.)])\s*/;

/** Awal sebuah kejadian: tanggal, nama bulan, tahun opsional. */
var POLA_TANGGAL = /(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/;

function bantalDua(angka) {
  return angka < 10 ? '0' + angka : String(angka);
}

/**
 * Baca tanggal di awal teks.
 * @param {string} teks
 * @param {number} tahunBawaan dipakai bila tahun tidak ditulis
 * @returns {{iso: string, sisa: string}|null}
 */
function uraiTanggalIndonesia(teks, tahunBawaan) {
  var isi = String(teks || '').trim();
  if (!isi) return null;

  var cocok = new RegExp('^' + POLA_TANGGAL.source).exec(isi);
  if (!cocok) return null;

  var hari = parseInt(cocok[1], 10);
  var bulan = ALIAS_BULAN[cocok[2].toLowerCase()];
  if (!bulan) return null;
  if (hari < 1 || hari > 31) return null;

  var tahun = cocok[3] ? parseInt(cocok[3], 10) : Number(tahunBawaan);
  if (!tahun) return null;

  // Tanggal seperti 31 Februari tidak masuk akal; tolak daripada digeser diam-diam.
  var uji = new Date(tahun, bulan - 1, hari);
  if (uji.getMonth() !== bulan - 1 || uji.getDate() !== hari) return null;

  return {
    iso: tahun + '-' + bantalDua(bulan) + '-' + bantalDua(hari),
    sisa: isi.slice(cocok[0].length).trim()
  };
}

/** '2026-07-23' -> '23 Juli 2026'; '' bila bukan tanggal ISO. */
function formatTanggalIndonesia(iso) {
  var cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!cocok) return '';
  var bulan = parseInt(cocok[2], 10);
  if (bulan < 1 || bulan > 12) return '';
  return parseInt(cocok[3], 10) + ' ' + BULAN_INDONESIA[bulan - 1] + ' ' + cocok[1];
}

/**
 * Tebak tahap dari kata kunci. Urutan penting: yang lebih khusus diperiksa
 * lebih dulu, karena 'pra harmonisasi' dan 'selesai harmonisasi' keduanya
 * mengandung kata 'harmonisasi'.
 */
function tebakTahap(keterangan) {
  var t = String(keterangan || '').toLowerCase();
  if (!t) return 'LAINNYA';

  if (/hasil\s*fasilitasi|fasilitasi\s+(sudah\s+)?terbit/.test(t)) return 'HASIL_FASILITASI';
  if (/selesai\s*harmonisasi|surat\s+selesai/.test(t)) return 'SELESAI_HARMONISASI';
  if (/pra[\s-]*harmonisasi/.test(t)) return 'PRA_HARMONISASI';
  if (/(rapat|zoom|undangan)[^.]*harmonisasi|harmonisasi[^.]*(rapat|zoom)/.test(t)) return 'RAPAT_HARMONISASI';
  if (/fasilitasi/.test(t)) return 'FASILITASI';
  if (/dikembalikan|pengembalian|kembalikan/.test(t)) return 'DIKEMBALIKAN';
  if (/perbaikan|revisi|diperbaiki/.test(t)) return 'PERBAIKAN';
  if (/ditetapkan|penetapan|diundangkan|ditandatangani/.test(t)) return 'PENETAPAN';
  if (/reviu|review|diteliti|dikoreksi|dikaji/.test(t)) return 'REVIU_HUKUM';
  if (/berkas\s+masuk|masuk\s+ke\s+sistem|berkas\s+diterima/.test(t)) return 'BERKAS_MASUK';
  if (/harmonisasi/.test(t)) return 'RAPAT_HARMONISASI';
  return 'LAINNYA';
}

/**
 * Pecah satu baris yang mungkin memuat lebih dari satu kejadian.
 * Contoh: '22 Juli 2026 Berkas masuk - 23 Juli 2026 Berkas direviu'
 * @returns {Array<string>} potongan, masing-masing diawali tanggal bila ada
 */
function pecahKejadian(baris) {
  var isi = String(baris || '');
  var pola = new RegExp(POLA_TANGGAL.source, 'g');
  var posisi = [];
  var cocok;
  while ((cocok = pola.exec(isi)) !== null) {
    posisi.push(cocok.index);
    if (pola.lastIndex === cocok.index) pola.lastIndex++;
  }
  if (posisi.length <= 1) return [isi];

  var potongan = [];
  if (posisi[0] > 0) {
    var awal = isi.slice(0, posisi[0]).replace(POLA_BUTIR, '').trim();
    if (awal) potongan.push(awal);
  }
  for (var i = 0; i < posisi.length; i++) {
    var akhir = i + 1 < posisi.length ? posisi[i + 1] : isi.length;
    var bagian = isi.slice(posisi[i], akhir);
    // Buang penanda butir yang menempel di ekor potongan sebelumnya.
    bagian = bagian.replace(/[\s\-*•–—]+$/, '').trim();
    if (bagian) potongan.push(bagian);
  }
  return potongan;
}

/**
 * Urai seluruh isi kolom 16.
 *
 * Baris yang tidak terbaca polanya tetap dipindahkan dengan tahap LAINNYA dan
 * teks aslinya utuh. Membuang kalimat yang tidak dikenali akan menghilangkan
 * riwayat berbulan-bulan tanpa jejak, dan itu justru bagian yang paling dicari
 * OPD saat membuka monitoring.
 *
 * @param {string} teks isi sel kolom 16
 * @param {number} tahunBawaan tahun timestamp pengajuan
 * @returns {Array<{tanggal: string, tahap: string, keterangan: string, mentah: string}>}
 */
function uraiKolomProses(teks, tahunBawaan) {
  var isi = String(teks === null || teks === undefined ? '' : teks);
  if (!isi.trim()) return [];

  var hasil = [];
  isi.split(/\r?\n/).forEach(function (barisAsli) {
    var baris = barisAsli.trim();
    if (!baris) return;

    var tanpaButir = baris.replace(POLA_BUTIR, '').trim();
    if (!tanpaButir) return;

    pecahKejadian(tanpaButir).forEach(function (potongan) {
      var bersih = potongan.replace(POLA_BUTIR, '').trim();
      if (!bersih) return;
      var tanggal = uraiTanggalIndonesia(bersih, tahunBawaan);
      if (tanggal) {
        hasil.push({
          tanggal: tanggal.iso,
          tahap: tebakTahap(tanggal.sisa),
          keterangan: tanggal.sisa,
          mentah: bersih
        });
      } else {
        hasil.push({ tanggal: '', tahap: 'LAINNYA', keterangan: bersih, mentah: bersih });
      }
    });
  });

  return hasil;
}

/**
 * Susun ulang kolom 16 dari baris riwayat terstruktur.
 * Bentuknya sengaja dibuat sama persis dengan yang selama ini diketik manual.
 * @param {Array<{tanggal: string, keterangan: string}>} daftar
 * @returns {string}
 */
function susunKolomProses(daftar) {
  return (daftar || [])
    .map(function (baris) {
      var tanggal = formatTanggalIndonesia(baris.tanggal);
      var keterangan = String(baris.keterangan || '').trim();
      return tanggal ? '- ' + tanggal + ' ' + keterangan : '- ' + keterangan;
    })
    .join('\n');
}


// ============================================================
// ============================================================
// Rekap.gs
// ============================================================

/**
 * Rekap.gs - hitungan, rata-rata lama proses, dan penulisan CSV. Fungsi murni.
 *
 * Semua fungsi menerima array objek pengajuan yang sudah dinormalkan oleh
 * RepoPengajuan, dengan sekurang-kurangnya: id, opd, status, masuk (ISO),
 * diperbarui (ISO). Tidak ada yang membaca sheet dari sini.
 */

var SATU_HARI_MS = 24 * 60 * 60 * 1000;

function statusBaku(nilai) {
  return String(nilai || '').trim().toUpperCase();
}

/** @returns {{TOTAL: number, PROSES: number, SELESAI: number, DIKEMBALIKAN: number}} */
function rekapPerStatus(daftar) {
  var hasil = { TOTAL: 0, PROSES: 0, SELESAI: 0, DIKEMBALIKAN: 0 };
  (daftar || []).forEach(function (baris) {
    hasil.TOTAL++;
    var s = statusBaku(baris && baris.status);
    if (s !== 'TOTAL' && Object.prototype.hasOwnProperty.call(hasil, s)) hasil[s]++;
  });
  return hasil;
}

/** @returns {Array<{opd: string, jumlah: number}>} terbanyak dulu, lalu abjad */
function rekapPerOpd(daftar) {
  var hitung = {};
  (daftar || []).forEach(function (baris) {
    var opd = String((baris && baris.opd) || '').trim();
    if (!opd) opd = '(tidak diisi)';
    hitung[opd] = (hitung[opd] || 0) + 1;
  });
  return Object.keys(hitung)
    .map(function (opd) { return { opd: opd, jumlah: hitung[opd] }; })
    .sort(function (a, b) {
      if (b.jumlah !== a.jumlah) return b.jumlah - a.jumlah;
      return a.opd < b.opd ? -1 : a.opd > b.opd ? 1 : 0;
    });
}

/** @returns {Array<{bulan: string, jumlah: number}>} bulan 'YYYY-MM', menaik */
function rekapPerBulan(daftar) {
  var hitung = {};
  (daftar || []).forEach(function (baris) {
    var cocok = /^(\d{4})-(\d{2})/.exec(String((baris && baris.masuk) || ''));
    if (!cocok) return;
    var bulan = cocok[1] + '-' + cocok[2];
    hitung[bulan] = (hitung[bulan] || 0) + 1;
  });
  return Object.keys(hitung)
    .sort()
    .map(function (bulan) { return { bulan: bulan, jumlah: hitung[bulan] }; });
}

/** @returns {number|null} milidetik UTC tengah malam, null bila bukan ISO */
function uraiIso(iso) {
  var cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim());
  if (!cocok) return null;
  return Date.UTC(
    parseInt(cocok[1], 10),
    parseInt(cocok[2], 10) - 1,
    parseInt(cocok[3], 10)
  );
}

/** @returns {number|null} jumlah hari penuh antara dua tanggal ISO */
function selisihHari(isoAwal, isoAkhir) {
  var a = uraiIso(isoAwal);
  var b = uraiIso(isoAkhir);
  if (a === null || b === null) return null;
  return Math.round((b - a) / SATU_HARI_MS);
}

/**
 * Rata-rata lama proses, hanya dari pengajuan berstatus SELESAI.
 * Memasukkan yang masih PROSES akan membuat angkanya turun terus seiring
 * waktu dan tidak berarti apa-apa.
 * @returns {number|null} hari, satu angka di belakang koma
 */
function rataLamaProsesHari(daftar) {
  var jumlah = 0;
  var banyak = 0;
  (daftar || []).forEach(function (baris) {
    if (statusBaku(baris && baris.status) !== 'SELESAI') return;
    var hari = selisihHari(baris.masuk, baris.diperbarui);
    if (hari === null) return;
    jumlah += hari;
    banyak++;
  });
  if (!banyak) return null;
  return Math.round((jumlah / banyak) * 10) / 10;
}

/**
 * Pengajuan PROSES yang tidak bergerak melewati ambang hari.
 * Inilah yang paling sering terlewat dalam sistem manual.
 * @returns {Array<string>} daftar ID
 */
function cariMandek(daftar, ambangHari, isoHariIni) {
  var ambang = Number(ambangHari) || 7;
  var hasil = [];
  (daftar || []).forEach(function (baris) {
    if (statusBaku(baris && baris.status) !== 'PROSES') return;
    var diam = selisihHari(baris.diperbarui, isoHariIni);
    if (diam !== null && diam > ambang) hasil.push(baris.id);
  });
  return hasil;
}

/** Loloskan satu sel CSV sesuai RFC 4180. */
function selCsv(nilai) {
  if (nilai === null || nilai === undefined) return '';
  var teks = String(nilai);
  if (/[",\r\n]/.test(teks)) return '"' + teks.replace(/"/g, '""') + '"';
  return teks;
}

/**
 * @param {Array<Object>} daftar
 * @param {Array<{kunci: string, judul: string}>} kolom
 * @returns {string} CSV berpemisah CRLF antar baris, tanpa baris kosong di akhir
 */
function keCsv(daftar, kolom) {
  var baris = [kolom.map(function (k) { return selCsv(k.judul); }).join(',')];
  (daftar || []).forEach(function (isi) {
    baris.push(kolom.map(function (k) { return selCsv(isi[k.kunci]); }).join(','));
  });
  return baris.join('\r\n');
}


// ============================================================
// ============================================================
// RepoLog.gs
// ============================================================

/**
 * RepoLog.gs - jejak audit.
 *
 * Mencatat setiap perubahan status, penambahan riwayat, pengembalian berkas,
 * dan perubahan pengaturan. Kegagalan menulis log tidak boleh membatalkan
 * pekerjaan yang sedang berjalan -- kehilangan satu baris catatan jauh lebih
 * ringan daripada kehilangan pengajuan.
 */

function logCatat(aksi, idPengajuan, rincian) {
  try {
    var idSs = konfigIdSpreadsheet();
    if (!idSs) return;
    lembarTambahBaris(idSs, NAMA_SHEET_LOG, [
      Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss'),
      emailPengunjung(),
      aksi,
      idPengajuan || '',
      String(rincian || ''),
      ''   // Apps Script tidak menyediakan IP pengunjung; kolom disiapkan
           // untuk pemasangan lain yang punya sumber lain
    ]);
  } catch (e) {
    console.error('Gagal menulis log: ' + e.message);
  }
}

/** @returns {Array<Object>} n baris log terakhir, terbaru dulu */
function logTerakhir(jumlah) {
  wajibAdmin();
  var n = Number(jumlah) || 100;
  var semua = lembarBaca(konfigIdSpreadsheet(), NAMA_SHEET_LOG, 'A2:F');
  return semua.slice(Math.max(0, semua.length - n)).reverse().map(function (b) {
    return {
      waktu: String(b[0] || ''),
      email: String(b[1] || ''),
      aksi: String(b[2] || ''),
      id_pengajuan: String(b[3] || ''),
      rincian: String(b[4] || '')
    };
  });
}


// ============================================================
// ============================================================
// RepoRiwayat.gs
// ============================================================

/**
 * RepoRiwayat.gs - lini masa terstruktur.
 *
 * Sheet Riwayat adalah sumber kebenaran; kolom 16 di sheet pengajuan
 * dihasilkan ulang dari sini setiap kali riwayat berubah. Jadi orang yang
 * terbiasa membaca spreadsheet tetap melihat isi yang sama dan selalu
 * mutakhir, sementara sistem punya bentuk yang bisa disaring dan dihitung.
 */

function riwayatSemua() {
  return lembarBaca(konfigIdSpreadsheet(), NAMA_SHEET_RIWAYAT, 'A2:G')
    .map(function (b, i) {
      return {
        barisKe: i + 2,
        id_riwayat: String(b[0] || ''),
        id_pengajuan: String(b[1] || '').trim().toUpperCase(),
        tanggal: String(b[2] || ''),
        tahap: String(b[3] || 'LAINNYA'),
        keterangan: String(b[4] || ''),
        dicatat_oleh: String(b[5] || ''),
        dicatat_pada: String(b[6] || '')
      };
    })
    .filter(function (r) { return r.id_pengajuan; });
}

/** @returns {Array<Object>} riwayat satu pengajuan, urut tanggal lalu urutan tulis */
function riwayatUntuk(idPengajuan) {
  var kode = String(idPengajuan || '').trim().toUpperCase();
  return riwayatSemua()
    .filter(function (r) { return r.id_pengajuan === kode; })
    .sort(function (a, b) {
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
      return a.barisKe - b.barisKe;
    });
}

/** @returns {Object} id_pengajuan -> kejadian terakhir, untuk daftar monitoring */
function riwayatTerakhirPerPengajuan() {
  var peta = {};
  riwayatSemua().forEach(function (r) {
    var ada = peta[r.id_pengajuan];
    if (!ada || r.tanggal >= ada.tanggal) peta[r.id_pengajuan] = r;
  });
  return peta;
}

/**
 * Tambah satu kejadian, lalu susun ulang kolom 16 supaya spreadsheet tetap
 * terbaca seperti biasa.
 */
function riwayatTambah(idPengajuan, isi, email) {
  if (TAHAP_RIWAYAT.indexOf(isi.tahap) < 0) throw new Error('Tahap tidak dikenali.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isi.tanggal || ''))) {
    throw new Error('Tanggal harus berbentuk YYYY-MM-DD.');
  }

  var kunci = LockService.getScriptLock();
  kunci.waitLock(30000);
  try {
    var sekarang = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    var idRiwayat = 'R' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMddHHmmss') +
                    '-' + Math.floor(Math.random() * 1000);
    lembarTambahBaris(konfigIdSpreadsheet(), NAMA_SHEET_RIWAYAT, [
      idRiwayat, idPengajuan, isi.tanggal, isi.tahap, isi.keterangan || '', email, sekarang
    ]);
  } finally {
    kunci.releaseLock();
  }

  riwayatSegarkanKolomProses(idPengajuan, email);
  logCatat('TAMBAH_RIWAYAT', idPengajuan, isi.tahap + ' ' + isi.tanggal);
}

/** Hasilkan ulang kolom 16 dari sheet Riwayat. */
function riwayatSegarkanKolomProses(idPengajuan, email) {
  var teks = susunKolomProses(riwayatUntuk(idPengajuan));
  pengajuanPerbaruiSel(idPengajuan, 'proses', teks, email || penggunaSekarang().email);
  return teks;
}


// ============================================================
// ============================================================
// RepoPengajuan.gs
// ============================================================

/**
 * RepoPengajuan.gs - baca/tulis sheet pengajuan.
 *
 * Indeks kolom tidak pernah ditulis keras. Sheet asal adalah spreadsheet
 * jawaban Google Form milik Bagian Hukum, dan urutan kolomnya bisa berbeda di
 * pemasangan lain. Semua akses lewat petaKolom() yang dihitung dari baris
 * header dan di-cache.
 */

var CACHE_PETA_KOLOM = 'peta_kolom_v1';

/** Alasan pengembalian yang berulang di data nyata, jadi pilihan cepat admin. */
var ALASAN_KEMBALI = [
  'Draf belum memuat komentar dasar hukum di setiap pasal',
  'Belum disertakan hasil konsultasi',
  'Draf yang diinput belum sesuai ketentuan'
];

/** @returns {Object} kunci kolom -> indeks 0-based */
function petaKolom() {
  var cache = CacheService.getScriptCache();
  var tersimpan = cache.get(CACHE_PETA_KOLOM);
  if (tersimpan) {
    try { return JSON.parse(tersimpan); } catch (e) { /* baca ulang */ }
  }
  var header = lembarBacaHeader(konfigIdSpreadsheet(), konfigNamaSheet());
  var peta = cocokkanHeader(header).peta;
  cache.put(CACHE_PETA_KOLOM, JSON.stringify(peta), 300);
  return peta;
}

function petaKolomBersihkan() {
  CacheService.getScriptCache().remove(CACHE_PETA_KOLOM);
}

function selBaris(baris, peta, kunci) {
  var i = peta[kunci];
  if (i === undefined) return '';
  var nilai = baris[i];
  return nilai === null || nilai === undefined ? '' : String(nilai);
}

/**
 * '30/07/2026 14:20:31' atau '2026-07-30 ...' -> '2026-07-30'; '' bila tak terbaca.
 * Google Form menulis timestamp menurut locale spreadsheet, jadi kedua bentuk
 * itu sama-sama mungkin muncul.
 */
function tanggalDariTimestamp(teks) {
  var isi = String(teks || '').trim();
  var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(isi);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  var lokal = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(isi);
  if (lokal) {
    var d = lokal[1].length === 1 ? '0' + lokal[1] : lokal[1];
    var b = lokal[2].length === 1 ? '0' + lokal[2] : lokal[2];
    return lokal[3] + '-' + b + '-' + d;
  }
  return '';
}

/**
 * @returns {Array<Object>} seluruh pengajuan; setiap objek memuat kunci kolom
 *   ditambah barisKe (1-based), masuk, dan diperbarui (keduanya ISO tanggal)
 */
function pengajuanSemua() {
  var peta = petaKolom();
  var nilai = lembarBaca(konfigIdSpreadsheet(), konfigNamaSheet(), 'A2:AZ');

  return nilai.map(function (baris, i) {
    var isi = { barisKe: i + 2 };
    Object.keys(peta).forEach(function (kunci) { isi[kunci] = selBaris(baris, peta, kunci); });
    isi.masuk = tanggalDariTimestamp(isi.timestamp);
    isi.diperbarui = tanggalDariTimestamp(isi.diperbarui_pada) || isi.masuk;
    if (!isi.status) isi.status = 'PROSES';
    return isi;
  }).filter(function (isi) {
    // Baris kosong di bawah data terakhir tidak dihitung sebagai pengajuan.
    return isi.judul || isi.id || isi.timestamp;
  });
}

/** @returns {Object|null} */
function pengajuanCari(id) {
  var kode = String(id || '').trim().toUpperCase();
  if (!kode) return null;
  var cocok = pengajuanSemua().filter(function (p) {
    return String(p.id || '').trim().toUpperCase() === kode;
  });
  return cocok.length ? cocok[0] : null;
}

/**
 * Simpan pengajuan baru.
 *
 * Seluruhnya di dalam satu kunci: nomor pengajuan dibaca lalu ditulis kembali,
 * dan tanpa kunci dua pengiriman bersamaan bisa mendapat nomor yang sama dan
 * salah satunya menimpa baris yang lain. Pada volume sekarang kemungkinannya
 * kecil, tapi akibatnya kehilangan berkas pengajuan.
 *
 * @returns {{id: string, barisKe: number}}
 */
function pengajuanSimpanBaru(data, email) {
  var kunci = LockService.getScriptLock();
  kunci.waitLock(30000);
  try {
    var idSs = konfigIdSpreadsheet();
    var namaSheet = konfigNamaSheet();
    var peta = petaKolom();

    var tahun = Number(Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy'));
    var pengaturan = pengaturanSemua();
    var terakhir = pengaturan.nomor_terakhir ||
      nomorTerbesar(pengajuanSemua().map(function (p) { return p.id; }));
    var idBaru = nomorBerikutnya(tahun, terakhir);

    var lebar = Object.keys(peta).reduce(function (maks, k) {
      return Math.max(maks, peta[k] + 1);
    }, 0);
    var baris = [];
    for (var i = 0; i < lebar; i++) baris.push('');

    function set(kunciKolom, nilai) {
      if (peta[kunciKolom] !== undefined) baris[peta[kunciKolom]] = nilai;
    }

    var sekarang = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    set('timestamp', sekarang);
    set('opd', data.opd);
    set('jenis_peraturan', data.jenis_peraturan);
    set('judul', data.judul);
    set('nama_pemohon', data.nama_pemohon);
    set('wa_pemohon', normalisasiWa(data.wa_pemohon) || data.wa_pemohon);
    set('status', 'PROSES');
    set('keterangan', '');
    set('proses', '');
    set('id', idBaru);
    set('email_pemohon', email);
    set('kode_opd', data.kode_opd || '');
    set('diperbarui_pada', sekarang);
    set('diperbarui_oleh', email);

    var barisKe = lembarTambahBaris(idSs, namaSheet, baris);
    pengaturanSetel('nomor_terakhir', idBaru);

    return { id: idBaru, barisKe: barisKe };
  } finally {
    kunci.releaseLock();
  }
}

/** Tulis satu sel pada baris pengajuan dan perbarui jejak perubahan. */
function pengajuanPerbaruiSel(id, kunciKolom, nilai, email) {
  var kunci = LockService.getScriptLock();
  kunci.waitLock(30000);
  try {
    var pengajuan = pengajuanCari(id);
    if (!pengajuan) throw new Error('Pengajuan ' + id + ' tidak ditemukan.');

    var peta = petaKolom();
    var idSs = konfigIdSpreadsheet();
    var namaSheet = konfigNamaSheet();

    if (peta[kunciKolom] === undefined) {
      throw new Error('Kolom ' + kunciKolom + ' tidak ada di sheet.');
    }
    lembarTulis(idSs, namaSheet,
      lembarKolomHuruf(peta[kunciKolom] + 1) + pengajuan.barisKe, [[nilai]]);

    var sekarang = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    if (peta.diperbarui_pada !== undefined) {
      lembarTulis(idSs, namaSheet,
        lembarKolomHuruf(peta.diperbarui_pada + 1) + pengajuan.barisKe, [[sekarang]]);
    }
    if (peta.diperbarui_oleh !== undefined) {
      lembarTulis(idSs, namaSheet,
        lembarKolomHuruf(peta.diperbarui_oleh + 1) + pengajuan.barisKe, [[email]]);
    }
  } finally {
    kunci.releaseLock();
  }
}

/** Ubah status; DIKEMBALIKAN mewajibkan alasan. */
function pengajuanUbahStatus(id, status, alasan, email) {
  var s = String(status || '').toUpperCase();
  if (STATUS_PENGAJUAN.indexOf(s) < 0) throw new Error('Status tidak dikenali.');
  if (s === 'DIKEMBALIKAN' && !String(alasan || '').trim()) {
    throw new Error('Alasan wajib diisi saat mengembalikan pengajuan.');
  }
  pengajuanPerbaruiSel(id, 'status', s, email);
  if (String(alasan || '').trim()) pengajuanPerbaruiSel(id, 'keterangan', alasan, email);
  logCatat('UBAH_STATUS', id, s + (alasan ? ' - ' + alasan : ''));
}

/* ---------- daftar OPD ---------- */

/** @returns {Array<{kode_opd, nama_resmi, nama_singkat, aktif}>} hanya yang aktif */
function opdDaftar() {
  try {
    return lembarBaca(konfigIdSpreadsheet(), NAMA_SHEET_OPD, 'A2:D')
      .filter(function (b) { return String(b[0] || '').trim(); })
      .map(function (b) {
        return {
          kode_opd: String(b[0] || ''),
          nama_resmi: String(b[1] || ''),
          nama_singkat: String(b[2] || ''),
          aktif: String(b[3] === undefined || b[3] === '' ? 'TRUE' : b[3]).toUpperCase() !== 'FALSE'
        };
      })
      .filter(function (o) { return o.aktif; });
  } catch (e) {
    return [];
  }
}

function opdTambah(baris) {
  wajibAdmin();
  var kode = String(baris.kode_opd || '').trim();
  var nama = String(baris.nama_resmi || '').trim();
  if (!kode || !nama) throw new Error('Kode OPD dan nama resmi wajib diisi.');
  lembarTambahBaris(konfigIdSpreadsheet(), NAMA_SHEET_OPD,
    [kode, nama, String(baris.nama_singkat || ''), 'TRUE']);
  logCatat('TAMBAH_OPD', '', kode + ' - ' + nama);
  return { sukses: true };
}

/* ---------- data untuk halaman ---------- */

/**
 * Data untuk halaman monitoring publik.
 *
 * Kedua sakelar keterbukaan diterapkan di server, bukan di browser. Menyaring
 * di browser berarti datanya tetap terkirim dan bisa dibaca siapa pun yang
 * membuka panel jaringan.
 */
function monitoringData() {
  if (!konfigSudahSiap()) return { siap: false, hitungan: {}, daftar: [], tahun: [] };

  var pengguna = penggunaSekarang();
  var admin = pengguna.peran === 'ADMIN';
  var bolehWa = admin || pengaturanBenar('publik_tampilkan_wa');
  var bolehBerkas = admin || pengaturanBenar('publik_tampilkan_berkas');
  var terakhirPer = riwayatTerakhirPerPengajuan();

  var daftar = pengajuanSemua().map(function (p) {
    var milikSendiri = !!pengguna.email &&
      String(p.email_pemohon || '').toLowerCase() === pengguna.email;
    var terakhir = terakhirPer[String(p.id || '').trim().toUpperCase()];
    return {
      id: p.id,
      judul: p.judul,
      opd: p.opd,
      kode_opd: p.kode_opd,
      jenis_peraturan: p.jenis_peraturan,
      status: p.status,
      masuk: p.masuk,
      diperbarui: p.diperbarui,
      keterangan: p.keterangan,
      nama_pemohon: p.nama_pemohon,
      wa_pemohon: (bolehWa || milikSendiri) ? formatWa(p.wa_pemohon) : samarkanWa(p.wa_pemohon),
      bolehBerkas: bolehBerkas || milikSendiri,
      terakhir: terakhir
        ? { tanggal: terakhir.tanggal, tahap: terakhir.tahap, keterangan: terakhir.keterangan }
        : null
    };
  });

  var tahun = [];
  daftar.forEach(function (d) {
    var t = String(d.masuk || '').slice(0, 4);
    if (t && tahun.indexOf(t) < 0) tahun.push(t);
  });
  tahun.sort().reverse();

  return {
    siap: true,
    admin: admin,
    hitungan: rekapPerStatus(daftar),
    tahun: tahun,
    daftar: daftar.sort(function (a, b) {
      return a.masuk < b.masuk ? 1 : a.masuk > b.masuk ? -1 : 0;
    })
  };
}

/**
 * Data untuk halaman detail satu pengajuan.
 * Tautan berkas hanya ikut dikirim bila sakelar keterbukaan menyala, pengunjung
 * adalah admin, atau pengunjung adalah pemohon berkas itu sendiri.
 */
function detailData(id) {
  if (!konfigSudahSiap()) return { ada: false };

  var p = pengajuanCari(id);
  if (!p) return { ada: false };

  var pengguna = penggunaSekarang();
  var admin = pengguna.peran === 'ADMIN';
  var milikSendiri = !!pengguna.email &&
    String(p.email_pemohon || '').toLowerCase() === pengguna.email;
  var bolehBerkas = admin || milikSendiri || pengaturanBenar('publik_tampilkan_berkas');
  var bolehWa = admin || milikSendiri || pengaturanBenar('publik_tampilkan_wa');

  var berkas = [];
  if (bolehBerkas) {
    KOLOM_FORM.filter(function (k) { return k.jenis === 'berkas'; }).forEach(function (kol) {
      String(p[kol.kunci] || '').split(/[,\s]+/).forEach(function (url) {
        var bersih = url.trim();
        if (bersih) berkas.push({ kolom: kol.kunci, judul: kol.judul, url: bersih });
      });
    });
  }

  return {
    ada: true,
    admin: admin,
    pengajuan: {
      id: p.id, judul: p.judul, opd: p.opd, kode_opd: p.kode_opd,
      jenis_peraturan: p.jenis_peraturan, status: p.status,
      masuk: p.masuk, diperbarui: p.diperbarui, keterangan: p.keterangan,
      nama_pemohon: p.nama_pemohon,
      wa_pemohon: bolehWa ? formatWa(p.wa_pemohon) : samarkanWa(p.wa_pemohon)
    },
    riwayat: riwayatUntuk(p.id),
    berkas: berkas,
    boleh: { berkas: bolehBerkas, wa: bolehWa }
  };
}

/* ---------- data & aksi dashboard admin ---------- */

function adminData() {
  wajibAdmin();
  var pengaturan = pengaturanSemua();
  var hariIni = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

  var semua = pengajuanSemua().map(function (p) {
    return {
      id: p.id, judul: p.judul, opd: p.opd, status: p.status,
      masuk: p.masuk, diperbarui: p.diperbarui, keterangan: p.keterangan,
      jenis_peraturan: p.jenis_peraturan
    };
  });

  var mandek = cariMandek(semua, Number(pengaturan.ambang_mandek_hari) || 7, hariIni);

  // Antrean: hanya PROSES, yang paling lama tidak diperbarui di atas.
  var antrean = semua
    .filter(function (p) { return String(p.status).toUpperCase() === 'PROSES'; })
    .sort(function (a, b) { return (a.diperbarui || '') < (b.diperbarui || '') ? -1 : 1; })
    .map(function (p) {
      p.mandek = mandek.indexOf(p.id) >= 0;
      return p;
    });

  return {
    antrean: antrean,
    rekap: {
      status: rekapPerStatus(semua),
      opd: rekapPerOpd(semua),
      bulan: rekapPerBulan(semua),
      rataHari: rataLamaProsesHari(semua)
    },
    pengaturan: pengaturan,
    opd: opdDaftar(),
    admin: adminDaftar(),
    emailSaya: emailPengunjung(),
    alasanKembali: ALASAN_KEMBALI,
    tahap: TAHAP_RIWAYAT
  };
}

function adminTambahRiwayat(id, isi) {
  wajibAdmin();
  riwayatTambah(id, isi, penggunaSekarang().email);
  return { sukses: true };
}

function adminUbahStatus(id, status, alasan) {
  wajibAdmin();
  pengajuanUbahStatus(id, status, alasan, penggunaSekarang().email);
  return { sukses: true };
}

/** Batas keras yang benar-benar sanggup dilayani jalur unggah ini. */
var BATAS_MAKS_MB = 30;

function adminSetelPengaturan(kunci, nilai) {
  wajibAdmin();

  // Batas ukuran boleh diturunkan, tidak boleh dinaikkan melewati kemampuan
  // sistem. Menyetel 100 di sini hanya akan membuat pemohon menunggu lama lalu
  // gagal di tengah unggah -- lebih baik ditolak sekarang.
  if (kunci.indexOf('batas_') === 0) {
    var angka = Number(nilai);
    if (!angka || angka <= 0) throw new Error('Batas ukuran harus angka lebih dari 0.');
    if (angka > BATAS_MAKS_MB) {
      throw new Error('Batas ukuran maksimal ' + BATAS_MAKS_MB + ' MB.');
    }
    nilai = String(angka);
  }


  if (kunci === 'id_folder_induk' && nilai) {
    var cocok = nilai.match(/\/(?:folders|drive\/folders)\/([a-zA-Z0-9_-]+)/) || nilai.match(/id=([a-zA-Z0-9_-]+)/);
    if (cocok) nilai = cocok[1];
    
    try {
      var folder = DriveApp.getFolderById(nilai);
      nilai = folder.getId();
    } catch (e) {
      throw new Error('ID atau Link Folder Drive tidak valid atau tidak dapat diakses.');
    }
    
    // Sinkronkan ke PropertiesService
    konfigSetelDasar({ idFolder: nilai });
  }

  pengaturanSetel(kunci, nilai);
  logCatat('UBAH_PENGATURAN', '', kunci + ' = ' + nilai);
  return { sukses: true };
}

function adminResetKonfig() {
  wajibAdmin();
  propSkrip().deleteProperty(KUNCI_ID_SPREADSHEET);
  propSkrip().deleteProperty(KUNCI_NAMA_SHEET);
  authBersihkanCache();
  // Tanpa dua baris ini, peta kolom dan pengaturan spreadsheet LAMA masih
  // tersimpan 5 menit. Spreadsheet baru akan dibaca memakai indeks kolom milik
  // yang lama -- data terbaca di kolom yang salah tanpa galat apa pun.
  petaKolomBersihkan();
  pengaturanBersihkanCache();
  return { sukses: true };
}

function adminRekapCsv() {
  wajibAdmin();
  return keCsv(pengajuanSemua(), [
    { kunci: 'id', judul: 'ID' },
    { kunci: 'masuk', judul: 'Tanggal Masuk' },
    { kunci: 'opd', judul: 'OPD' },
    { kunci: 'kode_opd', judul: 'Kode OPD' },
    { kunci: 'jenis_peraturan', judul: 'Jenis' },
    { kunci: 'judul', judul: 'Judul' },
    { kunci: 'status', judul: 'Status' },
    { kunci: 'diperbarui', judul: 'Diperbarui' },
    { kunci: 'keterangan', judul: 'Keterangan' }
  ]);
}


// ============================================================
// ============================================================
// Upload.gs
// ============================================================

/**
 * Upload.gs - izin unggah, pendaftaran berkas, penamaan otomatis, dan
 * penyimpanan pengajuan.
 *
 * Bytes berkas tidak pernah melewati Apps Script. Server membuat sesi unggah
 * bertahap dan mengirim URL sesinya ke browser; browser mengirim potongan
 * langsung ke Drive. Ini bukan pilihan gaya: operasi Blob di Apps Script mentok
 * di sekitar 50 MB, CacheService hanya menampung 100 KB per kunci, dan
 * PropertiesService sekitar 9 KB -- tidak ada tempat untuk menampung lampiran
 * 30 MB antar panggilan.
 *
 * Token OAuth tidak pernah dikirim ke browser. URL sesi hanya bisa menerima
 * bytes untuk satu berkas dan tidak bisa dipakai membaca apa pun.
 */

var UMUR_DRAF = 21600;  // 6 jam, cukup untuk satu sesi pengisian form

function drafKunciCache(draf) {
  return 'draf_' + String(draf).replace(/[^A-Za-z0-9_-]/g, '');
}

/** Mulai satu draf pengajuan dan siapkan folder singgah untuk berkasnya. */
function unggahMulaiDraf() {
  var draf = Utilities.getUuid();
  var singgah = berkasFolderPastikan('_sementara', konfigIdFolder());
  var folderDraf = berkasFolderBuat(draf, singgah);

  CacheService.getScriptCache().put(
    drafKunciCache(draf),
    JSON.stringify({ folder: folderDraf, berkas: [] }),
    UMUR_DRAF
  );
  return { draf: draf };
}

function drafBaca(draf) {
  var mentah = CacheService.getScriptCache().get(drafKunciCache(draf));
  if (!mentah) {
    throw new Error('Draf pengajuan sudah kedaluwarsa. Muat ulang halaman dan isi kembali.');
  }
  var isi = JSON.parse(mentah);
  return isi;
}

function drafTulis(draf, isi) {
  CacheService.getScriptCache().put(drafKunciCache(draf), JSON.stringify(isi), UMUR_DRAF);
}

/**
 * Periksa ukuran dan jenis terhadap batas, lalu kembalikan URL sesi unggah.
 * @returns {{urlSesi: string}}
 */
function unggahMintaIzin(minta) {
  var isi = drafBaca(minta.draf);
  var periksa = validasiBerkas(
    { kolom: minta.kolom, nama: minta.nama, ukuran: minta.ukuran },
    pengaturanSemua()
  );
  if (!periksa.sah) throw new Error(periksa.pesan);

  return { urlSesi: berkasMulaiUnggah(minta.nama, minta.mime, isi.folder) };
}

function unggahBase64Potongan(minta) {
  var isi = drafBaca(minta.draf);
  var dataBytes = Utilities.base64Decode(minta.b64);
  var blob = Utilities.newBlob(dataBytes, minta.mime, minta.nama);
  var folder = DriveApp.getFolderById(isi.folder);
  var file = folder.createFile(blob);
  return file.getId();
}

/**
 * Cocokkan ukuran dan jenis sebenarnya lewat Drive setelah unggah selesai.
 *
 * Langkah ini tidak boleh dilewat. Pemeriksaan ukuran di browser bisa dilewati
 * oleh siapa pun yang paham; hanya pemeriksaan setelah berkas benar-benar ada
 * di Drive yang bisa dipercaya.
 */
function unggahDaftarkan(minta) {
  var isi = drafBaca(minta.draf);
  var meta = berkasMeta(minta.idBerkas);

  var periksa = validasiBerkas(
    { kolom: minta.kolom, nama: meta.name, ukuran: meta.size },
    pengaturanSemua()
  );
  if (!periksa.sah) {
    // Berkas yang tidak lolos tidak dibiarkan menggantung di Drive.
    try { berkasHapus(minta.idBerkas); } catch (e) { /* biarkan, sudah ditolak */ }
    throw new Error(periksa.pesan);
  }

  isi.berkas.push({ kolom: minta.kolom, idBerkas: meta.id, nama: meta.name, ukuran: meta.size });
  drafTulis(minta.draf, isi);

  return {
    idBerkas: meta.id, kolom: minta.kolom,
    nama: meta.name, ukuran: meta.size, url: meta.webViewLink
  };
}

/** Buang satu berkas dari draf sebelum pengajuan dikirim. */
function unggahBatalkan(minta) {
  var isi = drafBaca(minta.draf);
  isi.berkas = isi.berkas.filter(function (b) { return b.idBerkas !== minta.idBerkas; });
  drafTulis(minta.draf, isi);
  try { berkasHapus(minta.idBerkas); } catch (e) { /* mungkin sudah hilang */ }
  return { sukses: true };
}

/** Buang karakter yang tidak boleh ada di nama berkas dan potong judul panjang. */
function judulSingkat(judul) {
  var teks = String(judul || '')
    .replace(/^rancangan\s+peraturan\s+(daerah|bupati)\s*(kabupaten\s+brebes)?\s*(tentang)?\s*/i, '')
    .replace(/[\/\\:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return teks.length > 60 ? teks.slice(0, 60).trim() : teks;
}

/**
 * Penamaan otomatis.
 *
 * Form lama meminta pemohon menamai berkas sendiri, dan aturan seperti itu
 * hampir pasti dilanggar -- setiap pelanggaran jadi pekerjaan merapikan bagi
 * Bagian Hukum. Pemohon tidak perlu tahu aturannya sama sekali.
 */
function namaBerkasBaku(opsi) {
  var jenisBerkas = judulKolom(opsi.kolom) || opsi.kolom;
  var jenisPeraturan = opsi.jenisPeraturan === 'Daerah' ? 'Raperda' : 'Raperbup';
  var bagian = 'BREBES_' + jenisBerkas + '_' + jenisPeraturan +
               ' tentang ' + judulSingkat(opsi.judul) +
               '_' + (opsi.kodeOpd || 'OPD');
  if (opsi.urutan && opsi.urutan > 1) bagian += '_' + opsi.urutan;
  return bagian.replace(/[\/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() +
         (opsi.ekstensi ? '.' + opsi.ekstensi : '');
}

/**
 * Aturan berkas yang sudah digabung dengan batas dari sheet Pengaturan, supaya
 * form bisa menampilkan batas yang benar dan menolak lebih awal.
 */
function pengaturanUntukForm() {
  var pengaturan = pengaturanSemua();
  var hasil = {};
  KOLOM_FORM.forEach(function (kol) {
    var aturan = ATURAN_BERKAS[kol.kunci];
    if (!aturan) return;
    hasil[kol.kunci] = {
      judul: kol.judul,
      ekstensi: aturan.ekstensi,
      batasMb: Number(pengaturan[aturan.kunciBatas]) || 5,
      maksBerkas: aturan.kunciMaksBerkas
        ? (Number(pengaturan[aturan.kunciMaksBerkas]) || 5)
        : 1,
      wajib: !!kol.wajib,
      hanyaPerda: !!kol.hanyaPerda
    };
  });
  return hasil;
}

/**
 * Simpan pengajuan: validasi utuh, buat baris, pindahkan seluruh berkas ke
 * folder tujuan dengan nama baku, catat riwayat pertama.
 * @returns {{sukses: boolean, id: string, galat: Array}}
 */
function pengajuanKirim(data) {
  // Email sesi menang bila ada. Dengan deploy "Anyone with a Google account",
  // nilainya selalu terisi dan pemohon tidak bisa dipalsukan -- sesuai desain.
  // Isian manual hanya dipakai bila deploy-nya anonim, supaya berkas ini tetap
  // bisa dipasang tanpa mewajibkan login.
  var emailSesi = emailPengunjung();
  var email = emailSesi || String(data.email_pemohon || '').trim().toLowerCase();
  if (!email) throw new Error('Alamat email harus diisi.');

  var isiDraf = drafBaca(data.draf);

  // Daftar berkas disusun dari catatan draf di server, bukan dari kiriman
  // browser. Kiriman browser bisa diubah siapa pun yang paham.
  var berkasPerKolom = {};
  isiDraf.berkas.forEach(function (b) {
    if (!berkasPerKolom[b.kolom]) berkasPerKolom[b.kolom] = [];
    berkasPerKolom[b.kolom].push(b);
  });

  var untukValidasi = {
    jenis_peraturan: data.jenis_peraturan,
    opd: data.opd,
    kode_opd: data.kode_opd,
    judul: data.judul,
    nama_pemohon: data.nama_pemohon,
    wa_pemohon: data.wa_pemohon,
    berkas: berkasPerKolom
  };

  var hasil = validasiPengajuan(untukValidasi, pengaturanSemua());
  if (!hasil.sah) return { sukses: false, id: '', galat: hasil.galat };

  var disimpan = pengajuanSimpanBaru(untukValidasi, email);

  // Folder tujuan: SIMPEL/2026/BRB-2026-0029 - Judul Singkat/
  var tahun = disimpan.id.split('-')[1];
  var folderTahun = berkasFolderPastikan(tahun, konfigIdFolder());
  var folderPengajuan = berkasFolderPastikan(
    disimpan.id + ' - ' + judulSingkat(data.judul), folderTahun
  );

  Object.keys(berkasPerKolom).forEach(function (kolom) {
    var tautan = berkasPerKolom[kolom].map(function (b, i) {
      var nama = namaBerkasBaku({
        kolom: kolom,
        jenisPeraturan: data.jenis_peraturan,
        judul: data.judul,
        kodeOpd: data.kode_opd,
        ekstensi: ekstensiDari(b.nama),
        urutan: i + 1
      });
      var pindah = berkasPindahDanNamai(b.idBerkas, folderPengajuan, nama);
      return pindah.webViewLink ||
        ('https://drive.google.com/file/d/' + b.idBerkas + '/view');
    });
    pengajuanPerbaruiSel(disimpan.id, kolom, tautan.join(', '), email);
  });

  riwayatTambah(disimpan.id, {
    tanggal: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
    tahap: 'BERKAS_MASUK',
    keterangan: 'Berkas masuk ke sistem'
  }, email);

  CacheService.getScriptCache().remove(drafKunciCache(data.draf));
  logCatat('PENGAJUAN_BARU', disimpan.id, data.judul);

  return { sukses: true, id: disimpan.id, galat: [] };
}



// ============================================================
// Setup.gs (pakai link spreadsheet, tanpa Picker/Cloud)
// ============================================================

function apakahPemilikSkrip() {
  try {
    var aktif = Session.getActiveUser().getEmail();
    var efektif = Session.getEffectiveUser().getEmail();
    return !!aktif && !!efektif && aktif.toLowerCase() === efektif.toLowerCase();
  } catch (e) { return false; }
}
function wajibPemilikSkrip() { if (!apakahPemilikSkrip()) throw new Error('Penyiapan hanya bisa dijalankan oleh pemilik aplikasi.'); }

/** Ambil ID spreadsheet dari URL atau teks mentah. */
function _ambilIdDariLink(teks) {
  var bersih = String(teks || '').trim();
  // Kalau sudah berbentuk ID murni (tanpa slash)
  if (/^[A-Za-z0-9_-]{20,}$/.test(bersih)) return bersih;
  // Ambil dari URL: /spreadsheets/d/ID_DISINI/
  var cocok = /\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(bersih);
  if (cocok) return cocok[1];
  // Ambil dari URL: /d/ID_DISINI/
  var cocok2 = /\/d\/([A-Za-z0-9_-]+)/.exec(bersih);
  if (cocok2) return cocok2[1];
  throw new Error('Link tidak dikenali. Paste link spreadsheet dari browser, contoh: https://docs.google.com/spreadsheets/d/abc123.../edit');
}

function setupInfoAwal() {
  return { siap: konfigSudahSiap(), pemilik: apakahPemilikSkrip() };
}

/** Periksa spreadsheet dari link/ID yang di-paste user. */
function setupPeriksaSpreadsheet(linkAtauId) {
  wajibPemilikSkrip();
  var idSs;
  try { idSs = _ambilIdDariLink(linkAtauId); } catch (e) { return { sah: false, pesan: e.message }; }

  try {
    var ss = SpreadsheetApp.openById(idSs);
  } catch (e) {
    return { sah: false, pesan: 'Spreadsheet tidak bisa dibuka. Pastikan link benar dan Anda memiliki akses baca. (' + e.message + ')' };
  }

  // Cek akses tulis
  var bisaTulis = true;
  try {
    var testSheet = ss.insertSheet('_simpel_test_' + Date.now());
    ss.deleteSheet(testSheet);
  } catch (e) { bisaTulis = false; }

  if (!bisaTulis) {
    return { sah: false, pesan: 'Anda tidak memiliki akses EDIT ke spreadsheet ini. Minta pemilik spreadsheet menambahkan Anda sebagai editor.' };
  }

  var daftar = ss.getSheets().map(function (s) { return s.getName(); });
  if (!daftar.length) return { sah: false, pesan: 'Spreadsheet tidak memiliki sheet apa pun.' };

  var pilihan = daftar.filter(function (s) { return normalisasiHeader(s) === 'progres pengajuan'; })[0] || daftar[0];

  var header = lembarBacaHeader(idSs, pilihan);
  var cocok = cocokkanHeader(header);
  var isi = cocok.jenis === 'KOSONG' ? [] : lembarBaca(idSs, pilihan, 'A2:A');

  return {
    sah: true, idSs: idSs,
    jenis: cocok.jenis, namaSheet: pilihan,
    daftarSheet: daftar,
    hilang: cocok.hilang.map(function (k) { return judulKolom(k) || k; }),
    asing: cocok.asing, jumlahBaris: isi.length, pesan: ''
  };
}

function setupJalankan(opsi) {
  wajibPemilikSkrip();
  var idSs = opsi.idSs;
  var namaSheet = opsi.namaSheet;
  var kunci = LockService.getScriptLock();
  kunci.waitLock(30000);
  try {
    var header = lembarBacaHeader(idSs, namaSheet);
    var cocok = cocokkanHeader(header);
    if (cocok.jenis === 'ASING') throw new Error('Header sheet tidak dikenali.');
    if (cocok.jenis === 'KOSONG') {
      var semuaJudul = KOLOM_FORM.concat(KOLOM_TAMBAHAN).map(function (k) { return k.judul; });
      lembarTulis(idSs, namaSheet, 'A1', [semuaJudul]);
    } else if (cocok.jenis === 'FORM') {
      var barisHeader = header.slice();
      KOLOM_TAMBAHAN.forEach(function (kol) { barisHeader.push(kol.judul); });
      lembarTulis(idSs, namaSheet, 'A1', [barisHeader]);
    }
    [[NAMA_SHEET_RIWAYAT, SKEMA_RIWAYAT], [NAMA_SHEET_OPD, SKEMA_OPD],
     [NAMA_SHEET_PENGATURAN, SKEMA_PENGATURAN], [NAMA_SHEET_LOG, SKEMA_LOG],
     [NAMA_SHEET_ADMIN, SKEMA_ADMIN]
    ].forEach(function (p) { if (!lembarAdaSheet(idSs, p[0])) lembarBuatSheet(idSs, p[0], p[1]); });
    if (lembarBaca(idSs, NAMA_SHEET_PENGATURAN, 'A2:A').length === 0) {
      lembarTulis(idSs, NAMA_SHEET_PENGATURAN, 'A2', pengaturanAwal());
    }
    var idFolder = berkasFolderPastikan('SIMPEL', null);
    konfigSetelDasar({ idSpreadsheet: idSs, namaSheet: namaSheet, idFolder: idFolder });
    petaKolomBersihkan(); authBersihkanCache();
    pengaturanSetel('id_folder_induk', idFolder);
    var laporan = null;
    if (opsi.migrasi && cocok.jenis === 'FORM') laporan = migrasiJalankan(idSs, namaSheet);
    logCatat('SETUP', '', 'Penyiapan selesai. Sheet: ' + namaSheet);
    return { sukses: true, laporan: laporan, pesan: '' };
  } finally { kunci.releaseLock(); }
}

function setupUlang() {
  wajibPemilikSkrip();
  konfigHapus(); petaKolomBersihkan(); authBersihkanCache();
  return { sukses: true };
}
// ============================================================
// Migrasi.gs
// ============================================================

/**
 * Migrasi.gs - memindahkan data lama ke bentuk baru tanpa menghapus apa pun.
 *
 * Dijalankan wizard penyiapan ketika spreadsheet yang dipilih ternyata berisi
 * jawaban Google Form. Kalau spreadsheet kosong, seluruh berkas ini dilewati.
 */

/**
 * @returns {{namaCadangan, barisDiberiId, riwayatTerurai, riwayatLainnya,
 *            opdPerluPeriksa: Array<string>, selisihKolom16: Array<string>}}
 */
function migrasiJalankan(idSs, namaSheet) {
  var laporan = {
    namaCadangan: '',
    barisDiberiId: 0,
    riwayatTerurai: 0,
    riwayatLainnya: 0,
    opdPerluPeriksa: [],
    selisihKolom16: []
  };

  var tanggal = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

  // 1. Cadangan lebih dulu, sebelum apa pun disentuh.
  laporan.namaCadangan = namaSheet + ' (cadangan ' + tanggal + ')';
  if (!lembarAdaSheet(idSs, laporan.namaCadangan)) {
    lembarSalinSheet(idSs, namaSheet, laporan.namaCadangan);
  }

  petaKolomBersihkan();
  var peta = petaKolom();
  var nilai = lembarBaca(idSs, namaSheet, 'A2:AZ');

  var baris = nilai.map(function (b, i) {
    return {
      barisKe: i + 2,
      timestamp: String(b[peta.timestamp] || ''),
      masuk: tanggalDariTimestamp(b[peta.timestamp]),
      id: String(peta.id === undefined ? '' : (b[peta.id] || '')),
      opd: String(b[peta.opd] || '').trim(),
      proses: String(b[peta.proses] || ''),
      judul: String(b[peta.judul] || '')
    };
  }).filter(function (b) { return b.timestamp || b.judul; });

  // 2. Beri ID berurut menurut Timestamp dari yang terlama.
  var urut = baris.slice().sort(function (a, b) {
    if (a.masuk !== b.masuk) return a.masuk < b.masuk ? -1 : 1;
    return a.barisKe - b.barisKe;
  });

  var nomorTerakhir = '';
  var kolomId = lembarKolomHuruf(peta.id + 1);
  urut.forEach(function (b) {
    if (b.id) { nomorTerakhir = b.id; return; }
    var tahun = Number((b.masuk || tanggal).slice(0, 4));
    b.id = nomorBerikutnya(tahun, nomorTerakhir);
    nomorTerakhir = b.id;
    lembarTulis(idSs, namaSheet, kolomId + b.barisKe, [[b.id]]);
    laporan.barisDiberiId++;
  });
  if (nomorTerakhir) pengaturanSetel('nomor_terakhir', nomorTerakhir);

  // 3-4. Urai kolom 16. Baris yang tidak terbaca polanya tetap dipindahkan
  // dengan tahap LAINNYA dan teks aslinya utuh -- tidak ada satu pun kalimat
  // yang dibuang.
  var sekarang = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
  var email = Session.getEffectiveUser().getEmail();

  urut.forEach(function (b) {
    var tahunBawaan = Number((b.masuk || tanggal).slice(0, 4));
    var kejadian = uraiKolomProses(b.proses, tahunBawaan);
    if (!kejadian.length) return;

    kejadian.forEach(function (k, i) {
      if (k.tahap === 'LAINNYA') laporan.riwayatLainnya++;
      else laporan.riwayatTerurai++;
      lembarTambahBaris(idSs, NAMA_SHEET_RIWAYAT, [
        'M' + b.id + '-' + (i + 1), b.id, k.tanggal, k.tahap, k.keterangan, email, sekarang
      ]);
    });

    // Bandingkan hasil susun ulang dengan aslinya. Kalau berbeda, ada informasi
    // yang berubah bentuk, dan itu harus dilihat manusia sebelum sistem
    // dianggap siap.
    if (normalisasiBanding(susunKolomProses(kejadian)) !== normalisasiBanding(b.proses)) {
      laporan.selisihKolom16.push(b.id);
    }
  });

  // 5. Petakan nama OPD ke daftar baku; yang meragukan ditandai untuk diperiksa
  // manusia, bukan ditebak diam-diam.
  var opdAda = {};
  opdDaftar().forEach(function (o) {
    [o.nama_resmi, o.nama_singkat, o.kode_opd].forEach(function (nama) {
      var kunci = normalisasiHeader(nama);
      if (kunci) opdAda[kunci] = o.kode_opd;
    });
  });

  var kolomKodeOpd = lembarKolomHuruf(peta.kode_opd + 1);
  var belumDikenal = {};
  urut.forEach(function (b) {
    if (!b.opd) return;
    var kunci = normalisasiHeader(b.opd);
    var kode = opdAda[kunci];
    if (!kode) {
      // Cocokkan dengan awalan: 'BPKAD KABUPATEN BREBES' -> 'BPKAD'.
      // Lima ejaan untuk satu instansi memang ada di data nyata.
      Object.keys(opdAda).forEach(function (kandidat) {
        if (kandidat && kunci.indexOf(kandidat) === 0) kode = opdAda[kandidat];
      });
    }
    if (kode) lembarTulis(idSs, namaSheet, kolomKodeOpd + b.barisKe, [[kode]]);
    else belumDikenal[b.opd] = true;
  });
  laporan.opdPerluPeriksa = Object.keys(belumDikenal);

  logCatat('MIGRASI', '', JSON.stringify({
    id: laporan.barisDiberiId,
    riwayat: laporan.riwayatTerurai + laporan.riwayatLainnya,
    selisih: laporan.selisihKolom16.length
  }));

  return laporan;
}

/** Rapatkan spasi dan buang baris kosong supaya perbandingan tidak salah alarm. */
function normalisasiBanding(teks) {
  return String(teks || '')
    .split(/\r?\n/)
    .map(function (b) { return b.trim().replace(/\s+/g, ' '); })
    .filter(function (b) { return b; })
    .join('\n');
}


// ============================================================
// ============================================================
// Uji.gs
// ============================================================

/**
 * Uji.gs - penjalan tes untuk fungsi murni, dijalankan dari editor Apps Script.
 *
 * tests/ di komputer sudah menguji hal yang sama, tapi runtime V8 Apps Script
 * bukan Node. Menjalankan ulang di sini memastikan tidak ada perbedaan
 * perilaku yang lolos, terutama pada regex dan Date.
 *
 * Cara pakai: buka editor Apps Script, pilih jalankanSeluruhUji, tekan Run,
 * lalu baca hasilnya di Executions.
 */

var _ujiGagal = [];

function _harus(syarat, pesan) {
  if (!syarat) _ujiGagal.push(pesan);
}

function _harusSama(dapat, harap, pesan) {
  var a = JSON.stringify(dapat);
  var b = JSON.stringify(harap);
  if (a !== b) _ujiGagal.push(pesan + ' - dapat ' + a + ', diharapkan ' + b);
}

function jalankanSeluruhUji() {
  _ujiGagal = [];

  /* Skema */
  _harusSama(normalisasiHeader('Judul Raperda/Raperbup'), 'judul raperda raperbup', 'normalisasiHeader');
  _harusSama(cocokkanHeader([]).jenis, 'KOSONG', 'cocokkanHeader kosong');
  _harusSama(cocokkanHeader(['Nama Barang', 'Jumlah']).jenis, 'ASING', 'cocokkanHeader asing');
  _harusSama(judulKolom('opd'), 'Nama OPD Pemohon', 'judulKolom');

  /* Validasi */
  _harusSama(normalisasiWa('+62 822 9998 9690'), '082299989690', 'normalisasiWa +62');
  _harusSama(normalisasiWa('123'), null, 'normalisasiWa pendek');
  _harusSama(formatWa('082299989690'), '0822-9998-9690', 'formatWa');
  _harusSama(samarkanWa('082299989690'), '0822****9690', 'samarkanWa');

  var pengaturanUji = {};
  pengaturanAwal().forEach(function (b) { pengaturanUji[b[0]] = b[1]; });
  _harus(validasiBerkas({ kolom: 'rancangan', nama: 'r.pdf', ukuran: 100 }, pengaturanUji).sah === false,
    'rancangan harus menolak PDF');
  _harus(validasiBerkas({ kolom: 'lampiran', nama: 'l.zip', ukuran: 90 * 1024 * 1024 }, pengaturanUji).sah === true,
    'lampiran harus menerima 90 MB');

  var dataPerbup = {
    jenis_peraturan: 'Bupati', opd: 'BPKAD', judul: 'Uji', nama_pemohon: 'Uji',
    wa_pemohon: '082299989690',
    berkas: {
      surat_permohonan: [{ nama: 'a.pdf', ukuran: 1000 }],
      keterangan_na: [{ nama: 'b.pdf', ukuran: 1000 }],
      rancangan: [{ nama: 'c.docx', ukuran: 1000 }],
      paraf: [{ nama: 'd.pdf', ukuran: 1000 }],
      dasar_hukum: [{ nama: 'e.pdf', ukuran: 1000 }]
    }
  };
  _harus(validasiPengajuan(dataPerbup, pengaturanUji).sah === true, 'Perbup lengkap harus sah');
  dataPerbup.jenis_peraturan = 'Daerah';
  _harus(validasiPengajuan(dataPerbup, pengaturanUji).sah === false,
    'Perda tanpa SK Tim & BA PANSUS harus ditolak');

  /* Penomoran */
  _harusSama(nomorBerikutnya(2026, 'BRB-2026-0029'), 'BRB-2026-0030', 'nomorBerikutnya lanjut');
  _harusSama(nomorBerikutnya(2027, 'BRB-2026-0029'), 'BRB-2027-0001', 'nomorBerikutnya ganti tahun');
  _harusSama(nomorTerbesar(['BRB-2026-0003', 'BRB-2026-0029']), 'BRB-2026-0029', 'nomorTerbesar');

  /* ParserRiwayat */
  var contoh = '- 22 Juli 2026 Berkas masuk ke sistem\n' +
               '- 23 Juli 2026 Berkas sedang direviu Bagian Hukum\n' +
               '- 23 Juli 2026 Berkas sudah terinput ke sistem pra harmonisasi (Kemenkum Kanwil Jateng)';
  var terurai = uraiKolomProses(contoh, 2026);
  _harusSama(terurai.length, 3, 'uraiKolomProses jumlah');
  _harusSama(terurai[0].tahap, 'BERKAS_MASUK', 'uraiKolomProses tahap pertama');
  _harusSama(terurai[1].tahap, 'REVIU_HUKUM', 'uraiKolomProses tahap kedua');
  _harusSama(terurai[2].tahap, 'PRA_HARMONISASI', 'uraiKolomProses tahap ketiga');
  _harusSama(susunKolomProses(terurai), contoh, 'perjalanan bolak-balik kolom 16');
  _harusSama(formatTanggalIndonesia('2026-07-23'), '23 Juli 2026', 'formatTanggalIndonesia');

  /* Rekap */
  _harusSama(rekapPerStatus([{ status: 'PROSES' }, { status: 'SELESAI' }]),
    { TOTAL: 2, PROSES: 1, SELESAI: 1, DIKEMBALIKAN: 0 }, 'rekapPerStatus');
  _harusSama(selisihHari('2026-07-01', '2026-07-11'), 10, 'selisihHari');
  _harusSama(keCsv([{ a: 'x,y' }], [{ kunci: 'a', judul: 'A' }]), 'A\r\n"x,y"', 'keCsv');

  /* Penamaan berkas */
  _harusSama(
    namaBerkasBaku({
      kolom: 'surat_permohonan', jenisPeraturan: 'Bupati',
      judul: 'Rancangan Peraturan Bupati tentang Percontohan',
      kodeOpd: 'BPKAD', ekstensi: 'pdf'
    }),
    'BREBES_Surat Permohonan Rancangan Perda/Perbup_Raperbup tentang Percontohan_BPKAD.pdf'
      .replace(/[\/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' '),
    'namaBerkasBaku'
  );

  var ringkasan = _ujiGagal.length
    ? 'GAGAL (' + _ujiGagal.length + '):\n' + _ujiGagal.join('\n')
    : 'Seluruh uji lulus.';
  Logger.log(ringkasan);
  return ringkasan;
}


// ============================================================

// ============================================================
// Main.gs
// ============================================================

var HALAMAN_SAH = ['monitoring', 'detail', 'pengajuan', 'admin', 'setup'];

function doGet(e) {
  var param = (e && e.parameter) || {};
  var halaman = String(param.h || 'monitoring').toLowerCase();
  if (HALAMAN_SAH.indexOf(halaman) < 0) halaman = 'monitoring';
  if (!konfigSudahSiap()) halaman = 'setup';
  var t = HtmlService.createTemplateFromFile('Index');
  t.dataAwal = JSON.stringify({ halaman: halaman, kode: String(param.kode || '').slice(0, 40) });
  return t.evaluate()
    .setTitle('SIMPEL Hukum Brebes')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(nama) { return HtmlService.createHtmlOutputFromFile(nama).getContent(); }

function konteksAwal() {
  if (!konfigSudahSiap()) {
    return { siap: false, pengguna: { email: emailPengunjung(), peran: 'PUBLIK' }, pengumuman: '', tahap: TAHAP_RIWAYAT, status: STATUS_PENGAJUAN, opd: [] };
  }
  var pengaturan = pengaturanSemua();
  return { siap: true, pengguna: penggunaSekarang(), pengumuman: pengaturan.pengumuman || '', tahap: TAHAP_RIWAYAT, status: STATUS_PENGAJUAN, opd: opdDaftar() };
}
