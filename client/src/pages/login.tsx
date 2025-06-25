import { useEffect } from "react";
import { redirectToSignIn } from "@clerk/clerk-react";

export default function Login() {
  useEffect(() => {
    redirectToSignIn();
  }, []);
  return null;
}
