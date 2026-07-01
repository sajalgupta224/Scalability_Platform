import { useState, useEffect } from 'react';

interface UsePanelStateReturn {
  isPipelinePanelExpanded: boolean;
  isModelComparisonExpanded: boolean;
  handleTogglePipelinePanel: () => void;
  handleToggleModelComparison: () => void;
  setIsPipelinePanelExpanded: (value: boolean) => void;
  setIsModelComparisonExpanded: (value: boolean) => void;
  getMainContentStyle: () => { marginRight: string };
}

export const usePanelState = (isCreateMode: boolean): UsePanelStateReturn => {
  const [isPipelinePanelExpanded, setIsPipelinePanelExpanded] = useState<boolean>(true);
  const [isModelComparisonExpanded, setIsModelComparisonExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (isCreateMode) setIsPipelinePanelExpanded(true);
  }, [isCreateMode]);

  const handleTogglePipelinePanel = () => {
    setIsPipelinePanelExpanded((prev) => !prev);
    if (!isPipelinePanelExpanded) setIsModelComparisonExpanded(false);
  };

  const handleToggleModelComparison = () => {
    setIsModelComparisonExpanded((prev) => !prev);
    if (!isModelComparisonExpanded) setIsPipelinePanelExpanded(false);
  };

  const getMainContentStyle = () => {
    const rightMargin =
      !isPipelinePanelExpanded && !isModelComparisonExpanded
        ? '0'
        : isPipelinePanelExpanded
        ? '30%'
        : '40%';
    return { marginRight: rightMargin };
  };

  return {
    isPipelinePanelExpanded,
    isModelComparisonExpanded,
    handleTogglePipelinePanel,
    handleToggleModelComparison,
    setIsPipelinePanelExpanded,
    setIsModelComparisonExpanded,
    getMainContentStyle,
  };
};
