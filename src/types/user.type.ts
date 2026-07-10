import z from "zod";

export const UserSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
  // firstName: z.string().optional(),
  // lastName: z.string().optional(),
  phoneNumber: z.string().max(10).optional(),
  location: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  DOB: z.string().optional(),
  role: z.enum(["user", "admin", "driver"]).default("user"),
  image: z.string().optional(),

  passwordResetCode: z.string().nullable().optional(),
  passwordResetExpires: z.date().nullable().optional(),
  fcmToken: z.string().optional(),

  loginOtpCodeHash: z.string().nullable().optional(),
  loginOtpExpires: z.date().nullable().optional(),
  loginOtpAttempts: z.number().int().min(0).optional(),
  loginOtpLockedUntil: z.date().nullable().optional(),
});

export type UserType = z.infer<typeof UserSchema>;
