# pixie-ai Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-14

## Active Technologies
- (001-this-should-be)

## Project Structure
```
src/
tests/
```

## Directory Structure
- **Components:**
    - Group related UI components together in a `components/` directory.
    - For larger applications, consider further organizing components by feature or domain (e.g., `components/auth/`, `components/user/`).
    - Each component should ideally reside in its own directory, containing its code, styles, and tests.
- **Tests:**
    - Place tests alongside the code they are testing (e.g., `src/feature/myFeature.ts` and `src/feature/myFeature.test.ts`).
    - Alternatively, maintain a top-level `tests/` directory that mirrors the `src/` directory structure.
    - Use the naming convention `<filename>.test.ts` for test files.
- **Services:**
    - Centralize business logic and data access operations in a `services/` directory.
    - Organize services by domain or resource (e.g., `services/userService.ts`, `services/productService.ts`).
    - Services should be responsible for interacting with external APIs, databases, or other data sources.
    - Use the naming convention `<servicename>.service.ts` for service files.
- **Helper Functions/Utilities:**
    - Create a `utils/` or `helpers/` directory for small, reusable, and generic functions that don't belong to a specific component or service.
    - Categorize helpers further if the number of files grows (e.g., `utils/formatters.ts`, `utils/validators.ts`).
- **Types:**
    - Define shared TypeScript types, interfaces, and enums in a centralized `types/` directory at the root of the `src/` folder.
    - For types specific to a particular feature or component, consider placing them alongside the relevant code (e.g., `components/user/user.types.ts`).

## Commands
# Add commands for 

## Code Style
- **Language Preference:**
    - TypeScript is the preferred language for new code and refactoring existing JavaScript. Leverage TypeScript's features for type safety and improved code quality.
- **Readability and Naming:**
    - Use clear, descriptive, and human-readable names for variables, functions, classes, and files. Avoid abbreviations unless they are universally understood within the project context.
    - Names should accurately reflect the purpose or content of the entity they represent.
    - Follow established naming conventions for the specific language/framework being used (e.g., camelCase for JavaScript/TypeScript variables, snake_case for Python variables, PascalCase for classes).
- **Modularity and Function Decomposition:**
    - Break down complex tasks into smaller, focused functions or methods. Each function should ideally have a single, well-defined responsibility.
    - Aim for functions that are concise and easy to understand. If a function becomes too long or performs multiple unrelated operations, consider refactoring it into smaller, more specialized functions.
    - Promote code reuse by encapsulating common logic within functions.
    - Avoid deeply nested logic; extract inner blocks into separate functions where appropriate.

## Recent Changes
- 001-this-should-be: Added

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
