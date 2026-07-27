import {
  CreateUserDTO,
  LoginUserDTO,
  UpdateUserDTO,
} from "../../dtos/user.dto";
import { UserRepository } from "../../repositories/user.repository";
import bcryptjs from "bcryptjs";
import { HttpError } from "../../errors/http-error";
import { toSafeUser } from "../../config/toSafeUser";

let userRepository = new UserRepository();

export class AdminUserService {
  async createUser(data: CreateUserDTO) {
    const emailCheck = await userRepository.getUserByEmail(data.email);
    if (emailCheck) throw new HttpError(403, "Email already in use");

    const usernameCheck = await userRepository.getUserByUsername(data.username);
    if (usernameCheck) throw new HttpError(403, "Username already in use");

    const hashedPassword = await bcryptjs.hash(data.password, 10);
    data.password = hashedPassword;

    const newUser = await userRepository.createUser(data);
    return toSafeUser(newUser);
  }

  async getAllUsers({
    page,
    size,
    search,
    filter,
  }: {
    page?: string;
    size?: string;
    search?: string;
    filter?: Record<string, any>;
  }) {
    const currentPage = page ? parseInt(page) : 1;
    const pageSize = size ? parseInt(size) : 10;
    const currentSearch = search || "";

    const { users, total } = await userRepository.getAllUsers({
      page: currentPage,
      size: pageSize,
      search: currentSearch,
      filter,
    });

    const pagination = {
      page: currentPage,
      size: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };

    return { users, pagination };
  }

  async deleteUser(id: string, callingAdminId?: string) {
    if (callingAdminId && String(id) === String(callingAdminId)) {
      throw new HttpError(400, "You cannot delete your own account");
    }

    const user = await userRepository.getUserById(id);
    if (!user) throw new HttpError(404, "User not found");

    const deleted = await userRepository.deleteUser(id);
    return deleted;
  }
  async updateUser(
    id: string,
    updateData: UpdateUserDTO,
    callingAdminId?: string,
  ) {
    const user = await userRepository.getUserById(id);
    if (!user) throw new HttpError(404, "User not found");

    const { password, role, ...rest } = updateData as any;
    const safeUpdate: any = { ...rest };

    if (role) {
      // NEW — block an admin from demoting their own account via this endpoint
      if (
        callingAdminId &&
        String(id) === String(callingAdminId) &&
        role !== "admin"
      ) {
        throw new HttpError(400, "You cannot change your own admin role");
      }
      safeUpdate.role = role;
    }

    if (password) {
      safeUpdate.password = await bcryptjs.hash(password, 12);
    }

    const updatedUser = await userRepository.updateUser(id, safeUpdate);
    if (!updatedUser) throw new HttpError(404, "User not found");

    return toSafeUser(updatedUser); // once you've extracted the shared utility
  }

  async getUserById(id: string) {
    const user = await userRepository.getUserById(id);
    if (!user) throw new HttpError(404, "User not found");
    return toSafeUser(user);
  }
}
