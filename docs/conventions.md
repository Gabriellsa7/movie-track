# Code conventions

All examples below are real names from this repository. New features must
follow these patterns exactly. **Everything is written in English**: code,
variable names, comments, tests and documentation.

## File naming

Lowercase with dots as the type separator: `<feature>.<type>[.<variant>].ts`.

| File type | Pattern | Real example |
| --- | --- | --- |
| Entity | `<feature>.entity.ts` | `src/domain/user/user.entity.ts` |
| Domain interface | `<feature>.interface.ts` | `src/domain/user/interfaces/user.interface.ts` |
| Service interface | `<feature>.service.interface.ts` | `src/domain/user/interfaces/user.service.interface.ts` |
| Domain error | `<name>.error.ts` | `src/domain/errors/not-found.error.ts` |
| Shared domain type | `<name>.interface.ts` | `src/domain/common/pagination.interface.ts` |
| Repository contract | `<feature>.repository.read.ts` / `.write.ts` | `src/domain/user/repository/user.repository.read.ts` |
| Service | `<feature>.service.ts` | `src/domain/user/service/user.service.ts` |
| Repository implementation | `<feature>.repository.read.ts` / `.write.ts` | `src/infrastructure/repository/user/user.repository.write.ts` |
| Mongoose schema | `<feature>.schema.ts` | `src/infrastructure/db/mongo/schema/user.schema.ts` |
| Mongoose model | `<feature>.model.ts` | `src/infrastructure/db/mongo/models/user.model.ts` |
| Controller | `<feature>.controller.ts` | `src/interfaces/http/controllers/user.controller.ts` |
| Controller interface | `controller.interface.ts` | `src/interfaces/http/controllers/controller.interface.ts` |
| Factory | `<feature>.<type>.factory.ts` | `src/infrastructure/config/factories/user.service.factory.ts` |
| Unit test | `<subject>.unit.test.ts` | `src/__tests__/unit/user.service.unit.test.ts` |
| Integration test | `<subject>.<action>.int.test.ts` | `src/__tests__/integration/user.create.int.test.ts` |

No exceptions — every file follows the pattern above.

## Symbol naming

| Symbol | Pattern | Real examples |
| --- | --- | --- |
| Domain interface | `I` + PascalCase | `IUser`, `IUserService`, `IController`, `IPagination` |
| Parameter interface | `IParams` + action/context | `IParamsCreateUser`, `IParamsUpdateUser`, `IParamsUserService` |
| Repository contract | `I<Feature>Repository<Read\|Write>` | `IUserRepositoryRead`, `IUserRepositoryWrite` |
| Persistence interface | `IM` + PascalCase, extends the domain interface | `IMUser extends IUser` (adds `_id: Types.ObjectId`; lives in the schema file) |
| Class | PascalCase, no prefix | `UserService`, `UserController`, `Server`, `User` |
| Factory | `<Feature><Type>Factory` | `UserServiceFactory`, `UserControllerFactory` |
| Mongoose model | `M` + lowercase, typed with `IM*` | `Muser = mongoose.model<IMUser>('user', userSchema)` |
| Mongoose schema | camelCase + `Schema`, typed with `IM*` | `userSchema = new mongoose.Schema<IMUser>({...})` |
| Variables/properties | camelCase | `userRepositoryRead`, `apiSpecLocation` |
| Constants | UPPER_SNAKE_CASE | `OPEN_API_SPEC_FILE_LOCATION`, `HIDE_MONGO_INTERNAL_FIELDS`, `DEFAULT_LIST_LIMIT` |
| Enum (Agents.md, no example in code yet) | `E` + PascalCase, UPPER members | `EStatus.ACTIVE` |

Methods have intent-revealing names: `findUserByEmail`, `updateUserById`,
`searchUsers` — never generic ones like `get` or `handle`.

## Code patterns

- **Always `async/await`**; never chained `.then()`.
- **Controllers**: methods as arrow function properties (`createUser = async (req, res, next) => {...}`),
  routes registered in `initRoutes()`, class implements `IController` and exposes `getRoutes(): Router`.
