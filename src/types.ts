export type OrderStatus = 'draft' | 'ready' | 'delivered' | 'cancelled'

export interface Order {
  id: string
  user_id: string
  customer_name: string | null
  customer_phone: string | null
  destination: string | null
  note: string | null
  status: OrderStatus
  order_date: string
  paid_qty: number
  free_qty: number
  total_amount: number
  bill_number: string | null
  source_image_path: string | null
  created_at: string
  updated_at: string
}

export interface ShopSettings {
  user_id: string
  shop_name: string
  shop_phone: string | null
  shop_address: string | null
  updated_at: string
}
