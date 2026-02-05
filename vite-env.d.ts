/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_BACKEND_MODE: 'simulation' | 'firebase'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
