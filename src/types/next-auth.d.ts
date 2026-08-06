import type { DefaultSession } from "next-auth";
import type { Papel } from "@/lib/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      papel: Papel;
      ativo: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    papel?: Papel;
    ativo?: boolean;
  }
}
