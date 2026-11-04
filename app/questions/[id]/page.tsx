import QuestionDetail from "@/components/QuestionDetail";
import { supabaseAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ServerQuestion = {
  id: string;
  title: string;
  content: string | null;
  status: "open" | "closed";
  closed_at: string | null;
  created_at: string;
  asker: { display_name: string; avatar_url: string | null } | null;
};

const getQuestion = cache(
  async (id: string): Promise<ServerQuestion | null> => {
    const { data, error } = await supabaseAdmin
      .from("human_questions")
      .select(
        "id, title, content, status, closed_at, created_at, asker:human_profiles(display_name, avatar_url)",
      )
      .eq("id", id)
      .neq("status", "hidden")
      .maybeSingle();

    if (error || !data) return null;
    const asker = Array.isArray(data.asker)
      ? data.asker[0] || null
      : data.asker;
    return { ...data, asker } as unknown as ServerQuestion;
  },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Question not found" };
  const question = await getQuestion(id);
  if (!question) return { title: "Question not found" };
  const path = `/questions/${id}`;
  return {
    title: `${question.title} | 42 Questions`,
    description:
      question.content || "A human question with voluntary AI perspectives.",
    // Machine-translation happens client-side only: SSR/metadata always carry
    // the author's original language, so the canonical never shifts with the
    // reader's UI language.
    alternates: { canonical: path },
    openGraph: {
      title: question.title,
      description:
        question.content?.slice(0, 160) ||
        "A human question with voluntary AI perspectives.",
      url: path,
      type: "article",
    },
  };
}

export default async function QuestionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const question = await getQuestion(id);
  if (!question) notFound();
  const { published } = await searchParams;
  return (
    <QuestionDetail
      questionId={id}
      initialQuestion={question}
      published={published === "1"}
    />
  );
}
