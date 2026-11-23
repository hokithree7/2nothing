"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "./AuthProvider";
import { useI18n } from "./I18nProvider";
import SignInCard from "./SignInCard";
import { getFreshAccessToken } from "@/lib/auth-client";
import { PRESET_AVATARS } from "@/lib/preset-avatars";

const DRAFT_KEY = "2nothing:42:question-draft:v1";

// A short synthesized key "clack" for the send key: a filtered noise tick for
// the switch plus a low thump for the keycap bottoming out. Created lazily on
// the first press (a user gesture), quiet, and silently skipped if Web Audio
// is unavailable.
let keyAudio: AudioContext | null = null;
function playKeyClack(accepted: boolean) {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    keyAudio ??= new AC();
    const ctx = keyAudio;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.028);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const tick = ctx.createBufferSource();
    tick.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = accepted ? 2600 : 1400;
    band.Q.value = 0.8;
    const tickGain = ctx.createGain();
    tickGain.gain.value = accepted ? 0.2 : 0.1;
    tick.connect(band).connect(tickGain).connect(ctx.destination);
    tick.start(t);
    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(accepted ? 160 : 110, t);
    thump.frequency.exponentialRampToValueAtTime(55, t + 0.07);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(accepted ? 0.16 : 0.08, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    thump.connect(thumpGain).connect(ctx.destination);
    thump.start(t);
    thump.stop(t + 0.1);
  } catch {
    /* audio is decoration only */
  }
}

// The daily quota resets at 00:00 UTC; show that moment in the reader's own
// clock (e.g. 08:00 in Asia/Shanghai). Client-only: the hint renders after
// the terminal is expanded, so there is no SSR/hydration mismatch.
function quotaResetLocal(zh: boolean): string {
  const now = new Date();
  const reset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return reset.toLocaleTimeString(zh ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
type Draft = { title: string; content: string; key: string };
const newKey = () => crypto.randomUUID();

export function FortyTwoMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={`q42-mark ${small ? "q42-mark-small" : ""}`}
      viewBox="0 0 260 180"
      role="img"
      aria-label="42"
    >
      <text
        x="18"
        y="139"
        fontFamily="Arial, sans-serif"
        fontSize="154"
        fontWeight="900"
        letterSpacing="-14"
        fill="currentColor"
      >
        42
      </text>
      <ellipse
        cx="135"
        cy="104"
        rx="124"
        ry="24"
        transform="rotate(-20 135 104)"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="245" cy="63" r="5" fill="currentColor" />
    </svg>
  );
}

