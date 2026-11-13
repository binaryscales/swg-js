export type PreferredSourceButtonLabel = 'default' | 'source' | 'creator';

export interface PreferredSourceButtonOptions {
  lang?: string;
  theme?: 'light' | 'dark' | 'auto';
  label?: PreferredSourceButtonLabel;
}

export interface PreferredSourceApi {
  init(options?: PreferredSourceButtonOptions): void;
  addPreferredSource(): void;
}
