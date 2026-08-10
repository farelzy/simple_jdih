import { describe, it, expect } from 'vitest';
import { bacaKonfig } from '../konfig.js';

const LENGKAP = {
  PORT: '3101',
  DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_USER: 'simpel',
  DB_PASSWORD: 'rahasia', DB_NAME: 'simpel',
  JWT_SECRET: 'x'.repeat(32),
  GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'cs', GOOGLE_REFRESH_TOKEN: 'rt',
  DRIVE_FOLDER_ID: 'folder', SHEETS_ID: 'sheet'
};

describe('bacaKonfig', () => {
  it('membaca seluruh nilai dengan tipe yang benar', () => {
    const k = bacaKonfig(LENGKAP);
    expect(k.port).toBe(3101);
    expect(k.db.port).toBe(3306);
    expect(k.db.host).toBe('127.0.0.1');
    expect(k.google.refreshToken).toBe('rt');
  });

  it('memakai port bawaan bila tidak diisi', () => {
    const { PORT, ...tanpaPort } = LENGKAP;
    expect(bacaKonfig(tanpaPort).port).toBe(3101);
  });

  it('menyebut SEMUA kunci yang hilang sekaligus, bukan satu per satu', () => {
    const { DB_HOST, JWT_SECRET, SHEETS_ID, ...kurang } = LENGKAP;
    expect(() => bacaKonfig(kurang)).toThrow(/DB_HOST.*JWT_SECRET.*SHEETS_ID/s);
  });

  it('menolak JWT_SECRET yang terlalu pendek', () => {
    expect(() => bacaKonfig({ ...LENGKAP, JWT_SECRET: 'pendek' })).toThrow(/JWT_SECRET.*32/);
  });

  it('sandi database boleh kosong untuk pemasangan tanpa sandi', () => {
    const { DB_PASSWORD, ...tanpaSandi } = LENGKAP;
    expect(bacaKonfig(tanpaSandi).db.password).toBe('');
  });

  it('hasilnya beku supaya tidak bisa diubah saat berjalan', () => {
    const k = bacaKonfig(LENGKAP);
    expect(Object.isFrozen(k)).toBe(true);
    expect(Object.isFrozen(k.db)).toBe(true);
    expect(Object.isFrozen(k.google)).toBe(true);
  });
});
