/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_DIAGNOSTIC_REPORT_ENDPOINT?: string;
  readonly VITE_DIAGNOSTIC_REPORT_FALLBACK_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
