// app/(auth)/reset-password/[token]/page.tsx

import type { Metadata } from "next";
import { ResetPasswordClient } from "./reset-password-client";

export const metadata: Metadata = { title: "Reset Password" };

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return <ResetPasswordClient token={params.token} />;
}
