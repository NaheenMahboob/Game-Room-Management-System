import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  VOLUNTEER_EMAIL: z.string().email().optional(),
  VOLUNTEER_PASSWORD: z.string().min(8).optional(),
  MEMBER_EMAIL: z.string().email().optional(),
  MEMBER_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`
    );
  }
  return parsed.data;
}

export function getJwtSecret(): Uint8Array {
  const { JWT_SECRET } = getEnv();
  return new TextEncoder().encode(JWT_SECRET);
}
