# Crypto Tracker — Especificación

Aplicación web SSR para seguimiento manual de compras/ventas de criptomonedas, organizadas por grupos. Valoración en USD vía CoinGecko.

## Stack

| Capa           | Tecnología                       | Versión objetivo |
|----------------|----------------------------------|------------------|
| Runtime        | Bun                              | 1.3.13           |
| Framework web  | Hono + `hono/jsx` (SSR)          | 4.12.x           |
| Interactividad | HTMX                             | 2.0.9            |
| Estilos        | Tailwind CSS (CLI standalone)    | 4.2.x            |
| Persistencia   | Archivos JSON en disco           | —                |
| Precios        | CoinGecko Demo API               | v3               |

Notas:
- HTMX 2.x es la versión estable actual (HTMX 4.0 está en rollout pero 2.x seguirá siendo `latest` durante un periodo largo).
- Tailwind v4 usa configuración CSS-first con `@theme`, sin `tailwind.config.js`.
- CoinGecko Demo: 30 calls/min, 10.000 calls/mes, header `x-cg-demo-api-key`, endpoint base `https://api.coingecko.com/api/v3`.

## Modelo de datos (filesystem)

```
data/
├── groups.json                         # índice de grupos (metadata ligera)
└── groups/
    ├── <group-slug>/
    │   ├── group.json                  # metadata del grupo
    │   └── coins/
    │       ├── <coin-id>.json          # tenencia + movimientos de una moneda
    │       └── ...
    └── ...
```

### `groups.json`
Índice plano para listar grupos rápido sin recorrer el filesystem.

```json
{
  "groups": [
    { "id": "long-term", "name": "Long term", "createdAt": "2026-04-22T10:00:00Z" }
  ]
}
```

### `groups/<group-id>/group.json`
```json
{
  "id": "long-term",
  "name": "Long term",
  "createdAt": "2026-04-22T10:00:00Z"
}
```

### `groups/<group-id>/coins/<coin-id>.json`
`coinId` usa el API ID de CoinGecko (ej. `bitcoin`, `ethereum`, `solana`).

```json
{
  "coinId": "bitcoin",
  "symbol": "BTC",
  "name": "Bitcoin",
  "movements": [
    {
      "id": "01JS9X...",
      "type": "buy",
      "date": "2026-01-15T09:30:00Z",
      "amount": 0.15,
      "pricePerCoin": 42000.00,
      "note": ""
    },
    {
      "id": "01JSAY...",
      "type": "sell",
      "date": "2026-03-10T14:00:00Z",
      "amount": 0.05,
      "pricePerCoin": 68000.00,
      "note": ""
    }
  ]
}
```

- `type`: `"buy"` | `"sell"`.
- `amount`: cantidad de la moneda (no USD).
- `pricePerCoin`: precio unitario en USD al momento de la operación.
- `id`: ULID o UUID generado en servidor.

### Valores derivados (no persistidos)

Calculados en servidor en cada request:

- `holding` = `sum(buy.amount) − sum(sell.amount)`
- `costBasis` (USD) = `sum(buy.amount * buy.pricePerCoin) − sum(sell.amount * sell.pricePerCoin)`
- `currentValueUsd` = `holding * priceUsd` (de CoinGecko)
- `pnl` = `currentValueUsd − costBasis`
- `pnlPct` = `pnl / costBasis * 100` (si `costBasis > 0`)

Método de cálculo de PnL: realizado + no realizado agregados (cost-basis neto). No se usa FIFO/LIFO en MVP.

## Rutas (Hono)

| Método | Ruta                                              | Devuelve           | Propósito                                 |
|--------|---------------------------------------------------|--------------------|-------------------------------------------|
| GET    | `/`                                               | HTML completo      | Listado de grupos                         |
| POST   | `/groups`                                         | Fragmento HTMX     | Crea grupo                                |
| DELETE | `/groups/:groupId`                                | Fragmento HTMX     | Elimina grupo                             |
| GET    | `/groups/:groupId`                                | HTML completo      | Detalle del grupo (tabla de monedas)      |
| POST   | `/groups/:groupId/coins`                          | Fragmento HTMX     | Añade moneda al grupo                     |
| DELETE | `/groups/:groupId/coins/:coinId`                  | Fragmento HTMX     | Elimina moneda                            |
| GET    | `/groups/:groupId/coins/:coinId`                  | HTML completo      | Detalle moneda (tabla de movimientos)     |
| POST   | `/groups/:groupId/coins/:coinId/movements`        | Fragmento HTMX     | Añade movimiento                          |
| DELETE | `/groups/:groupId/coins/:coinId/movements/:movId` | Fragmento HTMX     | Elimina movimiento                        |
| GET    | `/api/coins/search?q=...`                         | JSON o fragmento   | Autocompletado (proxy a CoinGecko search) |

Los endpoints que devuelven fragmentos responden con los trozos de HTML que HTMX inserta vía `hx-target` / `hx-swap`.

## Vistas

### Home `/`
- Lista de grupos existentes (nombre + link).
- Formulario inline para crear grupo (`hx-post="/groups"`, `hx-target="#groups-list"`, `hx-swap="beforeend"`).
- Botón de eliminar por grupo (`hx-delete` + confirm).

