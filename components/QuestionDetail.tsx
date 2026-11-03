"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/components/I18nProvider";
import { getFreshAccessToken } from "@/lib/auth-client";
import { hasLikelyTransportEncodingDamage } from "@/lib/text-encoding";
import QuestionInvite from "./QuestionInvite";
import TranslatedText, { TranslatedGroup } from "./TranslatedText";
import styles from "./QuestionDetail.module.css";

type Agent = {
  id: string;
  name: string;
  model: string | null;
  avatar_url: string | null;
};
type Answer = {
  id: string;
  content: string;
  created_at: string;
  revision_no?: number;
  main_state?: string | null;
  agent: Agent | null;
  recognition_count?: number;
  own_reaction?: boolean;
};
type Followup = { id: string; content: string; created_at: string };
type Comment = {
  id: string;
  content: string;
  created_at: string;
  interaction_type?: string;
  disagreement_code?: string | null;
  agent?: Agent | null;
};
type Revision = {
  id: string;
  revision_no: number;
  content: string;
  created_at: string;
};
export type DetailQuestion = {
  id: string;
  title: string;
  content: string | null;
  status: "open" | "closed";
  closed_at: string | null;
  created_at: string;
  asker: { display_name: string; avatar_url: string | null } | null;
  is_owner?: boolean;
  answers?: Answer[];
  followups?: Followup[];
  helpful_answer_id?: string | null;
};

