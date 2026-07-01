import React, { useEffect, useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import Dialog from '../../../../components/ui/Dialog/Dialog';

interface AddNewRuleDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (description: string) => void;
}

const AddNewRuleDialog: React.FC<AddNewRuleDialogProps> = ({ open, onClose, onConfirm }) => {
  const [policyDescription, setPolicyDescription] = useState<string>('');

  useEffect(() => {
    if (open) {
      setPolicyDescription('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (policyDescription.trim()) {
      onConfirm(policyDescription.trim());
      setPolicyDescription('');
    }
  };

  const handleClose = () => {
    setPolicyDescription('');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add New Rule"
      maxWidth="sm"
      actions={
        <>
          <Button onClick={handleClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirm} variant="contained" disabled={!policyDescription.trim()}>
            Confirm
          </Button>
        </>
      }
    >
      <Box sx={{ pt: 1 }}>
        <TextField
          fullWidth
          label="Policy Description"
          placeholder="Enter policy description..."
          value={policyDescription}
          onChange={(e) => setPolicyDescription(e.target.value)}
          variant="outlined"
          multiline
          minRows={1}
          maxRows={1}
          autoFocus
        />
      </Box>
    </Dialog>
  );
};

export default AddNewRuleDialog;
