import React from 'react';
import styles from './SQLTab.module.scss';

interface SQLTabProps {
  query?: string;
  queryId?: string;
}

const SQLTab: React.FC<SQLTabProps> = ({ query, queryId }) => {
  if (!query) {
    return (
      <div className={styles.container}>
        <p className={styles.noData}>No SQL query to display</p>
      </div>
    );
  }

  const highlightSQL = (sql: string): string => {
    // SQL Keywords (magenta/pink)
    const keywords = [
      'SELECT',
      'FROM',
      'WHERE',
      'GROUP BY',
      'ORDER BY',
      'WITH',
      'AS',
      'AND',
      'OR',
      'IN',
      'NOT',
      'HAVING',
      'JOIN',
      'LEFT',
      'RIGHT',
      'INNER',
      'OUTER',
      'ON',
      'LIMIT',
      'OFFSET',
      'DISTINCT',
      'CASE',
      'WHEN',
      'THEN',
      'ELSE',
      'END',
      'NULLS',
      'LAST',
      'FIRST',
      'ASC',
      'DESC',
      'CURRENT_DATE',
      'BY',
    ];

    // Aggregate functions (blue)
    const aggregateFunctions = ['MIN', 'MAX', 'COUNT', 'SUM', 'AVG'];

    let highlighted = sql;

    // First, highlight table names with dots (yellowish/orange)
    highlighted = highlighted.replace(
      /\b([a-z_]+\.[a-z_]+\.[a-z_]+)\b/gi,
      `<span class="${styles.tableName}">$1</span>`
    );

    // Highlight aggregate functions (blue)
    aggregateFunctions.forEach((func) => {
      const regex = new RegExp(`\\b(${func})\\b`, 'gi');
      highlighted = highlighted.replace(
        regex,
        `<span class="${styles.aggregateFunction}">$1</span>`
      );
    });

    // Highlight SQL keywords (magenta/pink)
    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
      highlighted = highlighted.replace(regex, `<span class="${styles.keyword}">$1</span>`);
    });

    return highlighted;
  };

  return (
    <div className={styles.container}>
      {queryId && <div className={styles.queryId}>Query ID: {queryId}</div>}
      <div className={styles.codeWrapper}>
        <pre className={styles.codeBlock}>
          <code dangerouslySetInnerHTML={{ __html: highlightSQL(query) }} />
        </pre>
      </div>
    </div>
  );
};

export default SQLTab;
