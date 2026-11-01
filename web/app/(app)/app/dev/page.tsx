import { notFound } from "next/navigation";
import { DevSignIn } from "./dev-sign-in";

export default function DevSignInPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevSignIn />;
}
