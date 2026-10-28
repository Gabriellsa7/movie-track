# Front-end handoff

What a front-end (web desktop, mobile web or native app) needs to know about
the Movie Track API. The contract in
[`src/contracts/service.yaml`](../src/contracts/service.yaml) is the source of
truth for every request and response shape; with the API running, Swagger UI at
`http://localhost:3000/docs` shows it and lets you call every route.

## Product in one paragraph

A personal movie log. Users sign up, log the movies they watched (rating 1–10 in
half steps, review, genres, poster, watch date, favorite, how many times they
watched it), keep a **watchlist** of movies to watch (with priority, a personal
note and an optional planned date: the **next movies**), press **"I watched
it"** on a watchlist item to move it to the log with a rating, search movies in
**TMDB** to prefill forms, and see **stats** about what they watched.

## Conventions

- **Base URL:** `http://localhost:3000` locally (`docker compose up` or
  `yarn dev`). No version prefix.
- **CORS:** browsers may call the API only from the origins in `CORS_ORIGINS`
  (defaults to `APP_URL`, `http://localhost:5173` locally). The `RateLimit`,
  `RateLimit-Policy` and `Retry-After` headers are readable from browser code.
- **JSON everywhere**, except the two uploads (`multipart/form-data`).
- **Ids** are 24-character hex strings (MongoDB ObjectIds). A malformed id in
  the URL returns 400.
- **Dates:** send `YYYY-MM-DD` (`watchedAt`, `plannedFor`); responses return
  ISO date-times.
- **Pagination:** `?page=1&limit=20` (limit up to 50). Pages answer
  `{ items, total, page, limit }`.
- **Every error** has the same shape, and the front should branch on `code`,
  not on the message:

  ```json
  { "message": "Movie not found", "status": 404, "code": "MOVIE_NOT_FOUND" }
  ```

  Validation errors (400 `VALIDATION_ERROR`) also bring
  `errors: [{ field, message }]`, useful to highlight form fields.

## Authentication

1. `POST /auth/login` with `{ email, password }` returns
   `{ accessToken, refreshToken }`.
2. Send `Authorization: Bearer <accessToken>` on protected routes. The access
   token lasts **1 hour**.
3. On 401 `TOKEN_EXPIRED`, call `POST /auth/refresh` with `{ refreshToken }` to
   get **both** tokens again (the refresh token lasts **7 days** and rotates),
   then retry the request. On any other 401 from refresh (`INVALID_TOKEN`,
   `TOKEN_REVOKED`), send the user to the login screen.
4. The user id is the JWT `sub` claim; routes under `/users/{id}` that change
   data only accept the logged user's own id (403 `FORBIDDEN_RESOURCE`
   otherwise). After logging in (and when the app opens with a stored session),
   load the logged user with `GET /users/{id}/account`: it is the only read that
   returns `email` and `emailVerified`.
5. **Log out** with `POST /auth/logout` `{ refreshToken }` (204), then drop both
   tokens. It revokes only that refresh token, so other devices stay logged in;
   a later refresh with it answers 401 `TOKEN_REVOKED`. The access token keeps
   working until it expires, so throw it away too.

Things the UI must handle:

- **Login rate limit:** after 5 failed logins for the same e-mail (or 50 from
  one IP) in 15 minutes, login answers 429 `TOO_MANY_ATTEMPTS`, even with the
  right password. Show a "try again later" message.
- **Changing the password** (`PATCH /users/{id}/password`) or **resetting it**
  revokes every refresh token, on every device, including the current one: the
  user has to log in again once the access token expires.
- **Changing the e-mail** (`PUT /users/{id}`) requires `currentPassword`
  (422 `CURRENT_PASSWORD_REQUIRED`, 401 `INVALID_CREDENTIALS`) and asks to
  confirm the new address.

## Screens and the routes behind them

### Sign-up, e-mail confirmation and password reset

