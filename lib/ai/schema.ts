import { z } from "zod";

export const TUTOR_MODES = ["explain", "eli5", "exam", "steps", "code", "quiz", "flashcards", "mistake", "pyq", "summary", "plan"] as const;
export const TUTOR_DEPTHS = ["intro", "standard", "deep"] as const;
export type TutorMode = (typeof TUTOR_MODES)[number];
export type TutorDepth = (typeof TUTOR_DEPTHS)[number];

const short = (n: number) => z.string().max(n);

export const tutorContextSchema = z
  .object({
    subjectName: short(80).optional(),
    topicName: short(160).optional(),
    status: short(40).optional(),
    confidence: z.number().int().min(0).max(5).optional(),
    accuracy: z.number().min(0).max(100).nullable().optional(),
    attempted: z.number().int().min(0).max(100000).optional(),
    notes: short(4000).optional(),
    recentErrors: z
      .array(z.object({ type: z.enum(["A", "B", "C"]), ref: short(160), whyWrong: short(600).optional(), rule: short(400).optional() }))
      .max(10)
      .optional(),
    progressSummary: short(3000).optional(),
  })
  .strict();

export const tutorRequestSchema = z
  .object({
    messages: z
      .array(z.object({ role: z.enum(["user", "model"]), content: z.string().min(1).max(12000) }))
      .min(1)
      .max(40),
    mode: z.enum(TUTOR_MODES).default("explain"),
    depth: z.enum(TUTOR_DEPTHS).default("standard"),
    useSearch: z.boolean().default(false),
    context: tutorContextSchema.optional(),
  })
  .strict()
  .refine((r) => r.messages[r.messages.length - 1]?.role === "user", { message: "Last message must be from the user" });

export type TutorRequest = z.infer<typeof tutorRequestSchema>;
export type TutorContext = z.infer<typeof tutorContextSchema>;

export const quizRequestSchema = z
  .object({
    subjectName: short(80),
    topicName: short(160).optional(),
    count: z.number().int().min(3).max(10).default(5),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    notes: short(2000).optional(),
  })
  .strict();

export const quizResponseSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        type: z.enum(["MCQ", "MSQ", "NAT"]),
        options: z.array(z.string()).max(6),
        correct: z.array(z.number().int().min(0)).max(6),
        natAnswer: z.string().optional(),
        explanation: z.string(),
      }),
    )
    .min(1)
    .max(10),
});

export type QuizResponse = z.infer<typeof quizResponseSchema>;

/** JSON Schema passed to Gemini structured output for quizzes. */
export const QUIZ_JSON_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "Self-contained question. Use $...$ for math." },
          type: { type: "string", enum: ["MCQ", "MSQ", "NAT"] },
          options: { type: "array", items: { type: "string" }, description: "4 options for MCQ/MSQ, empty for NAT" },
          correct: { type: "array", items: { type: "integer" }, description: "0-based indices of correct options; empty for NAT" },
          natAnswer: { type: "string", description: "Exact numeric answer for NAT, with rounding stated" },
          explanation: { type: "string", description: "Step-by-step reasoning" },
        },
        required: ["question", "type", "options", "correct", "explanation"],
      },
    },
  },
  required: ["questions"],
} as const;
