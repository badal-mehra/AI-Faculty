import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your AI Faculty account to continue learning.",
};

export default function LoginPage() {
  return <LoginForm />;
}
