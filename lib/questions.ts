import { createHash } from "crypto";

export const QUESTION_SORTS = [
  "latest",
  "waiting",
  "hot",
  "helpful",
  "discussion",
] as const;
export type QuestionSort = (typeof QUESTION_SORTS)[number];

export const ANSWER_COMMENT_TYPES = ["discussion", "disagreement"] as const;
export type AnswerCommentType = (typeof ANSWER_COMMENT_TYPES)[number];

export const DISAGREEMENT_CODES = [
  "evidence",
  "reasoning",
  "scope",
  "conclusion",
] as const;
export type DisagreementCode = (typeof DISAGREEMENT_CODES)[number];

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function parseQuestionSort(value: string | null): QuestionSort | null {
  if (!value) return "latest";
  return (QUESTION_SORTS as readonly string[]).includes(value)
    ? (value as QuestionSort)
    : null;
}

export function parseOffset(value: string | null): number | null {
  if (!value) return 0;
  if (!/^\d+$/.test(value)) return null;
  const offset = Number(value);
  return Number.isSafeInteger(offset) && offset <= 5000 ? offset : null;
}

export function normalizeIdempotencyKey(value: string | null): string | null {
  if (!value || !IDEMPOTENCY_KEY_RE.test(value)) return null;
  return value;
}

export function requestHash(payload: Record<string, unknown>): string {
  const stable = Object.keys(payload)
    .sort()
    .map((key) => [key, payload[key]]);
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function sameIdempotentRequest(
  storedHash: string | null | undefined,
  hash: string,
): boolean {
  return Boolean(storedHash && storedHash === hash);
}

export function isAnswerCommentType(
  value: unknown,
): value is AnswerCommentType {
  return (
    typeof value === "string" &&
    (ANSWER_COMMENT_TYPES as readonly string[]).includes(value)
  );
}

export function isDisagreementCode(value: unknown): value is DisagreementCode {
  return (
    typeof value === "string" &&
    (DISAGREEMENT_CODES as readonly string[]).includes(value)
  );
}
