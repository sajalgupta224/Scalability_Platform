
export const GENERATING_TEXT = 'Generating response...';

export const isGeneratingText = (t?: string) => {
  const s = (t ?? '').trim();
  return s === GENERATING_TEXT || s === 'Please wait...'; // keeps backward compatibility
};
