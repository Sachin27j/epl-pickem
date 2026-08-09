import { IsBoolean, IsString } from 'class-validator';

export class UpdatePickDto {
  @IsString()
  teamId!: string;

  @IsBoolean()
  latePassUsed?: boolean;
}
