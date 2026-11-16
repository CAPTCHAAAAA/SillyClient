import { Capacitor } from "@capacitor/core";
import {
  TarvenEnv,
  type DiagnosticReportInput,
  type DiagnosticReportResult,
} from "../capacitor-plugin";
import {
  deliverDiagnosticReport,
  openDiagnosticPrefillDraft,
} from "./diagnostic-report";
import { openExternalUrl } from "./external-links";

const DEFAULT_PUBLIC_SENTRY_DSN =
  "https://ffbac1e85a0a52f4d5c1bfe949f443a1@o4512437322383360.ingest.us.sentry.io/4512437347352576";

async function copyTextBestEffort(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

export async function submitDiagnosticReport(
  payload: DiagnosticReportInput
): Promise<DiagnosticReportResult> {
  return deliverDiagnosticReport({
    payload,
    nativeSubmit: (input) => TarvenEnv.submitDiagnosticReport(input),
    isDev: import.meta.env.DEV,
    isNativePlatform: Capacitor.isNativePlatform(),
    configuredSentryDsn: import.meta.env.VITE_SENTRY_DSN ?? DEFAULT_PUBLIC_SENTRY_DSN,
    configuredEndpoint: import.meta.env.VITE_DIAGNOSTIC_REPORT_ENDPOINT,
    configuredFallbackEndpoint: import.meta.env.VITE_DIAGNOSTIC_REPORT_FALLBACK_ENDPOINT,
    openUrl: openExternalUrl,
    copyText: copyTextBestEffort,
  });
}

export async function submitDiagnosticReportViaDraft(
  payload: DiagnosticReportInput
): Promise<DiagnosticReportResult> {
  return openDiagnosticPrefillDraft({
    payload,
    openUrl: openExternalUrl,
    copyText: copyTextBestEffort,
  });
}
