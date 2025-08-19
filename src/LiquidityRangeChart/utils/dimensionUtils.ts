export function calculateInitialDimensions() {
  const isMobile = window.innerWidth <= 768;
  return {
    width: Math.max(300, Math.min(window.innerWidth - 20, 900)),
    height: isMobile ? Math.min(300, window.innerHeight * 0.4) : 400
  };
}

export function calculateResizeDimensions() {
  const isMobile = window.innerWidth <= 768;
  const height = isMobile ? Math.min(300, window.innerHeight * 0.4) : 400;
  const width = Math.max(300, Math.min(window.innerWidth - 20, isMobile ? window.innerWidth - 20 : 900));
  return { width, height };
}