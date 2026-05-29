import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PayOrderDto } from './dto/pay-order.dto';

const ORDER_INCLUDE = {
  items: { include: { package: true } },
  user: { select: { id: true, fullName: true, email: true } },
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, dto: CreateOrderDto) {
    const packageIds = dto.items.map((i) => i.packageId);
    const packages = await this.prisma.package.findMany({
      where: { id: { in: packageIds } },
    });

    if (packages.length !== packageIds.length) {
      throw new BadRequestException('Ada paket yang tidak ditemukan');
    }

    let totalAmount = 0;
    const itemsData = dto.items.map((item) => {
      const pkg = packages.find((p) => p.id === item.packageId)!;
      if (!pkg.isActive) {
        throw new BadRequestException(`Paket "${pkg.name}" sedang tidak tersedia`);
      }
      if (pkg.stock < item.quantity) {
        throw new BadRequestException(
          `Stok paket "${pkg.name}" tidak cukup (tersisa ${pkg.stock})`,
        );
      }
      const subtotal = pkg.price * item.quantity;
      totalAmount += subtotal;
      return { packageId: item.packageId, quantity: item.quantity, subtotal };
    });

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          totalAmount,
          eventDate: new Date(dto.eventDate),
          eventAddress: dto.eventAddress,
          paymentMethod: dto.paymentMethod,
          notes: dto.notes,
          items: { create: itemsData },
        },
        include: ORDER_INCLUDE,
      });

      for (const item of dto.items) {
        await tx.package.update({
          where: { id: item.packageId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      return created;
    });

    return { message: 'Pesanan berhasil dibuat', order };
  }

  findAll(currentUserId: number, currentRole: UserRole) {
    return this.prisma.order.findMany({
      where: currentRole === UserRole.ADMIN ? undefined : { userId: currentUserId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
  }

  async findOne(id: number, currentUserId: number, currentRole: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (currentRole !== UserRole.ADMIN && order.userId !== currentUserId) {
      throw new ForbiddenException('Anda tidak punya akses ke pesanan ini');
    }
    return order;
  }

  async confirm(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Hanya pesanan PENDING yang bisa dikonfirmasi');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.WAITING_PAYMENT },
      include: ORDER_INCLUDE,
    });
  }

  async pay(id: number, userId: number, role: UserRole, dto: PayOrderDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (role !== UserRole.ADMIN && order.userId !== userId) {
      throw new ForbiddenException('Ini bukan pesanan kamu');
    }
    if (order.status !== OrderStatus.WAITING_PAYMENT) {
      throw new BadRequestException(
        'Pesanan belum bisa dibayar. Tunggu admin mengkonfirmasi dulu.',
      );
    }
    if (dto.paymentMethod !== 'Cash on Delivery' && !dto.paymentProof) {
      throw new BadRequestException('Bukti pembayaran wajib diupload untuk metode ini');
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.PAYMENT_REVIEW,
        paymentMethod: dto.paymentMethod,
        paymentProof: dto.paymentProof ?? null,
      },
      include: ORDER_INCLUDE,
    });
  }

  async verifyPayment(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (order.status !== OrderStatus.PAYMENT_REVIEW) {
      throw new BadRequestException('Hanya pesanan menunggu verifikasi yang bisa di-acc');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.PAID, paidAt: new Date() },
      include: ORDER_INCLUDE,
    });
  }

  async deliver(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Hanya pesanan PAID (lunas) yang bisa diantar');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.DELIVERING },
      include: ORDER_INCLUDE,
    });
  }

  async complete(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (order.status !== OrderStatus.DELIVERING) {
      throw new BadRequestException('Hanya pesanan DELIVERING yang bisa ditandai sampai');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.DELIVERED },
      include: ORDER_INCLUDE,
    });
  }

  // USER cancel: hanya saat PENDING.
  // ADMIN cancel: kapan saja (untuk menolak pesanan).
  // Stok dikembalikan otomatis.
  async cancel(id: number, currentUserId: number, currentRole: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');

    if (currentRole !== UserRole.ADMIN && order.userId !== currentUserId) {
      throw new ForbiddenException('Anda tidak punya akses ke pesanan ini');
    }
    if (currentRole !== UserRole.ADMIN && order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Pesanan yang sudah dikonfirmasi tidak bisa dibatalkan',
      );
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Pesanan sudah dibatalkan');
    }
    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Pesanan yang sudah sampai tidak bisa dibatalkan');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.package.update({
          where: { id: item.packageId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    return { message: 'Pesanan berhasil dibatalkan' };
  }

  // ADMIN: hapus permanen pesanan dari database
  // Hanya boleh untuk pesanan yang sudah CANCELLED supaya tidak ada data aktif yg hilang
  async permanentDelete(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (order.status !== OrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Hanya pesanan yang sudah dibatalkan yang bisa dihapus permanen',
      );
    }
    // OrderItem dihapus otomatis karena onDelete: Cascade di schema
    await this.prisma.order.delete({ where: { id } });
    return { message: 'Pesanan dihapus permanen' };
  }
}