export default function FortyTwoTerminal({
  zoom = false,
}: {
  /** Close-up variant: CRT screen only, no machine shell (used on /questions). */
  zoom?: boolean;
}) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const { user } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({
    title: "",
    content: "",
    key: "",
  });
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [login, setLogin] = useState(false);
  // Inline "pick a display name" panel: opens when the ask API answers 403
  // (logged-in human without a display name). Saving retries the publish with
  // the intact draft and the SAME idempotency key — no trip to the console.
  const [namePanel, setNamePanel] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("");
  const [savingName, setSavingName] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const [composing, setComposing] = useState(false);
  // Brief "keystroke" flag that makes the power LED flicker while typing.
  const [typing, setTyping] = useState(false);
  // Send-key feedback: "release" = spring back after a pointer press,
  // "strike" = full down-up for keyboard sends, "deny" = key bottoms out but
  // nothing is sent (too short), with a shake and an amber hint.
  const [keyFx, setKeyFx] = useState<"" | "release" | "strike" | "deny">("");
  const keyFxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const terminal = useRef<HTMLDivElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        const stored = raw ? JSON.parse(raw) : null;
        if (
          stored &&
          typeof stored.title === "string" &&
          typeof stored.content === "string"
        ) {
          setDraft({
            title: stored.title.slice(0, 200),
            content: stored.content.slice(0, 2000),
            key: typeof stored.key === "string" ? stored.key : newKey(),
          });
          setSaved(Boolean(stored.title || stored.content));
        } else setDraft({ title: "", content: "", key: newKey() });
      } catch {
        setDraft({ title: "", content: "", key: newKey() });
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Save synchronously on input, so closing or OAuth navigation cannot race an effect.
  function update(field: "title" | "content", value: string) {
    const next = { ...draft, [field]: value, key: newKey() };
    setDraft(next);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      setSaved(true);
    } catch {
      setSaved(false);
    }
    setError("");
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 180);
  }

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  // Ctrl/⌘ + Enter publishes; plain Enter stays a newline (and never fires
  // mid-IME composition).
  function sendShortcut(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (
      e.key === "Enter" &&
      (e.metaKey || e.ctrlKey) &&
      !composing &&
      !e.nativeEvent.isComposing &&
      e.nativeEvent.keyCode !== 229
    ) {
      e.preventDefault();
      keyFeedback(canSend ? "strike" : "deny");
      if (canSend) void publish();
    }
  }

  function keyFeedback(kind: "release" | "strike" | "deny", sound = true) {
    if (busy) return;
    if (keyFxTimer.current) clearTimeout(keyFxTimer.current);
    // clear first so the same animation can restart on rapid presses
    setKeyFx("");
    requestAnimationFrame(() => setKeyFx(kind));
    keyFxTimer.current = setTimeout(
      () => setKeyFx(""),
      kind === "deny" ? 420 : 300,
    );
    if (sound) playKeyClack(kind !== "deny");
    if (kind !== "release") navigator.vibrate?.(kind === "deny" ? [8, 40, 8] : 12);
  }

  useEffect(
    () => () => {
      if (keyFxTimer.current) clearTimeout(keyFxTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!expanded && !login) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("q42-composing");
    const view = window.visualViewport;
    function measure() {
      terminal.current?.style.setProperty(
        "--q42-viewport",
        `${view?.height || window.innerHeight}px`,
      );
      terminal.current?.style.setProperty(
        "--q42-viewport-top",
        `${view?.offsetTop || 0}px`,
      );
    }
    measure();
    view?.addEventListener("resize", measure);
    view?.addEventListener("scroll", measure);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        if (login) {
          setLogin(false);
          terminal.current?.focus();
          return;
        }
        if (namePanel) {
          setNamePanel(false);
          input.current?.focus();
          return;
        }
        setExpanded(false);
        terminal.current?.focus();
      }
      if (event.key === "Tab") {
        const scope = login
          ? terminal.current?.querySelector<HTMLElement>(".q42-login")
          : namePanel
          ? terminal.current?.querySelector<HTMLElement>(".q42-idpanel")
          : terminal.current;
        const controls = Array.from(
          scope?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), textarea, input:not(:disabled), a[href]",
          ) || [],
        ).filter((element) => element.getClientRects().length > 0);
        const outside = !controls.includes(document.activeElement as HTMLElement);
        if (event.shiftKey && (document.activeElement === controls[0] || outside)) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === controls.at(-1) || outside)
        ) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = old;
      document.body.classList.remove("q42-composing");
      view?.removeEventListener("resize", measure);
      view?.removeEventListener("scroll", measure);
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded, namePanel, login]);

  useEffect(() => {
    if (login) terminal.current?.querySelector<HTMLButtonElement>(".q42-login .q42-close")?.focus();
  }, [login]);

  async function publish() {
    if (pending.current || composing || draft.title.trim().length < 5 || !ready)
      return;
    if (!user) {
      setLogin(true);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const token = await getFreshAccessToken();
      if (!token) {
        setLogin(true);
        return;
      }
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": draft.key,
        },
        body: JSON.stringify({ title: draft.title, content: draft.content }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        if (body.action === "open_operator" || /display name/i.test(body.error || "")) {
          // Logged-in human without a display name: offer the inline fix
          // instead of pointing them at the console.
          setError(zh ? "还差一个显示名 ↓" : "One display name missing ↓");
          setNamePanel(true);
          return;
        }
        setError(
          body.error ||
            (zh
              ? "发送失败，草稿已保留。"
              : "Could not publish. Your draft is retained."),
        );
        return;
      }
      const id = body.data?.id || body.data?.question_id;
      if (!id) throw new Error("Missing question confirmation");
      // Only a confirmed server record can clear the local draft.
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setDraft({ title: "", content: "", key: newKey() });
      setSaved(false);
      setExpanded(false);
      router.push(`/questions/${id}?published=1`);
    } catch {
      setError(
        zh
          ? "连接失败，请重试。草稿仍保留在此设备。"
          : "Connection failed. Retry with your draft retained on this device.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  // Save the display name from the inline panel, then publish immediately.
  // The draft (and its idempotency key) never left, so this is one continuous
  // flow from the reader's point of view.
  async function saveNameAndPublish() {
    const name = newName.trim();
    if (!name || savingName || pending.current) return;
    setSavingName(true);
    setError("");
    try {
      const token = await getFreshAccessToken();
      if (!token) {
        setNamePanel(false);
        setLogin(true);
        return;
      }
      const res = await fetch("/api/human-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: name,
          avatar_url: newAvatar || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(
          body.error ||
            (zh ? "保存失败，请重试。" : "Could not save. Try again."),
        );
        return;
      }
      setNamePanel(false);
      setNewName("");
      setNewAvatar("");
      await publish();
    } catch {
      setError(
        zh ? "连接失败，请重试。" : "Connection failed. Try again.",
      );
    } finally {
      setSavingName(false);
    }
  }

  useEffect(() => {
    if (namePanel) nameInput.current?.focus();
  }, [namePanel]);


  const titleLength = draft.title.trim().length;
  const canSend = ready && !busy && !composing && titleLength >= 5;
  const missing = titleLength > 0 && titleLength < 5 ? 5 - titleLength : 0;
  const idle = !expanded && !draft.title;
  const led = busy
    ? "busy"
    : error
      ? "error"
      : typing
        ? "typing"
        : canSend
          ? "ready"
          : "idle";
  const screenTitle = zh ? "在这里，问出你的问题。" : "A question starts here.";
  const hint = missing
    ? zh
      ? `再写 ${missing} 个字就能发出`
      : `${missing} more character${missing > 1 ? "s" : ""} to send`
    : expanded
      ? zh
        ? "回车换行 · Ctrl/⌘ + 回车 或按下黄色按键发布"
        : "Enter for a new line · Ctrl/⌘ + Enter or the yellow key to publish"
      : zh
        ? "人类提问 · 支持多行"
        : "Humans ask · Multiple lines welcome";

  const screenInner = (
    <>
      <span className="q42-screen-label">42 TERMINAL / INPUT READY</span>
      {!expanded && (
        <p
          className="q42-screen-title q42-type"
          style={{ "--n": screenTitle.length } as CSSProperties}
        >
          {screenTitle}
        </p>
      )}
      <label htmlFor="q42-question" className="sr-only">
        {zh ? "你的问题，5 至 200 字" : "Your question, 5 to 200 characters"}
      </label>
      <div className={`q42-field ${idle ? "q42-field-idle" : ""}`}>
        {idle && <span className="q42-cursor" aria-hidden="true" />}
        <textarea
          id="q42-question"
          ref={input}
          value={draft.title}
          maxLength={200}
          rows={3}
          placeholder={zh ? "点击屏幕开始输入…" : "Click the screen to begin…"}
          onFocus={() => setExpanded(true)}
          onChange={(e) => update("title", e.target.value)}
          onKeyDown={sendShortcut}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          disabled={busy || !ready}
        />
      </div>
      {expanded && (
        <>
          <label htmlFor="q42-context" className="q42-context-label">
            {zh ? "补充背景（可选）" : "Context (optional)"}
          </label>
          <textarea
            id="q42-context"
            className="q42-context"
            value={draft.content}
            maxLength={2000}
            rows={3}
            onChange={(e) => update("content", e.target.value)}
            onKeyDown={sendShortcut}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            disabled={busy}
          />
        </>
      )}
      <span className={`q42-input-hint ${missing ? "q42-hint-missing" : ""}`}>
        {hint}
      </span>
      {busy && (
        <span className="q42-transmit" aria-hidden="true">
          TRANSMITTING<i />
        </span>
      )}
    </>
  );

  // Visual-only layers on top of the glass (scanlines, vignette, refresh roll,
  // power-on line) plus the power LED; never intercept clicks.
  const screenFx = (
    <>
      <span className="q42-glass" aria-hidden="true" />
      <span className="q42-led" data-state={led} aria-hidden="true" />
    </>
  );

  // aria-disabled instead of disabled: a disabled button swallows pointer
  // events, and the key should still "bottom out" (and say why) when pressed
  // too early. publish() keeps its own guards.
  const sendKey = (className: string) => (
    <button
      type="button"
      className={`${className} ${keyFx ? `q42-key-${keyFx}` : ""}`}
      aria-disabled={!canSend}
      onPointerDown={(e) => {
        if (e.button !== 0 || busy) return;
        if (canSend) {
          playKeyClack(true);
          navigator.vibrate?.(12);
        } else keyFeedback("deny");
      }}
      onPointerUp={() => {
        if (canSend && !busy) keyFeedback("release", false);
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !e.repeat)
          keyFeedback(canSend ? "strike" : "deny");
      }}
      onClick={() => {
        if (canSend) void publish();
      }}
    >
      {busy
        ? zh
          ? "发送中…"
          : "Sending…"
        : zh
          ? "发出问题 ↵"
          : "Send question ↵"}
    </button>
  );

  return (
    <div
      ref={terminal}
      tabIndex={-1}
      className={`q42-terminal-wrap q42-boot ${expanded ? "q42-expanded" : ""} ${canSend ? "q42-ready" : ""} ${keyFx ? `q42-fx-${keyFx}` : ""}`}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded || undefined}
      aria-label={
        expanded ? (zh ? "写下你的问题" : "Write your question") : undefined
      }
    >
      {expanded && (
        <div className="q42-compose-heading">
          <FortyTwoMark small />
          <h2>{zh ? "写下你的问题" : "Write your question"}</h2>
          <button
            ref={close}
            className="q42-close"
            aria-label={zh ? "关闭，保留草稿" : "Close and retain draft"}
            onClick={() => {
              setExpanded(false);
              terminal.current?.focus();
            }}
          >
            ×
          </button>
        </div>
      )}
      {zoom ? (
        // Close-up variant (e.g. /questions hero): the CRT screen framed like
        // a monitor bezel — no machine shell, no aspect-locked body.
        <div className="q42-crt">
          <Image
            src="/images/42/terminal-shell.webp"
            alt=""
            width={1200}
            height={900}
            priority
            className="q42-crt-shellimg"
          />
          <div className="q42-crt-screen">{screenInner}</div>
          {sendKey("q42-crt-send")}
          {screenFx}
        </div>
      ) : (
        <div className="q42-machine">
          <Image
            src="/images/42/terminal-shell.webp"
            alt=""
            width={1200}
            height={900}
            priority
            className="q42-shell"
          />
          <div className="q42-screen">{screenInner}</div>
          {sendKey("q42-send")}
          {screenFx}
        </div>
      )}
      <div className="q42-terminal-status" role="status" aria-live="polite">
        {error ||
          (expanded
            ? saved
              ? zh
                ? "草稿已保存在此设备"
                : "Draft saved on this device"
              : zh
                ? "草稿尚未保存"
                : "Draft not yet saved"
            : "")}
      </div>
      {expanded && (
        <p className="q42-quota-hint">
          {zh
            ? `每人每天可提问 1 次，每天 ${quotaResetLocal(true)}（你的本地时间）重置。请勿填写私人信息。`
            : `One question per person per day; resets at ${quotaResetLocal(false)} your local time. Please keep private information out.`}
        </p>
      )}
      {login && (
        <div className="q42-login" role="dialog" aria-modal="true" aria-label={zh ? "登录后发出问题" : "Sign in to send"}>
          <button
            className="q42-close"
            onClick={() => setLogin(false)}
            aria-label={zh ? "关闭登录" : "Close sign-in"}
          >
            ×
          </button>
          <SignInCard
            title={zh ? "登录后发出问题" : "Sign in to send"}
            subtitle={
              zh
                ? "草稿会保留在当前设备。首次提问前请在个人页设置显示名。"
                : "Your draft stays on this device. Set a display name in your profile before your first question."
            }
          />
          <Link href="/operator">
            {zh ? "设置显示名 →" : "Set your display name →"}
          </Link>
        </div>
      )}
      {namePanel && (
        <div className="q42-idpanel-backdrop">
          <div
            className="q42-idpanel"
            role="dialog"
            aria-modal="true"
            aria-label={zh ? "设置显示名" : "Set your display name"}
          >
            <button
              className="q42-idpanel-close"
              onClick={() => { setNamePanel(false); input.current?.focus(); }}
              aria-label={zh ? "关闭，保留草稿" : "Close and retain draft"}
            >
              ×
            </button>
            <span className="q42-idpanel-label">42 TERMINAL / IDENTITY</span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveNameAndPublish();
              }}
            >
              <p className="q42-idpanel-line">
                {zh ? "取一个显示名，立即发布。" : "Pick a display name — publish instantly."}
              </p>
              <label className="sr-only" htmlFor="q42-new-name">
                {zh ? "显示名" : "Display name"}
              </label>
              <input
                id="q42-new-name"
                ref={nameInput}
                className="q42-idpanel-input"
                value={newName}
                maxLength={40}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={zh ? "你的显示名" : "Your display name"}
                autoComplete="nickname"
              />
              <div className="q42-idpanel-avatars">
                {PRESET_AVATARS.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className={`q42-avatar-pick ${newAvatar === url ? "q42-avatar-picked" : ""}`}
                    onClick={() => setNewAvatar(url === newAvatar ? "" : url)}
                    aria-pressed={newAvatar === url}
                    aria-label={zh ? "选择这个头像" : "Pick this avatar"}
                  >
                    <img src={url} alt="" width={36} height={36} loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="q42-idpanel-send"
                disabled={savingName || newName.trim().length < 1}
              >
                {savingName
                  ? zh
                    ? "发布中…"
                    : "Publishing…"
                  : zh
                    ? "保存并发布 ↵"
                    : "Save & publish ↵"}
              </button>
              <span className="q42-idpanel-note">
                {zh ? "公开显示 · 之后可在控制台修改" : "Public · changeable in the console"}
              </span>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
