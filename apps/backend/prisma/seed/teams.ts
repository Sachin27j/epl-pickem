import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const teams = [
  { name: 'Arsenal', shortName: 'ARS' },
  { name: 'Aston Villa', shortName: 'AVL' },
  { name: 'Bournemouth', shortName: 'BOU' },
  { name: 'Brentford', shortName: 'BRE' },
  { name: 'Brighton & Hove Albion', shortName: 'BHA' },
  { name: 'Chelsea', shortName: 'CHE' },
  { name: 'Coventry City', shortName: 'COV' },
  { name: 'Crystal Palace', shortName: 'CRY' },
  { name: 'Everton', shortName: 'EVE' },
  { name: 'Fulham', shortName: 'FUL' },
  { name: 'Hull City', shortName: 'HUL' },
  { name: 'Ipswich Town', shortName: 'IPS' },
  { name: 'Leeds United', shortName: 'LEE' },
  { name: 'Liverpool', shortName: 'LIV' },
  { name: 'Manchester City', shortName: 'MCI' },
  { name: 'Manchester United', shortName: 'MUN' },
  { name: 'Newcastle United', shortName: 'NEW' },
  { name: 'Nottingham Forest', shortName: 'NFO' },
  { name: 'Sunderland', shortName: 'SUN' },
  { name: 'Tottenham Hotspur', shortName: 'TOT' },
];

async function main() {
  for (const team of teams) {
    await prisma.team.upsert({
      where: {
        shortName: team.shortName,
      },
      update: {
        name: team.name,
      },
      create: team,
    });
  }

  console.log('20 EPL teams seeded successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
