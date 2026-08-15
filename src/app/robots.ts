import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true'

  return {
    rules: {
      userAgent: '*',
      ...(allowIndexing ? { allow: '/' } : { disallow: '/' }),
    },
  }
}
