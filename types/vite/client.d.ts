declare global {
  interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY: string;
    [key: string]: any;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
