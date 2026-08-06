import { readFileSync, existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/**
 * Muat .env.test dan suntikkan ke lingkungan uji.
 *
 * db.ts memanggil bacaKonfig(process.env) saat modulnya dimuat, jadi nilainya
 * harus sudah ada sebelum berkas uji mengimpor apa pun. Opsi `test.env` Vitest
 * dievaluasi di sini, sebelum satu pun modul uji dimuat.
 */
function muatEnvUji(): Record<string, string> {
  if (!existsSync('.env.test')) return {};
  const env: Record<string, string> = {};
  for (const baris of readFileSync('.env.test', 'utf8').split(/\r?\n/)) {
    const bersih = baris.trim();
    if (!bersih || bersih.startsWith('#')) continue;
    const pisah = bersih.indexOf('=');
    if (pisah < 0) continue;
    env[bersih.slice(0, pisah).trim()] = bersih.slice(pisah + 1).trim();
  }
  return env;
}

export default defineConfig({
  test: {
    env: muatEnvUji(),
    include: ['src/uji/**/*.test.ts'],
    // Uji database berbagi satu skema; menjalankannya berbarengan membuat
    // pembersihan tabel satu berkas menghapus data berkas lain.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000
  }
});
