declare module "qrious" {
  interface QRiousOptions {
    element?: HTMLCanvasElement;
    value?: string;
    size?: number;
    foreground?: string;
    background?: string;
    level?: string;
    mime?: string;
    padding?: number;
  }

  class QRious {
    constructor(options?: QRiousOptions);
    toDataURL(): string;
  }

  export = QRious;
}
