import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

@Injectable()
export class LeagueService {
  constructor(private readonly prisma: PrismaService) {}

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async create(name: string, userId: string) {
    const inviteCode = this.generateInviteCode();

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
        inviteCode,
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
}
