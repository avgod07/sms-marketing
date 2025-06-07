declare module "express" {
  export interface Request {}
  export interface Response {
    json(body: any): any;
    status(code: number): Response;
    send(body?: any): any;
    set(field: string, value?: string): Response;
    on(event: string, callback: (...args: any[]) => void): void;
  }
  export interface NextFunction {}
  export interface Express {
    use(...args: any[]): any;
    get(path: string, ...handlers: any[]): any;
    post(path: string, ...handlers: any[]): any;
  }
  function express(): Express;
  namespace express {
    function json(): any;
    function urlencoded(options: any): any;
  }
  export default express;
}
