// app/types/miniapp-sdk.d.ts
// Minimal types for @farcaster/miniapp-sdk used by your app.

declare module '@farcaster/miniapp-sdk' {
  export type MiniAppUser = {
    fid?: number
    username?: string
    displayName?: string
    pfpUrl?: string
  }

  export type MiniAppContext = {
    user?: MiniAppUser
    cast?: { hash?: string; channelKey?: string }
    frame?: { url?: string }
  }

  export const sdk: {
    /** Used as: const ctx = await sdk.context */
    context: Promise<MiniAppContext>

    actions: {
      /** Used by your Share button */
      composeCast(input: {
        text: string
        embeds?: string[]
        channelKey?: string
      }): Promise<void>

      /** Open deep links / external URLs */
      openUrl(url: string): Promise<void>

      /** Signal host that app is ready (removes spinner) */
      ready(): Promise<void>

      /** Optional helpers (declare if you use them later) */
      closeMini?(): Promise<void>
      copyToClipboard?(text: string): Promise<void>
    }
  }
}

