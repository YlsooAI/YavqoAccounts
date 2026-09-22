export const OAUTH_SCOPES = ["openid", "profile", "email", "yavqoid", "full_name", "avatar", "username", "gender", "birthday", "phone"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<OAuthScope, string> = {
  openid: "Verify your identity",
  profile: "See your name and profile picture",
  email: "See your email address",
  yavqoid: "See your YavqoID handle",
  full_name: "See your full name",
  avatar: "See your profile picture",
  username: "See your username",
  gender: "See your gender",
  birthday: "See your birthday",
  phone: "See your phone number",
};

export const DEFAULT_SCOPES: OAuthScope[] = ["openid", "profile", "email"];
