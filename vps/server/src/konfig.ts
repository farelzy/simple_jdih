/**
 * konfig.ts - membaca dan memvalidasi environment sekali di awal.
 *
 * Semua kunci yang hilang dilaporkan sekaligus. Melaporkannya satu per satu
 * memaksa orang menjalankan ulang berkali-kali hanya untuk menemukan bahwa ada
 * lima yang belum diisi.
 */

export interface KonfigDb {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}

export interface KonfigGoogle {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

export interface Konfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly db: KonfigDb;
  readonly jwtSecret: string;
  readonly google: KonfigGoogle;
  readonly driveFolderId: string;
  readonly sheetsId: string;
}

/**
 * DB_PASSWORD sengaja tidak wajib: sebagian pemasangan MariaDB lokal memakai
 * autentikasi soket tanpa sandi.
 */
const WAJIB = [
  'DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN',
  'DRIVE_FOLDER_ID', 'SHEETS_ID'
] as const;

const PANJANG_RAHASIA_MIN = 32;

export function bacaKonfig(env: Record<string, string | undefined>): Konfig {
  const hilang = WAJIB.filter((kunci) => !env[kunci]);
  if (hilang.length) {
    throw new Error(
      'Environment belum lengkap. Kunci yang hilang: ' + hilang.join(', ') +
      '. Salin .env.contoh jadi .env lalu isi.'
    );
  }

  const rahasia = env.JWT_SECRET as string;
  if (rahasia.length < PANJANG_RAHASIA_MIN) {
    throw new Error(
      `JWT_SECRET terlalu pendek: minimal ${PANJANG_RAHASIA_MIN} karakter. ` +
      'Hasilkan dengan: openssl rand -hex 32'
    );
  }

  return Object.freeze({
    port: Number(env.PORT ?? 3101),
    nodeEnv: env.NODE_ENV ?? 'development',
    db: Object.freeze({
      host: env.DB_HOST as string,
      port: Number(env.DB_PORT ?? 3306),
      user: env.DB_USER as string,
      password: env.DB_PASSWORD ?? '',
      database: env.DB_NAME as string
    }),
    jwtSecret: rahasia,
    google: Object.freeze({
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      refreshToken: env.GOOGLE_REFRESH_TOKEN as string
    }),
    driveFolderId: env.DRIVE_FOLDER_ID as string,
    sheetsId: env.SHEETS_ID as string
  });
}
