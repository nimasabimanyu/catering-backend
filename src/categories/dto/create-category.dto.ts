import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Tumpeng' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Paket tumpeng untuk acara', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}