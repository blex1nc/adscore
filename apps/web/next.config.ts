import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Marka asset yükleme server action ile yapılır (CONTRACTS §4); dosya
    // sınırı 2 MB olduğundan varsayılan 1 MB action gövde limiti yükseltildi.
    // Asıl sınır actions/brands.ts'te (ASSET_MAX_BYTES) uygulanır.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
