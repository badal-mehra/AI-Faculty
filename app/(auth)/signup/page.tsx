import type { Metadata } from "next";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Sign up for AI Faculty to start learning with an AI teacher.",
};

export default function SignupPage() {
  return <SignupForm />;
}
