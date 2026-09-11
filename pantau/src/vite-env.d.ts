/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Tautan Google Form pengajuan; bila kosong, menu "Ajukan" disembunyikan. */
  readonly VITE_URL_FORM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
