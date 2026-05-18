# Frontend Rules

## Components

- Keep components small and composable
- Prefer presentation-only components
- Extract logic into hooks

## File Structure

- hooks/: async orchestration
- services/: database/API access
- schemas/: zod schemas
- components/: presentation
- pages/: route-level composition

## Styling

- Preserve existing UI unless explicitly requested
- Reuse existing components before creating new ones

## Anti Patterns

- Massive components
- Business logic inside JSX
- Duplicate query logic
- Fetching directly in components
- Repeated form validation logic