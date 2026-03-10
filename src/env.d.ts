/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly LOOPS_API_KEY: string;
  readonly TALLY_API_KEY: string;
  readonly GA4_SERVICE_ACCOUNT_KEY: string;
  readonly GA4_PROPERTY_ID: string;
  readonly SEOBOT_API_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
