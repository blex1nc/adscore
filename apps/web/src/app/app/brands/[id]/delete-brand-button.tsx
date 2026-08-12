"use client";

import { Button } from "@/components/ui";

export function DeleteBrandButton() {
  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      onClick={(e) => {
        if (!confirm("Bu markayı silmek istediğine emin misin?")) {
          e.preventDefault();
        }
      }}
    >
      Markayı sil
    </Button>
  );
}
