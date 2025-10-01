declare module '@farcaster/miniapp-sdk' {
  export const sdk: {
    actions: {
      composeCast(input: { text: string; embeds?: string[]; channelKey?: string }): Promise<void>;
      openUrl(url: string): Promise<void>;
    };
  };
}

