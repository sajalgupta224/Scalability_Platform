
import React from "react";
import TemplateCard from "./TemplateCards/TemplateCard";
import type { Template } from "../../../types/templates.types";
import "./TemplateCards/TemplatesGrid.scss";

type Props = {
  templates: Template[];
};

function buildDetails(description: string) {
  if (!description) return [];
  const parts = description.split(".").map(s => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.map(p => p + ".") : [description];
}

const TemplatesGrid: React.FC<Props> = ({ templates }) => {
  if (!templates?.length) return <div>No templates found.</div>;

  return (
    <div className="templates-grid">
      {templates.map((t) => (
        <TemplateCard
          key={t.template_name}
          title={t.template_name}
          description={t.description}
          details={buildDetails(t.description)}
          selected={false}
          onSelect={() => {}}
          onInfo={() => {}}
        />
      ))}
    </div>
  );
};

export default TemplatesGrid;
