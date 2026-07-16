import type { ReactNode } from "react";

export type SuiteSettings = {
  primaryFont: string;
  onPrimaryFontChange: (font: string) => void;
  style: string;
  onStyleChange: (style: string) => void;
  onToggleStyleMode: () => void;
  update: SuiteUpdateControls;
};

export type SuiteUpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "error";

export type SuiteUpdateControls = {
  appName: string;
  currentVersion: string;
  identifier: string;
  platform: string;
  status: SuiteUpdateStatus;
  availableVersion?: string;
  releaseNotes?: string;
  progress?: number;
  downloadedBytes?: number;
  contentLength?: number;
  lastCheckedAt?: string;
  error?: string;
  onCheck: () => void;
  onInstall: () => void;
};

export type SuiteChrome = {
  active: boolean;
  sharedUniversePath?: string;
  onHome?: () => void;
  renderAppSwitcher: () => ReactNode;
  suiteSettings?: SuiteSettings;
};
