"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { configureAnalyticsPresentation } from "@/lib/analytics";
type AccountStatus = "active" | "disabled";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

type AuthSession = {
  user: AuthUser;
  expiresAt: string;
};
import {
  downloadWorkspaceBackup,
  downloadWorkspaceExport,
} from "@/lib/exporters";
import {
  clearLocalLedger,
  readLocalBackupMeta,
  readLocalLedger,
  writeLocalBackupMeta,
  writeLocalLedger,
} from "@/lib/local-ledger";
import {
  defaultLocalPreferences,
  LocalWorkspacePreferences,
  mergeWorkspacePreferences,
  readLocalPreferences,
  writeLocalPreferences,
} from "@/lib/local-preferences";
import {
  defaultWorkspaceMember,
  objectPalette,
  sampleState,
} from "@/lib/sample-data";
import {
  BillbookState,
  CategoryGroup,
  EntryKind,
  ExportFormat,
  HistoryAction,
  HistoryDisplaySettings,
  LongTermCategorySetting,
  NewObjectInput,
  NewTransactionInput,
  ObjectAllocation,
  ObjectKind,
  PermissionSet,
  TeamMember,
  UpdateTransactionInput,
  UserRole,
} from "@/lib/types";

type BillbookContextValue = {
  state: BillbookState;
  currentUser: TeamMember | null;
  hydrated: boolean;
  permissions: PermissionSet;
  errorMessage: string | null;
  lastBackupAt: string | null;
  clearError: () => void;
  addObject: (input: NewObjectInput) => void;
  addTransaction: (input: NewTransactionInput) => void;
  updateTransaction: (transactionId: string, updates: UpdateTransactionInput) => void;
  deleteTransaction: (transactionId: string) => void;
  exportData: (format: ExportFormat) => void;
  importData: (file: File) => Promise<void>;
  clearData: () => void;
  backupData: () => void;
  updateObjectConfig: (
    objectId: string,
    updates: Partial<
      Pick<
        BillbookState["objects"][number],
        "name" | "kind" | "note" | "status"
      >
    >,
  ) => void;
  updateObjectCategories: (objectId: string, categoryIds: string[]) => void;
  addCategoryToObject: (objectId: string, categoryName: string) => void;
  removeCategoryFromObject: (objectId: string, categoryId: string) => void;
  deleteObject: (objectId: string) => void;
  reorderObjects: (activeObjectId: string, targetObjectId: string) => void;
  updatePreferences: (updates: Partial<BillbookState["preferences"]>) => void;
  updateHistoryDisplaySettings: (
    updates: Partial<BillbookState["advancedSettings"]["historyDisplay"]>,
  ) => void;
  addLongTermCategory: (input: { objectId: string; name: string; cycleDays: number }) => void;
  updateLongTermCategory: (
    settingId: string,
    updates: { name: string; cycleDays: number },
  ) => void;
  deleteLongTermCategory: (settingId: string) => void;
  updateWorkspaceProfile: (updates: {
    workspaceName: string;
    workspaceDescription: string;
  }) => void;
  refreshFromSqlite: () => Promise<void>;
};

const BillbookContext = createContext<BillbookContextValue | null>(null);
const OTHER_CATEGORY_ID = "cat-other";
const OTHER_CATEGORY_NAME = "其它";
const LONG_TERM_CATEGORY_COLOR = "#0f8a78";
const GUEST_AUTH_SESSION: AuthSession = {
  user: {
    id: defaultWorkspaceMember.id,
    name: defaultWorkspaceMember.name,
    email: defaultWorkspaceMember.email,
    role: defaultWorkspaceMember.role,
    status: "active",
    createdAt: "2026-04-24T09:10:00+08:00",
    updatedAt: "2026-04-24T09:10:00+08:00",
    lastLoginAt: "2026-04-24T09:10:00+08:00",
  },
  expiresAt: "2099-12-31T23:59:59.000Z",
};

