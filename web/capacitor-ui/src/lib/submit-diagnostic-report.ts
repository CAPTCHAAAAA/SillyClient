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
import { resolveDefaultSentryDsn } from "./sentry-diagnostic";

async function copyTextBestEffort(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

export async function submitDiagnosticReport(
  payload: DiagnosticReportInput
): Promise<DiagnosticReportResult> {
  const isNativePlatform = Capacitor.isNativePlatform();
  const isDev = import.meta.env.DEV;
  return deliverDiagnosticReport({
    payload,
    nativeSubmit: (input) => TarvenEnv.submitDiagnosticReport(input),
    isDev,
    isNativePlatform,
    configuredSentryDsn: resolveDefaultSentryDsn({
      isNativePlatform,
      isDev,
      envSentryDsn: import.meta.env.VITE_SENTRY_DSN,
    }),
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
