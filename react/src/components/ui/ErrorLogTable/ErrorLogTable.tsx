import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import type { ErrorLogEntry } from '../../../types/errors.types';
import styles from './ErrorLogTable.module.scss';

interface ErrorLogTableProps {
  data: ErrorLogEntry[];
}

const ErrorLogTable: React.FC<ErrorLogTableProps> = ({ data }) => {
  return (
    <div className={styles.tableWrapper}>
      <TableContainer component={Paper} className={styles.tableContainer}>
        <Table className={styles.table}>
          <TableHead>
            <TableRow>
              <TableCell className={styles.headerCell}>S.no</TableCell>
              <TableCell className={styles.headerCell}>Event type</TableCell>
              <TableCell className={styles.headerCell}>Error message</TableCell>
              <TableCell className={styles.headerCell}>Context</TableCell>
              <TableCell className={styles.headerCell}>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index} className={styles.tableRow}>
                <TableCell className={styles.tableCell}>{row.sno}</TableCell>
                <TableCell className={styles.tableCell}>{row.eventType}</TableCell>
                <TableCell className={styles.tableCell}>
                  <div className={styles.errorMessage}>{row.errorMessage}</div>
                </TableCell>
                <TableCell className={styles.tableCell}>{row.context}</TableCell>
                <TableCell className={styles.tableCell}>{row.date}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default ErrorLogTable;
