// sound scheme editor — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useState } from "react";
import { call, errorCopy } from "../../lib/api";
import { toast } from "../../components/ui";
import { useLazyLoad, useVisibleOnce } from "../../lib/useLoad";
import type { SoundEventInfo, SoundSchemeInfo } from "../../lib/types";

export function useSoundsSection() {
  // ---- Sounds ----
  const { data: schemes, error: schemesError, refresh: refreshSchemes, load: loadSchemes } = useLazyLoad<SoundSchemeInfo[]>("list_sound_schemes");
  const { data: soundEvents, error: soundEventsError, refresh: refreshSoundEvents, load: loadSoundEvents } = useLazyLoad<SoundEventInfo[]>("list_sound_events");
  const soundsRef = useVisibleOnce(() => { loadSchemes(); loadSoundEvents(); });
  const [schemeName, setSchemeName] = useState("");
  const refreshSounds = () => {
    refreshSchemes();
    refreshSoundEvents();
  };
  const applyScheme = (guid: string) =>
    call<string>("apply_sound_scheme", { guid }).then((m) => { toast(m); refreshSounds(); }).catch((e) => toast(errorCopy(e), "err"));
  const saveScheme = () => {
    if (!schemeName.trim()) return;
    call<string>("save_current_scheme", { name: schemeName.trim() }).then((m) => { toast(m); setSchemeName(""); refreshSounds(); }).catch((e) => toast(errorCopy(e), "err"));
  };
  const setEventSound = (evt: string, path: string) =>
    call("set_sound_event", { event: evt, path }).then(() => refreshSounds()).catch((e) => toast(errorCopy(e), "err"));
  const previewSound = (path: string) =>
    call("preview_sound", { path }).then((m) => toast(m as string)).catch((e) => toast(errorCopy(e), "err"));
  return { schemes, schemesError, soundEvents, soundEventsError, soundsRef, schemeName, setSchemeName, refreshSounds, applyScheme, saveScheme, setEventSound, previewSound };
}
