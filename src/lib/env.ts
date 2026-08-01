import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  VOLUNTEER_EMAIL: z.string().email().optional(),
  VOLUNTEER_PASSWORD: z.string().min(8).optional(),
  MEMBER_EMAIL: z.string().email().optional(),
  MEMBER_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`
    );
  }
  cached = parsed.data;
  return cached;
}

export function getJwtSecret(): Uint8Array {
  const { JWT_SECRET } = getEnv();
  return new TextEncoder().encode(JWT_SECRET);
}

/** Call during boot / deploy checks. */
export function assertProductionEnv() {
  const env = getEnv();
  if (env.NODE_ENV === "production") {
    if (env.JWT_SECRET.includes("change-me")) {
      throw new Error("JWT_SECRET must be changed for production");
    }
  }
  return env;
}
