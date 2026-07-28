import { QueryFilter, Types } from "mongoose";
import { UserModel, IUser } from "../models/user.model";
export interface IUserRepository {
  getUserByEmail(email: string): Promise<IUser | null>;
  getUserByUsername(username: string): Promise<IUser | null>;

  createUser(userData: Partial<IUser>): Promise<IUser>;
  getUserById(id: string): Promise<IUser | null>;
  getAllUsers({
    page,
    size,
    search,
  }: {
    page: number;
    size: number;
    search?: string;
  }): Promise<{ users: IUser[]; total: number }>;
  updateUser(id: string, updateData: Partial<IUser>): Promise<IUser | null>;
  deleteUser(id: string): Promise<boolean>;
}
export class UserRepository implements IUserRepository {
  async createUser(userData: Partial<IUser>): Promise<IUser> {
    const user = new UserModel(userData);
    return await user.save();
  }
  async getUserByEmail(email: string): Promise<IUser | null> {
    const user = await UserModel.findOne({ email: email });
    return user;
  }
  async getUserByUsername(username: string): Promise<IUser | null> {
    const user = await UserModel.findOne({ username: username });
    return user;
  }

  async getUserById(id: string): Promise<IUser | null> {
    const user = await UserModel.findById(id);
    return user;
  }
  async getAllUsers({
    page,
    size,
    search,
    filter: baseFilter,
  }: {
    page: number;
    size: number;
    search?: string;
    filter?: Record<string, any>;
  }): Promise<{ users: IUser[]; total: number }> {
    const query: any = { ...(baseFilter || {}) };

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select("email username role location phoneNumber DOB gender")
        .skip((page - 1) * size)
        .limit(size),
      UserModel.countDocuments(query),
    ]);

    return { users, total };
  }

  async updateUser(
    id: string,
    updateData: Partial<IUser>,
  ): Promise<IUser | null> {
    const updatedUser = await UserModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await UserModel.findByIdAndDelete(id);
    return result ? true : false;
  }
  async saveFcmToken(userId: string, token: string) {
    return UserModel.findByIdAndUpdate(
      userId,
      { fcmToken: token },
      { new: true },
    );
  }
}
