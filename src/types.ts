export type OrderStatus = 'draft' | 'ready' | 'delivered' | 'cancelled'

export interface OrderItem {
  id: string
  order_id: string
  name: string
  quantity: number
  unit_price: number
  created_at: string
}

export interface Order {
  id: string
  user_id: string
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  note: string | null
  status: OrderStatus
  delivery_fee: number
  source_image_path: string | null
  created_at: string
  updated_at: string
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
}

export interface ShopSettings {
  user_id: string
  shop_name: string
  shop_phone: string | null
  shop_address: string | null
  updated_at: string
}

/** A single line item as drafted in the New Order editor, before it is persisted. */
export interface DraftItem {
  id: string
  name: string
  quantity: number
  unit_price: number
}
