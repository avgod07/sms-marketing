declare module "fs" {}
declare module "path" {}
declare module "http" {}

declare namespace NodeJS {
  interface Process {
    env: Record<string, string | undefined>;
    exit(code?: number): never;
  }
}

declare var process: NodeJS.Process;
