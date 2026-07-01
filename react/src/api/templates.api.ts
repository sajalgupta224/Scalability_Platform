
import type { RegisterTemplatePayload, Template } from "../types/templates.types";

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch("/api/templates");
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

export async function registerTemplate(payload: RegisterTemplatePayload): Promise<any> {
  const res = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Failed to register template");
  }

  return res.json();
}
``
