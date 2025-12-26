"use client";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/_actions";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    try {
      await logoutAction();
    } finally {
      router.replace("/sign-in");
      router.refresh();
    }
  }

  return (
    <Button variant="outline" onClick={onLogout}>
      Logout
    </Button>
  );
}
