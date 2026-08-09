import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreatePickDto } from './dto/create-pick.dto';
import { UpdatePickDto } from './dto/update-pick.dto';

@Injectable()
export class PickService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePickDto, userId: string) {
    const gameweek = await this.prisma.seasonGameweek.findUnique({
      where: {
        id: dto.gameweekId,
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

    const isPastDeadline = new Date() > gameweek.deadline;

    if (gameweek.status === 'REVEALED') {
      throw new ForbiddenException('This gameweek has already been revealed');
    }

    if (gameweek.status !== 'OPEN' && !dto.latePassUsed) {
      throw new ForbiddenException(
        'Picks are not currently open for this gameweek',
      );
    }

    if (isPastDeadline && !dto.latePassUsed) {
      throw new ForbiddenException('The deadline for this gameweek has passed');
    }

    const team = await this.prisma.team.findUnique({
      where: {
        id: dto.teamId,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const existingPick = await this.prisma.pick.findUnique({
      where: {
        userId_gameweekId: {
          userId,
          gameweekId: dto.gameweekId,
        },
      },
    });

    if (existingPick) {
      throw new ConflictException(
        'You have already submitted a pick for this gameweek',
      );
    }

    if (dto.predictionBoostUsed) {
      if (
        dto.predictedHomeGoals === undefined ||
        dto.predictedAwayGoals === undefined
      ) {
        throw new ForbiddenException(
          'A score prediction is required when using Prediction Boost',
        );
      }

      const boostsUsed = await this.prisma.pick.count({
        where: {
          userId,
          predictionBoostUsed: true,
          gameweek: {
            seasonId: gameweek.seasonId,
          },
        },
      });

      if (boostsUsed >= 5) {
        throw new ForbiddenException(
          'You have used all 5 Prediction Boosts for this season',
        );
      }
    }

    if (dto.latePassUsed) {
      const latePassesUsed = await this.prisma.pick.count({
        where: {
          userId,
          latePassUsed: true,
          gameweek: {
            seasonId: gameweek.seasonId,
          },
        },
      });

      if (latePassesUsed >= 3) {
        throw new ForbiddenException(
          'You have used all 3 Late Passes for this season',
        );
      }
    }

    const previousGameweek = await this.prisma.seasonGameweek.findFirst({
      where: {
        seasonId: gameweek.seasonId,
        number: {
          lt: gameweek.number,
        },
      },
      orderBy: {
        number: 'desc',
      },
    });

    if (previousGameweek) {
      const previousPick = await this.prisma.pick.findUnique({
        where: {
          userId_gameweekId: {
            userId,
            gameweekId: previousGameweek.id,
          },
        },
      });

      if (previousPick && previousPick.teamId === dto.teamId) {
        throw new ConflictException(
          'You cannot pick the same team in consecutive gameweeks',
        );
      }
    }

    return this.prisma.pick.create({
      data: {
        userId,
        gameweekId: dto.gameweekId,
        teamId: dto.teamId,
        predictionBoostUsed: dto.predictionBoostUsed ?? false,
        predictedHomeGoals: dto.predictedHomeGoals,
        predictedAwayGoals: dto.predictedAwayGoals,
        latePassUsed: dto.latePassUsed ?? false,
      },
    });
  }

  async getMyPick(gameweekId: string, userId: string) {
    return this.prisma.pick.findUnique({
      where: {
        userId_gameweekId: {
          userId,
          gameweekId,
        },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdatePickDto, userId: string) {
    const pick = await this.prisma.pick.findUnique({
      where: {
        id,
      },
      include: {
        gameweek: {
          include: {
            season: true,
          },
        },
      },
    });

    if (!pick) {
      throw new NotFoundException('Pick not found');
    }

    if (pick.userId !== userId) {
      throw new ForbiddenException('You can only update your own pick');
    }

    const isPastDeadline = new Date() > pick.gameweek.deadline;

    if (pick.gameweek.status === 'REVEALED') {
      throw new ForbiddenException('This gameweek has already been revealed');
    }

    if (pick.gameweek.status !== 'OPEN' && !dto.latePassUsed) {
      throw new ForbiddenException('Picks are not currently open');
    }

    if (isPastDeadline && !dto.latePassUsed) {
      throw new ForbiddenException('The deadline for this gameweek has passed');
    }

    if (dto.latePassUsed) {
      if (pick.latePassUsed) {
        throw new ConflictException(
          'A Late Pass has already been used for this pick',
        );
      }

      const latePassesUsed = await this.prisma.pick.count({
        where: {
          userId,
          latePassUsed: true,
          gameweek: {
            seasonId: pick.gameweek.seasonId,
          },
        },
      });

      if (latePassesUsed >= 3) {
        throw new ForbiddenException(
          'You have used all 3 Late Passes for this season',
        );
      }
    }

    const team = await this.prisma.team.findUnique({
      where: {
        id: dto.teamId,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.id === pick.teamId) {
      throw new ConflictException('You have already selected this team');
    }

    const previousGameweek = await this.prisma.seasonGameweek.findFirst({
      where: {
        seasonId: pick.gameweek.seasonId,
        number: {
          lt: pick.gameweek.number,
        },
      },
      orderBy: {
        number: 'desc',
      },
    });

    if (previousGameweek) {
      const previousPick = await this.prisma.pick.findUnique({
        where: {
          userId_gameweekId: {
            userId,
            gameweekId: previousGameweek.id,
          },
        },
      });

      if (previousPick && previousPick.teamId === dto.teamId) {
        throw new ConflictException(
          'You cannot pick the same team in consecutive gameweeks',
        );
      }
    }

    return this.prisma.pick.update({
      where: {
        id,
      },
      data: {
        teamId: dto.teamId,
        latePassUsed: pick.latePassUsed || dto.latePassUsed === true,
      },
    });
  }
}
