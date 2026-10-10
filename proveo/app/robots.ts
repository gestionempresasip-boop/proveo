import type { MetadataRoute } from 'next'

// La app es privada: se le pide a todos los buscadores que no rastreen nada.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] }
}
