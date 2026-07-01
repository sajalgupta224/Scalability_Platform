import React from 'react';
import styles from './RadioCard.module.scss';
import { Radio } from '@mui/material';

export interface RadioCardProps {
  name: string;
  label: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  icon: React.ComponentType<{ className?: string }>;
}

const RadioCard: React.FC<RadioCardProps> = ({
  name,
  label,
  value,
  checked,
  onChange,
  icon: Icon,
}) => {
  const handleSelect = () => onChange(value);

  return (
    <div
      className={`${styles.card} ${checked ? styles.checked : ''}`}
      role="radio"
      aria-checked={checked}
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={e => {
        if (e.key === ' ' || e.key === 'Enter') handleSelect();
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={handleSelect}
        className={styles.nativeRadio}
      />

      <div className={styles.leftSection}>
        <Radio checked={checked} className={styles.muiRadio} />
        <span className={styles.label}>{label}</span>
      </div>

      <div className={styles.iconWrap}>
        <Icon className={styles.icon} />
      </div>
    </div>
  );
};

export default RadioCard;
