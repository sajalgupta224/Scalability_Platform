import React, { useRef, useState, useEffect } from 'react';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import MicIcon from '@mui/icons-material/Mic';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import styles from './ChatInput.module.scss';

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isRunning?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onFileSelect?: (file: File) => void;
  uploadedFileName?: string;
  uploadedFilePreviewUrl?: string | null;
  onClearFile?: () => void;
  isUploading?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onStop,
  isRunning = false,
  placeholder = "Message to Raise",
  disabled = false,
  onFileSelect,
  uploadedFileName,
  uploadedFilePreviewUrl,
  onClearFile,
  isUploading = false,
}) => {
  const docInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) onChange(transcript);
  }, [transcript]);

  const menuOpen = Boolean(menuAnchor);

  const isImageFile = (fileName?: string): boolean => {
    if (!fileName) return false;
    const ext = fileName.toLowerCase().split('.').pop() || '';
    return ['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'gif', 'webp'].includes(ext);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      onSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!onFileSelect || isUploading) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          onFileSelect(file);
        }
        return;
      }
    }
  };

  const handlePlusClick = (e: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleUploadDocument = () => {
    handleMenuClose();
    docInputRef.current?.click();
  };

  const handleUploadImage = () => {
    handleMenuClose();
    imgInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
    // Reset so the same file can be re-selected
    if (e.target) {
      e.target.value = '';
    }
  };

  const startListening = () => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
  };

  const handleSend = () => {
    onSend();
    resetTranscript();
  };

  const handleStopExecution = () => {
    stopListening();
    if (onStop) onStop();
  };

  return (
    <div className={styles.chatInputWrapper}>
      {/* File preview inside the input box */}
      {(uploadedFileName || isUploading) && (
        <div className={styles.filePreviewArea}>
          <div className={styles.filePreviewChip}>
            {uploadedFilePreviewUrl && isImageFile(uploadedFileName) ? (
              <img
                src={uploadedFilePreviewUrl}
                alt={uploadedFileName}
                className={styles.filePreviewThumb}
              />
            ) : (
              <span className={styles.filePreviewDocIcon}>
                <DescriptionOutlinedIcon />
              </span>
            )}
            {uploadedFileName && (
              <span className={styles.filePreviewName}>{uploadedFileName}</span>
            )}
            {onClearFile && !isUploading && (
              <IconButton
                className={styles.filePreviewClose}
                onClick={onClearFile}
                size="small"
              >
                <CloseIcon />
              </IconButton>
            )}
            {isUploading && (
              <div className={styles.uploadingOverlay}>
                <CircularProgress size={20} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input row with + button, text input, send button */}
      <div className={styles.inputRow}>
        {onFileSelect && (
          <>
            <IconButton
              className={styles.attachButton}
              onClick={handlePlusClick}
              disabled={disabled || isUploading}
              title="Add content"
            >
              <AddIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={handleMenuClose}
              anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              slotProps={{
                paper: {
                  sx: {
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                    minWidth: 200,
                  },
                },
              }}
            >
              <MenuItem onClick={handleUploadDocument} className={styles.menuItem}>
                <ListItemIcon>
                  <DescriptionOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Upload Document</ListItemText>
              </MenuItem>
              <MenuItem onClick={handleUploadImage} className={styles.menuItem}>
                <ListItemIcon>
                  <ImageOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Upload Image</ListItemText>
              </MenuItem>
            </Menu>
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <input
              ref={imgInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.tiff,.bmp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </>
        )}
        <div className={styles.inputArea}>
          <input
            type="text"
            className={styles.input}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
            disabled={disabled || isRunning}
          />
        </div>
        {browserSupportsSpeechRecognition && (
          <IconButton
            className={styles.micButton}
            disabled={disabled || isRunning}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onMouseLeave={stopListening}
            onTouchStart={startListening}
            onTouchEnd={stopListening}
          >
            {listening ? <StopIcon color="error" /> : <MicIcon color="primary" />}
          </IconButton>
        )}
        <IconButton
          className={styles.sendButton}
          disabled={disabled && !isRunning}
          onClick={isRunning ? handleStopExecution : handleSend}
        >
          {isRunning ? <StopIcon color="error" /> : <SendIcon />}
        </IconButton>
      </div>
    </div>
  );
};

export default ChatInput;
