import React from "react";
import "./TemplateCard.scss";

interface TemplateCardProps {
  title: string;
  description: string;
  details: string[];
  selected: boolean;
  onSelect: () => void;
  onInfo?: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  title,
  description,
  details,
  selected,
  onSelect,
  onInfo,
}) => {
  return (
    <div className={`template-card${selected ? " selected" : ""}`} onClick={onSelect}>
      {/* Select icon row */}
      <div className="template-card__select-icon">
        <span className={`template-card__select${selected ? " checked" : ""}`}>
          {selected ? "✔" : ""}
        </span>
      </div>

      {/* Content area */}
      <div className="template-card__content">
        <div className="template-card__header">
          <h3>{title}</h3>
          {onInfo && (
            <button
              className="template-card__info"
              onClick={(e) => {
                e.stopPropagation();
                onInfo();
              }}
            >
              i
            </button>
          )}
        </div>

        {/* 🔽 Scrollable body */}
        <div className="template-card__body">
          <div className="template-card__desc">{description}</div>
          <ul className="template-card__details">
            {details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TemplateCard;