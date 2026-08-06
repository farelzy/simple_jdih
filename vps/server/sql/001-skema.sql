-- Seluruh tabel SIMPEL. Idempoten: aman dijalankan berulang tiap server naik.

CREATE TABLE IF NOT EXISTS opd (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  kode         VARCHAR(32)  NOT NULL UNIQUE,
  nama_resmi   VARCHAR(255) NOT NULL,
  nama_singkat VARCHAR(64)  NOT NULL DEFAULT '',
  aktif        TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pengajuan (
  id               INT AUTO_INCREMENT PRIMARY KEY,
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
  CONSTRAINT fk_pengajuan_opd FOREIGN KEY (opd_id) REFERENCES opd(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_dibuat (dibuat_pada)
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
  pengajuan_id INT          NOT NULL,
  tanggal      DATE         NOT NULL,
  tahap        VARCHAR(32)  NOT NULL,
  keterangan   TEXT         NOT NULL,
  dicatat_oleh VARCHAR(255) NOT NULL DEFAULT '',
  dicatat_pada DATETIME     NOT NULL,
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
