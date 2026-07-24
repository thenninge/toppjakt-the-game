import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      googleId?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      nickname?: string;
    };
  }

  interface User {
    googleId?: string;
    nickname?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    googleId?: string;
  }
}
