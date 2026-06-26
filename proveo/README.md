# Proveo

App de gestión de pedidos, inventario y escandallos entre restaurantes y la nave-obrador. Next.js (App Router) + Supabase.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Despliegue

El proyecto se despliega en **Render.com**, conectado a GitHub: cada push a `main` lanza un deploy automático (ver `render.yaml`). Las migraciones SQL en `supabase/migrations/` se aplican manualmente desde el SQL Editor de Supabase.
