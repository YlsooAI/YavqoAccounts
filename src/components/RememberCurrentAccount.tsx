"use client";

import { useEffect } from "react";
import { currentSlot, maskEmail, rememberAccount } from "@/lib/remembered-accounts";

export default function RememberCurrentAccount({ id, name, email, avatarUrl }: {
  id: string; name: string; email: string; avatarUrl: string | null;
}) {
  useEffect(() => {
    rememberAccount({
      slot: currentSlot(),
      id,
      name,
      maskedEmail: maskEmail(email),
      avatarUrl,
    });
  }, [id, name, email, avatarUrl]);
  return null;
}
