import z from "zod";

export const UserSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
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
});

export type UserType = z.infer<typeof UserSchema>;
