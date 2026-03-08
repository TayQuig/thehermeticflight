/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly LOOPS_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
