import { IsString } from 'class-validator';

export class UpdatePickDto {
  @IsString()
  teamId!: string;
}
