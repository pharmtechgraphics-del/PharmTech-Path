export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, system, careerPreferences } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  // Build preferences context if the user has selections saved
  const labelMap = {
    enjoy: "Things they enjoy doing",
    avoid: "Things they want to avoid",
    setting: "Preferred work settings",
    patientContact: "Patient interaction preference",
    motivators: "Career motivators",
    skills: "Skills they want to use more",
  };

  let preferencesContext = "";
  if (careerPreferences && typeof careerPreferences === "object") {
    const lines = Object.entries(careerPreferences)
      .filter(([, values]) => Array.isArray(values) && values.length > 0)
      .map(([key, values]) => `${labelMap[key] || key}: ${values.join(", ")}`);

    if (lines.length > 0) {
      preferencesContext = `\n\nThe user has shared the following career preferences:\n${lines.join("\n")}\nUse these preferences to personalize your suggestions. Prioritize roles and paths that align with what they enjoy and their motivators. Avoid recommending paths that conflict with what they want to avoid.`;
    }
  }

  const finalSystem = (system || "") + preferencesContext;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system: finalSystem,
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Anthropic API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
