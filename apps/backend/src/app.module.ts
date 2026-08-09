import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { LeagueModule } from './league/league.module';
import { PickModule } from './pick/pick.module';
import { PrismaModule } from './prisma/prisma.module';
import { ScoringModule } from './scoring/scoring.module';
import { SeasonModule } from './season/season.module';
import { TeamModule } from './team/team.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    LeagueModule,
    SeasonModule,
    TeamModule,
    PickModule,
    ScoringModule,
    LeaderboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
