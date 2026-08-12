"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyInviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/invite/${token}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-sm text-accent transition-opacity duration-300 hover:opacity-80"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Kopyalandı" : "Linki kopyala"}
    </button>
  );
}
