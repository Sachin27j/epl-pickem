import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeagueService {
  constructor(private readonly prisma: PrismaService) {}

  private generateInviteCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  async create(name: string, userId: string) {
    let inviteCode: string;

    do {
      inviteCode = this.generateInviteCode();

      const existing = await this.prisma.league.findUnique({
        where: {
          inviteCode,
        },
      });

      if (!existing) {
        break;
      }
    } while (true);

    return this.prisma.$transaction(async (tx) => {
      const league = await tx.league.create({
        data: {
          name,
          inviteCode,
          createdById: userId,
        },
      });

      await tx.leagueMember.create({
        data: {
          leagueId: league.id,
          userId,
          role: 'ADMIN',
        },
      });

      return league;
    });
  }

  async join(inviteCode: string, userId: string) {
    const league = await this.prisma.league.findUnique({
      where: {
        inviteCode: inviteCode.trim().toUpperCase(),
      },
    });

    if (!league) {
      throw new NotFoundException('League not found');
    }

    const existingMember = await this.prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId: league.id,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('Already a member of this league');
    }

    return this.prisma.leagueMember.create({
      data: {
        userId,
        leagueId: league.id,
      },
    });
  }

  async getById(id: string, userId: string) {
    const league = await this.prisma.league.findUnique({
      where: {
        id,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        seasons: {
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            gameweeks: {
              orderBy: {
                number: 'asc',
              },
            },
          },
        },
      },
    });

    if (!league) {
      throw new NotFoundException('League not found');
    }

    const isMember = league.members.some((member) => member.userId === userId);

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this league');
    }

    return league;
  }

  async getMyLeagues(userId: string) {
    return this.prisma.league.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
