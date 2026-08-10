-- Daftar OPD Kabupaten Brebes.
--
-- Disusun dari nama-nama yang benar-benar muncul di spreadsheet Bagian Hukum,
-- bukan dari daftar teoretis. `nama_resmi` sengaja ditulis tanpa embel-embel
-- "Kabupaten Brebes" supaya pencocokan awalan menangkap seluruh varian ejaan:
--
--   'BPKAD', 'BPKAD BREBES', 'BPKAD KAB. BREBES', 'BPKAD KABUPATEN BREBES'
--   semuanya berawalan 'bpkad' -> satu OPD yang sama.
--
-- Untuk pemasangan di instansi lain, hapus berkas ini dan isi daftar OPD lewat
-- Dashboard -> tab OPD.

INSERT IGNORE INTO opd (kode, nama_resmi, nama_singkat, aktif) VALUES
  ('BPKAD',      'BPKAD',                                        'Badan Pengelolaan Keuangan dan Aset Daerah', 1),
  ('BAPPERIDA',  'Bapperida',                                    'Badan Perencanaan Pembangunan, Riset dan Inovasi Daerah', 1),
  ('BAPENDA',    'Bapenda',                                      'Badan Pendapatan Daerah', 1),
  ('BPBD',       'BPBD',                                         'Badan Penanggulangan Bencana Daerah', 1),
  ('DP3KB',      'DP3KB',                                        'Dinas Pemberdayaan Perempuan, Perlindungan Anak dan Keluarga Berencana', 1),
  ('DINDIKPORA', 'Dinas Pendidikan, Pemuda dan Olahraga',        'Dindikpora', 1),
  ('DPU',        'Dinas Pekerjaan Umum',                         'DPU', 1),
  ('DLH',        'Dinas Lingkungan Hidup',                       'DLH', 1),
  ('DPRKP',      'Dinas Perumahan Rakyat dan Kawasan Permukiman', 'DPRKP', 1),
  ('DPMD',       'Dinas Pemberdayaan Masyarakat dan Desa',       'DPMD', 1),
  ('INSPEKTORAT','Inspektorat Daerah',                           'Inspektorat', 1),
  ('BAGORG',     'Bagian Organisasi Sekretariat Daerah',         'Bagian Organisasi', 1),
  ('BAGEKON',    'Bagian Perekonomian',                          'Bagian Perekonomian Setda', 1),
  -- Ditaruh terakhir supaya 'Bagian ... Sekretariat Daerah' tidak lebih dulu
  -- tertarik ke sini saat pencocokan awalan.
  ('SETDA',      'Sekretariat Daerah',                           'Setda', 1);
