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

    if (gameweek.status !== 'LOCKED' && gameweek.status !== 'REVEALED') {
      throw new ForbiddenException(
        'Gameweek must be locked before scores can be calculated',
      );
    }

    const picks = await this.prisma.pick.findMany({
      where: {
        gameweekId,
      },
    });

    const results = await this.prisma.gameweekTeamResult.findMany({
      where: {
        gameweekId,
      },
    });

    const resultsByTeam = new Map<string, (typeof results)[number]>(
      results.map((result) => [result.teamId, result]),
    );

    const missingResult = picks.find((pick) => !resultsByTeam.has(pick.teamId));

    if (missingResult) {
      throw new ForbiddenException(
        'Results are missing for one or more selected teams',
      );
    }

    for (const pick of picks) {
      const result = resultsByTeam.get(pick.teamId);

      if (!result) {
        continue;
      }

      let basePoints = 0;
      let gdBonus = 0;

      const goalDifference = Math.abs(
        result.goalsFor - result.goalsAgainst,
      );

      if (result.goalsFor > result.goalsAgainst) {
        // Win: +3 points
        basePoints = 3;

        // +1 for every 3-goal winning margin
        gdBonus = Math.floor(goalDifference / 3);
      } else if (result.goalsFor === result.goalsAgainst) {
        // Draw: +1 point
        basePoints = 1;
      } else {
        // Loss: -3 points
        basePoints = -3;

        // -1 for every 3-goal losing margin
        gdBonus = -Math.floor(goalDifference / 3);
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
