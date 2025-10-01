// app/types/miniapp-sdk.d.ts
// Minimal typings to satisfy our code usage in FarcasterProvider and shareReferral.

declare module '@farcaster/miniapp-sdk' {
  /** Shape minimal dari context yang kita akses di app */
  export type MiniAppUser = {
    fid?: number
    username?: string
    displayName?: string
    pfpUrl?: string
  }

  export type MiniAppContext = {
    user?: MiniAppUser
    // tambahkan properti lain bila nanti dipakai:
    // cast?: { hash?: string; channelKey?: string }
    // frame?: { url?: string }
  }

  export const sdk: {
    /** Di kode kamu dipanggil: `await sdk.context` */
    context: Promise<MiniAppContext>

    actions: {
      /** Dipakai oleh tombol share */
      composeCast(input: {
        text: string
        embeds?: string[]
        channelKey?: string // kita tidak gunakan, tapi biarkan ada
      }): Promise<void>

      /** Fallback open URL dari Mini App */
      openUrl(url: string): Promise<void>
    }
  }
}

