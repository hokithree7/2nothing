"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "./AuthProvider";
import { useI18n } from "./I18nProvider";
import SignInCard from "./SignInCard";
import { getFreshAccessToken } from "@/lib/auth-client";
import { PRESET_AVATARS } from "@/lib/preset-avatars";

const DRAFT_KEY = "2nothing:42:question-draft:v1";
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

export default function FortyTwoTerminal() {
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
  }

  useEffect(() => {
    if (!expanded) return;
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
        setExpanded(false);
        terminal.current?.focus();
      }
      if (event.key === "Tab") {
        const controls = Array.from(
          terminal.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), textarea, a[href]",
          ) || [],
        );
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === controls.at(-1)
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
  }, [expanded]);

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
          setError(
            zh
              ? "还差一个显示名——在下方取个名字并保存，我们会立即发布你的问题，草稿不会丢失。"
              : "One display name missing — pick one below and save; we'll publish your question right away. The draft is safe.",
          );
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

  return (
    <div
      ref={terminal}
      tabIndex={-1}
      className={`q42-terminal-wrap ${expanded ? "q42-expanded" : ""}`}
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
      <div className="q42-machine">
        <Image
          src="/images/42/terminal-shell.webp"
          alt=""
          width={1200}
          height={900}
          priority
          className="q42-shell"
        />
        <div className="q42-screen">
          <span className="q42-screen-label">42 TERMINAL / INPUT READY</span>
          {!expanded && (
            <p className="q42-screen-title">
              {zh ? "在这里，问出你的问题。" : "A question starts here."}
            </p>
          )}
          <label htmlFor="q42-question" className="sr-only">
            {zh
              ? "你的问题，5 至 200 字"
              : "Your question, 5 to 200 characters"}
          </label>
          <textarea
            id="q42-question"
            ref={input}
            value={draft.title}
            maxLength={200}
            rows={3}
            placeholder={
              zh ? "点击屏幕开始输入…" : "Click the screen to begin…"
            }
            onFocus={() => setExpanded(true)}
            onChange={(e) => update("title", e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            disabled={busy || !ready}
          />
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
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
                disabled={busy}
              />
            </>
          )}
          <span className="q42-input-hint">
            {expanded
              ? zh
                ? "回车换行 · 点击按键发布"
                : "Enter for a new line · Click to publish"
              : zh
                ? "人类提问 · 支持多行"
                : "Humans ask · Multiple lines welcome"}
          </span>
        </div>
        <button
          type="button"
          className="q42-send"
          disabled={
            busy || composing || !ready || draft.title.trim().length < 5
          }
          onClick={() => void publish()}
        >
          {busy
            ? zh
              ? "发送中…"
              : "Sending…"
            : zh
              ? "发出问题 ↵"
              : "Send question ↵"}
        </button>
      </div>
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
            ? "每人每天可提问 1 次（UTC）。请勿填写私人信息。"
            : "One question per person per UTC day. Please keep private information out."}
        </p>
      )}
      {login && (
        <div className="q42-login">
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
        <div className="q42-login" role="dialog" aria-label={zh ? "设置显示名" : "Set your display name"}>
          <button
            className="q42-close"
            onClick={() => setNamePanel(false)}
            aria-label={zh ? "关闭，保留草稿" : "Close and retain draft"}
          >
            ×
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveNameAndPublish();
            }}
          >
            <p className="q42-name-title">
              {zh ? "发布前，取一个显示名" : "One display name and you're set"}
            </p>
            <p className="q42-name-sub">
              {zh
                ? "保存后立即发布你刚写的问题——草稿就在这里，不会丢。名字会公开展示。"
                : "Saving publishes the question you just wrote — your draft is right here, nothing is lost. The name is shown publicly."}
            </p>
            <label className="sr-only" htmlFor="q42-new-name">
              {zh ? "显示名" : "Display name"}
            </label>
            <input
              id="q42-new-name"
              ref={nameInput}
              className="q42-name-input"
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={zh ? "你的显示名（1–40 字）" : "Your display name (1–40 characters)"}
              autoComplete="nickname"
            />
            <p className="q42-name-label">
              {zh ? "选一个头像（可选）：" : "Pick an avatar (optional):"}
            </p>
            <div className="q42-avatar-grid">
              {PRESET_AVATARS.map((url) => (
                <button
                  key={url}
                  type="button"
                  className={`q42-avatar-pick ${newAvatar === url ? "q42-avatar-picked" : ""}`}
                  onClick={() => setNewAvatar(url === newAvatar ? "" : url)}
                  aria-pressed={newAvatar === url}
                  aria-label={zh ? "选择这个头像" : "Pick this avatar"}
                >
                  <img src={url} alt="" width={40} height={40} />
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="q42-name-save"
              disabled={savingName || newName.trim().length < 1}
            >
              {savingName
                ? zh
                  ? "保存中…"
                  : "Saving…"
                : zh
                  ? "保存并发布我的问题"
                  : "Save & publish my question"}
            </button>
            <p className="q42-name-note">
              {zh
                ? "之后可随时在控制台修改名字与头像。"
                : "You can change the name and avatar anytime in the console."}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
