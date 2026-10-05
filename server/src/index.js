import express from 'express'
import { randomUUID } from 'node:crypto'
import { database } from './database.js'
import './seed.js'

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.use(express.json({ limit: '100kb' }))

function toProduct(row) {
  return {
    id: row.id,
    code: row.article,
    name: row.name,
    brand: row.brand,
    category: row.category_id,
    price: row.price_kopecks / 100,
    oldPrice: row.old_price_kopecks === null ? undefined : row.old_price_kopecks / 100,
    stockQuantity: row.stock_quantity,
    stock: row.stock_quantity > 0 ? `В наличии · ${row.stock_quantity} шт.` : 'Под заказ',
    image: row.image_url,
  }
}

function isValidPhone(phone) {
  return typeof phone === 'string' && /^[+\d()\-\s]{7,24}$/.test(phone.trim())
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: 'connected' })
})

app.get('/api/categories', (_request, response) => {
  const items = database.prepare('SELECT id, name FROM categories ORDER BY sort_order, name').all()
  response.json({ items })
})

app.get('/api/products', (request, response) => {
  const page = Math.max(Number.parseInt(request.query.page, 10) || 1, 1)
  const pageSize = Math.min(Math.max(Number.parseInt(request.query.pageSize, 10) || 24, 1), 100)
  const conditions = ['p.is_active = 1']
  const parameters = []

  if (typeof request.query.category === 'string' && request.query.category !== 'all') {
    conditions.push('p.category_id = ?')
    parameters.push(request.query.category)
  }

  if (typeof request.query.q === 'string' && request.query.q.trim()) {
    conditions.push('(p.article LIKE ? OR p.name LIKE ? OR p.brand LIKE ?)')
    const term = `%${request.query.q.trim()}%`
    parameters.push(term, term, term)
  }

  const where = conditions.join(' AND ')
  const total = database.prepare(`SELECT COUNT(*) AS total FROM products p WHERE ${where}`).get(...parameters).total
  const rows = database.prepare(`
    SELECT p.* FROM products p
    WHERE ${where}
    ORDER BY p.name COLLATE NOCASE
    LIMIT ? OFFSET ?
  `).all(...parameters, pageSize, (page - 1) * pageSize)

  response.json({ items: rows.map(toProduct), total, page, pageSize })
})

app.get('/api/products/:id', (request, response) => {
  const row = database.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(Number(request.params.id))
  if (!row) return response.status(404).json({ error: 'Товар не найден.' })
  response.json(toProduct(row))
})

app.get('/api/fitment', (request, response) => {
  const { make, model, year: yearValue } = request.query
  const year = Number(yearValue)
  if (typeof make !== 'string' || typeof model !== 'string' || !Number.isInteger(year) || year < 1950 || year > 2100) {
    return response.status(400).json({ error: 'Укажите марку, модель и корректный год автомобиля.' })
  }

  const rows = database.prepare(`
    SELECT p.* FROM products p
    JOIN vehicle_fitments f ON f.product_id = p.id
    WHERE p.is_active = 1 AND f.make = ? AND f.model = ? AND ? BETWEEN f.year_from AND f.year_to
    ORDER BY p.name COLLATE NOCASE
  `).all(make, model, year)

  response.json({ vehicle: { make, model, year }, items: rows.map(toProduct) })
})

app.post('/api/business-leads', (request, response) => {
  const companyName = typeof request.body.companyName === 'string' ? request.body.companyName.trim() : ''
  const phone = typeof request.body.phone === 'string' ? request.body.phone.trim() : ''
  const email = typeof request.body.email === 'string' ? request.body.email.trim() : null

  if (companyName.length < 2 || companyName.length > 160 || !isValidPhone(phone)) {
    return response.status(400).json({ error: 'Укажите название компании и корректный телефон.' })
  }
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return response.status(400).json({ error: 'Проверьте адрес электронной почты.' })
  }

  const result = database.prepare(`
    INSERT INTO business_leads (company_name, phone, email) VALUES (?, ?, ?)
  `).run(companyName, phone, email || null)

  response.status(201).json({ id: Number(result.lastInsertRowid), status: 'received' })
})

app.post('/api/orders', (request, response) => {
  const { customerName, phone, customerType = 'retail', items } = request.body
  if (typeof customerName !== 'string' || customerName.trim().length < 2 || customerName.trim().length > 120 || !isValidPhone(phone)) {
    return response.status(400).json({ error: 'Укажите имя и корректный телефон для заказа.' })
  }
  if (!['retail', 'business'].includes(customerType) || !Array.isArray(items) || items.length === 0 || items.length > 100) {
    return response.status(400).json({ error: 'Проверьте тип клиента и состав заказа.' })
  }

  const quantities = new Map()
  for (const item of items) {
    if (!Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      return response.status(400).json({ error: 'Количество товара должно быть от 1 до 99.' })
    }
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
  }

  const createOrder = database.transaction(() => {
    const selectedProducts = [...quantities].map(([productId, quantity]) => {
      const product = database.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(productId)
      if (!product) throw Object.assign(new Error('Один из товаров больше не доступен.'), { status: 404 })
      if (product.stock_quantity < quantity) throw Object.assign(new Error(`Недостаточно остатка: ${product.name}.`), { status: 409 })
      return { product, quantity }
    })

    const total = selectedProducts.reduce((sum, line) => sum + line.product.price_kopecks * line.quantity, 0)
    const orderId = randomUUID()
    database.prepare(`
      INSERT INTO orders (id, customer_type, customer_name, phone, total_kopecks)
      VALUES (?, ?, ?, ?, ?)
    `).run(orderId, customerType, customerName.trim(), phone.trim(), total)

    const addItem = database.prepare(`
      INSERT INTO order_items
        (order_id, product_id, article_snapshot, name_snapshot, quantity, unit_price_kopecks, line_total_kopecks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const decreaseStock = database.prepare('UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = datetime(\'now\') WHERE id = ?')

    for (const { product, quantity } of selectedProducts) {
      addItem.run(orderId, product.id, product.article, product.name, quantity, product.price_kopecks, product.price_kopecks * quantity)
      decreaseStock.run(quantity, product.id)
    }
    return { id: orderId, total: total / 100, status: 'new' }
  })

  try {
    response.status(201).json(createOrder())
  } catch (error) {
    if (error.status) return response.status(error.status).json({ error: error.message })
    throw error
  }
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Внутренняя ошибка сервера.' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`AutomotiveStore API listening on http://localhost:${port}`)
})