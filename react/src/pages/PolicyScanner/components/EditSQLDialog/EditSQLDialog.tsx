import React, { useEffect, useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import Dialog from '../../../../components/ui/Dialog/Dialog';

interface EditSQLDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (sql: string) => void;
  initialSQL?: string;
  policyId?: string | number;
}

const EditSQLDialog: React.FC<EditSQLDialogProps> = ({
  open,
  onClose,
  onConfirm,
  initialSQL = '',
  policyId,
}) => {
  const [sql, setSQL] = useState<string>(initialSQL);

  useEffect(() => {
    if (open) {
      setSQL(initialSQL);
    }
  }, [open, initialSQL]);

  const handleConfirm = () => {
    onConfirm(sql);
  };

  const handleClose = () => {
    setSQL(initialSQL);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={`Edit Generated SQL${policyId ? ` - Policy ${policyId}` : ''}`}
      maxWidth="md"
      actions={
        <>
          <Button onClick={handleClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirm} variant="contained">
            Save
          </Button>
        </>
      }
    >
      <Box sx={{ pt: 1 }}>
        <TextField
          fullWidth
          label="Generated SQL"
          placeholder="Enter SQL..."
          value={sql}
          onChange={(e) => setSQL(e.target.value)}
          variant="outlined"
          multiline
          minRows={6}
          maxRows={12}
          autoFocus
          sx={{
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
              fontSize: '14px',
            },
          }}
        />
      </Box>
    </Dialog>
  );
};

export default EditSQLDialog;
