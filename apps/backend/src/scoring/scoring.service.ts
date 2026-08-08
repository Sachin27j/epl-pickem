import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async scoreGameweek(gameweekId: string, userId: string) {
    const gameweek = await this.prisma.seasonGameweek.findUnique({
      where: {
        id: gameweekId,
      },
      include: {
        season: true,
      },
    });

    if (!gameweek) {
      throw new NotFoundException('Gameweek not found');
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: gameweek.season.leagueId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this league');
    }

    if (membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only league admins can calculate scores');
    }

    const picks = await this.prisma.pick.findMany({
      where: {
        gameweekId,
      },
    });

    for (const pick of picks) {
      const result = await this.prisma.gameweekTeamResult.findUnique({
        where: {
          gameweekId_teamId: {
            gameweekId,
            teamId: pick.teamId,
          },
        },
      });

      if (!result) {
        continue;
      }

      let basePoints = 0;
      let gdBonus = 0;

      if (result.goalsFor > result.goalsAgainst) {
        basePoints = 3;

        if (result.goalsFor - result.goalsAgainst >= 3) {
          gdBonus = 1;
        }
      } else if (result.goalsFor === result.goalsAgainst) {
        basePoints = 1;
      } else if (result.goalsAgainst - result.goalsFor >= 3) {
        gdBonus = -1;
      }

      const scoreBeforeBoost = basePoints + gdBonus;

      const predictionCorrect =
        pick.predictionBoostUsed &&
        pick.predictedHomeGoals === result.goalsFor &&
        pick.predictedAwayGoals === result.goalsAgainst;

      const predictionMultiplier = predictionCorrect ? 2 : 1;

      const totalPoints = scoreBeforeBoost * predictionMultiplier;

      await this.prisma.pick.update({
        where: {
          id: pick.id,
        },
        data: {
          basePoints,
          gdBonus,
          predictionMultiplier,
          totalPoints,
        },
      });
    }

    return {
      message: 'Gameweek scores calculated successfully',
    };
  }
}