function createId(prefix: string): string {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function appendHistory(
  current: BillbookState,
  entry: { actorId: string; action: HistoryAction; title: string; detail: string },
): BillbookState {
  return {
    ...current,
    history: [
      {
        id: createId("hist"),
        actorId: entry.actorId,
        action: entry.action,
        title: entry.title,
        detail: entry.detail,
        createdAt: new Date().toISOString(),
      },
      ...current.history,
    ].slice(0, 50),
  };
}

function buildLocalWorkspaceSeed(
  session: AuthSession,
  preferences: LocalWorkspacePreferences,
): BillbookState {
  return {
    workspaceName: "我的账本",
    workspaceDescription: "个人记账工作区",
    objects: [],
    accounts: [
      { id: "acc-default", name: "现金", type: "cash", balance: 0 },
    ],
    categories: [
      { id: "cat-food", name: "餐饮", kind: "expense", group: "daily" },
      { id: "cat-grocery", name: "日用", kind: "expense", group: "daily" },
      { id: "cat-transport", name: "出行", kind: "expense", group: "transport" },
      { id: "cat-learning", name: "学习", kind: "expense", group: "growth" },
      { id: "cat-pet", name: "宠物", kind: "expense", group: "pet-care" },
      { id: "cat-gift", name: "礼物", kind: "expense", group: "family" },
      { id: "cat-home", name: "居家", kind: "expense", group: "housing" },
      { id: "cat-fuel", name: "加油", kind: "expense", group: "transport" },
      { id: "cat-parking", name: "停车", kind: "expense", group: "transport" },
      { id: "cat-other", name: "其它", kind: "expense", group: "daily" },
    ],
    transactions: [],
    history: [],
    preferences: {
      theme: preferences.theme ?? "fern",
      language: preferences.language ?? "zh-CN",
      currency: preferences.currency ?? "CNY",
      storagePath: preferences.storagePath ?? "",
    },
    advancedSettings: {
      historyDisplay: { enabled: false, periodDays: 30 },
      longTermCategories: [],
    },
    recurringPlans: [],
    teamMembers: [],
  };
}

export function BillbookProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState(sampleState);
  const [authSession, setAuthSession] = useState<AuthSession | null>(GUEST_AUTH_SESSION);
  const [localPreferences, setLocalPreferences] = useState<LocalWorkspacePreferences>(
    defaultLocalPreferences,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const desktopSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDesktopSyncFingerprintRef = useRef<string | null>(null);

  const currentUser = authSession
    ? toTeamMember(authSession.user, state.teamMembers)
    : null;
  const permissions = getPermissions(currentUser?.role);

  const clearError = useCallback(() => setErrorMessage(null), []);

  useEffect(() => {
    configureAnalyticsPresentation({
      locale: state.preferences.language,
      currency: state.preferences.currency,
    });
    applyTheme(state.preferences.theme);
    document.documentElement.lang = state.preferences.language;
  }, [state.preferences.currency, state.preferences.language, state.preferences.theme]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.billbookDesktop ||
      !hydrated ||
      !authSession
    ) {
      return;
    }

    const payload = createDesktopWorkspaceSyncPayload(state, currentUser);
    const fingerprint = JSON.stringify(payload);

    if (lastDesktopSyncFingerprintRef.current === fingerprint) {
      return;
    }

    if (desktopSyncTimerRef.current) {
      clearTimeout(desktopSyncTimerRef.current);
    }

    desktopSyncTimerRef.current = setTimeout(() => {
      void window.billbookDesktop
        ?.syncWorkspace(payload)
        .then(() => {
          lastDesktopSyncFingerprintRef.current = fingerprint;
        })
        .catch((error) => {
          console.error("Failed to sync workspace to desktop SQLite:", error);
        });
    }, 900);

    return () => {
      if (desktopSyncTimerRef.current) {
        clearTimeout(desktopSyncTimerRef.current);
        desktopSyncTimerRef.current = null;
      }
    };
  }, [authSession, currentUser, hydrated, state]);

  const loadWorkspace = async (session: AuthSession) => {
    const nextLocalPreferences = readLocalPreferences(session.user.id);
    setLocalPreferences(nextLocalPreferences);
    setLastBackupAt(readLocalBackupMeta(session.user.id).lastBackupAt);
    setAuthSession(session);

    // 桌面端：优先从 SQLite 加载，避免 MCP 写入的数据被 localStorage 覆盖
    if (typeof window !== "undefined" && window.billbookDesktop) {
      try {
        const sqliteState = await window.billbookDesktop.readWorkspaceState();
        if (sqliteState && typeof sqliteState === "object") {
          const normalized = normalizeWorkspace(
            sqliteState as BillbookState,
            session,
            nextLocalPreferences,
          );
          setState(normalized);
          writeLocalLedger(session.user.id, normalized);
          // 设置初始指纹，避免自动 sync 覆盖相同数据
          if (lastDesktopSyncFingerprintRef) {
            const initialPayload = createDesktopWorkspaceSyncPayload(
              normalized,
              null,
            );
            lastDesktopSyncFingerprintRef.current = JSON.stringify(initialPayload);
          }
          return;
        }
      } catch {
        // SQLite 无数据或无连接，fallthrough 到 localStorage
      }
    }

    const localWorkspace = readLocalLedger(session.user.id);
    if (localWorkspace) {
      setState(normalizeWorkspace(localWorkspace, session, nextLocalPreferences));
      return;
    }

    const workspace = buildLocalWorkspaceSeed(session, nextLocalPreferences);
    writeLocalLedger(session.user.id, workspace);
    setState(workspace);
  };



  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        await loadWorkspace(GUEST_AUTH_SESSION);
      } catch {
          setState(buildLocalWorkspaceSeed(GUEST_AUTH_SESSION, defaultLocalPreferences));
          setLocalPreferences(defaultLocalPreferences);
          setLastBackupAt(null);
      } finally {
        setHydrated(true);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);





  const saveWorkspace = (nextState: BillbookState) => {
    if (!authSession?.user.id) {
      throw new Error("账本数据保存失败。");
    }

    writeLocalLedger(authSession.user.id, nextState);
  };

  const commitWorkspaceChange = (
    updater: (current: BillbookState, user: TeamMember) => BillbookState,
    failureMessage: string,
  ) => {
    if (!currentUser) {
      setErrorMessage("当前会话不可用。");
      return;
    }

    setState((current) => {
      const nextState = normalizeWorkspace(
        updater(current, currentUser),
        authSession,
        localPreferences,
      );

      try {
        saveWorkspace(nextState);
      } catch {
        setErrorMessage(failureMessage);
        return current;
      }

      return nextState;
    });
  };

  const addObject = (input: NewObjectInput) => {
    if (!permissions.canEdit || !currentUser) {
      setErrorMessage("当前账号不能创建对象。");
      return;
    }

    const normalizedName = input.name.trim();

    if (!normalizedName) {
      setErrorMessage("对象名称不能为空。");
      return;
    }

    commitWorkspaceChange((current, user) => {
      const paletteIndex = current.objects.length % objectPalette.length;
      const normalizedKind = normalizeObjectKind(input.kind);
      const defaultCategoryIds =
        input.categoryIds && input.categoryIds.length > 0
          ? input.categoryIds
          : getDefaultCategoryIdsForKind(
              current.categories
                .filter((category) => category.kind === "expense")
                .map((category) => category.id),
              normalizedKind,
            );

      return appendHistory(
        {
          ...current,
          objects: [
            ...current.objects,
            {
              id: createId("obj"),
              name: normalizedName,
              kind: normalizedKind,
              accent: objectPalette[paletteIndex],
              monthlyBudget: 0,
              categoryIds: defaultCategoryIds,
              note: input.note.trim(),
              goal: "先录入 3 到 5 笔代表性交易，建立基础账本节奏。",
              status: "active",
            },
          ],
        },
        {
          actorId: user.id,
          action: "create_object",
          title: "创建对象",
          detail: `已创建 ${normalizedName}。`,
        },
      );
    }, "创建对象失败。");
  };

  const addTransaction = (input: NewTransactionInput) => {
    if (!permissions.canEdit || !currentUser) {
      setErrorMessage("当前账号不能创建交易。");
      return;
    }

    const title = input.title.trim();
    const amount = roundAmount(input.amount);

    if (!title || amount <= 0) {
      setErrorMessage("请输入有效的标题和金额。");
      return;
    }

    if (!input.objectId) {
      setErrorMessage("每笔交易都必须归属一个对象。");
      return;
    }

    commitWorkspaceChange((current, user) => {
      const nextTransaction = {
        id: createId("txn"),
        title,
        amount,
        date: input.date,
        kind: "expense" as const,
        categoryId: input.categoryId,
        accountId: current.accounts[0]?.id ?? "acc-local",
        allocations: [{ objectId: input.objectId, amount }],
        note: input.note.trim(),
        tags: ["single-object"],
        spreadDays: resolveTransactionSpreadDays(
          current,
          input.categoryId,
          input.spreadDays,
        ),
      };
      const accountDelta = -amount;

      return appendHistory(
        {
          ...current,
          transactions: [nextTransaction, ...current.transactions],
          accounts: current.accounts.map((account) =>
            account.id === (current.accounts[0]?.id ?? "acc-local")
              ? { ...account, balance: roundAmount(account.balance + accountDelta) }
              : account,
          ),
        },
        {
          actorId: user.id,
          action: "create_transaction",
          title: "创建交易",
          detail: `已记录 ${title}。`,
        },
      );
    }, "保存交易失败。");
  };

  const updateTransaction = (
    transactionId: string,
    updates: UpdateTransactionInput,
  ) => {
    if (!permissions.canEdit || !currentUser) {
      setErrorMessage("当前账号不能修改交易。");
      return;
    }

    const amount = roundAmount(updates.amount);

    if (amount <= 0) {
      setErrorMessage("请输入有效的消费金额。");
      return;
    }

    commitWorkspaceChange((current, user) => {
      const targetTransaction = current.transactions.find(
        (transaction) => transaction.id === transactionId,
      );

      if (!targetTransaction) {
        setErrorMessage("未找到要修改的消费记录。");
        return current;
      }

      const nextCategory = current.categories.find(
        (category) =>
          category.id === updates.categoryId && category.kind === targetTransaction.kind,
      );

      if (!nextCategory) {
        setErrorMessage("未找到要更新的消费分类。");
        return current;
      }

      const nextAllocations = scaleAllocationsToAmount(
        current,
        targetTransaction.allocations,
        amount,
      );
      const accountDelta =
        targetTransaction.kind === "expense"
          ? targetTransaction.amount - amount
          : amount - targetTransaction.amount;

      return appendHistory(
        {
          ...current,
          transactions: current.transactions.map((transaction) =>
            transaction.id === transactionId
              ? {
                  ...transaction,
                  title: nextCategory.name,
                  amount,
                  date: updates.date,
                  categoryId: updates.categoryId,
                  allocations: nextAllocations,
                  spreadDays: resolveTransactionSpreadDays(
                    current,
                    updates.categoryId,
                    updates.spreadDays,
                  ),
                }
              : transaction,
          ),
          accounts: current.accounts.map((account) =>
            account.id === targetTransaction.accountId
              ? {
                  ...account,
                  balance: roundAmount(account.balance + accountDelta),
                }
              : account,
          ),
        },
        {
          actorId: user.id,
          action: "update_transaction",
          title: "更新交易",
          detail: `已更新 ${nextCategory.name} 的消费记录。`,
        },
      );
    }, "修改交易失败。");
  };

  const deleteTransaction = (transactionId: string) => {
    if (!permissions.canEdit || !currentUser) {
      setErrorMessage("当前账号不能删除交易。");
      return;
    }

    commitWorkspaceChange((current, user) => {
      const targetTransaction = current.transactions.find(
        (transaction) => transaction.id === transactionId,
      );

      if (!targetTransaction) {
        setErrorMessage("未找到要删除的消费记录。");
        return current;
      }

      const accountDelta =
        targetTransaction.kind === "expense"

        ? targetTransaction.amount
        : -targetTransaction.amount;

      return updateAmountDistribution(current, user, {
        ...targetTransaction,
        amount: 0,
      });
    }, "删除交易失败。");
  };

  return (
    <BillbookContext.Provider
      value={{
        state,
        currentUser,
        hydrated,
        permissions,
        errorMessage,
        lastBackupAt,
        clearError,
        addObject,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        exportData: (format: ExportFormat) => downloadWorkspaceExport(state, format),
        importData: async (file: File) => {
          try {
            const text = await file.text();
            const imported = JSON.parse(text);

            if (imported.mode === "local-backup" && imported.state) {
              commitWorkspaceChange(() => imported.state, "导入备份失败。");
              return;
            }

            commitWorkspaceChange(
              (current) => mergeWorkspaceState(current, imported),
              "导入数据失败。",
            );
          } catch {
            setErrorMessage("导入失败：文件内容解析错误。");
          }
        },
        clearData: () => {
          writeLocalLedger(authSession?.user.id ?? 'guest', defaultWorkspaceState());
          setState(defaultWorkspaceState);
        },
        backupData: () => {
          setLastBackupAt(downloadWorkspaceBackup(state));
        },
        updateObjectConfig: (objectId, updates) => {
          commitWorkspaceChange(
            (current) => ({
              ...current,
              objects: current.objects.map((obj) =>
                obj.id === objectId ? { ...obj, ...updates } : obj,
              ),
            }),
            "更新对象失败。",
          );
        },
        updateObjectCategories: (objectId, categoryIds) => {
          commitWorkspaceChange(
            (current) => ({
              ...current,
              objects: current.objects.map((obj) =>
                obj.id === objectId ? { ...obj, categoryIds } : obj,
              ),
            }),
            "更新对象分类失败。",
          );
        },
        addCategoryToObject: (objectId, categoryName) => {
          commitWorkspaceChange(
            (current) => {
              const nextId = `cat-${Date.now()}`;
              const nextCategory = {
                id: nextId,
                name: categoryName,
                kind: "expense" as const,
                group: "other" as CategoryGroup,
              };

              return {
                ...current,
                categories: [...current.categories, nextCategory],
                objects: current.objects.map((obj) =>
                  obj.id === objectId
                    ? { ...obj, categoryIds: [...obj.categoryIds, nextId] }
                    : obj,
                ),
              };
            },
            "添加分类失败。",
          );
        },
        removeCategoryFromObject: (objectId, categoryId) => {
          commitWorkspaceChange(
            (current) => {
              const otherCategory = current.categories.find((cat) => cat.id === "cat-other");

              return {
                ...current,
                objects: current.objects.map((obj) =>
                  obj.id === objectId
                    ? {
                        ...obj,
                        categoryIds: obj.categoryIds.filter((id) => id !== categoryId),
                      }
                    : obj,
                ),
                transactions: current.transactions.map((tx) =>
                  tx.allocations.some((a) => a.objectId === objectId) && tx.categoryId === categoryId
                    ? {
                        ...tx,
                        categoryId: otherCategory?.id ?? "cat-other",
                        categoryName: otherCategory?.name ?? tx.title,
                      }
                    : tx,
                ),
              };
            },
            "移除分类失败。",
          );
        },
        deleteObject: (objectId) => {
          commitWorkspaceChange(
            (current) => ({
              ...current,
              objects: current.objects.filter((obj) => obj.id !== objectId),
                transactions: current.transactions.filter(
                  (tx) => !tx.allocations.some((a) => a.objectId === objectId),
              ),
            }),
            "删除对象失败。",
          );
        },
        reorderObjects: (activeObjectId, targetObjectId) => {
          commitWorkspaceChange((current) => {
            const objects = [...current.objects];
            const activeIndex = objects.findIndex((o) => o.id === activeObjectId);
            const targetIndex = objects.findIndex((o) => o.id === targetObjectId);

            if (activeIndex === -1 || targetIndex === -1) return current;

            const [moved] = objects.splice(activeIndex, 1);
            objects.splice(targetIndex, 0, moved);

            return { ...current, objects };
          }, "排序失败。");
        },
        updatePreferences: (updates) => {
          commitWorkspaceChange(
            (current) => ({
              ...current,
              preferences: { ...current.preferences, ...updates },
            }),
            "更新偏好失败。",
          );
        },
        updateHistoryDisplaySettings: (updates) => {
          commitWorkspaceChange(
            (current) => ({
              ...current,
              advancedSettings: {
                ...current.advancedSettings,
                historyDisplay: {
                  ...current.advancedSettings.historyDisplay,
                  ...updates,
                },
              },
            }),
            "更新历史账设置失败。",
          );
        },
        addLongTermCategory: (input) => {
          commitWorkspaceChange(
            (current) => {
              const existingCategory = current.categories.find(
                (cat) =>
                  cat.kind === "expense" &&
                  cat.name.trim().toLowerCase() === input.name.trim().toLowerCase() &&
                  current.objects
                    .find((o) => o.id === input.objectId)
                    ?.categoryIds.includes(cat.id),
              );

              let categoryId: string;

              if (existingCategory) {
                categoryId = existingCategory.id;
              } else {
                categoryId = `cat-${Date.now()}`;
                const newCategory = {
                  id: categoryId,
                  name: input.name,
                  kind: "expense" as const,
                  group: "other" as const,
                };
                current = {
                  ...current,
                  categories: [...current.categories, newCategory],
                  objects: current.objects.map((obj) =>
                    obj.id === input.objectId
                      ? { ...obj, categoryIds: [...obj.categoryIds, categoryId] }
                      : obj,
                  ),
                };
              }

              const palette = [
                "#0f8a78", "#b7821e", "#3c6ca8", "#b24f7a",
                "#cf6c4a", "#5b8c5a", "#8b6f4e", "#6b5b95",
              ];
              const existingCount = current.advancedSettings.longTermCategories.length;
              const color = palette[existingCount % palette.length];

              return {
                ...current,
                advancedSettings: {
                  ...current.advancedSettings,
                  longTermCategories: [
                    ...current.advancedSettings.longTermCategories,
                    {
                      id: `ltc-${Date.now()}`,
                      objectId: input.objectId,
                      categoryId,
                      cycleDays: input.cycleDays,
                      color,
                    },
                  ],
                },
              };
            },
            "添加长期分类失败。",
          );
        },
        updateLongTermCategory: (settingId, updates) => {
          commitWorkspaceChange(
            (current) => ({
              ...current,
              advancedSettings: {
                ...current.advancedSettings,
                longTermCategories: current.advancedSettings.longTermCategories.map(
                  (setting) =>
                    setting.id === settingId
                      ? { ...setting, cycleDays: updates.cycleDays }
                      : setting,
                ),
              },
            }),
            "更新长期分类失败。",
          );
        },
        deleteLongTermCategory: (settingId) => {
          commitWorkspaceChange(
            (current) => ({
              ...current,
              advancedSettings: {
                ...current.advancedSettings,
                longTermCategories: current.advancedSettings.longTermCategories.filter(
                  (setting) => setting.id !== settingId,
                ),
              },
            }),
            "删除长期分类失败。",
          );
        },
        updateWorkspaceProfile: (updates) => {
          commitWorkspaceChange(
            (current) => ({
              ...current,
              workspaceName: updates.workspaceName,
              workspaceDescription: updates.workspaceDescription,
            }),
            "更新工作区失败。",
          );
        },
        refreshFromSqlite: async () => {
          /* desktop-only: refresh from SQLite */
        },
      }}
    >
      {children}
    </BillbookContext.Provider>
  );
}

