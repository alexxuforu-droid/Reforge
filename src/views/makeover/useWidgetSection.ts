// widget engine + board — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLazyLoad, useVisibleOnce } from "../../lib/useLoad";
import type { WidgetConfig, WidgetsSettings } from "../../lib/types";

export function useWidgetSection(loadEngine: () => void) {
  // ---- Widgets ----
  const { data: widgets, error: widgetsError, refresh: refreshWidgets, load: loadWidgets } = useLazyLoad<WidgetConfig[]>("list_widgets");
  const { data: widgetsSettings, refresh: refreshWidgetsSettings, load: loadWidgetsSettings } = useLazyLoad<WidgetsSettings>("get_widgets_settings");
  const widgetsRef = useVisibleOnce(() => { loadWidgets(); loadWidgetsSettings(); });
  // S9.6 — the board preview needs the engine scene + widget list; loading
  // them again here is idempotent (same commands the sections above fire).
  const boardRef = useVisibleOnce(() => { loadEngine(); loadWidgets(); });
  const createWidget = async (kind: string) => {
    try { await call<WidgetConfig>("create_widget", { kind }); toast(`${kind} widget added`); refreshWidgets(); }
    catch (err) { toast(errorCopy(err), "err"); }
  };

  const resetWidgetLayout = async () => {
    try {
      const msg = await call<string>("reset_widget_layout");
      toast(msg);
      refreshWidgets();
    } catch (err) {
      toast(errorCopy(err), "err");
    }
  };

  const toggleWidget = async (w: WidgetConfig, visible: boolean) => {
    try { await call("set_widget_visible", { id: w.id, visible }); refreshWidgets(); }
    catch (err) { toast(errorCopy(err), "err"); }
  };

  const saveWidgetsSettings = async (next: Partial<WidgetsSettings>) => {
    try {
      const saved = await call<WidgetsSettings>("set_widgets_settings", {
        settings: { ...(widgetsSettings ?? { autohide_fullscreen: true }), ...next },
      });
      refreshWidgetsSettings();
      toast(saved.autohide_fullscreen ? "Widgets auto-hide during fullscreen apps" : "Widgets stay visible over fullscreen apps");
    } catch (err) { toast(errorCopy(err), "err"); }
  };

  const removeWidget = async (w: WidgetConfig) => {
    try { await call("remove_widget", { id: w.id }); refreshWidgets(); }
    catch (err) { toast(errorCopy(err), "err"); }
  };
  return { widgets, widgetsError, refreshWidgets, widgetsSettings, refreshWidgetsSettings, widgetsRef, boardRef, createWidget, resetWidgetLayout, toggleWidget, saveWidgetsSettings, removeWidget };
}
