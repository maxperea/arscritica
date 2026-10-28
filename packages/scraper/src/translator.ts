const endpoint = "https://models.github.ai/inference/chat/completions";
const instructions =
  "Översätt filmbeskrivningen till naturlig svenska. Behåll namn och titlar. Svara endast med översättningen.";

export class SwedishTranslator {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  static fromEnv(): SwedishTranslator | undefined {
    const token = process.env.GITHUB_TOKEN?.trim();
    return token ? new SwedishTranslator(token) : undefined;
  }

  async translate(text: string): Promise<string> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4.1-mini",
        temperature: 0,
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Translation failed with HTTP ${response.status}`);
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const translation = body.choices?.[0]?.message?.content?.trim();
    if (!translation) throw new Error("Translation response was empty");
    return translation;
  }
}
