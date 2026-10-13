import type { Metadata } from "next";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your AI Faculty account.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
