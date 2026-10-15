# Architecture

## Overview

Clean Architecture with vertical slices per feature. The `user` slice is the
canonical example — every new feature must mirror it file by file.

```mermaid
graph TD
    A[main.ts<br/>composition root] --> B[infrastructure/config/factories<br/>UserControllerFactory / UserServiceFactory]
    B --> C[interfaces/http/controllers<br/>UserController]
    C --> D[domain/user/service<br/>UserService]
    D --> E[domain/user/repository<br/>IUserRepositoryRead / IUserRepositoryWrite]
    E -.implemented by.-> F[infrastructure/repository/user<br/>UserRepositoryRead / UserRepositoryWrite]
    F --> G[infrastructure/db/mongo<br/>userSchema / Muser]
```

**Dependency rule:** `domain/` is pure — it does not import `infrastructure/`
or `interfaces/`. Repository contracts live in the domain
(`src/domain/user/repository/user.repository.read.ts` → `IUserRepositoryRead`);
implementations live in infrastructure
(`src/infrastructure/repository/user/user.repository.read.ts` → `UserRepositoryRead`).
The **file names are identical** on both sides — the directory distinguishes
contract from implementation. Do not mix them up when editing.

## Read/write split (light CQRS)

Each feature has two repository contracts:

- `I<Feature>RepositoryRead` — `findUserById`, `findUserByEmail`, `searchUsers`, `countUsers`
- `I<Feature>RepositoryWrite` — `createUser`, `updateUserById`, `deleteUserById`

The service receives both via a parameter object:

```ts
export class UserService implements IUserService {
  private userRepositoryRead: IUserRepositoryRead;
  private userRepositoryWrite: IUserRepositoryWrite;

  constructor({ userRepositoryRead, userRepositoryWrite }: IParamsUserService) {
    this.userRepositoryRead = userRepositoryRead;
    this.userRepositoryWrite = userRepositoryWrite;
  }
}
```

## Dependency injection

Manual DI, no container. Static factories in
`src/infrastructure/config/factories/`, one per artifact, with a `static create()`:

```ts
// user.service.factory.ts
export class UserServiceFactory {
  static create() {
    return new UserService({
      userRepositoryRead: new UserRepositoryRead(),
      userRepositoryWrite: new UserRepositoryWrite(),
    });
  }
}

// user.controller.factory.ts
export class UserControllerFactory {
  static create(): IController {
    return new UserController(UserServiceFactory.create());
  }
}
```

Rules:

1. All composition happens in factories — never inside services/controllers.
2. Factories do **no I/O at module load**; side effects only inside `create()`.
3. `main.ts` only knows controller factories.

## Server lifecycle (`src/interfaces/http/server.ts`)

Initialization order in the `Server` constructor:

1. `/health` route (registered **before** the middlewares — which is why it escapes the OpenApiValidator).
2. Middlewares: `express.json({ limit: '3mb' })` → `express.urlencoded` →
   `ContextAsyncHooks.getExpressMiddlewareTracking()` (traceability cid) → `helmet()` →
   extra middlewares passed via `middlewaresToStart` in the constructor.
