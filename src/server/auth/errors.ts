export class AuthError extends Error {
  status = 401;
}

export class ForbiddenError extends Error {
  status = 403;
}
