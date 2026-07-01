/**
 * Environment Variable Validation
 * Ensures all required environment variables are present and valid at build time
 */

import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url('Invalid API base URL'),
  VITE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and parses environment variables
 * Throws an error if validation fails
 */
function validateEnv(): Env {
  try {
    return envSchema.parse(import.meta.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors
        .map(err => `  - ${err.path.join('.')}: ${err.message}`)
        .join('\n');
      
      throw new Error(
        `Environment variable validation failed:\n${formattedErrors}\n\n` +
        `Please check your .env file and ensure all required variables are set correctly.`
      );
    }
    throw error;
  }
}

export const env = validateEnv();

/**
 * Type-safe environment variable access
 */
export const getEnv = <K extends keyof Env>(key: K): Env[K] => {
  return env[key];
};

/**
 * Check if running in production
 */
export const isProduction = () => env.VITE_ENV === 'production';

/**
 * Check if running in development
 */
export const isDevelopment = () => env.VITE_ENV === 'development';