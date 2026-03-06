/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_BACKEND_MODE: 'simulation' | 'firebase'
  readonly VITE_FIRESTORE_DATABASE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
