export function useMedia() {
  function thumbUrl(url?: string) {
    if (!url) return ''
    if (url.includes('_thumb.')) return url
    return url.replace(/(\.[^.]+)$/, '_thumb.webp')
  }

  function posterUrl(url?: string) {
    if (!url) return ''
    if (url.includes('_poster.')) return url
    return url.replace(/\.[^.]+$/, '_poster.jpg')
  }

  return { thumbUrl, posterUrl }
}
