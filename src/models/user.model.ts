import mongoose, { Document, Schema, Types } from "mongoose";
import { UserType } from "../types/user.type";
type UserSchemaType = UserType & {
  failedLoginAttempts?: number;
  lockUntil?: Date | null;
  fcmToken?: string | null;
  passwordResetCode?: string | null;
  passwordResetExpires?: Date | null;
  tokenVersion?: number;
};

const UserSchema: Schema = new Schema<UserSchemaType>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    image: { type: String, required: false },
    phoneNumber: { type: String, required: false },
    location: { type: String, required: false },
    gender: { type: String, required: false },
    DOB: { type: String, required: false },
    // firstName: { type: String },
    // lastName: { type: String },
    role: {
      type: String,
      enum: ["user", "admin", "driver"],
      default: "user",
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    fcmToken: { type: String, default: null },
    passwordResetCode: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    loginOtpCodeHash: { type: String, default: null, select: false },
    loginOtpExpires: { type: Date, default: null },
    loginOtpAttempts: { type: Number, default: 0 },
    loginOtpLockedUntil: { type: Date, default: null },
  },

  {
    timestamps: true,
  },
);

export interface IUser extends UserType, Document {
  lockUntil: Date;
  tokenVersion: number;
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const UserModel = mongoose.model<IUser>("User", UserSchema);
