import React from 'react';
import styles from './ResultsTab.module.scss';

interface ResultsTabProps {
  data?: Array<Record<string, any>>;
  title?: string;
}

const ResultsTab: React.FC<ResultsTabProps> = ({ data, title }) => {
  if (!data || data.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.noData}>No results to display</p>
      </div>
    );
  }

  const columns = data[0] ? Object.keys(data[0]) : [];

  return (
    <div className={styles.container}>
      {title && <h3 className={styles.title}>{title}</h3>}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col) => (
                  <td key={col}>{row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTab;
