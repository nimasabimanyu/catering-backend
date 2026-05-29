import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { PayOrderDto } from './dto/pay-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Buat pesanan baru (status awal PENDING)' })
  create(@Req() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List pesanan (USER lihat sendiri, ADMIN lihat semua)' })
  findAll(@Req() req: any) {
    return this.ordersService.findAll(req.user.id, req.user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail pesanan' })
  findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id, req.user.id, req.user.role);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'User bayar pesanan (WAITING_PAYMENT -> PAYMENT_REVIEW)' })
  pay(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PayOrderDto,
  ) {
    return this.ordersService.pay(id, req.user.id, req.user.role, dto);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin konfirmasi pesanan (PENDING -> WAITING_PAYMENT)' })
  confirm(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.confirm(id);
  }

  @Patch(':id/verify-payment')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin verifikasi pembayaran (PAYMENT_REVIEW -> PAID)' })
  verifyPayment(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.verifyPayment(id);
  }

  @Patch(':id/deliver')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin kirim pesanan (PAID -> DELIVERING)' })
  deliver(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.deliver(id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin tandai pesanan sampai (DELIVERING -> DELIVERED)' })
  complete(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.complete(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Batalkan/tolak pesanan (USER hanya saat PENDING, ADMIN kapan saja)' })
  cancel(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.ordersService.cancel(id, req.user.id, req.user.role);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin hapus pesanan permanen (hanya untuk CANCELLED)' })
  permanentDelete(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.permanentDelete(id);
  }
}
