import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { CreateGameweekDto } from './dto/create-gameweek.dto';
import { CreateGameweekResultDto } from './dto/create-gameweek-result.dto';

@Injectable()
export class SeasonService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeasonDto, userId: string) {
    const membership = await this.prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: dto.leagueId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('League not found');
    }

    if (membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only league admins can create a season');
    }

    return this.prisma.season.create({
      data: {
        leagueId: dto.leagueId,
        name: dto.name,
        status: 'UPCOMING',
      },
    });
  }

  async createGameweek(
    seasonId: string,
    dto: CreateGameweekDto,
    userId: string,
  ) {
    const season = await this.prisma.season.findUnique({
      where: {
        id: seasonId,
      },
      include: {
        league: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!season) {
      throw new NotFoundException('Season not found');
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: season.league.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('League not found');
    }

    if (membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only league admins can create a gameweek');
    }

    return this.prisma.seasonGameweek.create({
      data: {
        seasonId,
        number: dto.number,
        deadline: new Date(dto.deadline),
        status: 'UPCOMING',
      },
    });
  }
  async createResult(
    seasonId: string,
    gameweekId: string,
    dto: CreateGameweekResultDto,
    userId: string,
  ) {
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

    if (membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only league admins can add results');
    }

    const gameweek = await this.prisma.seasonGameweek.findUnique({
      where: {
        id: gameweekId,
      },
    });

    if (!gameweek || gameweek.seasonId !== seasonId) {
      throw new NotFoundException('Gameweek not found');
    }

    const team = await this.prisma.team.findUnique({
      where: {
        id: dto.teamId,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return this.prisma.gameweekTeamResult.upsert({
      where: {
        gameweekId_teamId: {
          gameweekId,
          teamId: dto.teamId,
        },
      },
      update: {
        goalsFor: dto.goalsFor,
        goalsAgainst: dto.goalsAgainst,
      },
      create: {
        gameweekId,
        teamId: dto.teamId,
        goalsFor: dto.goalsFor,
        goalsAgainst: dto.goalsAgainst,
      },
    });
  }
}
