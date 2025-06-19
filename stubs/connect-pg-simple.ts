export default function connectPgSimple(session: any) {
  const Store = session.Store;
  return class PGStore extends Store {
    constructor(_opts: any) {
      super();
    }
  };
}
