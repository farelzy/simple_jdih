import { describe, it, expect } from 'vitest';
import { pisahPernyataanSql } from '../../pure/sql.js';

describe('pisahPernyataanSql', () => {
  it('memecah pernyataan sederhana', () => {
    expect(pisahPernyataanSql('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('pernyataan terakhir boleh tanpa titik koma', () => {
    expect(pisahPernyataanSql('SELECT 1; SELECT 2')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('pernyataan kosong dan spasi dibuang', () => {
    expect(pisahPernyataanSql(';;  ;\n; SELECT 1 ;;')).toEqual(['SELECT 1']);
  });

  /**
   * Inti keberadaan berkas ini. Judul pengajuan sungguhan memuat titik koma,
   * dan memecah di sana menghasilkan dua pernyataan rusak -- pemulihan gagal
   * di tengah, setelah sebagian tabel terlanjur dihapus.
   */
  it('titik koma di dalam petik bukan pemisah', () => {
    const sql = "INSERT INTO p VALUES ('Raperda tentang Retribusi; Perubahan'); SELECT 1";
    expect(pisahPernyataanSql(sql)).toEqual([
      "INSERT INTO p VALUES ('Raperda tentang Retribusi; Perubahan')",
      'SELECT 1'
    ]);
  });

  it('petik yang diloloskan garis miring terbalik tidak menutup kutip', () => {
    const sql = "INSERT INTO p VALUES ('Raperbup \\'Uji\\'; bukan akhir'); SELECT 2";
    expect(pisahPernyataanSql(sql)).toHaveLength(2);
  });

  it("petik ganda-dua ('') di dalam petik tidak menutup kutip", () => {
    const sql = "INSERT INTO p VALUES ('sebut ''ini''; masih satu'); SELECT 2";
    expect(pisahPernyataanSql(sql)).toHaveLength(2);
  });

  it('petik ganda dan backtick ikut dihormati', () => {
    expect(pisahPernyataanSql('SELECT "a;b"; SELECT 2')).toHaveLength(2);
    expect(pisahPernyataanSql('SELECT `kolom;aneh`; SELECT 2')).toHaveLength(2);
  });

  /** Garis miring terbalik bukan pelolosan di dalam backtick. */
  it('backtick tidak mengenal pelolosan garis miring terbalik', () => {
    expect(pisahPernyataanSql('SELECT `a\\`; SELECT 2')).toHaveLength(2);
  });

  it('komentar baris dibuang berikut titik komanya', () => {
    expect(pisahPernyataanSql('-- catatan; bukan pernyataan\nSELECT 1;')).toEqual(['SELECT 1']);
    expect(pisahPernyataanSql('# catatan; juga\nSELECT 1;')).toEqual(['SELECT 1']);
  });

  it('komentar blok dibuang', () => {
    expect(pisahPernyataanSql('/* catatan; panjang */ SELECT 1;')).toEqual(['SELECT 1']);
  });

  /** `--` tanpa spasi sesudahnya bukan komentar; itu dua tanda minus. */
  it('minus ganda di dalam ekspresi tidak dianggap komentar', () => {
    expect(pisahPernyataanSql('SELECT 5--3;')).toEqual(['SELECT 5--3']);
  });

  it('dump berbaris banyak terpecah utuh', () => {
    const sql = [
      '-- Cadangan basis data',
      'SET NAMES utf8mb4;',
      'DROP TABLE IF EXISTS `opd`;',
      'CREATE TABLE `opd` (',
      '  `id` int NOT NULL,',
      "  `nama` varchar(255) NOT NULL DEFAULT 'a;b'",
      ');',
      "INSERT INTO `opd` (`id`, `nama`) VALUES",
      "  (1, 'BPKAD'),",
      "  (2, 'Dinas; Uji');",
      ''
    ].join('\n');

    const p = pisahPernyataanSql(sql);
    expect(p).toHaveLength(4);
    expect(p[0]).toBe('SET NAMES utf8mb4');
    expect(p[1]).toBe('DROP TABLE IF EXISTS `opd`');
    expect(p[2]).toContain('CREATE TABLE `opd`');
    expect(p[3]).toContain("'Dinas; Uji'");
  });

  it('teks kosong menghasilkan daftar kosong', () => {
    expect(pisahPernyataanSql('')).toEqual([]);
    expect(pisahPernyataanSql('   \n  ')).toEqual([]);
  });
});
