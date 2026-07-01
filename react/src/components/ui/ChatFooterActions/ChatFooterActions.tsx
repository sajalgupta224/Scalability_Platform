
import React, { useState } from 'react';
import { IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined';
import styles from './ChatFooterActions.module.scss';

export type DownloadFormat = 'pdf' | 'docx' | 'doc' | 'txt';

interface ChatFooterActionsProps {
  onCopy?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  onDownload?: (format: DownloadFormat) => void;
  disableDownload?: boolean;
}

const ChatFooterActions: React.FC<ChatFooterActionsProps> = ({
  onCopy,
  onLike,
  onDislike,
  onDownload,
  disableDownload = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleDownloadClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleFormatSelect = (format: DownloadFormat) => {
    handleMenuClose();
    onDownload?.(format);
  };

  return (
    <div className={styles.footerActions}>
      <Tooltip title="Copy">
        <span>
          <IconButton size="small" onClick={onCopy} aria-label="copy-response">
            <ContentCopyOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Download">
        <span>
          <IconButton
            size="small"
            onClick={handleDownloadClick}
            aria-label="download-response"
            disabled={disableDownload}
          >
            <DownloadOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => handleFormatSelect('pdf')}>
          <ListItemIcon>
            <PictureAsPdfOutlinedIcon fontSize="small" sx={{ color: '#d32f2f' }} />
          </ListItemIcon>
          <ListItemText>PDF</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFormatSelect('docx')}>
          <ListItemIcon>
            <DescriptionOutlinedIcon fontSize="small" sx={{ color: '#1565c0' }} />
          </ListItemIcon>
          <ListItemText>DOCX</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFormatSelect('doc')}>
          <ListItemIcon>
            <DescriptionOutlinedIcon fontSize="small" sx={{ color: '#1565c0' }} />
          </ListItemIcon>
          <ListItemText>DOC</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleFormatSelect('txt')}>
          <ListItemIcon>
            <TextSnippetOutlinedIcon fontSize="small" sx={{ color: '#424242' }} />
          </ListItemIcon>
          <ListItemText>TXT</ListItemText>
        </MenuItem>
      </Menu>

      <Tooltip title="Like">
        <span>
          <IconButton size="small" onClick={onLike} aria-label="like-response">
            <ThumbUpOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Dislike">
        <span>
          <IconButton size="small" onClick={onDislike} aria-label="dislike-response">
            <ThumbDownOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </div>
  );
};

export default ChatFooterActions;
