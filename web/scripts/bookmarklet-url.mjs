export function toBookmarkletUrl(code) {
  return `javascript:${encodeURIComponent(code)}`;
}

export function fromBookmarkletUrl(url) {
  if (!url.startsWith('javascript:')) throw new Error('Not a JavaScript URL');
  return decodeURIComponent(url.slice('javascript:'.length));
}
