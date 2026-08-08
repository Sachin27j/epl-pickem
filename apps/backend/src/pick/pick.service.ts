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

    if (gameweek.status !== 'OPEN') {
      throw new ForbiddenException(
        'Picks are not currently open for this gameweek',
      );
    }

    if (new Date() > gameweek.deadline) {
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

    return this.prisma.pick.create({
      data: {
        userId,
        gameweekId: dto.gameweekId,
        teamId: dto.teamId,
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
        gameweek: true,
      },
    });
    if (!pick) {
      throw new NotFoundException('Pick not found');
    }

    if (pick.userId !== userId) {
      throw new ForbiddenException('You can only update your own pick');
    }

    if (pick.gameweek.status !== 'OPEN') {
      throw new ForbiddenException('Picks are not currently open');
    }

    if (new Date() > pick.gameweek.deadline) {
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

    return this.prisma.pick.update({
      where: {
        id,
      },
      data: {
        teamId: dto.teamId,
      },
    });
  }
}
