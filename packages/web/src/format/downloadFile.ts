/**
 * Hands the browser a generated file.
 *
 * The object URL is revoked on the next frame rather than immediately: Safari
 * reads the blob after the click returns, and revoking synchronously hands it
 * an empty file.
 */
export function downloadTextFile(filename: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
