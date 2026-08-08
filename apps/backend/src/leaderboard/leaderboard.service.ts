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
      select: {
        userId: true,
        totalPoints: true,
      },
    });

    const pointsByUser = new Map<string, number>();

    for (const pick of picks) {
      pointsByUser.set(
        pick.userId,
        (pointsByUser.get(pick.userId) ?? 0) + pick.totalPoints,
      );
    }

    return members
      .map((member) => ({
        userId: member.user.id,
        name: member.user.name,
        points: pointsByUser.get(member.user.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points)
      .map((player, index) => ({
        rank: index + 1,
        ...player,
      }));
  }
}
