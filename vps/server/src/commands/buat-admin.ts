/**
 * commands/buat-admin.ts - buat akun admin dari baris perintah.
 *
 *   node dist/commands/buat-admin.js <email> <nama> <sandi>
 *
 * Dipakai untuk menyemai admin pertama tanpa melalui wizard, dan untuk
 * memulihkan akses kalau semua admin terkunci di kemudian hari. Hanya bisa
 * dijalankan oleh orang yang sudah punya akses SSH ke server -- yaitu orang
 * yang memang berhak.
 *
 * Sandi dilewatkan sebagai argumen, jadi ia akan tercatat di riwayat shell.
 * Perintah ini mengingatkan untuk membersihkannya.
 */

import { pool, siapkanSkema } from '../db.js';
import { adminBuat, adminCari, adminGantiSandi, adminHitungAktif } from '../repo/admin.js';
import { logCatat } from '../repo/log.js';

async function utama(): Promise<void> {
  const [email, nama, sandi] = process.argv.slice(2);

  if (!email || !sandi) {
    console.error('Pemakaian: node dist/commands/buat-admin.js <email> <nama> <sandi>');
    process.exitCode = 1;
    return;
  }

  await siapkanSkema();

  const adaSebelumnya = await adminCari(email);
  if (adaSebelumnya) {
    // Menimpa sandi lebih berguna daripada gagal: inilah jalur pemulihan saat
    // sandi admin terlupa.
    await adminGantiSandi(adaSebelumnya.id, sandi);
    await logCatat({ aktor: 'cli', aksi: 'GANTI_SANDI_ADMIN', rincian: email });
    console.log(`Kata sandi ${email} diperbarui.`);
  } else {
    await adminBuat(email, nama ?? '', sandi);
    await logCatat({ aktor: 'cli', aksi: 'BUAT_ADMIN', rincian: email });
    console.log(`Admin ${email} dibuat.`);
  }

  console.log(`Total admin aktif: ${await adminHitungAktif()}`);
  console.log(
    '\nSandi tadi tercatat di riwayat shell. Bersihkan dengan:\n' +
    '  history -d $(history 1) 2>/dev/null || true\n'
  );
}

try {
  await utama();
} catch (galat) {
  console.error('Gagal:', (galat as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
