import React, { useMemo, useState } from 'react';
import {
  Box,
  FormControl,
  InputAdornment,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  type SelectChangeEvent,
  TextField,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import type { DropdownOption } from '../../../types/ui.types';
import styles from './Dropdown.module.scss';

interface BaseDropdownProps {
  label: string;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  startIcon?: React.ReactNode;
  optionTooltips?: Record<string, string>;
}

interface SingleSelectProps extends BaseDropdownProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

interface MultiSelectProps extends BaseDropdownProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

type DropdownProps = SingleSelectProps | MultiSelectProps;

const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  multiple = false,
  searchable = false,
  startIcon,
  optionTooltips,
}) => {
  const [searchText, setSearchText] = useState('');

  const handleChange = (event: SelectChangeEvent<string | string[]>) => {
    const newValue = event.target.value;
    if (multiple) {
      (onChange as (value: string[]) => void)(newValue as string[]);
    } else {
      (onChange as (value: string) => void)(newValue as string);
    }
  };

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchText) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(searchText.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [options, searchText, searchable]);

  return (
    <div className={styles.dropdown}>
      <FormControl fullWidth variant="outlined" disabled={disabled}>
        <InputLabel id={`${label}-label`} shrink>{label}</InputLabel>
        <Select
          labelId={`${label}-label`}
          value={value}
          onChange={handleChange}
          label={label}
          className={styles.select}
          multiple={multiple}
          displayEmpty
          notched
          onClose={() => setSearchText('')}
          startAdornment={
            startIcon ? (
              <InputAdornment position="start" sx={{ mr: 0.5 }}>
                {startIcon}
              </InputAdornment>
            ) : undefined
          }
          MenuProps={
            searchable
              ? {
                  autoFocus: false,
                  PaperProps: {
                    sx: { maxHeight: 350 },
                  },
                }
              : undefined
          }
          renderValue={
            multiple
              ? (selected) => {
                  const selectedArr = selected as string[];
                  if (selectedArr.length === 0) {
                    return <span style={{ color: '#999' }}>{placeholder}</span>;
                  }
                  return (
                    <Box
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selectedArr.join(', ')}
                    </Box>
                  );
                }
              : (selected) => {
                  if (!selected) {
                    return <span style={{ color: '#999' }}>{placeholder}</span>;
                  }
                  const option = options.find((opt) => opt.value === selected);
                  return option ? option.label : selected;
                }
          }
        >
          {searchable && (
            <ListSubheader sx={{ p: 1 }}>
              <TextField
                size="small"
                autoFocus
                placeholder="Search..."
                fullWidth
                value={searchText}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </ListSubheader>
          )}
          {!multiple && !value && placeholder && (
            <MenuItem value="" disabled>
              {placeholder}
            </MenuItem>
          )}
          {filteredOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{option.label}</span>
                {optionTooltips && optionTooltips[option.value] ? (
                  <Tooltip title={optionTooltips[option.value]} arrow>
                    <HelpOutlineIcon fontSize="small" />
                  </Tooltip>
                ) : null}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

export default Dropdown;