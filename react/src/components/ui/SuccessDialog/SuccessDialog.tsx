import React from 'react';
import { Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Dialog from '../Dialog/Dialog';
import styles from './SuccessDialog.module.scss';

interface SuccessDialogProps {
  open: boolean;
  onClose: () => void;
  message: string;
  subMessage?: string;
  buttonText?: string;
}

const SuccessDialog: React.FC<SuccessDialogProps> = ({
  open,
  onClose,
  message,
  subMessage,
  buttonText = 'Done',
}) => {
  const dialogActions = (
    <Button
      variant="contained"
      onClick={onClose}
      className={styles.doneButton}
      fullWidth
    >
      {buttonText}
    </Button>
  );

  return (
    <Dialog
      open={open}
      title="Success"
      onClose={onClose}
      centered={true}
      actions={dialogActions}
      maxWidth="xs"
    >
      <div className={styles.successContent}>
        <div className={styles.iconWrapper}>
          <CheckCircleIcon className={styles.successIcon} />
        </div>
        <div className={styles.messageContainer}>
          <h2 className={styles.mainMessage}>{message}</h2>
          {subMessage && (
            <p className={styles.subMessage}>{subMessage}</p>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export default SuccessDialog;