- **Controllers are thin**: extract data from `req`, call the service and map the
  success response. No business rules and no error mapping — errors go to `next(error)`.
- **Domain errors** in `src/domain/errors/`: `DomainError` (base, carries `status`),
  `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404),
  `ConflictError` (409). Services throw these
  (`throw new NotFoundError('User not found')`) and **never** decide HTTP status;
  the central error handler (`src/interfaces/http/middlewares/error-handler.middleware.ts`) does the mapping.
- **`@ErrorHandler()`** on every public service method: logs unexpected
  (non-domain) errors with the service/method context and rethrows them. It
  never swallows or converts errors and never builds HTTP responses. Do not re-wrap
  errors in `new Error(string)` — that loses the type and the stack.
- **Entities** (`user.entity.ts` is the reference) implement their domain interface with:
  - declared properties and a `constructor(params: IParams<Feature>)` that owns the
    invariants (generates `id` with `randomUUID()` when missing, trims/normalizes fields,
    defaults dates, only sets optional fields that have a value);
  - instance methods for state changes (`updateProfile(data, updatedAt)`,
    `changePasswordHash(hash, updatedAt)`), so services never assign fields directly;
  - static mappers to response shapes (`User.toUserPrivate`, `User.toUserPublicSummary`,
    `User.toUserPublicProfile`) and static helpers shared with lookups (`User.normalizeEmail`).
  Services load the stored data, wrap it with `new <Feature>(data)`, call the methods and
  persist the result.
- **JSDoc** on public methods of services, repositories and controllers
  (`@param`, `@returns`, `@throws`) — the pattern used across the `user` slice.
- **Type imports**: relative paths, no path aliases.

## HTTP responses (the `user` slice pattern)

Every error response has the same shape, `{ message, status, code, errors? }`
(contract schemas `Error`/`ValidationError`, `code` always present), and is
produced **only** by the central error handler. `toErrorResponse`
(`src/interfaces/http/middlewares/error-response.mapper.ts`) classifies the
error; the middleware logs 5xx and answers. **500 is only for the unexpected**:
every known failure has its own status.

| Situation | Status | Body | Origin |
| --- | --- | --- | --- |
| Created | 201 | created entity | controller |
| Read/updated | 200 | entity | controller |
| Deleted / no content | 204 | empty | controller |
| Invalid payload, query or params | 400 | `{ message: 'Validation failed', status, code: 'VALIDATION_ERROR', errors: [{ field, message }] }` | OpenApiValidator → handler |
| Malformed JSON body | 400 | `{ message: 'Malformed JSON body', status: 400, code: 'INVALID_JSON' }` | `express.json` (body-parser) → handler |
| Invalid value or schema rule in Mongo | 400 | `{ ..., code: 'VALIDATION_ERROR', errors }` | Mongoose `CastError` / `ValidationError` → handler |
| Wrong password | 401 | `{ message, status: 401, code: 'INVALID_CREDENTIALS' }` | `UnauthorizedError` → handler |
| Missing bearer header | 401 | `{ message, status: 401, code: 'INVALID_TOKEN' }` | OpenApiValidator (`security`) → handler |
| Invalid or expired token | 401 | `{ message, status: 401, code: 'INVALID_TOKEN' \| 'TOKEN_EXPIRED' }` | `UnauthorizedError` (`authenticate` / `JwtTokenProvider`) → handler |
| Acting on another user's account | 403 | `{ message, status: 403, code: 'FORBIDDEN_RESOURCE' }` | `ForbiddenError` (`authorizeSelf`) → handler |
| Not found | 404 | `{ message: 'User not found', status: 404, code: 'USER_NOT_FOUND' }` | `NotFoundError` → handler |
| Route not in the contract | 404 | `{ message: 'Route not found', status: 404, code: 'ROUTE_NOT_FOUND' }` | OpenApiValidator → handler |
| Method not in the contract | 405 | `{ ..., code: 'METHOD_NOT_ALLOWED' }` | OpenApiValidator → handler |
| Conflict (e.g. duplicated email) | 409 | `{ message, status: 409, code: 'EMAIL_TAKEN' }` | `ConflictError` → handler |
| Unique index race (duplicate key) | 409 | `{ message: 'Resource already exists', code: 'DUPLICATE_KEY', errors: [{ field }] }` | Mongo `E11000` → handler (never echoes the value) |
| Body over the 3mb limit | 413 | `{ ..., code: 'PAYLOAD_TOO_LARGE' }` | `express.json` → handler |
| Body that is not JSON | 415 | `{ ..., code: 'UNSUPPORTED_MEDIA_TYPE' }` | OpenApiValidator → handler |
| Database unreachable | 503 | `{ message: 'Service temporarily unavailable', status: 503, code: 'SERVICE_UNAVAILABLE' }` | Mongo network / server-selection / buffering timeout → handler (logged as `server.dependency_unavailable`) |
| Unexpected error or response outside the contract | 500 | `{ message: 'Internal Server Error', status: 500, code: 'INTERNAL_ERROR' }` | handler (structured log with stack, method and path) |

A `DomainError` without a `code` gets one from its status (`NotFoundError()` →
`NOT_FOUND`). Every operation in the contract has a `default` response
(`UnexpectedError`) so a status not listed for a route (405, 413, 415, 503) keeps
its own status instead of being turned into a 500 by the response validator.

## OpenAPI contract (`src/contracts/service.yaml`)

Naming rules from the knowledge base (`playbooks/engineering/backend/contracts/CONTRACTS_LAYER.md`),
compatible with the current contract:

- Schemas/entities: PascalCase (`User`, `Error`)
- Properties: camelCase (`createdAt`, `email`)
- Route resources: kebab-case, plural (`/users`, `/user-profiles`) — this repo does not use an `/api` prefix
- Every endpoint documented with success **and** error examples; types with
  specific formats (`format: email`, `date-time`) and limits where applicable
- List endpoints take `page`/`limit` query params with sensible bounds and answer `{ items, total, page, limit }`
- `code` on error responses is optional and comes from the domain error (`new NotFoundError('User not found', 'USER_NOT_FOUND')`)

## Style and tooling

- **Prettier**: `singleQuote: true`, `trailingComma: 'all'` (`.prettierrc`). Run `yarn prettier`.
- **ESLint 9 flat config** (`eslint.config.mjs`): `typescript-eslint` recommended;
  unused variables/args are only allowed with a `_` prefix.
- **TypeScript strict** (`tsconfig.json`): target es2016, CommonJS, `esModuleInterop`.
- **Husky**: `pre-commit` runs `yarn lint`; `commit-msg` runs commitlint
  (`commitlint.config.js`, based on the organization standard — KB types,
  lowercase subject, header ≤ 72 chars).

## Commits, branches and release

- **Conventional Commits required** — semantic-release parses messages to
  version (branches `main` and `stage`). Types and impact (full guide in
  `.cursor/rules/ai_knowledge_base/playbooks/engineering/code-versioning/commits/`):
  - `feat:` → minor · `fix:` → patch · `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `chore:` → no bump
  - Format: `<type>[optional scope]: <description>` (e.g. `feat(user): add email uniqueness check`)
- **Branches**: `<type>/<kebab-case-description>` — `feature/add-user-authentication`,
  `bugfix/fix-login-error`, `hotfix/patch-security-issue`, `release/v1.2.0`.
- PRs via GitHub; merging into `main` triggers the release flow (CI uses `GITHUB_REF_NAME`).

## Comments

Organization knowledge base standard (`playbooks/engineering/backend/AGENTS.md`):

- Comment only when it adds real value — explain the **why**, never the obvious.
- Never leave commented-out code (dead code).
- Prefer self-documenting code: descriptive names, small functions, explicit types.

## Checklist before finishing any change

```bash
yarn prettier && yarn lint && yarn build && yarn test
```

All four commands must pass. `yarn test` runs unit + integration.