/* ─── Helper functions ─── */

function toTeamMember(
  user: { id: string; email: string; name?: string },
  teamMembers: TeamMember[],
): TeamMember | null {
  return (
    teamMembers.find((member) => member.id === user.id) ?? {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email.split("@")[0],
      role: "owner" as UserRole,
      accent: "#17806d",
      lastActive: new Date().toISOString(),
    }
  );
}

function getPermissions(role: UserRole | undefined): PermissionSet {
  switch (role) {
    case "owner":
      return { canEdit: true, canManagePermissions: true, canExport: true };
    case "editor":
      return { canEdit: true, canManagePermissions: false, canExport: true };
    case "viewer":
      return { canEdit: false, canManagePermissions: false, canExport: false };
    default:
      return { canEdit: true, canManagePermissions: true, canExport: true };
  }
}

function createDesktopWorkspaceSyncPayload(
  state: BillbookState,
  currentUser: TeamMember | null,
) {
  return {
    workspaceUserName: currentUser?.name ?? null,
    syncedAt: new Date().toISOString(),
    state,
  };
}

function normalizeWorkspace(
  sqliteState: Partial<BillbookState>,
  _session: AuthSession | null,
  preferences: LocalWorkspacePreferences,
): BillbookState {
  return {
    workspaceName: sqliteState.workspaceName ?? "我的账本",
    workspaceDescription: sqliteState.workspaceDescription ?? "",
    objects: sqliteState.objects ?? [],
    accounts: sqliteState.accounts ?? [],
    categories: sqliteState.categories ?? [],
    transactions: sqliteState.transactions ?? [],
    recurringPlans: sqliteState.recurringPlans ?? [],
    teamMembers: sqliteState.teamMembers ?? [],
    history: sqliteState.history ?? [],
    advancedSettings: sqliteState.advancedSettings ?? {
      historyDisplay: { enabled: false, periodDays: 30 },
      longTermCategories: [],
    },
    preferences: {
      ...sqliteState.preferences,
      ...preferences,
    },
  };
}