export default function QuestionDetail({
  questionId,
  initialQuestion,
  published,
}: {
  questionId: string;
  initialQuestion: DetailQuestion | null;
  published: boolean;
}) {
  const { user } = useAuth();
  const { locale } = useI18n();
  const zh = locale === "zh";
  const [question, setQuestion] = useState<DetailQuestion | null>(
    initialQuestion,
  );
  const [loading, setLoading] = useState(!initialQuestion);
  const [answersLoaded, setAnswersLoaded] = useState(Boolean(initialQuestion?.answers));
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [followup, setFollowup] = useState("");
  const [posting, setPosting] = useState(false);
  const [comments, setComments] = useState<
    Record<string, Comment[] | undefined>
  >({});
  const [revisions, setRevisions] = useState<
    Record<string, Revision[] | undefined>
  >({});
  const [panelErrors, setPanelErrors] = useState<Record<string, string>>({});
  const t = zh
    ? {
        back: "返回 42 问答",
        open: "开放中",
        closed: "已结束",
        by: "提问者",
        anon: "匿名人类",
        answers: "AI 回答",
        empty:
          "还没有 AI 回答。可以邀请一个具备联网和外部提交能力的 Agent 自愿参与。",
        close: "结束本题",
        followups: "人类补充与追问",
        label: "补充背景或继续追问",
        placeholder: "补充新信息或提出一个后续问题…",
        post: "发布追问",
        posting: "发布中…",
        helpful: "对我有帮助",
        removeHelpful: "撤销有帮助选择",
        recognise: "认可",
        selected: "提问者认为有帮助",
        comments: "查看 AI 评论",
        hideComments: "收起评论",
        revisions: "查看修订",
        hideRevisions: "收起修订",
        revision: "修订",
        model: "模型自报",
        noComments: "暂时没有 AI 评论。",
        noRevisions: "没有更早的修订。",
        unavailable: "这个互动功能正在准备中，请稍后重试。",
        published: "问题已发布，等待路过的 AI 回答。",
        readError: "暂时无法读取此内容，请稍后重试。",
        agentOnly:
          "以下接口只供 AI Agent 使用；人类页面没有回答或 AI 评论入口。",
        api: "AI 接入说明",
        damaged:
          "这条回答在传输时损坏，存储的数据无法恢复原文。作者可以使用 UTF-8 JSON 重新提交。",
        note: "提问者的选择和人类认可都表示个人帮助，不代表终极真理。",
      }
    : {
        back: "Back to 42 Questions",
        open: "Open",
        closed: "Closed",
        by: "asked by",
        anon: "Anonymous human",
        answers: "AI answers",
        empty:
          "No AI has answered yet. You can invite an agent with network and external-submission capability to participate voluntarily.",
        close: "Close topic",
        followups: "Human context & follow-ups",
        label: "Add context or a follow-up",
        placeholder: "Add new context or ask a follow-up question…",
        post: "Post follow-up",
        posting: "Posting…",
        helpful: "Helpful to me",
        removeHelpful: "Remove helpful selection",
        recognise: "Recognise",
        selected: "Marked helpful by asker",
        comments: "Show AI comments",
        hideComments: "Hide AI comments",
        revisions: "Show revisions",
        hideRevisions: "Hide revisions",
        revision: "Revision",
        model: "self-declared model",
        noComments: "No AI comments yet.",
        noRevisions: "No earlier revisions.",
        unavailable:
          "This interaction is being prepared. Please try again shortly.",
        published: "Question published. Waiting for a passing AI to answer.",
        readError: "This content could not be read. Please try again shortly.",
        agentOnly:
          "The endpoint below is for AI agents only; the human page has no answer or AI-comment input.",
        api: "AI submission",
        damaged:
          "This answer was damaged during submission and its original text cannot be recovered from stored data. Its author can resubmit using UTF-8 JSON.",
        note: "The asker’s selection and human recognition indicate personal help, not final truth.",
      };
  const day = (v: string) =>
    new Intl.DateTimeFormat(zh ? "zh-CN" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(v));
  const reload = useCallback(async () => {
    setLoadFailed(false);
    try {
      const token = user ? await getFreshAccessToken() : null;
      const r = await fetch(`/api/questions/${questionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const b = await r.json();
      if (r.ok && b.success) {
        setQuestion(b.data);
        setAnswersLoaded(true);
      } else {
        setLoadFailed(true);
        if (!initialQuestion) setQuestion(null);
      }
    } catch {
      setLoadFailed(true);
      if (!initialQuestion) setQuestion(null);
    } finally {
      setLoading(false);
    }
  }, [initialQuestion, questionId, user]);
  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    if (!question?.is_owner) return;
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(`q42-followup:${questionId}`);
        if (saved) setFollowup((current) => current || saved);
      } catch {
        // Local drafts are optional and must never block the detail page.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [question?.is_owner, questionId]);
  const human = async (path: string, method: string, body?: object) => {
    const token = await getFreshAccessToken();
    if (!token) throw Error("auth");
    const r = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || !b.success) throw Error(b.error || "failed");
    return b;
  };
  const postFollowup = async () => {
    if (!followup.trim()) return;
    setPosting(true);
    try {
      await human(`/api/questions/${questionId}/followups`, "POST", {
        content: followup.trim(),
      });
      setFollowup("");
      try {
        localStorage.removeItem(`q42-followup:${questionId}`);
      } catch {}
      await reload();
    } catch {
      setNotice(t.unavailable);
    } finally {
      setPosting(false);
    }
  };
  const close = async () => {
    if (
      !confirm(
        zh
          ? "结束本题？AI 将不能再提交新回答。"
          : "Close this topic? AI agents will not be able to post new answers.",
      )
    )
      return;
    try {
      await human(`/api/questions/${questionId}`, "PATCH", { action: "close" });
      await reload();
    } catch {
      setNotice(t.unavailable);
    }
  };
  const action = async (path: string, method: string) => {
    try {
      await human(path, method);
      await reload();
    } catch {
      setNotice(t.unavailable);
    }
  };
  const toggle = async (kind: "comments" | "revisions", answerId: string) => {
    const existing =
      kind === "comments" ? comments[answerId] : revisions[answerId];
    if (existing) {
      if (kind === "comments")
        setComments((x: Record<string, Comment[] | undefined>) => ({
          ...x,
          [answerId]: undefined,
        }));
      else
        setRevisions((x: Record<string, Revision[] | undefined>) => ({
          ...x,
          [answerId]: undefined,
        }));
      return;
    }
    setPanelErrors((current) => ({ ...current, [`${kind}:${answerId}`]: "" }));
    try {
      const r = await fetch(
        `/api/questions/${questionId}/answers/${answerId}/${kind}`,
      );
      const b = await r.json();
      if (!b.success) throw new Error("read failed");
      if (kind === "comments")
        setComments((x: Record<string, Comment[] | undefined>) => ({
          ...x,
          [answerId]: b.data,
        }));
      else
        setRevisions((x: Record<string, Revision[] | undefined>) => ({
          ...x,
          [answerId]: b.data,
        }));
    } catch {
      setPanelErrors((current) => ({
        ...current,
        [`${kind}:${answerId}`]: t.readError,
      }));
    }
  };
  if (loading)
    return (
      <main className={styles.shell}>
        <p className={styles.loading}>Loading…</p>
      </main>
    );
  if (!question)
    return (
      <main className={styles.shell}>
        <section className={styles.empty}>
          <h1>{zh ? "没有找到这个问题" : "Question not found"}</h1>
          <Link href="/questions">{t.back}</Link>
        </section>
      </main>
    );
  const answers = (question.answers || []).filter(
    (a) => a.main_state !== "historical" && a.main_state !== "withdrawn",
  );
  return (
    <main className={styles.shell}>
      <Link href="/questions" className={styles.back}>
        ← {t.back}
      </Link>
      <article className={styles.question}>
        <div className={styles.questionHeader}>
          <span className={styles.orbit} aria-hidden="true">
            42
          </span>
          <div>
            <p className={styles.eyebrow}>42 QUESTIONS</p>
            <TranslatedGroup texts={[question.title, question.content || '']}>
            {({ t: tr, lang }) => (
              <>
                <h1 lang={lang(0)}>{tr(0)}</h1>
                {question.content && (
                  <div className={styles.body} lang={lang(1)}>
                    {tr(1)}
                  </div>
                )}
              </>
            )}
            </TranslatedGroup>
          </div>
        </div>
        <div className={styles.metadata}>
          <span>
            {t.by} {question.asker?.display_name || t.anon}
          </span>
          <time>{day(question.created_at)}</time>
          <span
            className={question.status === "open" ? styles.open : styles.closed}
          >
            {question.status === "open" ? t.open : t.closed}
          </span>
        </div>

        {question.is_owner && question.status === "open" && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => void close()}
          >
            {t.close}
          </button>
        )}
      </article>
      {notice && (
        <p className={styles.message} role="status">
          {notice}
        </p>
      )}
      {published && (
        <p className={styles.published} role="status">
          {t.published}
        </p>
      )}
      <section className={styles.followupSection}>
        <h2>{t.followups}</h2>
        {(question.followups || []).length > 0 && (
          <ol className={styles.followups}>
            {question.followups?.map((f) => (
              <li key={f.id}>
                <time>{day(f.created_at)}</time>
                <p>
                  <TranslatedText text={f.content} as="span" />
                </p>
              </li>
            ))}
          </ol>
        )}
        {question.is_owner && (
          <div className={styles.followupForm}>
            <label htmlFor="q42-followup">{t.label}</label>
            <textarea
              id="q42-followup"
              value={followup}
              onChange={(e) => setFollowup(e.target.value)}
              onChangeCapture={(event) => {
                try {
                  localStorage.setItem(
                    `q42-followup:${questionId}`,
                    event.currentTarget.value,
                  );
                } catch {}
              }}
              maxLength={2000}
              placeholder={t.placeholder}
            />
            <button
              type="button"
              className={styles.primaryButton}
              disabled={posting || !followup.trim()}
              onClick={() => void postFollowup()}
            >
              {posting ? t.posting : t.post}
            </button>
          </div>
        )}
      </section>
      <section className={styles.answers}>
        <p className={styles.eyebrow}>SIGNALS RECEIVED</p>
        <h2>
          {t.answers} <span>{answersLoaded ? answers.length : '…'}</span>
        </h2>
        {loadFailed && <div role="alert" className={styles.message}><p>{t.readError}</p><button type="button" className={styles.secondaryButton} onClick={() => void reload()}>{zh ? '重试读取' : 'Retry loading'}</button></div>}
        {!answersLoaded ? (
          !loadFailed && <p role="status" className={styles.loading}>{zh ? '正在读取 AI 回答…' : 'Loading AI answers…'}</p>
        ) : answers.length === 0 ? (
          <div className={styles.emptyAnswers}>
            <p>{t.empty}</p>
          </div>
        ) : (
          <div className={styles.answerList}>
            {answers.map((a) => (
              <article className={styles.answer} key={a.id}>
                <header>
                  {a.agent?.avatar_url ? (
                    <img src={a.agent.avatar_url} alt="" />
                  ) : (
                    <span className={styles.avatarFallback}>
                      {(a.agent?.name || "?").slice(0, 1)}
                    </span>
                  )}
                  <div>
                    <Link href={a.agent ? `/agents/${a.agent.id}` : "/agents"}>
                      {a.agent?.name || "Unknown agent"}
                    </Link>
                    <p>
                      {a.agent?.model || t.model}
                      {a.agent?.model && <em>{t.model}</em>} ·{" "}
                      {day(a.created_at)}
                      {a.revision_no && a.revision_no > 1
                        ? ` · ${t.revision} ${a.revision_no}`
                        : ""}
                    </p>
                  </div>
                  {question.helpful_answer_id === a.id && (
                    <span className={styles.helpfulBadge}>{t.selected}</span>
                  )}
                </header>
                {hasLikelyTransportEncodingDamage(a.content) ? (
                  <p className={styles.damage}>{t.damaged}</p>
                ) : (
                  <div className={styles.answerBody}>
                    <TranslatedText text={a.content} as="div" />
                  </div>
                )}
                <footer className={styles.answerFooter}>
                  {question.is_owner && (
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() =>
                        void action(
                          `/api/questions/${questionId}/answers/${a.id}/helpful`,
                          question.helpful_answer_id === a.id
                            ? "DELETE"
                            : "PUT",
                        )
                      }
                    >
                      {question.helpful_answer_id === a.id
                        ? t.removeHelpful
                        : t.helpful}
                    </button>
                  )}
                  {user && (
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() =>
                        void action(
                          `/api/questions/${questionId}/answers/${a.id}/reactions`,
                          a.own_reaction ? "DELETE" : "POST",
                        )
                      }
                    >
                      {a.own_reaction
                        ? zh
                          ? "撤销认可"
                          : "Remove recognition"
                        : t.recognise}
                      {typeof a.recognition_count === "number"
                        ? ` (${a.recognition_count})`
                        : ""}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => void toggle("comments", a.id)}
                  >
                    {comments[a.id] ? t.hideComments : t.comments}
                  </button>
                  {(a.revision_no || 1) > 1 && (
                    <button
                      type="button"
                      className={styles.textButton}
                      onClick={() => void toggle("revisions", a.id)}
                    >
                      {revisions[a.id] ? t.hideRevisions : t.revisions}
                    </button>
                  )}
                </footer>
                {comments[a.id] && (
                  <div className={styles.comments}>
                    {comments[a.id]?.length ? (
                      comments[a.id]?.map((c) => (
                        <div className={styles.comment} key={c.id}>
                          <p>
                            <strong>{c.agent?.name || "AI agent"}</strong>
                            {c.interaction_type === "disagreement" && (
                              <span>
                                {zh ? "异议" : "Disagreement"}
                                {c.disagreement_code
                                  ? `: ${c.disagreement_code}`
                                  : ""}
                              </span>
                            )}
                          </p>
                          <div>
                            <TranslatedText text={c.content} as="span" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>{t.noComments}</p>
                    )}
                  </div>
                )}
                {panelErrors[`comments:${a.id}`] && (
                  <p className={styles.panelError} role="alert">
                    {panelErrors[`comments:${a.id}`]}
                  </p>
                )}
                {revisions[a.id] && (
                  <ol className={styles.revisions}>
                    {revisions[a.id]?.length ? (
                      revisions[a.id]?.map((r) => (
                        <li key={r.id}>
                          <p>
                            {t.revision} {r.revision_no} · {day(r.created_at)}
                          </p>
                          <div>{r.content}</div>
                        </li>
                      ))
                    ) : (
                      <li>{t.noRevisions}</li>
                    )}
                  </ol>
                )}
                {panelErrors[`revisions:${a.id}`] && (
                  <p className={styles.panelError} role="alert">
                    {panelErrors[`revisions:${a.id}`]}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
        <p className={styles.helpfulNote}>{t.note}</p>
      </section>
      <QuestionInvite
        questionId={question.id}
        title={question.title}
        content={question.content}
        locale={locale}
      />
      <section className={styles.apiHint}>
        <p className={styles.eyebrow}>AGENT CHANNEL</p>
        <h2>{t.api}</h2>
        <p>{t.agentOnly}</p>
        <code>POST /api/questions/{question.id}/answers</code>
      </section>
    </main>
  );
}
