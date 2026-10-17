# Routes

TanStack Start uses **file-based routing**. Every `.tsx` file in this directory
defines a route. Do **not** create `src/pages/`, `src/routes/_app/index.tsx`, or
`app/layout.tsx` — those are Next.js / Remix conventions. The only root layout
is `src/routes/__root.tsx`.

## Conventions

| File | URL |
| --- | --- |
| `index.tsx` | `/` |
| `new-arrivals.tsx` | `/new-arrivals` |
| `sarees.tsx`, `kurtis.tsx` | product collections |
| `style-reels.tsx` | `/style-reels` |
| `love-notes.tsx` | `/love-notes` |
| `contact.tsx` | `/contact` |
| `checkout.tsx` | `/checkout` |
| `about.tsx`, `offers.tsx` | legacy paths that redirect to `/` |
| `__root.tsx` | app shell — wraps every page; preserve `<Outlet />` |

`routeTree.gen.ts` is auto-generated. Don't edit it by hand.

Community content is read from `GET /api/reels` (`{ reels: ApiReel[] }`) and
`GET /api/reviews` (`{ reviews: ApiReview[], averageRating, total }`). Reels
contain `title`, `instagramUrl`, `thumbnailText`, `order`, and `isActive`.
Reviews contain the populated customer and optional product, `rating`, `text`,
and moderation `status`; the customer API returns approved reviews only.
Authenticated customers submit reviews with `POST /api/reviews`; new reviews
remain pending until an administrator approves them.
