# Stack Rules

## Mandatory Technologies

- React
- TypeScript
- Supabase
- TanStack Query
- Zod
- React Hook Form

## Data Fetching

- Use TanStack Query for all server state
- Do NOT use raw useEffect for fetching server data
- Query keys must be centralized and stable
- Use custom hooks for queries and mutations

## Validation

- Use Zod schemas for runtime validation
- Infer TypeScript types from Zod whenever possible

## TypeScript

- Avoid any
- Prefer explicit exported types
- Use discriminated unions where appropriate

## Forms

- Use React Hook Form + Zod
- Avoid uncontrolled custom validation logic

## API Layer

- Never call Supabase directly from UI components
- Database access belongs in services/
- Hooks should orchestrate queries/mutations

## State Management

- React Query for async/server state
- Local component state only for UI concerns