/** Core mutation function — wraps any state change with error handling, persistence, and change logging. */
function useCommitWorkspaceChange(
  state: BillbookState,
  setState: (updater: BillbookState | ((prev: BillbookState) => BillbookState)) => void,
  setErrorMessage: (msg: string | null) => void,
  authSession: AuthSession | null,
  localPreferences: LocalWorkspacePreferences,
) {
  const commitWorkspaceChange = useCallback(
    (mutator: (current: BillbookState, user: TeamMember) => BillbookState, errorLabel: string) => {
      if (!authSession) {
        setErrorMessage("请先登录");
        return;
      }

      const user = toTeamMember(authSession.user, state.teamMembers);
      if (!user) {
        setErrorMessage("用户信息异常");
        return;
      }

      try {
        const nextState = mutator(state, user);
        setState(nextState);
        writeLocalLedger(authSession.user.id, nextState);
        writeLocalPreferences(authSession.user.id, {
          ...localPreferences,
        });
      } catch {
        setErrorMessage(`${errorLabel}`);
      }
    },
    [authSession, state, setState, setErrorMessage, localPreferences],
  );

  return commitWorkspaceChange;
}

function defaultWorkspaceState(): BillbookState {
  return {
    workspaceName: "我的账本",
    workspaceDescription: "个人记账工作区",
    objects: [],
    accounts: [
      { id: "acc-default", name: "现金", type: "cash", balance: 0 },
    ],
    categories: [
      { id: "cat-food", name: "餐饮", kind: "expense", group: "daily" },
      { id: "cat-grocery", name: "日用", kind: "expense", group: "daily" },
      { id: "cat-transport", name: "出行", kind: "expense", group: "transport" },
      { id: "cat-learning", name: "学习", kind: "expense", group: "growth" },
      { id: "cat-pet", name: "宠物", kind: "expense", group: "pet-care" },
      { id: "cat-gift", name: "礼物", kind: "expense", group: "family" },
      { id: "cat-home", name: "居家", kind: "expense", group: "housing" },
      { id: "cat-fuel", name: "加油", kind: "expense", group: "transport" },
      { id: "cat-parking", name: "停车", kind: "expense", group: "transport" },
      { id: "cat-other", name: "其它", kind: "expense", group: "daily" },
    ],
    transactions: [],
    recurringPlans: [],
    teamMembers: [],
    history: [],
    preferences: {
      theme: "fern",
      language: "zh-CN",
      currency: "CNY",
      storagePath: "",
    },
    advancedSettings: {
      historyDisplay: {
        enabled: false,
        periodDays: 30,
      },
      longTermCategories: [],
    },
  };
}

