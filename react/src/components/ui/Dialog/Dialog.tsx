import React from 'react';
import {
  Dialog as MuiDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  type DialogProps as MuiDialogProps,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import styles from './Dialog.module.scss';

export interface DialogProps extends Omit<MuiDialogProps, 'title'> {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
  hideTitle?: boolean;
  centered?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const Dialog: React.FC<DialogProps> = ({
  title,
  children,
  actions,
  onClose,
  showCloseButton = true,
  hideTitle = false,
  centered = false,
  maxWidth = 'sm',
  ...props
}) => {
  return (
    <MuiDialog
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={{
        className: styles.dialogPaper,
      }}
      {...props}
    >
      {!hideTitle && title && (
        <DialogTitle className={`${styles.dialogTitle} ${centered ? styles.centeredTitle : ''}`}>
          {title}
          {showCloseButton && (
            <IconButton
              aria-label="close"
              onClick={onClose}
              className={styles.closeButton}
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
      )}
      {hideTitle && showCloseButton && (
        <IconButton
          aria-label="close"
          onClick={onClose}
          className={styles.closeButtonOnly}
        >
          <CloseIcon />
        </IconButton>
      )}
      <DialogContent className={`${styles.dialogContent} ${centered ? styles.centeredContent : ''}`}>
        {children}
      </DialogContent>
      {actions && (
        <DialogActions className={styles.dialogActions}>
          {actions}
        </DialogActions>
      )}
    </MuiDialog>
  );
};

export default Dialog;
