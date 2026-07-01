import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Box } from '@mui/material';
import type { ConfigurationRow } from '../../../types/pipeline';
import styles from './ConfigurationDisplay.module.scss';

interface ConfigurationTableProps {
  rows: ConfigurationRow[];
}

const ConfigurationTable: React.FC<ConfigurationTableProps> = ({ rows }) => {
  return (
    <TableContainer className={styles.tableContainer}>
      <Table>
        <TableHead>
          <TableRow className={styles.tableHeader}>
            <TableCell className={styles.serialCell}>S.no</TableCell>
            <TableCell className={styles.fieldCell}>Field</TableCell>
            <TableCell className={styles.valueCell}>Value</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index} className={styles.tableRow}>
              <TableCell className={styles.serialCell}>{index + 1}</TableCell>
              <TableCell className={styles.fieldCell}>{row.field}</TableCell>
              <TableCell className={styles.valueCell}>
                <Box className={styles.valueContent}>
                  {row.icon && <Box className={styles.icon}>{row.icon}</Box>}
                  <span>{row.value}</span>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ConfigurationTable;