3. `OpenApiValidator.middleware` with `validateApiSpec: true` and `validateResponses: true`.
4. Controller routes (`controller.getRoutes()` mounted at `/`).
5. **Central error handler** (`errorHandlerMiddleware` in `src/interfaces/http/middlewares/error-handler.middleware.ts`,
   mounted by `errorHandler()`): the only place that translates
   errors into HTTP responses. `toErrorResponse` (`error-response.mapper.ts`)
   classifies the error into `{ message, status, code, errors? }`: `DomainError`,
   validator `HttpError` (400 with `errors: [{ field, message }]`, 401, 404, 405, 415),
   body-parser errors (400 `INVALID_JSON`, 413), Mongo errors (409 duplicate key,
   400 cast/validation, 503 database unavailable) and, only for anything else,
   500 `INTERNAL_ERROR`. The middleware logs 5xx (with method, path and stack) and
   answers; the full table is in [conventions.md](conventions.md#http-responses-the-user-slice-pattern).

Service methods are decorated with `@ErrorHandler()`
(`src/domain/common/decorators/error-handler.decorator.ts`): domain errors pass
through untouched; anything else is logged with the service and method names
(`eventName: 'service.unexpected_error'`) and rethrown to the central handler.

In `main.ts`, the boot order is: telemetry (first-line import) → env validation
(`infrastructure/config/env.ts`, fail-fast) → `new Server(...)` →
`await databaseSetup()` → `listen()` → graceful-shutdown registration
(SIGTERM/SIGINT close the HTTP server and Mongoose, exit 0 on success, with a
failsafe timeout).

## Domain errors (`src/domain/errors/`)

`DomainError` (base, carries the HTTP `status`) and the specializations
`UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404) and `ConflictError` (409). The error flow is always:
service throws a typed error → controller passes it on with `next(error)` →
central error handler responds in the contract shape. No other layer builds
error responses.

## Request→response flow (example: `POST /users`)

1. `express.json` parses the body; `ContextAsyncHooks` creates the tracking context (cid); OTel auto-instrumentation opens the HTTP span.
2. `OpenApiValidator` validates the request against `src/contracts/service.yaml` — an invalid body → 400 `ValidationError` before reaching the controller.
3. `UserController.createUser` (arrow function property) extracts `{ name, email, password }` from the body and calls `userService.createUser(...)`.
4. `UserService.createUser` applies the business rule: email already in use → throws `ConflictError` with code `EMAIL_TAKEN` (becomes 409 in the handler); otherwise hashes the password, generates `id`/`createdAt`/`updatedAt`, builds the `User` entity and delegates to `userRepositoryWrite.createUser`.
5. `UserRepositoryWrite` persists via the `Muser` model and returns a plain `IUser` (projection hides `_id`/`__v` — see `mongo.projection.ts`).
6. The controller responds `201` with the user; any error goes to `next(error)`.
7. `OpenApiValidator` validates the **response** against the contract before sending it.

`GET /users` is public and paginated: `search`, `page` and `limit` query params
(validated and coerced by the contract). The controller converts `page` into an
`IPagination` offset; the service runs `searchUsers` + `countUsers` and answers
`{ items, total, page, limit }` with public summaries only (no e-mail).

## OpenAPI contract (`src/contracts/service.yaml`)

- Source of truth for the API; validated at runtime in both directions.
- Every route/payload change **requires** updating the yaml in the same PR.
- The build copies the yaml to `dist/src/contracts` via the `copy-essentials`
  script (tsc does not copy non-TS files). Without it, `yarn start` breaks.
- Routes not documented in the contract are rejected by the validator.

## Authentication (JWT)

Stateless JWT with two tokens, both HS256 with the algorithm pinned on sign
**and** verify:

| Token | Secret / lifetime | Used on |
| --- | --- | --- |
| Access | `JWT_SECRET` / `JWT_EXPIRES_IN` (default `1h`) | `Authorization: Bearer <token>` on protected routes |
| Refresh | `REFRESH_TOKEN_SECRET` / `REFRESH_TOKEN_EXPIRES_IN` (default `7d`) | body of `POST /auth/refresh` only |

The payload carries only `sub` (the user id). Separate secrets mean an access
token is never accepted as a refresh token, and vice versa.

- **Port and adapter:** `ITokenProvider` (`src/domain/common/providers/token.provider.ts`)
  is the domain contract; `JwtTokenProvider` (`src/infrastructure/providers/token/`)
  is the only file that imports `jsonwebtoken`. It translates library errors into
  `UnauthorizedError` with `TOKEN_EXPIRED` or `INVALID_TOKEN`. `TokenProviderFactory`
  builds it from `env`.
- **`AuthService`** (`src/domain/auth/`): `login` answers the same
  `INVALID_CREDENTIALS` for an unknown e-mail and a wrong password (no user
  enumeration); `refresh` checks that the user still exists and issues both
  tokens again.
- **Middlewares** (`src/interfaces/http/middlewares/auth.middleware.ts`):
  `authenticate(tokenProvider)` verifies the bearer token and sets `req.userId`
  (401 otherwise); `authorizeSelf` lets the request through only when
  `req.userId` equals the `:id` route param (403 `FORBIDDEN_RESOURCE` otherwise).
  The `Request` type augmentation lives in the same file because `ts-node-dev`
  only sees types from imported files.
- **Protecting a route** takes three changes: `security: [bearerAuth: []]` plus
  `401`/`403` responses in the contract, and `this.authenticate, authorizeSelf`
  before the handler in the controller. The controller receives `authenticate`
  through its constructor (wired in the controller factory).

Known limitations: tokens cannot be revoked before they expire (no logout), and
login is faster for an unknown e-mail than for a wrong password (no dummy hash
compare yet).

## Entry points

| File | Role |
| --- | --- |
| `src/main.ts` | Production/dev: telemetry + `Server` + controllers via factories |
| `src/__tests__/configApp.ts` | `Server` instance used by integration tests — **must register the same controllers** |
