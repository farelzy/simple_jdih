import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { pool, kueri, siapkanSkema } from '../db.js';
import {
  adminBuat, adminCari, adminDaftar, adminNonaktifkan,
  adminHitungAktif, adminPeriksaSandi, adminGantiSandi
} from '../repo/admin.js';
import { buatToken, periksaToken } from '../middleware/auth.js';

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

  it('menolak email yang tidak sah', async () => {
    await expect(adminBuat('bukan-email', 'X', 'sandi-panjang-cukup')).rejects.toThrow(/email/i);
  });

  it('menolak sandi yang terlalu pendek', async () => {
    await expect(adminBuat('c@uji.local', 'Admin C', 'pendek')).rejects.toThrow(/8/);
  });

  it('adminDaftar tidak pernah membocorkan hash', async () => {
    const daftar = await adminDaftar();
    expect(daftar.length).toBeGreaterThan(0);
    for (const a of daftar) expect(a).not.toHaveProperty('password_hash');
  });

  it('adminPeriksaSandi menerima sandi benar dan menolak yang salah', async () => {
    expect(await adminPeriksaSandi('a@uji.local', 'sandi-rahasia-123')).not.toBeNull();
    expect(await adminPeriksaSandi('a@uji.local', 'sandi-salah-000')).toBeNull();
  });

  it('adminPeriksaSandi menolak email yang tidak terdaftar tanpa membocorkan bedanya', async () => {
    expect(await adminPeriksaSandi('tidak-ada@uji.local', 'apa pun')).toBeNull();
  });

  it('ganti sandi membuat sandi lama tidak berlaku lagi', async () => {
    const a = await adminCari('a@uji.local');
    await adminGantiSandi(a!.id, 'sandi-baru-9999');
    expect(await adminPeriksaSandi('a@uji.local', 'sandi-rahasia-123')).toBeNull();
    expect(await adminPeriksaSandi('a@uji.local', 'sandi-baru-9999')).not.toBeNull();
  });

  it('menonaktifkan admin mengeluarkannya dari hitungan aktif dan dari login', async () => {
    const sebelum = await adminHitungAktif();
    const b = await adminCari('b@uji.local');
    await adminNonaktifkan(b!.id);
    expect(await adminHitungAktif()).toBe(sebelum - 1);
    expect(await adminPeriksaSandi('b@uji.local', 'sandi-lain-456')).toBeNull();
  });
});

describe('token sesi', () => {
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
