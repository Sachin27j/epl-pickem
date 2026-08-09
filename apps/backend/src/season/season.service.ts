import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateGameweekDto } from './dto/create-gameweek.dto';
import { CreateGameweekResultDto } from './dto/create-gameweek-result.dto';
import { CreateSeasonDto } from './dto/create-season.dto';

@Injectable()
export class SeasonService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeasonDto, userId: string) {
    const league = await this.prisma.league.findUnique({
      where: {
        id: dto.leagueId,
      },
    });

    if (!league) {
      throw new NotFoundException('League not found');
    }

    const membership = await this.prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: dto.leagueId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this league');
    }

    if (membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only league admins can create seasons');
    }

    return this.prisma.season.create({
      data: {
        leagueId: dto.leagueId,
        name: dto.name,
        status: 'UPCOMING',
      },
    });
  }

  async getSeason(seasonId: string, userId: string) {
    const season = await this.prisma.season.findUnique({
      where: {
        id: seasonId,
      },
      include: {
        gameweeks: {
          orderBy: {
            number: 'asc',
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
          leagueId: season.leagueId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this league');
    }

    return season;
  }

  async activateSeason(seasonId: string, userId: string) {
    const season = await this.getAdminSeason(seasonId, userId);

    if (season.status !== 'UPCOMING') {
      throw new ForbiddenException('Only an upcoming season can be activated');
    }

    return this.prisma.season.update({
      where: {
        id: seasonId,
      },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  async completeSeason(seasonId: string, userId: string) {
    const season = await this.getAdminSeason(seasonId, userId);

    if (season.status !== 'ACTIVE') {
      throw new ForbiddenException('Only an active season can be completed');
    }

    const unfinishedGameweeks = await this.prisma.seasonGameweek.count({
      where: {
        seasonId,
        status: {
          not: 'REVEALED',
        },
      },
    });

    if (unfinishedGameweeks > 0) {
      throw new ForbiddenException(
        'All gameweeks must be revealed before completing the season',
      );
    }

    return this.prisma.season.update({
      where: {
        id: seasonId,
      },
      data: {
        status: 'COMPLETED',
      },
    });
  }

  async createGameweek(
    seasonId: string,
    dto: CreateGameweekDto,
    userId: string,
  ) {
    const season = await this.getAdminSeason(seasonId, userId);

    if (season.status === 'COMPLETED') {
      throw new ForbiddenException(
        'Cannot create a gameweek for a completed season',
      );
    }

    const deadline = new Date(dto.deadline);

    if (deadline <= new Date()) {
      throw new ConflictException('Gameweek deadline must be in the future');
    }

    const existingGameweek = await this.prisma.seasonGameweek.findUnique({
      where: {
        seasonId_number: {
          seasonId,
          number: dto.number,
        },
      },
    });

    if (existingGameweek) {
      throw new ConflictException('A gameweek with this number already exists');
    }

    return this.prisma.seasonGameweek.create({
      data: {
        seasonId,
        number: dto.number,
        deadline,
        status: 'UPCOMING',
      },
    });
  }

  async openGameweek(seasonId: string, gameweekId: string, userId: string) {
    const season = await this.getAdminSeason(seasonId, userId);

    if (season.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'The season must be active before a gameweek can be opened',
      );
    }

    const gameweek = await this.getAdminGameweek(seasonId, gameweekId, userId);

    if (gameweek.status !== 'UPCOMING') {
      throw new ForbiddenException('Only an upcoming gameweek can be opened');
    }

    return this.prisma.seasonGameweek.update({
      where: {
        id: gameweekId,
      },
      data: {
        status: 'OPEN',
      },
    });
  }

  async createResult(
    seasonId: string,
    gameweekId: string,
    dto: CreateGameweekResultDto,
    userId: string,
  ) {
    await this.getAdminSeason(seasonId, userId);

    const gameweek = await this.getAdminGameweek(seasonId, gameweekId, userId);

    if (gameweek.status !== 'LOCKED') {
      throw new ForbiddenException(
        'Gameweek must be locked before results can be added',
      );
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

  async lockGameweek(seasonId: string, gameweekId: string, userId: string) {
    const gameweek = await this.getAdminGameweek(seasonId, gameweekId, userId);

    if (gameweek.status !== 'OPEN') {
      throw new ForbiddenException('Only an open gameweek can be locked');
    }

    return this.prisma.seasonGameweek.update({
      where: {
        id: gameweekId,
      },
      data: {
        status: 'LOCKED',
      },
    });
  }

  async revealGameweek(seasonId: string, gameweekId: string, userId: string) {
    const gameweek = await this.getAdminGameweek(seasonId, gameweekId, userId);

    if (gameweek.status !== 'LOCKED') {
      throw new ForbiddenException('Only a locked gameweek can be revealed');
    }

    const picks = await this.prisma.pick.findMany({
      where: {
        gameweekId,
      },
      select: {
        teamId: true,
      },
    });

    const results = await this.prisma.gameweekTeamResult.findMany({
      where: {
        gameweekId,
      },
      select: {
        teamId: true,
      },
    });

    const resultTeamIds = new Set(results.map((result) => result.teamId));

    const missingResult = picks.some((pick) => !resultTeamIds.has(pick.teamId));

    if (missingResult) {
      throw new ForbiddenException(
        'Results are missing for one or more selected teams',
      );
    }

    return this.prisma.seasonGameweek.update({
      where: {
        id: gameweekId,
      },
      data: {
        status: 'REVEALED',
      },
    });
  }

  private async getAdminGameweek(
    seasonId: string,
    gameweekId: string,
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
      throw new ForbiddenException('Only league admins can manage gameweeks');
    }

    const gameweek = await this.prisma.seasonGameweek.findUnique({
      where: {
        id: gameweekId,
      },
    });

    if (!gameweek || gameweek.seasonId !== seasonId) {
      throw new NotFoundException('Gameweek not found');
    }

    return gameweek;
  }

  private async getAdminSeason(seasonId: string, userId: string) {
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
      throw new ForbiddenException('Only league admins can manage the season');
    }

    return season;
  }
}
