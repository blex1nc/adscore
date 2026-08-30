// Ad Library sabitleri — hem sunucu hem istemci tarafından okunur.
// (search.ts "server-only" olduğundan bu değerler ayrı dosyada durur.)

/** Maliyet kapısı (CLAUDE.md §43): tek içe aktarmada en fazla bu kadar reklam
 *  kaydedilir — her kayıt bir AI analizi tetikler. */
export const MAX_SAVED_PER_SEARCH = 6;

/** Gezinmede tek sayfada dönen kayıt sayısı (yazma yok, AI yok). */
export const BROWSE_PAGE_SIZE = 40;