### Detalle de grupo `/groups/:groupId`
Tabla con una fila por moneda:

| Columna        | Fuente                                      |
|----------------|---------------------------------------------|
| Name           | `coin.name`                                 |
| Ticker         | `coin.symbol`                               |
| Holding        | `holding` calculado                         |
| Current (USD)  | `currentValueUsd`                           |
| P&L (USD / %)  | `pnl` / `pnlPct` (verde/rojo según signo)   |

Encabezado de la página:
- **Total USD del grupo** = `sum(currentValueUsd)` de todas las monedas.
- **Total P&L del grupo** = `sum(pnl)`.

Formulario para añadir moneda:
- Input con autocompletado vía `hx-get="/api/coins/search"` con `hx-trigger="keyup changed delay:300ms"`.
- Al seleccionar una sugerencia se rellena `coinId`, `symbol`, `name`.

### Detalle de moneda `/groups/:groupId/coins/:coinId`
- Cabecera: nombre, ticker, holding, precio actual, valor actual, PnL.
- Formulario para añadir movimiento (`type`, `date`, `amount`, `pricePerCoin`, `note`).
- Tabla de movimientos ordenada por fecha desc:

| Columna          | Fuente                                |
|------------------|---------------------------------------|
| Date             | `movement.date`                       |
| Type             | `movement.type` (buy/sell)            |
| Amount           | `movement.amount`                     |
| Price per coin   | `movement.pricePerCoin`               |
| Total (USD)      | `amount * pricePerCoin`               |
| Note             | `movement.note`                       |
| —                | Botón eliminar (`hx-delete`)          |

## Integración CoinGecko

### Endpoints usados
- `GET /simple/price?ids={csv}&vs_currencies=usd` — precios spot de todas las monedas de un grupo en una sola llamada.
- `GET /search?query=...` — autocompletado al añadir moneda.

### Cliente
- Módulo `src/lib/coingecko.ts`.
- Header: `x-cg-demo-api-key: ${Bun.env.COINGECKO_API_KEY}`.
- Cache en memoria con TTL de 60s por clave (`ids` ordenados alfabéticamente) para no pegarse al rate limit de 30 req/min.
- Batch por grupo: una sola llamada `simple/price` con todos los `coinId` del grupo concatenados por coma.
- Manejo de errores: si la API falla, renderizar la tabla con `currentValueUsd = null` y mostrar guion ("—") en las columnas dependientes, sin romper la página.

## Persistencia

### Concurrencia
Escritura con patrón write-then-rename para evitar archivos corruptos:

1. Leer archivo actual.
2. Mutar en memoria.
3. Escribir en `<file>.tmp`.
4. `rename()` atómico a la ruta final.

Mutex en memoria por ruta de archivo (`Map<string, Promise>`) para serializar escrituras concurrentes dentro del mismo proceso.

### IDs
- `groupId`: slug generado del nombre (`slugify`) con sufijo numérico si colisiona.
- `coinId`: API ID de CoinGecko (ya es único).
- `movementId`: ULID (`Bun.randomUUIDv7()` o librería ULID).

## Estructura del proyecto

```
crypto-tracker/
├── src/
│   ├── index.tsx                  # entrypoint Bun.serve + Hono
│   ├── routes/
│   │   ├── groups.tsx
│   │   ├── coins.tsx
│   │   └── movements.tsx
│   ├── views/                     # componentes JSX SSR
│   │   ├── layout.tsx
│   │   ├── home.tsx
│   │   ├── group-detail.tsx
│   │   └── coin-detail.tsx
│   ├── lib/
│   │   ├── coingecko.ts
│   │   ├── storage.ts             # read/write JSON + locking
│   │   └── calc.ts                # holding, costBasis, pnl
│   └── styles/
│       └── input.css              # @import "tailwindcss"; @theme {...}
├── public/
│   ├── htmx.min.js                # htmx 2.0.9 self-hosted
│   └── app.css                    # output Tailwind
├── data/                          # gitignored
├── .env                           # COINGECKO_API_KEY
├── package.json
└── README.md
```

## Configuración mínima

### `package.json` (scripts relevantes)
```json
{
  "scripts": {
    "dev": "bun --hot src/index.tsx",
    "build:css": "bunx @tailwindcss/cli -i src/styles/input.css -o public/app.css --minify",
    "watch:css": "bunx @tailwindcss/cli -i src/styles/input.css -o public/app.css --watch"
  }
}
```

### `tsconfig.json` (claves relevantes para `hono/jsx`)
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  }
}
```

### Variables de entorno
```
COINGECKO_API_KEY=...
PORT=3000
DATA_DIR=./data
```

## Alcance MVP — fuera de este documento

- Sin autenticación (uso local/single-user).
- Sin histórico de precios ni gráficas.
- Sin multi-moneda fiat (solo USD).
- Sin métodos FIFO/LIFO; PnL por cost-basis neto.
- Sin edición de movimientos (solo create/delete).
- Sin export CSV.
