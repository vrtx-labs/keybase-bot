import ClientBase from "../client-base/index.js";
import type * as keybase1 from "../types/keybase1/index.js";

export interface CreateTeamParam {
  team: string;
}

export interface AddMembersParam {
  team: string;
  emails?: keybase1.MemberEmail[];
  usernames?: keybase1.MemberUsername[];
}

export interface RemoveMemberParam {
  team: string;
  username: string;
}

export interface ListTeamMembershipsParam {
  team: string;
}

/** The team module of your Keybase bot. */
class Team extends ClientBase {
  public async create(creation: CreateTeamParam): Promise<keybase1.TeamCreateResult> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "team",
      method: "create-team",
      options: creation,
    });
    if (!res) throw new Error("create");
    return res;
  }

  public async addMembers(additions: AddMembersParam): Promise<keybase1.TeamAddMemberResult> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "team",
      method: "add-members",
      options: additions,
    });
    if (!res) throw new Error("addMembers");
    return res;
  }

  public async removeMember(removal: RemoveMemberParam): Promise<void> {
    await this._guardInitialized();
    await this._runApiCommand({ apiName: "team", method: "remove-member", options: removal });
  }

  public async listTeamMemberships(
    team: ListTeamMembershipsParam,
  ): Promise<keybase1.TeamDetails> {
    await this._guardInitialized();
    const res = await this._runApiCommand({
      apiName: "team",
      method: "list-team-memberships",
      options: team,
    });
    if (!res) throw new Error("listTeamMemberships");
    return res;
  }
}

export default Team;
