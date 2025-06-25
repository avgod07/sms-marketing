interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  readonly VITE_CLERK_FRONTEND_API: string
  readonly VITE_CLERK_PROXY_URL: string
  // add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
