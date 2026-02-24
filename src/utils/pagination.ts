export const getPagination = (page?: string, pageSize?: string) => {
  const p = Math.max(1, Number(page || 1))
  const s = Math.min(1000, Math.max(1, Number(pageSize || 20)))
  return { skip: (p - 1) * s, take: s, page: p, pageSize: s }
}
