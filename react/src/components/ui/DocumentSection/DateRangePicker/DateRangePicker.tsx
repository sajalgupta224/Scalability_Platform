import React, { useState } from 'react';
import { Box, InputAdornment, Popover, Stack, TextField } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import dayjs from 'dayjs';
import type { DateRange } from '../../../../types/ui.types';

interface DateRangePickerProps {
  label: string;
  value: DateRange;
  onChange: (range: DateRange) => void;
  minDate?: Date;
  maxDate?: Date;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const handleFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = dayjs(event.target.value).toDate();
    onChange({ ...value, from: newFrom });
  };

  const handleToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = dayjs(event.target.value).toDate();
    onChange({ ...value, to: newTo });
  };

  const formatDateForInput = (date: Date): string => {
    return dayjs(date).format('YYYY-MM-DD');
  };

  const formatDateForDisplay = (date: Date): string => {
    return dayjs(date).format('DD/MM/YYYY');
  };

  const displayText = `${formatDateForDisplay(value.from)} - ${formatDateForDisplay(value.to)}`;

  return (
    <Box sx={{ width: '100%' }}>
      <TextField
        fullWidth
        label={label}
        value={displayText}
        onClick={handleClick}
        InputProps={{
          readOnly: true,
          endAdornment: (
            <InputAdornment position="end">
              <CalendarTodayIcon sx={{ color: '#757575', fontSize: 20 }} />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'white',
            borderRadius: '8px',
            cursor: 'pointer',
            '& fieldset': {
              borderColor: '#d0d0d0',
            },
            '&:hover fieldset': {
              borderColor: '#0F62FE',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#0F62FE',
              borderWidth: '2px',
            },
          },
          '& .MuiInputLabel-root': {
            paddingLeft: '4px',
            paddingRight: '4px',
            '&.Mui-focused': {
              color: '#0F62FE',
            },
          },
          '& .MuiInputBase-input': {
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 500,
          },
        }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            },
          },
        }}
      >
        <Box sx={{ p: 3, minWidth: 280 }}>
          <Stack spacing={2}>
            <Box>
              <TextField
                fullWidth
                type="date"
                label="From"
                value={formatDateForInput(value.from)}
                onChange={handleFromChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: minDate ? formatDateForInput(minDate) : undefined,
                  max: maxDate ? formatDateForInput(maxDate) : undefined,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                  },
                }}
              />
            </Box>
            <Box>
              <TextField
                fullWidth
                type="date"
                label="To"
                value={formatDateForInput(value.to)}
                onChange={handleToChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  min: minDate ? formatDateForInput(minDate) : undefined,
                  max: maxDate ? formatDateForInput(maxDate) : undefined,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                  },
                }}
              />
            </Box>
          </Stack>
        </Box>
      </Popover>
    </Box>
  );
};

export default DateRangePicker;
