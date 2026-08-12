"use client";

import { useActionState } from "react";
import { ImagePlus } from "lucide-react";
import {
  generateCreativeImage,
  type ImageFormState,
} from "@/actions/creative-images";

export function GenerateImageButton({
  creativeId,
  hasActive,
}: {
  creativeId: string;
  hasActive: boolean;
}) {
  const action = generateCreativeImage.bind(null, creativeId);
  const [state, formAction, pending] = useActionState<
    ImageFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending || hasActive}
        className="inline-flex items-center gap-1.5 text-xs text-accent transition-opacity duration-300 hover:opacity-80 disabled:opacity-50"
      >
        <ImagePlus size={13} />
        {hasActive
          ? "Görsel üretiliyor..."
          : pending
            ? "Başlatılıyor..."
            : "Görsel üret"}
      </button>
      {state.error ? (
        <span className="ml-2 text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
