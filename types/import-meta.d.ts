interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  // add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
