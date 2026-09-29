/**
 * File Downloader Utility
 * Provides robust and reliable file downloads across desktop, mobile, and iframe web views.
 */

export interface DownloadOptions {
  mimeType?: string;
  fallbackToDataUri?: boolean;
}

export function downloadJsonFile(filename: string, data: any, space = 2): boolean {
  try {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, space);
    return downloadTextFile(filename, jsonString, { mimeType: 'application/json;charset=utf-8' });
  } catch (err) {
    console.error('[fileDownloader] Failed to serialize JSON for download:', err);
    return false;
  }
}

export function downloadTextFile(
  filename: string,
  content: string,
  options: DownloadOptions = {}
): boolean {
  const mimeType = options.mimeType || 'text/plain;charset=utf-8';
  
  try {
    const blob = new Blob([content], { type: mimeType });
    return downloadBlob(filename, blob);
  } catch (err) {
    console.warn('[fileDownloader] Blob creation failed, attempting data URI fallback:', err);
    try {
      const encodedUri = `data:${mimeType},${encodeURIComponent(content)}`;
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 1000);
      return true;
    } catch (fallbackErr) {
      console.error('[fileDownloader] Data URI download also failed:', fallbackErr);
      return false;
    }
  }
}

export function downloadBlob(filename: string, blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // Append to body for Firefox & WebKit compatibility
    document.body.appendChild(link);
    link.click();

    // Delay cleanup to allow browser download manager to start the stream
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1500);

    return true;
  } catch (err) {
    console.error('[fileDownloader] Blob download error:', err);
    return false;
  }
}
