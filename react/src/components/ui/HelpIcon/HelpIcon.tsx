import React from 'react';
import styles from './HelpIcon.module.scss';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import { Tooltip } from '@mui/material';

export interface HelpIconProps {
  tooltip: string;
}

const HelpIcon: React.FC<HelpIconProps> = ({ tooltip }) => {
  return (
    <Tooltip title={tooltip} arrow placement="top">
      <div className={styles.iconWrapper}>
        <HelpOutlineOutlinedIcon className={styles.icon} />
      </div>
    </Tooltip>
  );
};

export default HelpIcon;
