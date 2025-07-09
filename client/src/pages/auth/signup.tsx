import { SignUp } from "@clerk/clerk-react";

export default function Signup() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <SignUp path="/signup" routing="path" signInUrl="/login" />
    </div>
  );
}
