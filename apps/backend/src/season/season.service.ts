import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

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
        gameweekId: true,
        teamId: true,
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
      { goalsFor: number; goalsAgainst: number }
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
      include: {
        team: true,
      },
    });
  }

  async getResults(seasonId: string, gameweekId: string, userId: string) {
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

    const gameweek = await this.prisma.seasonGameweek.findUnique({
      where: {
        id: gameweekId,
      },
    });

    if (!gameweek || gameweek.seasonId !== seasonId) {
      throw new NotFoundException('Gameweek not found');
    }

    return this.prisma.gameweekTeamResult.findMany({
      where: {
        gameweekId,
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
      orderBy: {
        team: {
          name: 'asc',
        },
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

  /*
   * Automatically lock an open gameweek once its
   * 24-hour Late Pass window has expired.
   *
   * deadline + 24 hours = lock time.
   *
   * Runs once every minute.
   */
  @Interval(60_000)
  async lockExpiredGameweeks() {
    const now = new Date();

    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    await this.prisma.seasonGameweek.updateMany({
      where: {
        status: 'OPEN',
        deadline: {
          lte: cutoff,
        },
      },
      data: {
        status: 'LOCKED',
      },
    });
  }

  async requestLatePass(
    seasonId: string,
    gameweekId: string,
    userId: string,
    teamId: string,
  ) {
    const gameweek = await this.prisma.seasonGameweek.findFirst({
      where: {
        id: gameweekId,
        seasonId,
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

    if (gameweek.status !== 'OPEN') {
      throw new ForbiddenException(
        'Late Pass requests are not available for this gameweek',
      );
    }

    const now = new Date();

    if (now <= gameweek.deadline) {
      throw new ConflictException(
        'Late Pass can only be requested after the deadline',
      );
    }

    const cutoff = new Date(gameweek.deadline.getTime() + 24 * 60 * 60 * 1000);

    if (now >= cutoff) {
      throw new ForbiddenException('The Late Pass window has expired');
    }

    const team = await this.prisma.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const existingPick = await this.prisma.pick.findUnique({
      where: {
        userId_gameweekId: {
          userId,
          gameweekId,
        },
      },
    });

    if (existingPick) {
      throw new ConflictException('You already have a pick for this gameweek');
    }

    const existingRequest = await this.prisma.latePassRequest.findUnique({
      where: {
        userId_gameweekId: {
          userId,
          gameweekId,
        },
      },
    });

    if (existingRequest) {
      throw new ConflictException(
        'You have already requested a Late Pass for this gameweek',
      );
    }

    const latePassesUsed = await this.prisma.pick.count({
      where: {
        userId,
        latePassUsed: true,
        gameweek: {
          seasonId: gameweek.seasonId,
        },
      },
    });

    const settings = await this.prisma.leagueSettings.findUnique({
      where: {
        leagueId: gameweek.season.leagueId,
      },
    });

    const maxLatePasses = settings?.latePasses ?? 3;

    if (latePassesUsed >= maxLatePasses) {
      throw new ForbiddenException(
        'You have used all of your Late Passes for this season',
      );
    }

    return this.prisma.latePassRequest.create({
      data: {
        userId,
        gameweekId,
        teamId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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

  async getLatePassRequests(
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

    const gameweek = await this.prisma.seasonGameweek.findUnique({
      where: {
        id: gameweekId,
      },
    });

    if (!gameweek || gameweek.seasonId !== seasonId) {
      throw new NotFoundException('Gameweek not found');
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

    const include = {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          shortName: true,
        },
      },
    };

    if (membership.role === 'ADMIN') {
      return this.prisma.latePassRequest.findMany({
        where: {
          gameweekId,
        },
        include,
        orderBy: {
          createdAt: 'asc',
        },
      });
    }

    return this.prisma.latePassRequest.findMany({
      where: {
        gameweekId,
        userId,
      },
      include,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async reviewLatePass(
    seasonId: string,
    gameweekId: string,
    requestId: string,
    userId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    await this.getAdminGameweek(seasonId, gameweekId, userId);

    const request = await this.prisma.latePassRequest.findFirst({
      where: {
        id: requestId,
        gameweekId,
      },
    });

    if (!request) {
      throw new NotFoundException('Late Pass request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException(
        'This Late Pass request has already been reviewed',
      );
    }

    const gameweek = await this.prisma.seasonGameweek.findUnique({
      where: {
        id: gameweekId,
      },
    });

    if (!gameweek) {
      throw new NotFoundException('Gameweek not found');
    }

    const cutoff = new Date(gameweek.deadline.getTime() + 24 * 60 * 60 * 1000);

    if (new Date() >= cutoff) {
      throw new ForbiddenException('The Late Pass window has expired');
    }

    if (status === 'APPROVED') {
      await this.prisma.pick.create({
        data: {
          userId: request.userId,
          gameweekId: request.gameweekId,
          teamId: request.teamId,
          latePassUsed: true,
          predictionBoostUsed: false,
          predictedHomeGoals: null,
          predictedAwayGoals: null,
        },
      });
    }

    return this.prisma.latePassRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status,
        reviewedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
