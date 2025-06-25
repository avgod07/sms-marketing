import { useEffect } from "react";

export default function Login() {
  useEffect(() => {
    const base = import.meta.env.VITE_CLERK_FRONTEND_API
      ? `https://${import.meta.env.VITE_CLERK_FRONTEND_API}`
      : import.meta.env.VITE_CLERK_PROXY_URL;
    if (base) {
      window.location.href = `${base}/sign-in`;
    }
  }, []);
  return null;
}
