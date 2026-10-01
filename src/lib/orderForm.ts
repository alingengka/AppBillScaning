import type { Order, PaymentMethod } from '@/types'

/** The editable fields of an order, shared by the scan page and the edit page. */
export interface OrderFormValues {
  customerName: string
  customerPhone: string
  orderDate: string
  paidQty: number
  freeQty: number
  totalAmount: number
  billNumber: string
  destination: string
  paymentMethod: PaymentMethod | null
  note: string
}

/** A saved order's values, ready to edit in the form. */
export function orderToFormValues(order: Order): OrderFormValues {
  return {
    customerName: order.customer_name ?? '',
    customerPhone: order.customer_phone ?? '',
    orderDate: order.order_date,
    paidQty: order.paid_qty,
    freeQty: order.free_qty,
    totalAmount: order.total_amount,
    billNumber: order.bill_number ?? '',
    destination: order.destination ?? '',
    paymentMethod: order.payment_method,
    note: order.note ?? '',
  }
}

/** The form's values as `orders` table columns, for insert or update. */
export function formValuesToColumns(values: OrderFormValues) {
  return {
    customer_name: values.customerName.trim(),
    customer_phone: values.customerPhone || null,
    destination: values.destination || null,
    note: values.note || null,
    order_date: values.orderDate,
    paid_qty: values.paidQty,
    free_qty: values.freeQty,
    total_amount: values.totalAmount,
    bill_number: values.billNumber || null,
    payment_method: values.paymentMethod,
  }
}
