import React, { useCallback } from 'react';
import { IconButton, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import bankingBot from '../../../assets/banking-bot.svg';
import styles from '../Experimentation.module.scss';

interface BotIntroSectionProps {
  chatbotName: string;
  isEditingName: boolean;
  tempChatbotName: string;
  isCreateMode: boolean;
  onStartEditing: () => void;
  onSaveName: () => void;
  onCancelEditing: () => void;
  onTempNameChange: (name: string) => void;
}

const BotIntroSection: React.FC<BotIntroSectionProps> = ({
  chatbotName,
  isEditingName,
  tempChatbotName,
  isCreateMode,
  onStartEditing,
  onSaveName,
  onCancelEditing,
  onTempNameChange,
}) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onSaveName();
      } else if (e.key === 'Escape') {
        onCancelEditing();
      }
    },
    [onSaveName, onCancelEditing]
  );

  return (
    <div className={styles.botSection}>
      <img src={bankingBot} alt="Banking bot" className={styles.botImage} />
      <div className={styles.botTitleWrapper}>
        {isEditingName ? (
          <>
            <input
              type="text"
              value={tempChatbotName}
              onChange={(e) => onTempNameChange(e.target.value)}
              className={styles.botTitleInput}
              autoFocus
              disabled={!isCreateMode}
              onKeyDown={handleKeyDown}
            />
            <IconButton size="small" onClick={onSaveName} className={styles.editIconButton}>
              <CheckIcon fontSize="small" />
            </IconButton>
          </>
        ) : (
          <>
            <Typography variant="h6" className={styles.botTitle}>
              {chatbotName}
            </Typography>
            <IconButton
              size="small"
              onClick={onStartEditing}
              className={styles.editIconButton}
              disabled={!isCreateMode}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </div>
      <Typography variant="body2" className={styles.botDescription}>
        Experiment with your bot – Your smart assistant!
        <br />
        Ask me anything
      </Typography>
    </div>
  );
};

export default React.memo(BotIntroSection);