function mergeWorkspaceState(
  current: BillbookState,
  imported: Partial<BillbookState>,
): BillbookState {
  return {
    ...current,
    ...imported,
    categories: [
      ...current.categories,
      ...(imported.categories?.filter(
        (cat) => !current.categories.some((c) => c.id === cat.id),
      ) ?? []),
    ],
    preferences: { ...current.preferences, ...imported.preferences },
    advancedSettings: {
      ...current.advancedSettings,
      ...(imported.advancedSettings ?? {}),
      longTermCategories: [
        ...current.advancedSettings.longTermCategories,
        ...(imported.advancedSettings?.longTermCategories ?? []).filter(
          (ltc) =>
            !current.advancedSettings.longTermCategories.some(
              (existing) => existing.id === ltc.id,
            ),
        ),
      ],
    },
  };
}



function resolveTransactionSpreadDays(
  _current: BillbookState,
  categoryId: string,
  spreadDays: number | undefined,
): number | undefined {
  if (spreadDays && spreadDays > 1) {
    return spreadDays;
  }
  return undefined;
}

function scaleAllocationsToAmount(
  _current: BillbookState,
  allocations: Array<{ objectId: string; amount: number }>,
  targetAmount: number,
): Array<{ objectId: string; amount: number }> {
  const total = allocations.reduce((sum, a) => sum + a.amount, 0);
  if (total === 0) return allocations;
  const ratio = targetAmount / total;
  return allocations.map((a) => ({
    ...a,
    amount: Math.round(a.amount * ratio * 100) / 100,
  }));
}

