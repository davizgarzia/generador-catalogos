export function paginateBalanced(items, maxPerPage = 12) {
  if (!items?.length) return []

  const pageCount = Math.ceil(items.length / maxPerPage)
  const baseSize = Math.floor(items.length / pageCount)
  const pagesWithExtraItem = items.length % pageCount

  const pages = []
  let start = 0

  for (let i = 0; i < pageCount; i++) {
    const size = baseSize + (i < pagesWithExtraItem ? 1 : 0)
    pages.push(items.slice(start, start + size))
    start += size
  }

  return pages
}
