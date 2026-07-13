export const SHARE_STATUS = Object.freeze({
  SHARED: 'shared',
  CANCELLED: 'cancelled',
  COPIED: 'copied',
  DOWNLOADED: 'downloaded',
  COPIED_AND_DOWNLOADED: 'copied-and-downloaded',
  FAILED: 'failed'
});

function nativeShareData(payload, image, canShareFiles) {
  const data = {
    title: payload.title ?? '',
    text: payload.text ?? ''
  };
  if (payload.url) data.url = payload.url;
  if (image) {
    try {
      if (canShareFiles?.([image])) data.files = [image];
    } catch {
      // Some browsers expose canShare but reject file payload inspection.
    }
  }
  return data;
}

function fallbackText(payload) {
  const text = payload.text || payload.title || '';
  return [text, payload.url].filter(Boolean).join('\n');
}

export async function executeShare({ payload, image, api }) {
  if (typeof api.share === 'function') {
    const data = nativeShareData(payload, image, api.canShareFiles);
    try {
      await api.share(data);
      return SHARE_STATUS.SHARED;
    } catch (error) {
      if (error?.name === 'AbortError') return SHARE_STATUS.CANCELLED;
    }
  }

  let copied = false;
  let downloaded = false;
  const text = fallbackText(payload);

  if (text && typeof api.writeText === 'function') {
    try {
      await api.writeText(text);
      copied = true;
    } catch {
      // Continue to the local image fallback when clipboard access is denied.
    }
  }

  if (image && typeof api.download === 'function') {
    try {
      await api.download(image);
      downloaded = true;
    } catch {
      // The caller receives a truthful failed status when no fallback succeeds.
    }
  }

  if (copied && downloaded) return SHARE_STATUS.COPIED_AND_DOWNLOADED;
  if (copied) return SHARE_STATUS.COPIED;
  if (downloaded) return SHARE_STATUS.DOWNLOADED;
  return SHARE_STATUS.FAILED;
}

function createBrowserApi(windowRef, documentRef) {
  const navigatorRef = windowRef.navigator;
  const urlApi = windowRef.URL;
  return {
    share: typeof navigatorRef?.share === 'function'
      ? (data) => navigatorRef.share(data)
      : null,
    canShareFiles: (files) => (
      typeof navigatorRef?.canShare === 'function' && navigatorRef.canShare({ files })
    ),
    writeText: typeof navigatorRef?.clipboard?.writeText === 'function'
      ? (text) => navigatorRef.clipboard.writeText(text)
      : null,
    download(file) {
      if (!urlApi?.createObjectURL) throw new Error('download-unavailable');
      const href = urlApi.createObjectURL(file);
      const link = documentRef.createElement('a');
      link.href = href;
      link.download = file.name || '兔兔别慌-战绩.png';
      link.click();
      windowRef.setTimeout(() => urlApi.revokeObjectURL(href), 0);
    }
  };
}

function toShareFile(blob, windowRef) {
  if (!blob) return null;
  const FileClass = windowRef.File;
  if (typeof FileClass !== 'function') return blob;
  if (blob instanceof FileClass) return blob;
  return new FileClass([blob], '兔兔别慌-战绩.png', { type: 'image/png' });
}

export function createBrowserSharingAdapter({ canvas }) {
  const documentRef = canvas.ownerDocument ?? document;
  const windowRef = documentRef.defaultView ?? window;
  const button = documentRef.createElement('button');
  const api = createBrowserApi(windowRef, documentRef);
  let payload = null;
  let image = null;
  let onStatus = null;
  let generation = 0;

  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', '分享战绩');
  button.className = 'share-hit-target';
  button.textContent = '分享战绩';
  button.hidden = true;
  canvas.parentElement?.appendChild(button);

  async function handleClick() {
    if (!payload) return;
    const activeGeneration = generation;
    const activePayload = payload;
    const activeImage = image;
    const activeOnStatus = onStatus;
    button.disabled = true;
    const status = await executeShare({ payload: activePayload, image: activeImage, api });
    if (generation !== activeGeneration) return;
    button.disabled = false;
    activeOnStatus?.(status);
  }

  button.addEventListener('click', handleClick);

  return {
    currentUrl() {
      return windowRef.location.href;
    },
    presentResult({ rect, payload: nextPayload, imagePromise, onStatus: nextOnStatus }) {
      generation += 1;
      const activeGeneration = generation;
      payload = nextPayload;
      image = null;
      onStatus = nextOnStatus;
      button.disabled = false;
      button.style.left = `${(rect.x / 360) * 100}%`;
      button.style.top = `${(rect.y / 640) * 100}%`;
      button.style.width = `${(Math.max(136, rect.width) / 360) * 100}%`;
      button.style.height = `${(Math.max(48, rect.height) / 640) * 100}%`;
      button.hidden = false;

      Promise.resolve(imagePromise)
        .then((blob) => {
          if (generation === activeGeneration) image = toShareFile(blob, windowRef);
        })
        .catch(() => {});
    },
    clearResult() {
      generation += 1;
      payload = null;
      image = null;
      onStatus = null;
      button.disabled = false;
      button.hidden = true;
    },
    destroy() {
      generation += 1;
      payload = null;
      image = null;
      onStatus = null;
      button.removeEventListener('click', handleClick);
      button.remove();
    }
  };
}
