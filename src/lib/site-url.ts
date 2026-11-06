/** Public base URL used in links we put in emails. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vyapar-one.com"
).replace(/\/$/, "");