| Step                  | Route                                                | Notes                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign up               | `POST /users` `{ name, email, password }`            | Password 8–72 chars with a letter and a number. 409 `EMAIL_TAKEN`. 5 accounts per IP per hour (429 `TOO_MANY_REQUESTS`). Sends a confirmation e-mail                        |
| Confirm e-mail page   | `POST /auth/verify-email` `{ token }`                | **The front must have a page at `APP_URL/verify-email?token=...`** that reads the token and calls this. 422 `INVALID_VERIFICATION_TOKEN` (used, invalid or older than 24 h) |
| "Resend confirmation" | `POST /users/{id}/email-verification`                | 409 `EMAIL_ALREADY_VERIFIED`; 3 per hour                                                                                                                                    |
| Forgot password       | `POST /auth/forgot-password` `{ email }`             | Always 204, even for unknown e-mails: show "if the account exists, an e-mail is on its way". 5 per IP every 15 min                                                          |
| Reset password page   | `POST /auth/reset-password` `{ token, newPassword }` | **The front must have a page at `APP_URL/reset-password?token=...`**. 422 `INVALID_RESET_TOKEN` (used, invalid or older than 1 h)                                           |

Unconfirmed users **can use the app normally**; the user object has
`emailVerified`, so the front can show a banner with a "resend" button.

### Profile and account

| Action                 | Route                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| My account             | `GET /users/{id}/account` (private user: `email`, `emailVerified`, avatar)                                                            |
| Edit name / e-mail     | `PUT /users/{id}` `{ name?, email?, currentPassword? }` (returns the private user, with `email` and `emailVerified`)                  |
| Change password        | `PATCH /users/{id}/password` `{ currentPassword, newPassword }`                                                                       |
| Upload / remove avatar | `PUT /users/{id}/avatar` (multipart field `avatar`) / `DELETE /users/{id}/avatar`                                                     |
| Delete account         | `DELETE /users/{id}` `{ password }` (also deletes movies, watchlist and images)                                                       |
| My stats               | `GET /users/{id}/stats` (private)                                                                                                     |
| Public profile         | `GET /users/{id}`, `GET /users?search=` (name, avatar, member since, movies count, average rating, favorites count; never the e-mail) |
| Profile movies         | `GET /users/{id}/movies` (public; same filters, sort and pagination as `GET /movies`; 404 `USER_NOT_FOUND`)                           |
| Review page            | `GET /users/{id}/movies/{movieId}` (public; 404 `MOVIE_NOT_FOUND`)                                                                    |

Stats return `totalMovies`, `totalWatches`, `averageRating`, `favoritesCount`,
`totalMinutes`, `ratingDistribution`, `moviesPerMonth` (last 12 months, months
without movies are omitted: fill them with 0 in charts) and `topGenres` (top 5).

Images (avatar and poster): JPEG, PNG or WebP up to **5 MB** (422
`INVALID_AVATAR_TYPE` / `INVALID_POSTER_TYPE`, 413 when too big). They are
stored in Cloudinary and come back as absolute URLs.

### Movie log ("my movies")

| Action        | Route                                                           | Notes                                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List          | `GET /movies`                                                   | `search` (title, ignores case and accents), `genreId`, `minRating`/`maxRating`, `favorite=true`, `sort=watchedAt\|rating\|title\|releaseYear\|watchCount`, `order=asc\|desc`                                |
| Details       | `GET /movies/{id}`                                              |                                                                                                                                                                                                             |
| Log a movie   | `POST /movies`                                                  | Required: `title`, `synopsis`, `releaseYear`, `genreIds` (1–5), `rating`. Optional: `review`, `director`, `durationMinutes`, `watchedAt` (default today), `isFavorite`, `watchCount`, `tmdbId`, `posterUrl` |
| Edit          | `PUT /movies/{id}`                                              | Replaces the movie: `title`, `synopsis`, `releaseYear`, `genreIds` and `rating` are required, like on create; `posterUrl: null` removes the poster                                                          |
| Delete        | `DELETE /movies/{id}`                                           |                                                                                                                                                                                                             |
| Favorite      | `PATCH /movies/{id}/favorite` `{ isFavorite }`                  |                                                                                                                                                                                                             |
| Watched again | `POST /movies/{id}/rewatch` `{ watchedAt? }`                    | Adds 1 to `watchCount`; `watchedAt` is the last watch                                                                                                                                                       |
| Poster upload | `PUT /movies/{id}/poster` (multipart field `poster`) / `DELETE` |                                                                                                                                                                                                             |

