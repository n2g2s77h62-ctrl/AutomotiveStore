import { database } from './database.js'

const categories = [
  ['filters', 'Фильтры', 1],
  ['brakes', 'Тормозная система', 2],
  ['engine', 'Двигатель', 3],
]

const products = [
  [1, 'W 712/95', 'Масляный фильтр', 'MANN-FILTER', 'filters', 89000, 109000, 18, 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=720&q=85'],
  [2, 'P 85 020', 'Комплект тормозных колодок', 'BREMBO', 'brakes', 475000, null, 6, 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=720&q=85'],
  [3, 'LX 2046', 'Воздушный фильтр двигателя', 'MAHLE', 'filters', 136000, null, 12, 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=720&q=85'],
  [4, 'ILZKR7B-11S', 'Свеча зажигания', 'NGK', 'engine', 112000, null, 24, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=720&q=85'],
]

const seed = database.transaction(() => {
  const addCategory = database.prepare('INSERT OR IGNORE INTO categories (id, name, sort_order) VALUES (?, ?, ?)')
  categories.forEach((category) => addCategory.run(...category))

  const addProduct = database.prepare(`
    INSERT OR IGNORE INTO products
      (id, article, name, brand, category_id, price_kopecks, old_price_kopecks, stock_quantity, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  products.forEach((product) => addProduct.run(...product))

  const addFitment = database.prepare(`
    INSERT OR IGNORE INTO vehicle_fitments (product_id, make, model, year_from, year_to)
    VALUES (?, 'Toyota', 'Camry', 2018, 2024)
  `)
  products.forEach(([id]) => addFitment.run(id))
})

seed()