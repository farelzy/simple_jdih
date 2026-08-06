-- Nilai awal pengaturan. INSERT IGNORE supaya tidak menimpa yang sudah diubah
-- Bagian Hukum lewat dashboard.
--
-- Tidak ada 'nomor_terakhir' di sini: nomor pengajuan diterbitkan dari tabel
-- pengajuan di dalam transaksi, jadi menyimpannya terpisah justru menciptakan
-- sumber kebenaran kedua yang bisa bertentangan.

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
