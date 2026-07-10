import z from "zod";
import { UserSchema } from "../types/user.type";
// re-use UserSchema from types
export const CreateUserDTO = UserSchema.pick({
  // firstName: true,
  // lastName: true,
  email: true,
  username: true,
  password: true,
  image: true,
  location: true,
  phoneNumber: true,
  DOB: true,
  gender: true,
})
  .extend(
    // add new attribute to zod
    {
      confirmPassword: z
        .string()
        .min(10, "Password must be at least 10 characters")
        .regex(/[a-z]/, "Must contain a lowercase letter")
        .regex(/[A-Z]/, "Must contain an uppercase letter")
        .regex(/[0-9]/, "Must contain a number")
        .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
      role: z.enum(["user", "admin", "driver"]).default("user"),
    },
  )
  .refine(
    // extra validation for confirmPassword
    (data) => data.password === data.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    },
  );
export type CreateUserDTO = z.infer<typeof CreateUserDTO>;

export const LoginUserDTO = z.object({
  email: z.email(),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
});
export type LoginUserDTO = z.infer<typeof LoginUserDTO>;

export const UpdateUserDTO = UserSchema.partial();
export type UpdateUserDTO = z.infer<typeof UpdateUserDTO>;

export const UpdateProfileDTO = UserSchema.partial()
  .omit({ password: true, role: true })
  .strict();
export type UpdateProfileDTO = z.infer<typeof UpdateProfileDTO>;
export const SaveFcmTokenDTO = z.object({
  token: z.string().min(10, "Invalid FCM token"),
});
export const VerifyLoginOtpDTO = z.object({
  tempToken: z.string().min(10, "Invalid session token"),
  code: z.string().regex(/^\d{6}$/, "Code must be exactly 6 digits"),
});
export type VerifyLoginOtpDTO = z.infer<typeof VerifyLoginOtpDTO>;
export type SaveFcmTokenDTO = z.infer<typeof SaveFcmTokenDTO>;