function updateAmountDistribution(
  current: BillbookState,
  user: TeamMember,
  transaction: {
    id: string; categoryId: string; title: string; amount: number;
    date: string; note?: string; spreadDays?: number;
    kind: EntryKind; objectId?: string; accountId?: string;
    allocations?: ObjectAllocation[]; tags?: string[];
  },
): BillbookState {
  if (!transaction.objectId) return current;
  const updatedTransactions = current.transactions.map((tx) =>
    tx.id === transaction.id ? { ...tx, ...transaction } : tx,
  );
  return {
    ...current,
    transactions: updatedTransactions,
    history: [
      {
        id: "hist-" + Date.now(),
        actorId: user.id,
        action: "update_transaction" as HistoryAction,
        title: "更新交易" as string,
        detail: "updated transaction" as string,
        createdAt: new Date().toISOString(),
      },
      ...current.history,
    ].slice(0, 50),
  };
}

function normalizeObjectKind(kind: ObjectKind) {
  return kind;
}

function roundAmount(amount: number) {
  return Math.round(amount * 100) / 100;
}

function applyTheme(theme: BillbookState["preferences"]["theme"]) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const themeTokens = {
    fern: {
      background: "#f6f3ec",
      bgStart: "#faf8f4",
      bgEnd: "#f3f0e9",
      foreground: "#13231c",
      muted: "#66736c",
      surface: "rgba(255, 253, 249, 0.78)",
      surfaceStrong: "rgba(255, 253, 249, 0.94)",
      surfaceSoft: "rgba(255, 253, 249, 0.7)",
      surfaceSolid: "rgba(255, 253, 249, 0.98)",
      line: "rgba(19, 35, 28, 0.1)",
      accent: "#17806d",
      accentSoft: "rgba(23, 128, 109, 0.14)",
      glowA: "rgba(23, 128, 109, 0.12)",
      glowB: "rgba(221, 133, 86, 0.14)",
      shadow: "0px 4px 18px rgba(0,0,0,0.036), 0px 2px 8px rgba(0,0,0,0.024), 0px 0.8px 3px rgba(0,0,0,0.016)",
      shellShadow: "0px 14px 52px rgba(0,0,0,0.04), 0px 7px 28px rgba(0,0,0,0.028), 0px 3px 15px rgba(0,0,0,0.02), 0px 1px 7px rgba(0,0,0,0.014)",
      heroGlow: "rgba(23, 128, 109, 0.12)",
      warmGlow: "rgba(196, 137, 87, 0.12)",
      warning: "#b55f35",
      warningSoft: "rgba(181, 95, 53, 0.12)",
    },
    ember: {
      background: "#f7efe6",
      bgStart: "#fbf4ed",
      bgEnd: "#f2e8dc",
      foreground: "#2d1d18",
      muted: "#7c6a63",
      surface: "rgba(255, 250, 246, 0.8)",
      surfaceStrong: "rgba(255, 250, 246, 0.95)",
      surfaceSoft: "rgba(255, 250, 246, 0.72)",
      surfaceSolid: "rgba(255, 250, 246, 0.99)",
      line: "rgba(45, 29, 24, 0.1)",
      accent: "#cf6c4a",
      accentSoft: "rgba(207, 108, 74, 0.16)",
      glowA: "rgba(207, 108, 74, 0.14)",
      glowB: "rgba(199, 152, 70, 0.16)",
      shadow: "0px 4px 18px rgba(0,0,0,0.036), 0px 2px 8px rgba(0,0,0,0.024), 0px 0.8px 3px rgba(0,0,0,0.016)",
      shellShadow: "0px 14px 52px rgba(0,0,0,0.04), 0px 7px 28px rgba(0,0,0,0.028), 0px 3px 15px rgba(0,0,0,0.02), 0px 1px 7px rgba(0,0,0,0.014)",
      heroGlow: "rgba(207, 108, 74, 0.14)",
      warmGlow: "rgba(199, 152, 70, 0.16)",
      warning: "#b55f35",
      warningSoft: "rgba(181, 95, 53, 0.12)",
    },
    ocean: {
      background: "#eef4f8",
      bgStart: "#f4f8fb",
      bgEnd: "#e8eff5",
      foreground: "#102534",
      muted: "#617789",
      surface: "rgba(252, 254, 255, 0.78)",
      surfaceStrong: "rgba(252, 254, 255, 0.94)",
      surfaceSoft: "rgba(252, 254, 255, 0.68)",
      surfaceSolid: "rgba(252, 254, 255, 0.98)",
      line: "rgba(16, 37, 52, 0.1)",
      accent: "#3c6ca8",
      accentSoft: "rgba(60, 108, 168, 0.14)",
      glowA: "rgba(60, 108, 168, 0.14)",
      glowB: "rgba(73, 168, 180, 0.16)",
      shadow: "0px 4px 18px rgba(0,0,0,0.036), 0px 2px 8px rgba(0,0,0,0.024), 0px 0.8px 3px rgba(0,0,0,0.016)",
      shellShadow: "0px 14px 52px rgba(0,0,0,0.04), 0px 7px 28px rgba(0,0,0,0.028), 0px 3px 15px rgba(0,0,0,0.02), 0px 1px 7px rgba(0,0,0,0.014)",
      heroGlow: "rgba(60, 108, 168, 0.14)",
      warmGlow: "rgba(73, 168, 180, 0.16)",
      warning: "#b55f35",
      warningSoft: "rgba(181, 95, 53, 0.12)",
    },
    berry: {
      background: "#f7edf1",
      bgStart: "#fcf5f7",
      bgEnd: "#f0e2e8",
      foreground: "#351b27",
      muted: "#7f6571",
      surface: "rgba(255, 250, 252, 0.8)",
      surfaceStrong: "rgba(255, 250, 252, 0.95)",
      surfaceSoft: "rgba(255, 250, 252, 0.72)",
      surfaceSolid: "rgba(255, 250, 252, 0.99)",
      line: "rgba(53, 27, 39, 0.1)",
      accent: "#b24f7a",
      accentSoft: "rgba(178, 79, 122, 0.16)",
      glowA: "rgba(178, 79, 122, 0.14)",
      glowB: "rgba(215, 141, 171, 0.16)",
      shadow: "0px 4px 18px rgba(0,0,0,0.036), 0px 2px 8px rgba(0,0,0,0.024), 0px 0.8px 3px rgba(0,0,0,0.016)",
      shellShadow: "0px 14px 52px rgba(0,0,0,0.04), 0px 7px 28px rgba(0,0,0,0.028), 0px 3px 15px rgba(0,0,0,0.02), 0px 1px 7px rgba(0,0,0,0.014)",
      heroGlow: "rgba(178, 79, 122, 0.14)",
      warmGlow: "rgba(215, 141, 171, 0.16)",
      warning: "#b55f35",
      warningSoft: "rgba(181, 95, 53, 0.12)",
    },
  }[theme];

  root.style.setProperty("--background", themeTokens.background);
  root.style.setProperty("--bg-start", themeTokens.bgStart);
  root.style.setProperty("--bg-end", themeTokens.bgEnd);
  root.style.setProperty("--foreground", themeTokens.foreground);
  root.style.setProperty("--muted", themeTokens.muted);
  root.style.setProperty("--surface", themeTokens.surface);
  root.style.setProperty("--surface-strong", themeTokens.surfaceStrong);
  root.style.setProperty("--surface-soft", themeTokens.surfaceSoft);
  root.style.setProperty("--surface-solid", themeTokens.surfaceSolid);
  root.style.setProperty("--line", themeTokens.line);
  root.style.setProperty("--accent", themeTokens.accent);
  root.style.setProperty("--accent-soft", themeTokens.accentSoft);
  root.style.setProperty("--glow-a", themeTokens.glowA);
  root.style.setProperty("--glow-b", themeTokens.glowB);
  root.style.setProperty("--shadow", themeTokens.shadow);
  root.style.setProperty("--shell-shadow", themeTokens.shellShadow);
  root.style.setProperty("--hero-glow", themeTokens.heroGlow);
  root.style.setProperty("--warm-glow", themeTokens.warmGlow);
  root.style.setProperty("--warning", themeTokens.warning);
  root.style.setProperty("--warning-soft", themeTokens.warningSoft);
}

