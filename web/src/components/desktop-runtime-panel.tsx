"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useBillbook } from "@/components/billbook-provider";
import { Panel } from "@/components/workspace-ui";

type DesktopEnvironment = {
  isDesktop: boolean;
  isDevelopment: boolean;
  appUrl: string;
};

type DesktopDatabaseStatus = {
  path: string;
  exists: boolean;
  workspaceName: string;
  syncedAt: string | null;
  objectCount: number;
  transactionCount: number;
  categoryCount: number;
  lastError?: string;
};

export function DesktopRuntimePanel() {
  const { t, lang } = useI18n();
  const { state, currentUser, refreshFromSqlite } = useBillbook();
  const [environment, setEnvironment] = useState<DesktopEnvironment | null>(null);
  const [databaseStatus, setDatabaseStatus] = useState<DesktopDatabaseStatus | null>(null);
  const [hermesAccess, setHermesAccess] = useState<boolean>(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (!window.billbookDesktop) return;

    let active = true;

    window.billbookDesktop.getEnvironment().then((value) => {
      if (active) setEnvironment(value);
    }).catch(() => {});

    window.billbookDesktop.getHermesAccess().then((value) => {
      if (active) setHermesAccess(value);
    }).catch(() => {});

    window.billbookDesktop.getDatabaseStatus().then((value) => {
      if (active) setDatabaseStatus(value);
    }).catch(() => {});

    const unsubscribeDatabase = window.billbookDesktop.onDatabaseStatus((nextStatus) => {
      if (active) setDatabaseStatus(nextStatus);
    });

    return () => { active = false; unsubscribeDatabase(); };
  }, []);

  const toggleHermesAccess = useCallback(async () => {
    if (!window.billbookDesktop) return;
    setBusyAction("hermes");
    try {
      const next = await window.billbookDesktop.setHermesAccess(!hermesAccess);
      setHermesAccess(next);
    } finally {
      setBusyAction(null);
    }
  }, [hermesAccess]);

  const syncWorkspaceToDesktop = async () => {
    if (!window.billbookDesktop) return;
    setBusyAction("sync");
    try {
      const nextStatus = await window.billbookDesktop.syncWorkspace({
        workspaceUserName: currentUser?.name ?? null,
        syncedAt: new Date().toISOString(),
        state,
      });
      setDatabaseStatus(nextStatus);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Panel title={t["runtime.title"]}>
      {environment ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Stat label={t["runtime.mode"]} value={environment.isDevelopment ? "Development" : "Desktop"} />
            <Stat label={t["runtime.syncTime"]} value={databaseStatus?.syncedAt ? formatSyncTime(databaseStatus.syncedAt, lang) : t["runtime.notSynced"]} />            
            <Stat label={t["runtime.txCount"]} value={databaseStatus ? String(databaseStatus.transactionCount) : "0"} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-4">
            <div>
              <p className="font-medium">{t["runtime.dbSection"]}</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                {t["runtime.dbHint"]}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={async () => {
                  setBusyAction("refresh");
                  try {
                    await refreshFromSqlite();
                    const status = (await window.billbookDesktop?.getDatabaseStatus()) ?? null;
                    setDatabaseStatus(status);
                  } finally {
                    setBusyAction(null);
                  }
                }}
                className="ui-button border border-[color:var(--line)] bg-[color:var(--surface)] disabled:opacity-50"
              >
                {busyAction === "refresh" ? "⟳" : "⟳ 从 SQLite 读入"}
              </button>
              <button
                type="button"
                disabled={Boolean(busyAction)}
                onClick={syncWorkspaceToDesktop}
                className="ui-button btn-accent disabled:opacity-50"
              >
                {busyAction === "sync" ? t["runtime.syncing"] : t["runtime.syncBtn"]}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-4">
            <div>
              <p className="font-medium">{t["runtime.hermesSection"]}</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                {hermesAccess
                  ? t["runtime.hermesOn"]
                  : t["runtime.hermesOff"]}
              </p>
            </div>
            <button
              type="button"
              disabled={busyAction === "hermes"}
              onClick={toggleHermesAccess}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                hermesAccess ? "bg-[color:var(--accent)]" : "bg-[color:var(--line)]"
              }`}
              role="switch"
              aria-checked={hermesAccess}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  hermesAccess ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <details className="rounded-[18px] border border-[color:var(--line)] bg-[color:var(--surface-strong)]">
            <summary className="cursor-pointer list-none px-4 py-4 text-sm font-medium">
              {t["runtime.detail"]}
            </summary>
            <div className="border-t border-[color:var(--line)] px-4 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Stat label={t["runtime.appUrl"]} value={environment.appUrl} />
                <Stat label={t["runtime.dbPath"]} value={databaseStatus?.path || "等待初始化"} />
                <Stat label={t["runtime.hermesAccess"]} value={hermesAccess ? t["runtime.on"] : t["runtime.off"]} />
              </div>
            </div>
          </details>
        </div>
      ) : (
        <div className="surface-strong rounded-[18px] border border-[color:var(--line)] p-4 text-sm leading-7 text-[color:var(--muted)]">
          {t["runtime.browserOnly"]}
        </div>
      )}
    </Panel>
  );
}

function formatSyncTime(value: string, locale: string = "zh-CN") {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-strong rounded-[16px] border border-[color:var(--line)] p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 break-all text-sm font-medium">{value}</p>
    </div>
  );
}
