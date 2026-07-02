import mongoose, { Document, Schema, Types } from "mongoose";
import { UserType } from "../types/user.type";
const UserSchema: Schema = new Schema<UserType>(
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

    fcmToken: { type: String, default: null },

    passwordResetCode: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
  },

  {
    timestamps: true, // auto createdAt and updatedAt
  },
);

export interface IUser extends UserType, Document {
  // combine UserType and Document
  _id: mongoose.Types.ObjectId; // mongo related attribute/ custom attributes
  createdAt: Date;
  updatedAt: Date;
}

export const UserModel = mongoose.model<IUser>("User", UserSchema);
// UserModel is the mongoose model for User collection
// db.users in MongoDB
