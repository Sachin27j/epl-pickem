import { IsInt, IsString, Min } from 'class-validator';

export class CreateGameweekResultDto {
  @IsString()
  teamId!: string;

  @IsInt()
  @Min(0)
  goalsFor!: number;

  @IsInt()
  @Min(0)
  goalsAgainst!: number;
}
