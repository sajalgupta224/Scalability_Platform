
import React from "react";
import type { Template } from "../../../types/templates.types";

type Props = {
  templates: Template[];
  loading?: boolean;
  error?: string | null;
};

const TemplateList: React.FC<Props> = ({ templates, loading, error }) => {
  if (loading) return <p>Loading templates…</p>;
  if (error) return <p>Error: {error}</p>;
  if (!templates?.length) return <p>No templates found.</p>;

  return (
    <table className="templates-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {templates.map((t, idx) => (
          <tr key={idx}>
            <td>{t.template_name}</td>
            <td>{t.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default TemplateList;
