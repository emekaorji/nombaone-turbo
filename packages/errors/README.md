# `@nombaone/errors`

`@nombaone/errors` is the shared vocabulary for API failures.

It exports:

- `HTTP_STATUS_CODES`
- `NOMBAONE_ERROR_CODES`
- `AppError`
- `NombaoneErrorCode`, `HttpStatusCode`, and `ApiFieldErrors`

Use it when the server and the client both need to understand the same failure state.
Do not put Express middleware, response formatters, logger behavior, or app-specific retry logic here.

Typical usage:

```ts
import { AppError, NOMBAONE_ERROR_CODES, HTTP_STATUS_CODES } from '@nombaone/errors';

throw new AppError(
  'User not found',
  HTTP_STATUS_CODES.NOT_FOUND,
  undefined,
  NOMBAONE_ERROR_CODES.USER_NOT_FOUND
);
```

You can also use the static helpers such as `AppError.BadRequest(...)` and `AppError.UnprocessableEntity(...)`.

Behavior worth knowing:

- invalid status values normalize to `500`
- omitted codes fall back from the status mapping
- `fieldErrors` stay attached for the HTTP layer to serialize

Add a new error code only when the distinction is stable and a caller may branch on it. If the nuance is only useful for logs, keep it out of `NOMBAONE_ERROR_CODES`.

The split is intentional:

- `@nombaone/errors` owns error meaning
- `@nombaone/server/http` owns response transport

Keep that boundary clean.
