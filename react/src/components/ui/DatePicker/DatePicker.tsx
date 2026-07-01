import React from 'react';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import styles from './DatePicker.module.scss';

interface DatePickerProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  error = false,
  helperText,
}) => {
  return (
    <div className={styles.datePickerContainer}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <MuiDatePicker
          value={value}
          onChange={onChange}
          disabled={disabled}
          minDate={minDate}
          maxDate={maxDate}
          slotProps={{
            textField: {
              label,
              error,
              helperText,
              fullWidth: true,
              size: 'small',
              className: styles.textField,
            },
          }}
        />
      </LocalizationProvider>
    </div>
  );
};

export default DatePicker;