Rules to mirror in forms: rating 1–10 in steps of 0.5 (`INVALID_RATING`);
release year from 1888 to next year (`INVALID_RELEASE_YEAR`); `watchedAt` not
in the future (`INVALID_WATCHED_AT`); the same movie (same `tmdbId`, or same
title and year) cannot be logged twice (409 `MOVIE_ALREADY_LOGGED`).

### Watchlist and "next movies"

| Action                    | Route                                                                         | Notes                                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add                       | `POST /watchlist`                                                             | Only `title` is required. Optional: `releaseYear`, `tmdbId`, `posterUrl`, `synopsis`, `genreIds`, `director`, `durationMinutes`, `priority` (`high`/`medium`/`low`, default `medium`), `note`, `plannedFor` (date)                             |
| List                      | `GET /watchlist`                                                              | `search`, `priority`, `planned=true` (next movies) / `false` (some day), `sort=addedAt\|priority\|plannedFor`                                                                                                                                  |
| Next movies section       | `GET /watchlist?planned=true&sort=plannedFor`                                 | Soonest first                                                                                                                                                                                                                                  |
| Edit                      | `PUT /watchlist/{id}`                                                         | Only the fields sent; `null` clears dates and optional data, `""` clears texts                                                                                                                                                                 |
| Remove                    | `DELETE /watchlist/{id}`                                                      |                                                                                                                                                                                                                                                |
| **"I watched it" button** | `POST /watchlist/{id}/watched` `{ rating, review?, watchedAt?, isFavorite? }` | Creates the movie from the item and removes the item (201 with the movie). If the item lacks `synopsis`, `releaseYear` or `genreIds`, it answers 422 `INCOMPLETE_MOVIE` naming them: ask for them on the same screen and send them in the body |

A movie already in the watchlist (409 `ALREADY_IN_WATCHLIST`) or already
watched (409 `MOVIE_ALREADY_LOGGED`) cannot be added again.

### Prefilling from TMDB

`GET /tmdb/search?query=...&page=1` (logged users only) returns movies with
`tmdbId`, `title`, `originalTitle`, `releaseYear`, `synopsis`, `posterUrl` and
`genreIds` **already converted to our genre ids**, ready to send to
`POST /movies` or `POST /watchlist`. Pages hold 20 results. 503
`MOVIE_CATALOG_UNAVAILABLE` when TMDB is down: let the user type the data.

`GET /genres` (public) lists the 19 genres (`id`, `name` in pt-BR) for pickers
and filters.

## Errors worth a dedicated message

| Code                                                                                           | Where                                                | Suggested UI                                            |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| `TOKEN_EXPIRED`                                                                                | any protected route                                  | refresh silently and retry                              |
| `TOKEN_REVOKED`, `INVALID_TOKEN`                                                               | refresh (after a logout, a password change or reset) | back to login                                           |
| `TOO_MANY_ATTEMPTS`, `TOO_MANY_REQUESTS`                                                       | login, sign-up, e-mail routes                        | "try again later" (the `RateLimit` header has the wait) |
| `EMAIL_TAKEN`                                                                                  | sign-up, profile                                     | field error on e-mail                                   |
| `MOVIE_ALREADY_LOGGED`, `ALREADY_IN_WATCHLIST`                                                 | add movie / watchlist                                | link to the existing item                               |
| `INCOMPLETE_MOVIE`                                                                             | "I watched it"                                       | ask for the missing fields                              |
| `STORAGE_UNAVAILABLE`, `EMAIL_UNAVAILABLE`, `MOVIE_CATALOG_UNAVAILABLE`, `SERVICE_UNAVAILABLE` | uploads, e-mails, TMDB, database                     | temporary failure, retry later                          |

## Still missing on the back-end

- **Public deploy** (platform not chosen yet). The front will need its URL, and
  the API needs the front's URL in `APP_URL` for the e-mail links and in
  `CORS_ORIGINS` (comma-separated, defaults to `APP_URL`) so browsers can call
  it. Native apps are not affected by CORS.
- **E-mails to real users** need a domain verified in Resend; until then the
  default sender only delivers to the Resend account owner. Locally, without
  `RESEND_API_KEY`, the API writes the e-mail links to its log instead.
