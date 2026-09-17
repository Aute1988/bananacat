/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_API_BASE?: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
  readonly VITE_INFURA_PROJECT_ID?: string
  readonly VITE_INFURA_PROJECT_SECRET?: string
  readonly VITE_PINATA_API_KEY?: string
  readonly VITE_PINATA_SECRET_KEY?: string
  readonly VITE_PINATA_JWT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
