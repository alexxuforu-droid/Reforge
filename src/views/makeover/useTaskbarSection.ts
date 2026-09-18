// taskbar redesigner — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLazyLoad, useVisibleOnce } from "../../lib/useLoad";
import type { PendingShellState, TaskbarCapabilities, TaskbarState } from "../../lib/types";

export function useTaskbarSection() {
  // ---- Taskbar ----
  const { data: taskbar, error: taskbarError, refresh: refreshTaskbarState, load: loadTaskbar } = useLazyLoad<TaskbarState>("shell_get_taskbar_state");
  const { data: pendingShell, error: pendingError, refresh: refreshPendingShell, load: loadPendingShell } = useLazyLoad<PendingShellState>("shell_get_pending_state");
  // P1-12 — which taskbar tweaks this OS build supports + the authoritative note.
  const { data: taskbarCaps, error: taskbarCapsError, load: loadTaskbarCaps } = useLazyLoad<TaskbarCapabilities>("shell_get_taskbar_capabilities");
  const taskbarRef = useVisibleOnce(() => { loadTaskbar(); loadPendingShell(); loadTaskbarCaps(); });
  const refreshTaskbar = () => {
    refreshTaskbarState();
    refreshPendingShell();
  };
  const setTaskbarSize = (size: string) =>
    call<TaskbarState>("shell_set_taskbar_size", { size }).then(() => { toast(`Taskbar size → ${size}`); refreshTaskbarState(); }).catch((e) => toast(errorCopy(e), "err"));
  const setTaskbarAlign = (align: string) =>
    call<TaskbarState>("shell_set_taskbar_alignment", { align }).then(() => { toast(`Taskbar alignment → ${align}`); refreshTaskbarState(); }).catch((e) => toast(errorCopy(e), "err"));
  const setTaskbarAutohide = (on: boolean) =>
    call<TaskbarState>("shell_set_taskbar_autohide", { on }).then(() => { toast(on ? "Taskbar auto-hides" : "Taskbar always visible"); refreshTaskbarState(); }).catch((e) => toast(errorCopy(e), "err"));
  const setTaskbarColorMatch = (on: boolean) =>
    call<TaskbarState>("shell_set_taskbar_color_match", { on }).then(() => { toast(on ? "Taskbar matches accent" : "Taskbar color match off"); refreshTaskbarState(); }).catch((e) => toast(errorCopy(e), "err"));
  const setTaskbarPosition = (side: string) =>
    call<string>("shell_set_taskbar_position", { side }).then((m) => { toast(m); refreshTaskbar(); }).catch((e) => toast(errorCopy(e), "err"));
  const applyPendingRestart = () =>
    call<string>("shell_apply_pending_restart").then((m) => { toast(m); refreshTaskbar(); }).catch((e) => toast(errorCopy(e), "err"));
  const revertPending = () =>
    call<string>("shell_revert_pending").then((m) => { toast(m); refreshTaskbar(); }).catch((e) => toast(errorCopy(e), "err"));
  return { taskbar, taskbarError, pendingShell, pendingError, taskbarCaps, taskbarCapsError, taskbarRef, refreshTaskbar, setTaskbarSize, setTaskbarAlign, setTaskbarAutohide, setTaskbarColorMatch, setTaskbarPosition, applyPendingRestart, revertPending };
}
