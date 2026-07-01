import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import Dialog from '../../../../components/ui/Dialog/Dialog';
import { SnowflakeMappingAPI } from '../../../../api/endpoints/policyScanner.api';
import styles from './EditTargetTableDialog.module.scss';

interface EditTargetTableDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { database: string; schema: string; table: string }) => void;
  initialData?: {
    database?: string;
    schema?: string;
    table?: string;
  };
  isConfirming?: boolean;
}

const EditTargetTableDialog: React.FC<EditTargetTableDialogProps> = ({
  open,
  onClose,
  onConfirm,
  initialData,
  isConfirming = false,
}) => {
  const [database, setDatabase] = useState(initialData?.database || '');
  const [schema, setSchema] = useState(initialData?.schema || '');
  const [table, setTable] = useState(initialData?.table || '');

  // Dropdown data state
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);

  // Loading states
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [isLoadingSchemas, setIsLoadingSchemas] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setDatabase(initialData?.database || '');
      setSchema(initialData?.schema || '');
      setTable(initialData?.table || '');
      // Clear schemas and tables when reopening
      if (!initialData?.database) {
        setSchemas([]);
        setTables([]);
      }
    }
  }, [open, initialData]);

  // Fetch databases when dialog opens
  useEffect(() => {
    const fetchDatabases = async () => {
      if (!open) {
        return;
      }

      setIsLoadingDatabases(true);
      try {
        const response = await SnowflakeMappingAPI.getDatabases();
        if (response.success) {
          setDatabases(response.databases);
        }
      } catch (error) {
        console.error('Error fetching databases:', error);
      } finally {
        setIsLoadingDatabases(false);
      }
    };

    fetchDatabases();
  }, [open]);

  // Fetch schemas when database is selected
  useEffect(() => {
    const fetchSchemas = async () => {
      if (!database) {
        setSchemas([]);
        setSchema('');
        setTables([]);
        setTable('');
        return;
      }

      setIsLoadingSchemas(true);
      try {
        const response = await SnowflakeMappingAPI.getSchemas(database);
        if (response.success) {
          setSchemas(response.schemas);
        }
      } catch (error) {
        console.error('Error fetching schemas:', error);
      } finally {
        setIsLoadingSchemas(false);
      }
    };

    fetchSchemas();
  }, [database]);

  // Fetch tables when schema is selected
  useEffect(() => {
    const fetchTables = async () => {
      if (!database || !schema) {
        setTables([]);
        setTable('');
        return;
      }

      setIsLoadingTables(true);
      try {
        const response = await SnowflakeMappingAPI.getTables(database, schema);
        if (response.success) {
          setTables(response.tables);
        }
      } catch (error) {
        console.error('Error fetching tables:', error);
      } finally {
        setIsLoadingTables(false);
      }
    };

    fetchTables();
  }, [database, schema]);

  // Handle database change - reset schema and table
  const handleDatabaseChange = (value: string) => {
    setDatabase(value);
    setSchema('');
    setTable('');
  };

  // Handle schema change - reset table
  const handleSchemaChange = (value: string) => {
    setSchema(value);
    setTable('');
  };

  const handleConfirm = () => {
    onConfirm({ database, schema, table });
  };

  const isFormValid = database && schema && table && !isConfirming;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit target table details"
      maxWidth="lg"
      centered
      actions={
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!isFormValid}
          className={styles.confirmButton}
        >
          {isConfirming ? <CircularProgress size={20} color="inherit" /> : 'Confirm'}
        </Button>
      }
    >
      <Box className={styles.dialogContent}>
        <Box className={styles.fieldRow}>
          <Box className={styles.fieldWrapper}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="database-label">Select database*</InputLabel>
              <Select
                labelId="database-label"
                value={database}
                onChange={(e) => handleDatabaseChange(e.target.value)}
                label="Select database*"
                className={styles.select}
                disabled={isLoadingDatabases}
              >
                <MenuItem value="">
                  <em>{isLoadingDatabases ? 'Loading...' : 'Database name'}</em>
                </MenuItem>
                {databases.map((db) => (
                  <MenuItem key={db} value={db}>
                    {db}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box className={styles.fieldWrapper}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="schema-label">Select schema*</InputLabel>
              <Select
                labelId="schema-label"
                value={schema}
                onChange={(e) => handleSchemaChange(e.target.value)}
                label="Select schema*"
                className={styles.select}
                disabled={!database || isLoadingSchemas}
              >
                <MenuItem value="">
                  <em>{isLoadingSchemas ? 'Loading...' : 'Schema name'}</em>
                </MenuItem>
                {schemas.map((sch) => (
                  <MenuItem key={sch} value={sch}>
                    {sch}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Select the schema for the target table" placement="right">
              <IconButton size="small" className={styles.helpIcon}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box className={styles.fieldRow}>
          <Box className={styles.fieldWrapperFull}>
            <FormControl fullWidth variant="outlined">
              <InputLabel id="table-label">Select table*</InputLabel>
              <Select
                labelId="table-label"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                label="Select table*"
                className={styles.select}
                disabled={!database || !schema || isLoadingTables}
              >
                <MenuItem value="">
                  <em>{isLoadingTables ? 'Loading...' : 'Table name'}</em>
                </MenuItem>
                {tables.map((tbl) => (
                  <MenuItem key={tbl} value={tbl}>
                    {tbl}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Select the table for the target" placement="right">
              <IconButton size="small" className={styles.helpIcon}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
};

export default EditTargetTableDialog;
