// lock screen designer — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useState } from "react";
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLazyLoad, useVisibleOnce } from "../../lib/useLoad";
import type { LockScreenState } from "../../lib/types";

export function useLockScreenSection() {
  // ---- Lock Screen ----
  const { data: lockScreen, error: lockScreenError, refresh: refreshLockScreenState, load: loadLockScreen } = useLazyLoad<LockScreenState>("get_lock_screen_state");
  const lockRef = useVisibleOnce(() => { loadLockScreen(); });
  const [lsImagePath, setLsImagePath] = useState("");
  const [lsFolder, setLsFolder] = useState("");
  const [lsInterval, setLsInterval] = useState(30);
  const refreshLockScreen = () => {
    refreshLockScreenState();
  };
  const setLsImage = () => {
    if (!lsImagePath.trim()) return;
    call<LockScreenState>("set_lock_screen_image", { source: lsImagePath }).then(() => { toast("Lock screen image set"); refreshLockScreenState(); }).catch((e) => toast(errorCopy(e), "err"));
  };
  // P2-5 — the webview CSP blocks file:// images; the backend returns a data URL.
  const [lsPreview, setLsPreview] = useState<string | null>(null);
  const previewLockScreen = () => {
    if (!lsImagePath.trim()) return;
    call<string>("read_image_data_url", { path: lsImagePath })
      .then((url) => setLsPreview(url))
      .catch((e) => toast(errorCopy(e), "err"));
  };
  const setLsSlideshow = () => {
    if (!lsFolder.trim()) return;
    call<LockScreenState>("set_lock_screen_slideshow", { folder: lsFolder, interval_minutes: lsInterval, shuffle: true }).then(() => { toast("Lock screen slideshow set"); refreshLockScreenState(); }).catch((e) => toast(errorCopy(e), "err"));
  };
  const setLsSpotlight = () =>
    call<LockScreenState>("set_lock_screen_spotlight", {}).then(() => { toast("Spotlight enabled"); refreshLockScreenState(); }).catch((e) => toast(errorCopy(e), "err"));
  const setLsHideApps = (hide: boolean) =>
    call<LockScreenState>("set_lock_screen_hide_apps", { hide }).then(() => { toast(`Detailed status ${hide ? "hidden" : "shown"}`); refreshLockScreenState(); }).catch((e) => toast(errorCopy(e), "err"));
  return { lockScreen, lockScreenError, lockRef, lsImagePath, setLsImagePath, lsFolder, setLsFolder, lsInterval, setLsInterval, lsPreview, refreshLockScreen, setLsImage, previewLockScreen, setLsSlideshow, setLsSpotlight, setLsHideApps };
}
