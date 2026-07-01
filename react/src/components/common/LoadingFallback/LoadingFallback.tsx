import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface LoadingFallbackProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  showProgress?: boolean;
  progress?: number;
}

// ============================================================================
// Loading Fallback Component
// ============================================================================

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  message = 'Loading...',
  size = 'medium',
  fullScreen = false,
  showProgress = false,
  progress = 0,
}) => {
  const spinnerSize = {
    small: 24,
    medium: 40,
    large: 56,
  }[size];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    ...(fullScreen && {
      minHeight: '100vh',
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      zIndex: 9999,
    }),
    ...(!fullScreen && {
      padding: '2rem',
    }),
  };

  return (
    <div style={containerStyle}>
      {/* Spinner */}
      <div
        style={{
          width: spinnerSize,
          height: spinnerSize,
          border: `${Math.max(2, spinnerSize / 10)}px solid #e5e7eb`,
          borderTop: `${Math.max(2, spinnerSize / 10)}px solid #3b82f6`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />

      {/* Message */}
      {message && (
        <p
          style={{
            margin: 0,
            fontSize: size === 'small' ? '0.875rem' : size === 'large' ? '1.125rem' : '1rem',
            color: '#6b7280',
            fontWeight: 500,
          }}
        >
          {message}
        </p>
      )}

      {/* Progress Bar */}
      {showProgress && (
        <div
          style={{
            width: '200px',
            height: '4px',
            backgroundColor: '#e5e7eb',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {/* Keyframes for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// Skeleton Loading Components
// ============================================================================

export const SkeletonText: React.FC<{
  lines?: number;
  width?: string;
}> = ({ lines = 1, width = '100%' }) => {
  return (
    <div style={{ width }}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          style={{
            height: '1rem',
            backgroundColor: '#e5e7eb',
            borderRadius: '4px',
            marginBottom: index < lines - 1 ? '0.5rem' : 0,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            ...(index === lines - 1 && lines > 1 && { width: '80%' }),
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '12rem',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          marginBottom: '1rem',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />
      <SkeletonText lines={3} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
}> = ({ rows = 5, columns = 4 }) => {
  return (
    <div style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <th
                key={colIndex}
                style={{
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div
                  style={{
                    height: '1rem',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td
                  key={colIndex}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <div
                    style={{
                      height: '1rem',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                      animationDelay: `${(rowIndex * columns + colIndex) * 0.05}s`,
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

// ============================================================================
// Page Loading Component
// ============================================================================

export const PageLoading: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <LoadingFallback
      message={message || 'Loading page...'}
      size="large"
      fullScreen={true}
    />
  );
};

// ============================================================================
// Inline Loading Component
// ============================================================================

export const InlineLoading: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <div
        style={{
          width: '16px',
          height: '16px',
          border: '2px solid #e5e7eb',
          borderTop: '2px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      {message && (
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          {message}
        </span>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};