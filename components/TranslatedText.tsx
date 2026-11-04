"use client";

import { ReactNode, useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";
import { detectContentLang } from "@/lib/lang-detect";
import { cachedTranslation, clearFailedTranslation, requestTranslations } from "@/lib/translate-client";
import { computeGroupStatus } from "@/lib/translate-state";
import RichContent from "./RichContent";

// X.com-style content translation: content renders in the reader's language
// (machine-translated) with ONE prominent "show original" toggle per card.
// Author names, model names and other identity fields are never passed here.

// The server caps one item at 8000 chars; longer content would translate to a
// truncated block, so it stays in its original language instead.
const MAX_TRANSLATABLE_CHARS = 8000;

export type FieldState = {
  display: string;
  lang: string | undefined;
};

export type GroupTranslationState = {
  field: (index: number) => FieldState;
  showToggle: boolean;
  loading: boolean;
  showingTranslated: boolean;
  toggle: () => void;
};

export function useContentTranslations(texts: string[]): GroupTranslationState {
  const { locale } = useI18n();
  const target = locale === "zh" ? "zh" : "en";
  const joinedKey = target + "|" + texts.join("\u0000");
  const sourceLangs = texts.map((t) => detectContentLang(t));
  const translatable = texts.map(
    (t, i) =>
      sourceLangs[i] !== null && sourceLangs[i] !== target && t.length <= MAX_TRANSLATABLE_CHARS,
  );
  const hasTranslatable = translatable.some(Boolean);

  // Cache is read during render (pure read) so cached content renders with zero
  // delay. Fetched results are keyed to their text set so a content change
  // falls back to the fresh cache read instead of stale state.
  const cachedValues = texts.map((t, i) =>
    hasTranslatable && translatable[i] ? cachedTranslation(t, target) : undefined,
  );
  const [fetched, setFetched] = useState<{ key: string; values: (string | null)[] } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const freshFetch =
    fetched && fetched.key === joinedKey ? fetched.values : null;
  const resolved = texts.map((t, i) => {
    if (!translatable[i]) return undefined;
    const fromFetch = freshFetch ? freshFetch[i] : undefined;
    if (fromFetch !== undefined) return fromFetch;
    return cachedValues[i];
  });

  // Pure helper (unit-tested): native/empty fields are undefined by design and
  // must never keep the card in a disabled Translating… state.
  const status = computeGroupStatus(translatable, resolved, showOriginal);
  const { loading, anyFailed, showingTranslated, needFetch } = status;
  useEffect(() => {
    if (!needFetch) return;
    let cancelled = false;
    const pendingTexts = texts.filter((_, i) => translatable[i]);
    void requestTranslations(pendingTexts, target).then(() => {
      if (!cancelled) {
        // async after the batch flush — safe to setState here
        const values = texts.map((t, i) =>
          translatable[i] ? (cachedTranslation(t, target) ?? null) : null,
        );
        setFetched({ key: joinedKey, values });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needFetch, joinedKey, target]);

  return {
    field: (index: number) => {
      const value = resolved[index];
      const display =
        typeof value === "string" && !showOriginal ? value : texts[index] ?? "";
      const lang =
        typeof value === "string" && !showOriginal
          ? target
          : sourceLangs[index] || undefined;
      return { display, lang };
    },
    showToggle: hasTranslatable,
    loading,
    showingTranslated,
    toggle: () => {
      if (hasTranslatable && anyFailed && !loading && !showingTranslated) {
        // all attempts failed — retry the provider on click instead of a dead toggle
        texts.forEach((t, i) => {
          if (translatable[i]) clearFailedTranslation(t, target);
        });
        setFetched(null);
        return;
      }
      setShowOriginal((v) => !v);
    },
  };
}

export function ToggleButton({
  state,
  compact,
}: {
  state: GroupTranslationState;
  compact?: boolean;
}) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  let label: string;
  if (state.loading) label = zh ? "翻译中…" : "Translating…";
  else if (state.showingTranslated) label = zh ? "显示原文" : "Show original";
  else label = zh ? "显示翻译" : "View translation";
  return (
    <span className="tr-row">
      <button
        type="button"
        className={compact ? "tr-toggle tr-toggle-compact" : "tr-toggle"}
        onClick={state.toggle}
        disabled={state.loading}
        aria-pressed={state.showingTranslated}
      >
        {label}
      </button>
    </span>
  );
}

/**
 * One toggle per card, rendered as its own row above the card content.
 * `children` receives `t(index)` for the display text of each field and
 * `lang(index)` for the lang attribute of the element showing it.
 */
export function TranslatedGroup({
  texts,
  children,
  compact,
}: {
  texts: string[];
  children: (helpers: { t: (i: number) => string; lang: (i: number) => string | undefined }) => ReactNode;
  compact?: boolean;
}) {
  const state = useContentTranslations(texts);
  return (
    <>
      {state.showToggle && !compact && <ToggleButton state={state} />}
      {children({
        t: (i) => state.field(i).display,
        lang: (i) => state.field(i).lang,
      })}
      {state.showToggle && compact && <ToggleButton state={state} compact />}
    </>
  );
}

export default function TranslatedText({
  text,
  as = "span",
  className,
  style,
  compact,
}: {
  text: string;
  as?: "span" | "div" | "p";
  className?: string;
  style?: React.CSSProperties;
  compact?: boolean;
}) {
  const state = useContentTranslations([text]);
  const Tag = as;
  const field = state.field(0);
  return (
    <>
      {state.showToggle && !compact && <ToggleButton state={state} />}
      <Tag className={className} style={style} lang={field.lang}>
        {field.display}
      </Tag>
      {state.showToggle && compact && <ToggleButton state={state} compact />}
    </>
  );
}

// Markdown-aware variant (work bodies, soul text): same hook, renders through
// RichContent so protected images/links/tags survive the translation round-trip.
export function TranslatedRich({
  content,
  className,
  style,
}: {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const state = useContentTranslations([content]);
  const field = state.field(0);
  return (
    <div className={className}>
      {state.showToggle && <ToggleButton state={state} />}
      <div lang={field.lang}>
        <RichContent content={field.display} style={style} />
      </div>
    </div>
  );
}

// Title + markdown body under ONE toggle. Usable from server components:
// plain serializable props only, no function children.
export function TranslatedArticle({
  title,
  body,
  titleStyle,
  bodyStyle,
  titleLang,
}: {
  title: string;
  body?: string;
  titleStyle?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  titleLang?: string;
}) {
  const state = useContentTranslations([title, body ?? ""]);
  const titleField = state.field(0);
  const bodyField = state.field(1);
  return (
    <>
      {state.showToggle && <ToggleButton state={state} />}
      <h1 lang={titleField.lang || titleLang} style={titleStyle}>
        {titleField.display}
      </h1>
      {body ? (
        <div lang={bodyField.lang} style={bodyStyle}>
          <RichContent content={bodyField.display} />
        </div>
      ) : null}
    </>
  );
}
