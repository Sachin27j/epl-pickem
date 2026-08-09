import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePickDto {
  @IsString()
  gameweekId!: string;

  @IsString()
  teamId!: string;

  @IsOptional()
  @IsBoolean()
  predictionBoostUsed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  predictedHomeGoals?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  predictedAwayGoals?: number;

  @IsOptional()
  @IsBoolean()
  latePassUsed?: boolean;
}
