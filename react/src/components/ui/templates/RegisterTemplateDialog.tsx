
import React, { useState } from "react";
import type { RegisterTemplatePayload } from "../../../types/templates.types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: RegisterTemplatePayload) => Promise<void>;
};

const RegisterTemplateDialog: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [template_name, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ template_name, description });
      setTemplateName("");
      setDescription("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to register template");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="register-dialog">
        <h3>Register New Template</h3>
        <form onSubmit={handleSubmit}>
          <label>Template Name</label>
          <input
            type="text"
            value={template_name}
            onChange={(e) => setTemplateName(e.target.value)}
            required
          />
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
          />
          {error && <p className="error-text">{error}</p>}
          <div className="button-group">
            <button type="submit">{submitting ? "Registering…" : "Register"}</button>
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterTemplateDialog;