function getDefaultCategoryIdsForKind(
  categoryIds: string[],
  kind: ObjectKind,
  requiredCategoryIds: string[] = [],
) {
  const preferredCategoryIdsByKind: Record<ObjectKind, string[]> = {
    self: ["cat-food", "cat-grocery", "cat-transport", "cat-learning"],
    partner: ["cat-food", "cat-gift", "cat-grocery"],
    pet: ["cat-food", "cat-pet", "cat-grocery"],
    vehicle: ["cat-fuel", "cat-parking", "cat-transport"],
    home: ["cat-home", "cat-grocery"],
    project: ["cat-learning", "cat-grocery"],
    family: ["cat-food", "cat-gift", "cat-grocery"],
    other: ["cat-food", "cat-grocery", "cat-transport"],
  };

  const matchedCategoryIds = preferredCategoryIdsByKind[kind].filter((categoryId) =>
    categoryIds.includes(categoryId),
  );

  if (matchedCategoryIds.length === 0) {
    return categoryIds.slice(0, 2);
  }

  const required = requiredCategoryIds.filter((id) => categoryIds.includes(id));
  const needsMore = required.length > 0 ? matchedCategoryIds.some((id) => required.includes(id)) : true;

  if (!needsMore) {
    return matchedCategoryIds.slice(0, 2);
  }

  return [...required, ...matchedCategoryIds.filter((id) => !required.includes(id))].slice(0, 4);
}

export function useBillbook() {
  const ctx = useContext(BillbookContext);
  if (!ctx) throw new Error("useBillbook must be used within BillbookProvider");
  return ctx;
}
