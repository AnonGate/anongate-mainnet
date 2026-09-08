/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELAYER_URL?: string;
  readonly VITE_RELAYER_URL_SEPOLIA?: string;
  readonly VITE_RELAYER_URL_MAINNET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
