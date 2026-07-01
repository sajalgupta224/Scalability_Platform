// src/api/endpoints/models.api.ts

type ModelsResponse = {
  success: boolean;
  message?: string;
  data: string[];
};

const API_BASE = 'http://localhost:5000';

export const ModelsAPI = {
  getModels: async (): Promise<string[]> => {
    const resp = await fetch(`${API_BASE}/api/models`);

    // If backend is down / CORS blocked, fetch throws before here
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Models API failed: HTTP ${resp.status} ${text}`);
    }

    const body: ModelsResponse = await resp.json();

    if (!body.success) {
      throw new Error(body.message || 'Models API returned success=false');
    }

    const models = Array.isArray(body.data) ? body.data : [];
    // normalize + dedupe
    return Array.from(new Set(models.map(String).map((s) => s.trim()).filter(Boolean)));
  },
};
