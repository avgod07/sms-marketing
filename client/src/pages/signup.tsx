import { useEffect } from "react";
import { redirectToSignUp } from "@clerk/clerk-react";

export default function Signup() {
  useEffect(() => {
    redirectToSignUp();
  }, []);
  return null;
}
