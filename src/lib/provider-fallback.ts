export interface ProviderAttempt<T> {
  name: string;
  run: () => Promise<T>;
}

export class ProviderFallbackError extends Error {
  readonly failures: Array<{ name: string; cause: unknown }>;

  constructor(failures: Array<{ name: string; cause: unknown }>) {
    super(`All configured AI providers failed (${failures.map((failure) => failure.name).join(", ")}).`);
    this.name = "ProviderFallbackError";
    this.failures = failures;
  }
}

export async function runProviderFallback<T>(
  attempts: ProviderAttempt<T>[],
): Promise<{ providerName: string; value: T }> {
  const failures: Array<{ name: string; cause: unknown }> = [];

  for (const attempt of attempts) {
    try {
      return {
        providerName: attempt.name,
        value: await attempt.run(),
      };
    } catch (cause) {
      failures.push({ name: attempt.name, cause });
    }
  }

  throw new ProviderFallbackError(failures);
}
