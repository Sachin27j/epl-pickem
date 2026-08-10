import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('EPL Pickem Backend (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let adminToken: string;
  let playerToken: string;

  let leagueId: string;
  let inviteCode: string;
  let seasonId: string;

  let gameweekId: string;
  let gameweek2Id: string;

  let arsenalId: string;
  let chelseaId: string;
  let liverpoolId: string;
  let cityId: string;

  let adminPickId: string;

  const adminUser = {
    name: 'E2E Admin',
    email: `e2e-admin-${Date.now()}@example.com`,
    password: 'Password123!',
  };

  const playerUser = {
    name: 'E2E Player',
    email: `e2e-player-${Date.now()}@example.com`,
    password: 'Password123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    /*
     * Match the validation configuration used by
     * the real application in main.ts.
     */
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    /*
     * Start every E2E run from a clean database.
     */
    await prisma.auditLog.deleteMany();
    await prisma.eventLog.deleteMany();
    await prisma.standingSnapshot.deleteMany();
    await prisma.gameweekTeamResult.deleteMany();
    await prisma.pick.deleteMany();
    await prisma.fixture.deleteMany();
    await prisma.seasonGameweek.deleteMany();
    await prisma.season.deleteMany();
    await prisma.leagueSettings.deleteMany();
    await prisma.leagueMember.deleteMany();
    await prisma.league.deleteMany();
    await prisma.user.deleteMany();
    await prisma.team.deleteMany();

    /*
     * Seed only the teams required by this test suite.
     * The real seed file contains all 20 EPL teams.
     */
    const teams = await Promise.all([
      prisma.team.create({
        data: {
          name: 'Arsenal',
          shortName: 'ARS',
        },
      }),
      prisma.team.create({
        data: {
          name: 'Chelsea',
          shortName: 'CHE',
        },
      }),
      prisma.team.create({
        data: {
          name: 'Liverpool',
          shortName: 'LIV',
        },
      }),
      prisma.team.create({
        data: {
          name: 'Manchester City',
          shortName: 'MCI',
        },
      }),
    ]);

    arsenalId = teams[0].id;
    chelseaId = teams[1].id;
    liverpoolId = teams[2].id;
    cityId = teams[3].id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });

    it('registers the admin user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(adminUser)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          name: adminUser.name,
          email: adminUser.email,
        }),
      );

      expect(response.body.passwordHash).toBeUndefined();
    });

    it('registers the player user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(playerUser)
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          name: playerUser.name,
          email: playerUser.email,
        }),
      );
    });

    it('logs the admin in', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: adminUser.email,
          password: adminUser.password,
        })
        .expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));

      adminToken = response.body.accessToken;
    });

    it('logs the player in', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: playerUser.email,
          password: playerUser.password,
        })
        .expect(201);

      expect(response.body.accessToken).toEqual(expect.any(String));

      playerToken = response.body.accessToken;
    });

    it('returns the authenticated profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: adminUser.email,
        }),
      );
    });
  });

  describe('Teams', () => {
    it('returns the available teams', async () => {
      const response = await request(app.getHttpServer())
        .get('/team')
        .expect(200);

      expect(response.body).toHaveLength(4);

      expect(
        response.body.map((team: { shortName: string }) => team.shortName),
      ).toEqual(expect.arrayContaining(['ARS', 'CHE', 'LIV', 'MCI']));
    });
  });

  describe('League', () => {
    it('creates a league and makes the creator an admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/league')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Premier League',
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: 'E2E Premier League',
          inviteCode: expect.any(String),
        }),
      );

      leagueId = response.body.id;
      inviteCode = response.body.inviteCode;

      expect(inviteCode).toHaveLength(8);
    });

    it('allows another user to join the league', async () => {
      await request(app.getHttpServer())
        .post('/league/join')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          inviteCode,
        })
        .expect(201);
    });

    it('rejects duplicate league membership', async () => {
      await request(app.getHttpServer())
        .post('/league/join')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          inviteCode,
        })
        .expect(409);
    });

    it('returns the admin league', async () => {
      const response = await request(app.getHttpServer())
        .get('/league')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(leagueId);
    });

    it('returns the league to a member', async () => {
      const response = await request(app.getHttpServer())
        .get(`/league/${leagueId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);

      expect(response.body.id).toBe(leagueId);
      expect(response.body.members).toHaveLength(2);
    });
  });

  describe('Season', () => {
    it('allows the admin to create a season', async () => {
      const response = await request(app.getHttpServer())
        .post('/season')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '2026/27',
          leagueId,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: '2026/27',
          status: 'UPCOMING',
        }),
      );

      seasonId = response.body.id;
    });

    it('prevents a player from activating the season', async () => {
      await request(app.getHttpServer())
        .post(`/season/${seasonId}/activate`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);
    });

    it('activates the season', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.status).toBe('ACTIVE');
    });

    it('creates the first gameweek', async () => {
      const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          number: 1,
          deadline,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          number: 1,
          status: 'UPCOMING',
        }),
      );

      gameweekId = response.body.id;
    });

    it('prevents a player from opening the gameweek', async () => {
      await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/open`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);
    });

    it('opens the gameweek', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/open`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.status).toBe('OPEN');
    });
  });

  describe('Picks', () => {
    it('requires score prediction when Prediction Boost is used', async () => {
      await request(app.getHttpServer())
        .post('/pick')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId,
          teamId: arsenalId,
          predictionBoostUsed: true,
        })
        .expect(403);
    });

    it('allows the admin to submit a Prediction Boost pick', async () => {
      const response = await request(app.getHttpServer())
        .post('/pick')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId,
          teamId: arsenalId,
          predictionBoostUsed: true,
          predictedHomeGoals: 0,
          predictedAwayGoals: 3,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          gameweekId,
          teamId: arsenalId,
          predictionBoostUsed: true,
          predictedHomeGoals: 0,
          predictedAwayGoals: 3,
        }),
      );

      adminPickId = response.body.id;
    });

    it('allows the player to submit a normal pick', async () => {
      const response = await request(app.getHttpServer())
        .post('/pick')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          gameweekId,
          teamId: chelseaId,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          gameweekId,
          teamId: chelseaId,
          predictionBoostUsed: false,
        }),
      );
    });

    it('rejects a second pick for the same gameweek', async () => {
      await request(app.getHttpServer())
        .post('/pick')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId,
          teamId: liverpoolId,
        })
        .expect(409);
    });

    it('returns the user pick', async () => {
      const response = await request(app.getHttpServer())
        .get(`/pick/gameweek/${gameweekId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(adminPickId);
      expect(response.body.team.shortName).toBe('ARS');
    });

    it('prevents another player from updating the pick', async () => {
      await request(app.getHttpServer())
        .patch(`/pick/${adminPickId}`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          teamId: liverpoolId,
        })
        .expect(403);
    });
  });

  describe('Gameweek locking and scoring', () => {
    it('prevents results before the gameweek is locked', async () => {
      await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teamId: arsenalId,
          goalsFor: 0,
          goalsAgainst: 3,
        })
        .expect(403);
    });

    it('prevents scoring before the gameweek is locked', async () => {
      await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/score`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('locks the gameweek', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.status).toBe('LOCKED');
    });

    it('does not allow Late Pass to bypass a locked gameweek', async () => {
      await request(app.getHttpServer())
        .post('/pick')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId,
          teamId: cityId,
          latePassUsed: true,
        })
        .expect(403);
    });

    it('allows the admin to enter the Arsenal result', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teamId: arsenalId,
          goalsFor: 0,
          goalsAgainst: 3,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          teamId: arsenalId,
          goalsFor: 0,
          goalsAgainst: 3,
        }),
      );
    });

    it('does not reveal while a selected team has no result', async () => {
      await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/reveal`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('allows the admin to enter the Chelsea result', async () => {
      await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teamId: chelseaId,
          goalsFor: 3,
          goalsAgainst: 0,
        })
        .expect(201);
    });

    it('calculates scores', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/score`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.message).toBe(
        'Gameweek scores calculated successfully',
      );
    });

    it('applies Prediction Boost correctly to a negative score', async () => {
      const pick = await prisma.pick.findUnique({
        where: {
          id: adminPickId,
        },
      });

      expect(pick).not.toBeNull();

      expect(pick?.basePoints).toBe(0);
      expect(pick?.gdBonus).toBe(-1);
      expect(pick?.predictionMultiplier).toBe(2);
      expect(pick?.totalPoints).toBe(-2);
    });

    it('reveals the gameweek', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweekId}/reveal`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.status).toBe('REVEALED');
    });
  });

  describe('Second gameweek and Late Pass', () => {
    it('creates a second gameweek', async () => {
      const deadline = new Date(Date.now() + 60 * 60 * 1000);

      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          number: 2,
          deadline: deadline.toISOString(),
        })
        .expect(201);

      gameweek2Id = response.body.id;
    });

    it('opens the second gameweek', async () => {
      await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweek2Id}/open`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    });

    it('rejects the same team in consecutive gameweeks', async () => {
      await request(app.getHttpServer())
        .post('/pick')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId: gameweek2Id,
          teamId: arsenalId,
        })
        .expect(409);
    });

    it('rejects a pick after the deadline without Late Pass', async () => {
      await prisma.seasonGameweek.update({
        where: {
          id: gameweek2Id,
        },
        data: {
          deadline: new Date(Date.now() - 60 * 1000),
        },
      });

      await request(app.getHttpServer())
        .post('/pick')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId: gameweek2Id,
          teamId: liverpoolId,
        })
        .expect(403);
    });

    it('allows a pick after the deadline with Late Pass', async () => {
      const response = await request(app.getHttpServer())
        .post('/pick')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          gameweekId: gameweek2Id,
          teamId: liverpoolId,
          latePassUsed: true,
        })
        .expect(201);

      expect(response.body.latePassUsed).toBe(true);
    });
  });

  describe('Leaderboard', () => {
    it('returns the league leaderboard', async () => {
      const response = await request(app.getHttpServer())
        .get(`/season/${seasonId}/leaderboard`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);

      expect(response.body[0]).toEqual(
        expect.objectContaining({
          rank: 1,
          name: 'E2E Player',
          points: 4,
        }),
      );

      expect(response.body[1]).toEqual(
        expect.objectContaining({
          rank: 2,
          name: 'E2E Admin',
          points: -2,
        }),
      );
    });

    it('allows a league member to view the leaderboard', async () => {
      await request(app.getHttpServer())
        .get(`/season/${seasonId}/leaderboard`)
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(200);
    });
  });

  describe('Season completion', () => {
    it('locks the second gameweek', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweek2Id}/lock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.status).toBe('LOCKED');
    });

    it('adds the second gameweek result', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweek2Id}/result`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teamId: liverpoolId,
          goalsFor: 2,
          goalsAgainst: 0,
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          teamId: liverpoolId,
          goalsFor: 2,
          goalsAgainst: 0,
        }),
      );
    });

    it('calculates the second gameweek score', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweek2Id}/score`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.message).toBe(
        'Gameweek scores calculated successfully',
      );
    });

    it('reveals the second gameweek', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/gameweek/${gameweek2Id}/reveal`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.status).toBe('REVEALED');
    });

    it('completes the season after all gameweeks are revealed', async () => {
      const response = await request(app.getHttpServer())
        .post(`/season/${seasonId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.status).toBe('COMPLETED');
    });
  });
});
