
/**
 * DocumentSection.tsx
 * Renders inline rows for referred documents (pdf, txt, doc, docx):
 * [ small doc icon ] [ filename (inline text, subtle hover) ]           [ small ↗ icon ]
 */

import React from 'react';
import { Box } from '@mui/material';
import styles from './DocumentSection.module.scss';
import pdfIcon from '../../../assets/document.svg';         // Red "PDF" badge
import docIcon from '../../../assets/document-doc.svg';     // Blue "DOC" badge
import txtIcon from '../../../assets/document-txt.svg';     // Gray "TXT" badge
import linkIcon from '../../../assets/open-link.svg';       // 16px external-link icon
import type { Document } from '../../../types/ui.types';

interface DocumentSectionProps {
  documents: Document[]; // may (or may not) include relativePath
}

const API_BASE = 'http://localhost:5000';

/**
 * Returns the appropriate icon based on file extension.
 * - .doc / .docx → blue DOC icon
 * - .txt → gray TXT icon
 * - .pdf and everything else → red PDF icon
 */
const getDocIcon = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'doc':
    case 'docx':
      return docIcon;
    case 'txt':
      return txtIcon;
    default:
      return pdfIcon;
  }
};

const DocumentSection: React.FC<DocumentSectionProps> = ({ documents }) => {
  const downloadDoc = async (doc: Document & { relativePath?: string }) => {
    try {
      const url = doc.name
        ? `${API_BASE}/api/response?download=1&name=${encodeURIComponent(doc.name)}`
        : `${API_BASE}/api/response?download=1&path=${encodeURIComponent(doc.relativePath ?? '')}`;

      const resp = await fetch(url, { method: 'GET' });
      if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);

      const cd = resp.headers.get('Content-Disposition') || '';
      const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(cd);
      const filename = match?.[1] ? decodeURIComponent(match[1]) : (doc.name || 'download.bin');

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('Download error:', e);
      alert('Failed to download file. Please try again.');
    }
  };

  return (
    <Box className={styles.documentSection}>
      <h6 className={styles.heading}>Referred documents</h6>

      {documents.length === 0 ? (
        <div className={styles.emptyState}>No citations for this document yet.</div>
      ) : (
        <div className={styles.documentList}>
          {documents.map((doc, idx) => (
            <div key={`${doc.name}-${idx}`} className={styles.docItem}>
              {/* Left: icon + clickable filename (inline) */}
              <div className={styles.docContent}>
                {/* small icon based on file type */}
                <span className={styles.iconWrapper}>
                  <img src={getDocIcon(doc.name)} alt="" className={styles.pdfIcon} aria-hidden="true" />
                </span>

                {/* filename as inline text with hover/focus styles */}
                <button
                  className={styles.docText}
                  title={doc.name}
                  type="button"
                  onClick={() => downloadDoc(doc)}
                  aria-label={`Download ${doc.name}`}
                >
                  {doc.name}
                </button>
              </div>

              {/* Right: external-link icon (same action by default) */}
              <div className={styles.actionButtons}>
                <span className={styles.iconWrapper}>
                  <button
                    className={styles.iconButton}
                    aria-label={`Open ${doc.name}`}
                    type="button"
                    onClick={() => downloadDoc(doc)}
                  >
                    <img src={linkIcon} alt="" aria-hidden="true" />
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Box>
   );
};

export default DocumentSection;
