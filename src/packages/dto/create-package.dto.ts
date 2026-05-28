import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePackageDto {
  @ApiProperty({ example: 'Paket Nasi Kuning Tumpeng' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Tumpeng nasi kuning lengkap' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 300000 })
  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ example: 'https://example.com/image.jpg', required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ example: 1 })
  @IsInt()
  categoryId: number;
}