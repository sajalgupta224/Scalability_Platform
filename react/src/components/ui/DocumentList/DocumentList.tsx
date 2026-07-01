
import React from "react";
import { Box, Typography, IconButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import styles from "./DocumentList.module.scss";

interface DocumentListProps {
  documents: string[];
  onEdit: (doc: string) => void;
  onDelete: (doc: string) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ documents, onEdit, onDelete }) => {
  return (
    <Box className={styles.docList}>
      <Typography variant="subtitle1">Document lists</Typography>
      {documents.map((doc, idx) => (
        <Box key={idx} className={styles.docItem}>
          <Typography>{doc}</Typography>
          <IconButton onClick={() => onEdit(doc)}><EditIcon /></IconButton>
          <IconButton onClick={() => onDelete(doc)}><DeleteIcon /></IconButton>
        </Box>
      ))}
    </Box>
  );
};

export default DocumentList;
