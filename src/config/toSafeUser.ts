export function toSafeUser(user: any) {
  const obj = typeof user.toObject === "function" ? user.toObject() : user;
  const {
    password,
    passwordResetCode,
    passwordResetExpires,
    loginOtpCodeHash,
    loginOtpExpires,
    loginOtpAttempts,
    loginOtpLockedUntil,
    failedLoginAttempts,
    lockUntil,
    __v,
    ...safe
  } = obj;
  return safe;
}
