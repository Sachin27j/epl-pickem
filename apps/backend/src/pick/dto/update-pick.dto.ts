import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePickDto {
  @IsString()
  teamId!: string;

  @IsOptional()
  @IsBoolean()
  latePassUsed?: boolean;
}
