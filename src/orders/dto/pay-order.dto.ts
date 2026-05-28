import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class PayOrderDto {
  @ApiProperty({
    example: 'Transfer Bank',
    enum: ['Transfer Bank', 'QRIS', 'Cash on Delivery'],
  })
  @IsString()
  @IsIn(['Transfer Bank', 'QRIS', 'Cash on Delivery'])
  paymentMethod: string;

  @ApiProperty({
    required: false,
    description: 'Base64 bukti transfer (wajib untuk Transfer & QRIS, opsional untuk COD)',
  })
  @IsString()
  @IsOptional()
  paymentProof?: string;
}