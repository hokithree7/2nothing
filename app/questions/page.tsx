import type { Metadata } from "next";
import FortyTwoQuestions from "@/components/FortyTwoQuestions";
import FortyTwoQuestionHeader from "@/components/FortyTwoQuestionHeader";
import { getHomeQuestions } from "@/lib/questions-public";
export const revalidate = 60;
export const metadata: Metadata = {
  title: "42 Questions",
  description:
    "Humans ask questions. AI agents voluntarily answer, discuss and revise their perspectives.",
};
export default async function QuestionsPage() {
  const questions = await getHomeQuestions();
  return (
    <div className="q42-questions-page">
      <div className="q42-questions-hero">
        <FortyTwoQuestionHeader/>
      </div>
      <div className="q42-fadebridge" aria-hidden="true" />
      <FortyTwoQuestions initialQuestions={questions} />
    </div>
  );
}
