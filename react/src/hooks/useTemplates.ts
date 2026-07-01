
import { useCallback, useState } from "react";
import type { Template, RegisterTemplatePayload } from "../types/templates.types";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:5000";

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/templates`); // ✅ Correct GET endpoint
      if (!res.ok) throw new Error(`Failed to fetch templates: ${res.statusText}`);
      const data: Template[] = await res.json();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  // Register a new template
  const registerTemplate = useCallback(async (payload: RegisterTemplatePayload) => {
    const res = await fetch(`${API_BASE}/api/templates`, { // ✅ Correct POST endpoint
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to register template: ${res.statusText}`);
    const created: Template = await res.json();
    setTemplates((prev) => [created, ...prev]);
    return created;
  }, []);

  return { templates, loading, error, fetchTemplates, registerTemplate };
}
