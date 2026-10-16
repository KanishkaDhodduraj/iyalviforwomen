<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Keep TanStack Start file-based routing; the current iteration is a home-only prototype, so discovery opens local dialogs rather than unfinished routes.
- Keep product fixtures and festival calculations in `src/data`, and localized interface strings in `src/data/translations.json`, to isolate presentation from content.
- Use the Zustand prototype store with deferred localStorage hydration for preferences, bag, wishlist, recent searches and newsletter; this prevents SSR hydration mismatches without adding a backend.
- Keep shared branded motifs and experience effects in `src/components/iyalvi`; use semantic CSS tokens and the existing shadcn controls.
