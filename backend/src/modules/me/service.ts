import { AppHttpError } from "../../errors/appHttpError.js";
import type { MeRepository } from "./repository.js";

export interface MeDto {
  user_id: string;
  /** The person's name, from their Instagram profile; null when they have none or it is not known yet. */
  display_name: string | null;
  /** Instagram username, without @; null for an account not linked to Instagram. */
  instagram_username: string | null;
  /** When the account was created. */
  created_at: string;
  saved_count: number;
}

export class MeService {
  constructor(private readonly repo: MeRepository) {}

  async getMe(userId: string): Promise<MeDto> {
    const { user, instagram, savedCount } = await this.repo.getProfileRows(userId);
    // Every Auth user gets a `users` row from a trigger; none means the account is gone.
    if (!user) throw new AppHttpError(404, "Profile not found", "PROFILE_NOT_FOUND");
    return {
      user_id: userId,
      display_name: instagram?.display_name ?? null,
      instagram_username: instagram?.username ?? null,
      created_at: user.created_at,
      saved_count: savedCount,
    };
  }
}
