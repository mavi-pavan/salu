import { handlers } from "@/auth";

// O adapter do Prisma exige Node — não roda no edge runtime.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
