import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(seasonId: string, userId: string) {
    const season = await this.prisma.season.findUnique({
      where: {
        id: seasonId,
      },
    });

    if (!season) {
      throw new NotFoundException('Season not found');
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: season.leagueId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this league');
    }

    const members = await this.prisma.leagueMember.findMany({
      where: {
        leagueId: season.leagueId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const picks = await this.prisma.pick.findMany({
      where: {
        gameweek: {
          seasonId,
        },
      },
      include: {
        gameweek: {
          select: {
            id: true,
          },
        },
      },
    });

    const results = await this.prisma.gameweekTeamResult.findMany({
      where: {
        gameweek: {
          seasonId,
        },
      },
      select: {
        gameweekId: true,
        teamId: true,
        goalsFor: true,
        goalsAgainst: true,
      },
    });

    const resultsByGameweekAndTeam = new Map<
      string,
      {
        goalsFor: number;
        goalsAgainst: number;
      }
    >();

    for (const result of results) {
      resultsByGameweekAndTeam.set(`${result.gameweekId}:${result.teamId}`, {
        goalsFor: result.goalsFor,
        goalsAgainst: result.goalsAgainst,
      });
    }

    const pointsByUser = new Map<string, number>();
    const goalDifferenceByUser = new Map<string, number>();

    for (const pick of picks) {
      pointsByUser.set(
        pick.userId,
        (pointsByUser.get(pick.userId) ?? 0) + pick.totalPoints,
      );

      const result = resultsByGameweekAndTeam.get(
        `${pick.gameweekId}:${pick.teamId}`,
      );

      if (result) {
        const goalDifference = result.goalsFor - result.goalsAgainst;

        goalDifferenceByUser.set(
          pick.userId,
          (goalDifferenceByUser.get(pick.userId) ?? 0) + goalDifference,
        );
      }
    }

    return members
      .map((member) => ({
        userId: member.user.id,
        name: member.user.name,
        points: pointsByUser.get(member.user.id) ?? 0,
        goalDifference: goalDifferenceByUser.get(member.user.id) ?? 0,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }

        return b.goalDifference - a.goalDifference;
      })
      .map((player, index) => ({
        rank: index + 1,
        ...player,
      }));
  }
}
