import React, { useEffect, useState } from 'react';
import { Typography } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { useLocation } from 'react-router-dom';
import styles from '../Experimentation.module.scss';

interface ChatHeaderProps {
  modeDisplay: string;
}

const STORAGE_KEY = 'experimentation_opened_from';

const ChatHeader: React.FC<ChatHeaderProps> = ({ modeDisplay }) => {
  const location = useLocation();
  const [isDeployedFlow, setIsDeployedFlow] = useState(false);

  useEffect(() => {
    const state = (location && (location.state as any)) || {};

    let deployed = false;

    if (state?.from === 'deployed' || state?.deployed === true || state?.source === 'deployed') {
      deployed = true;
      try {
        sessionStorage.setItem(STORAGE_KEY, 'deployed');
      } catch (e) {
      }
    } else if (state?.from === 'experiment' || state?.source === 'experiment') {
      deployed = false;
      try {
        sessionStorage.setItem(STORAGE_KEY, 'experiment');
      } catch (e) {}
    } else {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        deployed = stored === 'deployed';
      } catch (e) {
        deployed = false;
      }
    }

    setIsDeployedFlow(deployed);
  }, [location]);

  return (
    <div className={styles.headerSection}>
      <Typography variant="h5" className={styles.heading}>
        {modeDisplay}
      </Typography>
      <Typography variant="body2" className={styles.subHeading}>
        <DescriptionOutlinedIcon className={styles.icon} />
        {isDeployedFlow ? 'Deployed Application' : 'Experimentation'}
      </Typography>
    </div>
  );
};

export default React.memo(ChatHeader);
