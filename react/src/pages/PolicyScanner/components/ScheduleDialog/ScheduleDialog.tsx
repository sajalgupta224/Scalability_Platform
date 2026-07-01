import React, { useEffect, useState } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import Dialog from '../../../../components/ui/Dialog/Dialog';
import DateRangePicker from '../../../../components/ui/DateRangePicker/DateRangePicker';
import type { DateRange } from '../../../../types/ui.types';
import styles from './ScheduleDialog.module.scss';

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { frequency: string; dateRange: DateRange }) => void;
  initialData?: {
    frequency?: string;
    dateRange?: DateRange;
  };
}

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({
  open,
  onClose,
  onConfirm,
  initialData,
}) => {
  const [frequency, setFrequency] = useState(initialData?.frequency || '');
  const [dateRange, setDateRange] = useState<DateRange>(
    initialData?.dateRange || { from: new Date(), to: new Date() }
  );

  const frequencies = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

  useEffect(() => {
    if (open) {
      setFrequency(initialData?.frequency || '');
      setDateRange(initialData?.dateRange || { from: new Date(), to: new Date() });
    }
  }, [open, initialData]);

  const handleConfirm = () => {
    onConfirm({ frequency, dateRange });
    onClose();
  };

  const isFormValid = frequency && dateRange.from && dateRange.to;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Schedule"
      maxWidth="lg"
      centered
      actions={
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!isFormValid}
          className={styles.confirmButton}
        >
          Confirm
        </Button>
      }
    >
      <Box className={styles.dialogContent}>
        <Box className={styles.fieldRow}>
          <Box className={styles.fieldWrapper}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="frequency-label">Select frequency*</InputLabel>
              <Select
                labelId="frequency-label"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                label="Select frequency*"
                className={styles.select}
              >
                {frequencies.map((freq) => (
                  <MenuItem key={freq} value={freq}>
                    {freq}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box className={styles.fieldWrapper}>
            <DateRangePicker
              label="Select start and end date*"
              value={dateRange}
              onChange={setDateRange}
            />
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};

export default ScheduleDialog;
