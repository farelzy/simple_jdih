import { describe, it, expect } from 'vitest';
import {
  STASIUN, JUMLAH_STASIUN, stasiunTahap, stasiunTercapai, relDenganStatus, petaStasiun
} from '../../pure/tahap.js';

describe('STASIUN', () => {
  it('enam stasiun, berurut sesuai rel yang digambar di kartu', () => {
    expect(JUMLAH_STASIUN).toBe(6);
    expect(STASIUN.map((s) => s.kunci)).toEqual([
      'BERKAS_MASUK', 'REVIU_HUKUM', 'PRA_HARMONISASI',
      'FASILITASI', 'RAPAT_HARMONISASI', 'SELESAI_HARMONISASI'
    ]);
  });
});

describe('stasiunTahap', () => {
  it('memetakan tiap tahap rel ke nomor urutnya', () => {
    expect(stasiunTahap('BERKAS_MASUK')).toBe(1);
    expect(stasiunTahap('REVIU_HUKUM')).toBe(2);
    expect(stasiunTahap('PRA_HARMONISASI')).toBe(3);
    expect(stasiunTahap('FASILITASI')).toBe(4);
    expect(stasiunTahap('RAPAT_HARMONISASI')).toBe(5);
    expect(stasiunTahap('SELESAI_HARMONISASI')).toBe(6);
  });

  it('HASIL_FASILITASI dihitung sebagai stasiun Fasilitasi', () => {
    expect(stasiunTahap('HASIL_FASILITASI')).toBe(4);
  });

  // Berkas yang sudah ditetapkan pasti sudah melewati harmonisasi. Tanpa ini
  // relnya terlihat belum tuntas justru pada berkas yang paling tuntas.
  it('PENETAPAN dihitung sudah sampai stasiun terakhir', () => {
    expect(stasiunTahap('PENETAPAN')).toBe(6);
  });

  it('tahap di luar rel tidak punya stasiun', () => {
    expect(stasiunTahap('LAINNYA')).toBeNull();
    expect(stasiunTahap('PERBAIKAN')).toBeNull();
    expect(stasiunTahap('DIKEMBALIKAN')).toBeNull();
  });

  it('masukan yang tidak dikenali atau kosong tidak punya stasiun', () => {
    expect(stasiunTahap('')).toBeNull();
    expect(stasiunTahap(null)).toBeNull();
    expect(stasiunTahap(undefined)).toBeNull();
    expect(stasiunTahap('ngawur')).toBeNull();
    expect(stasiunTahap(7)).toBeNull();
  });
});

describe('stasiunTercapai', () => {
  it('mengambil stasiun terjauh, bukan yang terakhir dicatat', () => {
    // Urutan pencatatan sengaja mundur: rel harus tetap menunjuk Rapat.
    expect(stasiunTercapai([
      'BERKAS_MASUK', 'REVIU_HUKUM', 'RAPAT_HARMONISASI', 'PRA_HARMONISASI'
    ])).toBe(5);
  });

  // LAINNYA adalah tahap terbanyak di data sungguhan (40 dari 189 riwayat).
  // Kalau ia menggeser posisi, hampir semua kartu jatuh ke rel kosong.
  it('mengabaikan tahap di luar rel saat menghitung posisi', () => {
    expect(stasiunTercapai(['BERKAS_MASUK', 'PRA_HARMONISASI', 'LAINNYA'])).toBe(3);
    expect(stasiunTercapai(['LAINNYA', 'PERBAIKAN', 'DIKEMBALIKAN'])).toBe(0);
  });

  it('belum ada riwayat berarti belum sampai stasiun mana pun', () => {
    expect(stasiunTercapai([])).toBe(0);
  });

  it('tahan terhadap nilai kosong di dalam daftar', () => {
    expect(stasiunTercapai(['BERKAS_MASUK', null, undefined, ''])).toBe(1);
  });
});

describe('relDenganStatus', () => {
  /**
   * Di data sungguhan, 6 dari 14 pengajuan berstatus SELESAI berhenti di
   * stasiun 5 karena riwayatnya tidak pernah ditandai SELESAI_HARMONISASI.
   * Tanpa aturan ini, kartunya memasang lencana SELESAI di kanan atas sambil
   * menulis "Tahap 5 dari 6" di kaki, dan dua penanda di satu kartu saling
   * membantah. Status pengajuan yang menang: ia yang disetel sadar oleh
   * Bagian Hukum, sementara tahap riwayat sering tertinggal.
   */
  it('status SELESAI membuat rel penuh walau riwayatnya belum sampai ujung', () => {
    expect(relDenganStatus('SELESAI', 5)).toBe(JUMLAH_STASIUN);
    expect(relDenganStatus('SELESAI', 0)).toBe(JUMLAH_STASIUN);
    expect(relDenganStatus('selesai', 3)).toBe(JUMLAH_STASIUN);
  });

  it('status lain memakai posisi dari riwayat apa adanya', () => {
    expect(relDenganStatus('PROSES', 3)).toBe(3);
    expect(relDenganStatus('PROSES', 0)).toBe(0);
    // Berkas yang dikembalikan bisa berhenti di stasiun mana pun; relnya tidak
    // dimundurkan maupun dipenuhkan, cukup lencananya yang mengabarkan.
    expect(relDenganStatus('DIKEMBALIKAN', 2)).toBe(2);
  });

  it('status yang tidak dikenali tidak mengubah posisi', () => {
    expect(relDenganStatus('', 4)).toBe(4);
    expect(relDenganStatus(null, 4)).toBe(4);
    expect(relDenganStatus(undefined, 0)).toBe(0);
  });
});

describe('petaStasiun', () => {
  /**
   * Dashboard perlu tahu tahap mana yang menggerakkan rel dan mana yang tidak,
   * supaya pilihan di formulir bisa dikelompokkan dan Bagian Hukum tidak lagi
   * memilih LAINNYA sambil mengira relnya ikut maju. Pemetaannya dikirim dari
   * server, bukan ditulis ulang di peramban, karena aturannya hanya boleh
   * hidup di satu tempat.
   */
  it('memetakan tiap tahap ke nomor stasiunnya, null bila di luar rel', () => {
    expect(petaStasiun(['BERKAS_MASUK', 'FASILITASI', 'LAINNYA'])).toEqual({
      BERKAS_MASUK: 1,
      FASILITASI: 4,
      LAINNYA: null
    });
  });

  it('padanan ikut terpetakan, bukan dianggap di luar rel', () => {
    expect(petaStasiun(['HASIL_FASILITASI', 'PENETAPAN'])).toEqual({
      HASIL_FASILITASI: 4,
      PENETAPAN: 6
    });
  });

  it('daftar kosong menghasilkan peta kosong', () => {
    expect(petaStasiun([])).toEqual({});
  });
});
