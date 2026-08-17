export function isValidCronAuthorization(expected: string | undefined, authorization: string | undefined) {
  return Boolean(expected && authorization === `Bearer ${expected}`);
}
