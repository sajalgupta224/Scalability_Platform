import React, { useEffect, useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import Dialog from '../../../../components/ui/Dialog/Dialog';

interface EditFieldDialogProps {
  open: boolean;
  fieldLabel: string;
  currentValue: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

const EditFieldDialog: React.FC<EditFieldDialogProps> = ({
  open,
  fieldLabel,
  currentValue,
  onClose,
  onConfirm,
}) => {
  const [value, setValue] = useState<string>('');

  useEffect(() => {
    if (open) {
      setValue(currentValue || '');
    }
  }, [open, currentValue]);

  const handleConfirm = () => {
    onConfirm(value.trim());
    setValue('');
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={`Edit ${fieldLabel}`}
      maxWidth="sm"
      actions={
        <>
          <Button onClick={handleClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirm} variant="contained">
            Update
          </Button>
        </>
      }
    >
      <Box sx={{ pt: 1 }}>
        <TextField
          fullWidth
          label={fieldLabel}
          placeholder={`Enter ${fieldLabel.toLowerCase()}...`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          variant="outlined"
          multiline
          minRows={2}
          maxRows={6}
          autoFocus
        />
      </Box>
    </Dialog>
  );
};

export default EditFieldDialog;
