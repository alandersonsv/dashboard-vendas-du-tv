import React from 'react';

interface LoadingScreenProps {
  visible: boolean;
  progress: number;
  message: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  visible,
  progress,
  message,
}) => {
  if (!visible) return null;

  return (
    <div id="loading-screen" style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}>
      <div className="doc-logo-fallback">LABEST</div>
      <div className="loading-bar-bg">
        <div className="loading-bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="loading-text">{message}</div>
    </div>
  );
};
