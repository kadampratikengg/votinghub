const getFullscreenElement = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
};

export const isFullscreen = () => !!getFullscreenElement();

export const enterFullscreen = async (element) => {
  if (typeof document === 'undefined') return false;

  const target = element || document.documentElement;
  if (!target) return false;

  if (isFullscreen()) {
    return true;
  }

  const request =
    target.requestFullscreen ||
    target.webkitRequestFullscreen ||
    target.mozRequestFullScreen ||
    target.msRequestFullscreen;

  if (!request) {
    return false;
  }

  try {
    await request.call(target);
    return true;
  } catch (error) {
    console.warn('Failed to enter fullscreen mode:', error);
    return false;
  }
};

export const exitFullscreen = async () => {
  if (typeof document === 'undefined') return false;

  const exit =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen;

  if (!exit) {
    return false;
  }

  try {
    await exit.call(document);
    return true;
  } catch (error) {
    console.warn('Failed to exit fullscreen mode:', error);
    return false;
  }
};
