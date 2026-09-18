// style quiz, studio grid, favorites, import, analytics — extracted from views/Makeover.tsx (V2 pillar 2b, zero behavior change).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { call, errorCopy, swallow } from "../../lib/api";
import { toast } from "../../components/ui";
import { applyStyleDef } from "../../lib/styleApply";
import { useLoad } from "../../lib/useLoad";
import { decodeStyleCode, shareCodeError } from "../../lib/shareCodes";
import { getStyleAnalytics, recordStyleApplied, type StyleAnalytics } from "../../lib/styleAnalytics";
import { ALL_STYLES, QUIZ, EMPTY_ANSWERS, mergeAnswers, rankStyles, buildMyStyle } from "../../styles";
import type { StyleDef, QuizAnswers } from "../../styles/types";

export function useStyleStudio(refresh: () => void) {
  // ---- Style Quiz v3 ----
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(EMPTY_ANSWERS);
  const [quizDone, setQuizDone] = useState(false);

  // ---- Style Studio ----
  const [detailStyle, setDetailStyle] = useState<StyleDef | null>(null);
  const [animOn, setAnimOn] = useState(false);
  useEffect(() => { setAnimOn(false); }, [detailStyle?.id]);
  // C3 — animated gallery previews: only the hovered card mounts a scene
  // canvas, so nothing animates (or decodes) until the pointer is on it.
  const [hoverStyle, setHoverStyle] = useState<string | null>(null);
  const { data: appliedStyleId, error: appliedStyleError, refresh: refreshAppliedStyle } = useLoad<string>("get_applied_style");
  const [applyingStyle, setApplyingStyle] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [styleQuery, setStyleQuery] = useState("");
  const [styleCat, setStyleCat] = useState("All");
  const [styleTier, setStyleTier] = useState<"all" | StyleDef["tier"]>("all");
  const [styleAxis, setStyleAxis] = useState<"all" | NonNullable<StyleDef["axis"]>>("all");
  const [styleCollection, setStyleCollection] = useState("All");
  // S6.5 — share codes: import row + detail-modal copy.
  const [importOpen, setImportOpen] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  // S6.7 — local apply analytics (most-used strip + insight).
  const [analytics, setAnalytics] = useState<StyleAnalytics>(() => getStyleAnalytics());
  // Favorites: localStorage is only the fast first-paint mirror; the backend
  // file (data_dir/favorites.json) is the durable source of truth (A2.1).
  // The load has a real error state (the mirror still works if it fails) and
  // the backend-sync write is a dev-loud shim (the mirror stays consistent).
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("reforge.style-favs") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  // Favorites load keeps the local mirror as its fallback; failure is surfaced
  // via an InlineAlert next to the favorites button instead of a silent blank.
  const refreshFavorites = useCallback(() => {
    call<string[]>("get_favorites")
      .then((ids) => { setFavorites(ids); setFavoritesError(null); })
      .catch((e) => setFavoritesError(errorCopy(e)));
  }, []);
  const pickQuiz = (optIdx: number) => {
    const next = mergeAnswers(answers, QUIZ[quizStep], optIdx);
    setAnswers(next);
    if (quizStep + 1 < QUIZ.length) setQuizStep(quizStep + 1);
    else setQuizDone(true);
  };

  const resetQuiz = () => { setQuizStep(0); setAnswers(EMPTY_ANSWERS); setQuizDone(false); };
  const quizResults = quizDone ? rankStyles(ALL_STYLES, answers).slice(0, 3) : [];
  const myStyle = quizDone ? buildMyStyle(answers) : null;

  const favBusy = useRef<string | null>(null);
  const toggleFav = (id: string) => {
    // Ignore re-entry until the backend answers — a double-click must not
    // issue two identical toggles from the same stale state.
    if (favBusy.current === id) return;
    favBusy.current = id;
    const nowFav = !favorites.includes(id);
    setFavorites((f) => {
      const next = nowFav ? [...f, id] : f.filter((x) => x !== id);
      try { localStorage.setItem("reforge.style-favs", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    // Durable copy — overwrites from the backend on success (preview: same result).
    call<string[]>("set_favorite", { id, fav: nowFav })
      .then((ids) => setFavorites(ids))
      .catch((e) => swallow("set_favorite mirror", e)) /* mirror stays consistent */
      .finally(() => { favBusy.current = null; });
  };

  /** Composed studio filters (A2.3): favorites × category × tier × axis × collection × search. */
  const styleFiltered = useMemo(() => {
    const q = styleQuery.trim().toLowerCase();
    return ALL_STYLES.filter((s) => {
      if (favOnly && !favorites.includes(s.id)) return false;
      if (styleCat !== "All" && s.category !== styleCat) return false;
      if (styleTier !== "all" && s.tier !== styleTier) return false;
      if (styleAxis !== "all" && s.axis !== styleAxis) return false;
      if (styleCollection !== "All" && s.collection !== styleCollection) return false;
      if (q) {
        const hay = `${s.name} ${s.tagline} ${s.tags.join(" ")} ${s.category} ${s.wallpaperName ?? ""} ${s.axis ?? ""} ${s.collection ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [favOnly, styleQuery, styleCat, styleTier, styleAxis, styleCollection, favorites]);

  /** Atomic apply: one mock command, one undo entry, fully revertible. */
  const applyStyle = async (s: StyleDef, opts?: { animated?: boolean }) => {
    if (applyingStyle) return;
    setApplyingStyle(s.id);
    try {
      // Deeper components (A1.6): font, sound scheme, RGB intent — applied
      // atomically by the backend with a single composite undo entry.
      const res = await applyStyleDef(s, opts);
      refreshAppliedStyle();
      refresh();
      setDetailStyle(null);
      setQuizOpen(false);
      // S6.7 — record the apply in the local history (never leaves this PC).
      recordStyleApplied(s);
      setAnalytics(getStyleAnalytics());
      toast(`Applied “${s.name}” — revert anytime from History`);
      if (res.notes?.length) toast(res.notes.join(" · "), "info");
    } catch (e) {
      toast(errorCopy(e), "err");
    } finally {
      setApplyingStyle(null);
    }
  };

  /** S6.5 — decode a share code into a personal style and open its detail. */
  const importSharedStyle = () => {
    const err = shareCodeError(importCode);
    if (err) {
      setImportError(err);
      return;
    }
    const s = decodeStyleCode(importCode)!;
    setImportError(null);
    setImportCode("");
    setImportOpen(false);
    setDetailStyle(s);
    toast(`Imported “${s.name}” — it's yours to apply`);
  };
  return { quizOpen, setQuizOpen, quizStep, answers, quizDone, detailStyle, setDetailStyle, animOn, setAnimOn, hoverStyle, setHoverStyle, appliedStyleId, appliedStyleError, refreshAppliedStyle, applyingStyle, favOnly, setFavOnly, styleQuery, setStyleQuery, styleCat, setStyleCat, styleTier, setStyleTier, styleAxis, setStyleAxis, styleCollection, setStyleCollection, importOpen, setImportOpen, importCode, setImportCode, importError, setImportError, analytics, favorites, favoritesError, refreshFavorites, pickQuiz, resetQuiz, quizResults, myStyle, toggleFav, styleFiltered, applyStyle, importSharedStyle };
}
