interface Window {
  aistudio?: {
    hasSelectedApiKey: () => Promise<boolean>;
    setSelectedApiKey: (key: string) => Promise<void>;
    openSelectKey: () => Promise<void>;
  };
}
