
import React, { useEffect, useState } from "react";
import RegisterTemplateDialog from "../../components/ui/templates/RegisterTemplateDialog";
import TemplatesGrid from "../../components/ui/templates/TemplatesGrid";
import { TemplatesAPI } from "../../api/endpoints/templates.api";
import type { RegisterTemplatePayload, Template } from "../../types/templates.types";
import "./Templates.scss";

const TemplatesPage: React.FC = () => {
  const [openRegister, setOpenRegister] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await TemplatesAPI.getTemplates();
      setTemplates(data || []);
    } catch (error) {
      // ✅ apiClient already shows notification
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleRegister = async (payload: RegisterTemplatePayload) => {
    await TemplatesAPI.registerTemplate({
      template_name: payload.template_name.trim(),
      description: payload.description.trim(),
    });
    await loadTemplates();
  };

  return (
    <div className="templates-page">
      <h2 className="templates-title">Registered Templates</h2>
      <div className="templates-help">Use Cases</div>

      {loading && <div>Loading templates...</div>}

      <TemplatesGrid templates={templates} />

      <div className="templates-actions">
        <button
          className="templates-btn primary"
          onClick={() => setOpenRegister(true)}
        >
          Register New Template
        </button>
      </div>

      {openRegister && (
        <RegisterTemplateDialog
          open={openRegister}
          onClose={() => setOpenRegister(false)}
          onSubmit={async (p) => {
            await handleRegister(p);
            setOpenRegister(false);
          }}
        />
      )}
    </div>
  );
};

export default TemplatesPage;
