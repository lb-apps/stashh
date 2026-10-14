import type { Express } from "express";
import { apiReference } from "@scalar/express-api-reference";
import { generateOpenAPIDocument } from "./lib/openapi.js";
import { signInDevTestUser } from "./lib/devSupabasePasswordSignIn.js";

// Side-effect imports: register all module paths before spec generation
import "./modules/places/openapi.js";
import "./modules/lists/openapi.js";
import "./modules/library/openapi.js";
import "./modules/recognitions/openapi.js";
import "./modules/internal/openapi.js";

export async function mountDocs(app: Express): Promise<void> {
  app.get("/openapi.json", (_req, res) => {
    res.json(generateOpenAPIDocument());
  });

  const isDev = process.env.NODE_ENV !== "production";

  const base = {
    url: "/openapi.json",
    theme: "kepler" as const,
    // Scalar: keep Bearer token across reloads (localStorage). Dev-only — see
    // https://guides.scalar.com/products/api-references/configuration (persistAuth).
    persistAuth: isDev,
  };

  let scalarConfig: Parameters<typeof apiReference>[0] = base;

  if (isDev) {
    const auth = await signInDevTestUser();
    if (auth.ok) {
      scalarConfig = {
        ...base,
        authentication: {
          preferredSecurityScheme: "BearerAuth",
          securitySchemes: {
            BearerAuth: {
              token: auth.access_token,
            },
          },
        },
      };
      console.log("[docs] Scalar: prefilled Bearer token from DEV_TEST_* (Supabase password grant)");
    } else if (auth.error === "missing_env") {
      console.warn(
        "[docs] Scalar: set DEV_TEST_EMAIL, DEV_TEST_PASSWORD, and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) to prefill API auth",
      );
    } else if (auth.error === "auth_failed") {
      console.warn("[docs] Scalar: could not prefill token —", auth.message ?? "auth failed");
    }
  }

  app.use("/docs", apiReference(scalarConfig));
}
