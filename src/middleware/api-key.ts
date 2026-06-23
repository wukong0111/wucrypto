import { createMiddleware } from "hono/factory";

type ApiKeyEnv = {
  Variables: { user: { id: string; username: string; coingeckoApiKey: string | null } };
};

const EXACT_EXEMPTS = new Set(["/groups"]);

export const apiKeyMiddleware = createMiddleware<ApiKeyEnv>(async (c, next) => {
  const path = c.req.path;

  if (EXACT_EXEMPTS.has(path)) return next();
  if (path === "/settings" || path.startsWith("/settings/")) return next();

  const user = c.get("user");
  if (!user.coingeckoApiKey) {
    const isHtmx = c.req.header("HX-Request") === "true";
    if (isHtmx) {
      return c.html(
        '<span class="text-red-400 text-sm">Configure your CoinGecko API key in Settings to use this feature.</span>',
        403,
      );
    }
    return c.redirect("/settings?error=missing_key");
  }

  await next();
});
