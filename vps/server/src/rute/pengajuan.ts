/**
 * rute/pengajuan.ts - pengiriman form pengajuan.
 *
 * Form terbuka ke internet tanpa akun, jadi ada tiga penangkal: pembatas laju
 * per IP, kolom umpan yang hanya diisi bot, dan batas jumlah draf terbuka per
 * IP di rute unggah.
 */

import { Router } from 'express';
import { transaksi } from '../db.js';
import { GalatKlien } from '../tengah/galat.js';
import { batasKirim } from '../tengah/rate-limit.js';
import { pengaturanSemua } from '../repo/pengaturan.js';
import { pengajuanBuat } from '../repo/pengajuan.js';
import { berkasTambah } from '../repo/berkas.js';
import { riwayatTambah } from '../repo/riwayat.js';
import { opdCocokkan } from '../repo/opd.js';
import { logCatat } from '../repo/log.js';
import { validasiPengajuan, normalisasiWa } from '../murni/validasi.js';
import { drafBaca, drafHapus, type BerkasDraf } from './unggah.js';
import { hapusBerkas } from '../layanan/simpanan.js';

export const rutePengajuan = Router();

function hariIniIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

rutePengajuan.post('/kirim', batasKirim, async (req, res, next) => {
  try {
    const b = (req.body ?? {}) as Record<string, string>;

    // Kolom umpan. Manusia tidak pernah melihatnya, jadi kalau terisi berarti
    // bot. Dijawab seolah berhasil supaya bot tidak belajar mana yang lolos.
    if (String(b.situs_web ?? '').trim() !== '') {
      await logCatat({ aksi: 'HONEYPOT', rincian: '', ip: req.ip ?? '' });
      res.json({ sukses: true, nomor: 'BRB-0000-0000' });
      return;
    }

    const d = drafBaca(String(b.draf ?? ''));

    // Daftar berkas disusun dari catatan draf di server, bukan dari kiriman
    // browser. Kiriman browser bisa diubah siapa pun yang paham.
    const berkasPerKolom: Record<string, { nama: string; ukuran: number }[]> = {};
    for (const bk of d.berkas) {
      (berkasPerKolom[bk.kolom] ??= []).push({ nama: bk.namaAsli, ukuran: bk.ukuran });
    }

    const data = {
      jenis_peraturan: String(b.jenis_peraturan ?? ''),
      opd: String(b.opd ?? '').trim(),
      judul: String(b.judul ?? '').trim(),
      nama_pemohon: String(b.nama_pemohon ?? '').trim(),
      wa_pemohon: String(b.wa_pemohon ?? '').trim(),
      berkas: berkasPerKolom
    };

    const pengaturan = await pengaturanSemua();
    const hasil = validasiPengajuan(data, pengaturan);
    if (!hasil.sah) {
      res.status(400).json({ sukses: false, galat: hasil.galat });
      return;
    }

    const opdId = await opdCocokkan(data.opd);

    const { nomor } = await transaksi(async (conn) => {
      const dibuat = await pengajuanBuat({
        opd_id: opdId,
        opd_teks: data.opd,
        jenis_peraturan: data.jenis_peraturan as 'Daerah' | 'Bupati',
        judul: data.judul,
        nama_pemohon: data.nama_pemohon,
        wa_pemohon: normalisasiWa(data.wa_pemohon) ?? data.wa_pemohon,
        email_pemohon: String(b.email_pemohon ?? '').trim()
      }, conn);

      for (const bk of d.berkas as BerkasDraf[]) {
        await berkasTambah(dibuat.id, {
          kolom: bk.kolom,
          nama: bk.namaAsli,
          ukuran: bk.ukuran,
          mime: bk.mime,
          sumber: 'lokal',
          jalur: bk.namaDisk
        }, conn);
      }

      await riwayatTambah(dibuat.id, {
        tanggal: hariIniIso(),
        tahap: 'BERKAS_MASUK',
        keterangan: 'Berkas masuk ke sistem'
      }, 'sistem', conn);

      return dibuat;
    });

    // Berkas sudah milik pengajuan; draf tidak boleh membersihkannya lagi saat
    // kedaluwarsa.
    drafHapus(String(b.draf ?? ''));

    await logCatat({ aksi: 'PENGAJUAN_BARU', rincian: `${nomor} - ${data.judul}`, ip: req.ip ?? '' });
    res.json({ sukses: true, nomor, galat: [] });
  } catch (galat) {
    next(galat);
  }
});

/** Aturan berkas beserta batas yang berlaku, untuk digambar form. */
rutePengajuan.get('/aturan', async (_req, res, next) => {
  try {
    const { ATURAN_BERKAS } = await import('../murni/validasi.js');
    const { KOLOM_FORM } = await import('../murni/skema.js');
    const pengaturan = await pengaturanSemua();

    const hasil: Record<string, unknown> = {};
    for (const kol of KOLOM_FORM) {
      const aturan = ATURAN_BERKAS[kol.kunci];
      if (!aturan) continue;
      hasil[kol.kunci] = {
        judul: kol.judul,
        ekstensi: aturan.ekstensi,
        batasMb: Number(pengaturan[aturan.kunciBatas]) || 5,
        maksBerkas: aturan.kunciMaksBerkas ? Number(pengaturan[aturan.kunciMaksBerkas]) || 5 : 1,
        wajib: !!kol.wajib,
        hanyaPerda: !!kol.hanyaPerda
      };
    }
    res.json(hasil);
  } catch (e) { next(e); }
});

export { hapusBerkas };
