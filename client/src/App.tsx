import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'

type Product = {
  id: number
  name: string
  brand: string
  code: string
  category: string
  price: number
  oldPrice?: number
  stock: string
  image: string
}

type CartLine = { product: Product; quantity: number }
type Dialog = 'login' | 'business' | null

const products: Product[] = [
  { id: 1, name: 'Масляный фильтр', brand: 'MANN-FILTER', code: 'W 712/95', category: 'filters', price: 890, oldPrice: 1_090, stock: 'В наличии · 18 шт.', image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=720&q=85' },
  { id: 2, name: 'Комплект тормозных колодок', brand: 'BREMBO', code: 'P 85 020', category: 'brakes', price: 4_750, stock: 'В наличии · 6 компл.', image: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=720&q=85' },
  { id: 3, name: 'Воздушный фильтр двигателя', brand: 'MAHLE', code: 'LX 2046', category: 'filters', price: 1_360, stock: 'В наличии · 12 шт.', image: 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=720&q=85' },
  { id: 4, name: 'Свеча зажигания', brand: 'NGK', code: 'ILZKR7B-11S', category: 'engine', price: 1_120, stock: 'В наличии · 24 шт.', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=720&q=85' },
]

const categories = [
  { id: 'all', name: 'Все запчасти', count: '2 480 позиций', image: products[0].image },
  { id: 'filters', name: 'Фильтры', count: 'от 390 ₽', image: products[1].image },
  { id: 'brakes', name: 'Тормозная система', count: 'от 850 ₽', image: products[2].image },
  { id: 'engine', name: 'Двигатель', count: 'от 620 ₽', image: products[3].image },
]

const vehicleModels: Record<string, string[]> = {
  Toyota: ['Camry', 'RAV4', 'Corolla'],
  BMW: ['3 серия', '5 серия', 'X3'],
  Kia: ['Rio', 'Sportage', 'Ceed'],
  Lada: ['Vesta', 'Granta', 'Niva'],
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('ru-RU').replace(/[^\p{L}\p{N}]/gu, '')
}

function loadCart(): CartLine[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('motorika-cart') ?? '[]')
    if (!Array.isArray(stored)) return []

    return stored.flatMap((entry): CartLine[] => {
      if (typeof entry !== 'object' || entry === null) return []
      const line = entry as { productId?: unknown; quantity?: unknown }
      const product = products.find((item) => item.id === line.productId)
      if (!product || typeof line.quantity !== 'number' || !Number.isInteger(line.quantity) || line.quantity < 1) return []
      return [{ product, quantity: line.quantity }]
    })
  } catch {
    return []
  }
}

function App() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchMode, setSearchMode] = useState<'car' | 'vin'>('car')
  const [brand, setBrand] = useState('Toyota')
  const [model, setModel] = useState('Camry')
  const [year, setYear] = useState('2021')
  const [vin, setVin] = useState('')
  const [fitmentMessage, setFitmentMessage] = useState('')
  const [fitmentProductIds, setFitmentProductIds] = useState<number[] | null>(null)
  const [catalogProducts, setCatalogProducts] = useState(products)
  const [catalogError, setCatalogError] = useState(false)
  const [cart, setCart] = useState<CartLine[]>(loadCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [formMessage, setFormMessage] = useState('')

  useEffect(() => {
    localStorage.setItem('motorika-cart', JSON.stringify(cart.map(({ product, quantity }) => ({ productId: product.id, quantity }))))
  }, [cart])

  useEffect(() => {
    let active = true
    fetch('/api/products?page=1&pageSize=100')
      .then(async (response) => {
        if (!response.ok) throw new Error('Каталог недоступен')
        return response.json() as Promise<{ items?: Product[] }>
      })
      .then(({ items }) => {
        if (!active) return
        if (!Array.isArray(items)) throw new Error('Некорректный ответ каталога')
        setCatalogProducts(items)
        setCatalogError(false)
      })
      .catch(() => {
        if (active) setCatalogError(true)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('#global-search')?.focus()
      }
    }

    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const visibleProducts = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim())
    return catalogProducts.filter((product) => {
      const matchesCategory = activeCategory === 'all' || product.category === activeCategory
      const matchesVehicle = fitmentProductIds === null || fitmentProductIds.includes(product.id)
      const searchable = normalizeSearch(`${product.name} ${product.brand} ${product.code}`)
      return matchesCategory && matchesVehicle && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [activeCategory, catalogProducts, fitmentProductIds, query])

  const cartCount = cart.reduce((total, line) => total + line.quantity, 0)
  const cartTotal = cart.reduce((total, line) => total + line.product.price * line.quantity, 0)

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id)
      if (existing) return current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
      return [...current, { product, quantity: 1 }]
    })
  }

  function changeQuantity(productId: number, difference: number) {
    setCart((current) => current
      .map((line) => line.product.id === productId ? { ...line, quantity: line.quantity + difference } : line)
      .filter((line) => line.quantity > 0))
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setFormMessage('Отправляем заказ...')

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: values.get('customerName'),
          phone: values.get('phone'),
          customerType: values.get('customerType'),
          items: cart.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        }),
      })
      const result = await response.json() as { id?: string; total?: number; error?: string }
      if (!response.ok) {
        setFormMessage(result.error ?? 'Не удалось оформить заказ.')
        return
      }

      setCart([])
      setCheckoutOpen(false)
      setFormMessage(`Заказ ${result.id?.slice(0, 8)} принят. Сумма: ${formatPrice(result.total ?? cartTotal)}.`)
    } catch {
      setFormMessage('Сервер недоступен. Заказ не оформлен, попробуйте ещё раз.')
    }
  }

  async function submitFitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (searchMode === 'vin') {
      const normalizedVin = vin.trim().toUpperCase()
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalizedVin)) {
        setFitmentMessage('Проверьте VIN: нужно 17 символов, без I, O и Q.')
        return
      }
      setFitmentMessage(`Формат VIN ${normalizedVin} верный. Декодирование VIN подключается через лицензированный каталог.`)
      return
    }

    try {
      const params = new URLSearchParams({ make: brand, model, year })
      const response = await fetch(`/api/fitment?${params}`)
      const result = await response.json() as { items?: Product[]; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Не удалось проверить совместимость.')
      const matches = result.items ?? []
      setFitmentProductIds(matches.map((product) => product.id))
      setFitmentMessage(`${brand} ${model}, ${year}: найдено деталей ${matches.length}.`)
      document.querySelector('#popular')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (error) {
      setFitmentMessage(error instanceof Error ? error.message : 'Не удалось связаться с каталогом.')
    }
  }

  function submitHeaderSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedQuery = query.trim().toUpperCase()
    if (normalizedQuery.length === 17) {
      setVin(normalizedQuery)
      setSearchMode('vin')
      setFitmentProductIds(null)
      setQuery('')
      setFitmentMessage('')
      document.querySelector('#fitment')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    document.querySelector('#popular')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openDialog(nextDialog: Exclude<Dialog, null>) {
    setFormMessage('')
    setDialog(nextDialog)
  }

  async function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (dialog !== 'business') {
      setFormMessage('Авторизация по SMS появится после подключения сервиса входа.')
      return
    }

    const values = new FormData(event.currentTarget)
    setFormMessage('Отправляем заявку...')
    try {
      const response = await fetch('/api/business-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: values.get('companyName'),
          phone: values.get('phone'),
          email: values.get('email'),
        }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        setFormMessage(result.error ?? 'Не удалось отправить заявку.')
        return
      }
      setFormMessage('Заявка сохранена. Менеджер свяжется с вами в рабочее время.')
    } catch {
      setFormMessage('Сервер недоступен. Повторите попытку позже.')
    }
  }

  return (
    <div className="site-shell">
      <div className="topline"><div className="page-width topline-inner"><span>Запчасти, которым доверяют мастера</span><div className="topline-links"><a href="#delivery">Доставка и оплата</a><a href="#business">Для СТО и опта</a></div></div></div>
      <header className="site-header">
        <div className="page-width header-main">
          <a className="wordmark" href="#top" aria-label="Моторика, на главную"><span className="wordmark-mark">М</span><span>моторика<small>АВТОЗАПЧАСТИ</small></span></a>
          <button className="catalog-button" onClick={() => document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth' })}><span className="catalog-glyph">☰</span> Каталог</button>
          <form className="header-search" onSubmit={submitHeaderSearch}><span className="search-glyph" aria-hidden="true" /><input id="global-search" aria-label="Поиск по каталогу" placeholder="Артикул, название или VIN" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>Ctrl K</kbd><button className="header-search-submit" type="submit" aria-label="Искать">↵</button></form>
          <a className="header-phone" href="tel:+78005553210"><small>Ежедневно 9:00–21:00</small>8 800 555-32-10</a>
          <button className="icon-action account-action" onClick={() => openDialog('login')}><span className="user-glyph" aria-hidden="true" /><span>Войти</span></button>
          <button className="icon-action cart-action" onClick={() => setCartOpen(true)}><span className="bag-glyph" aria-hidden="true" /><span>Корзина</span><b>{cartCount}</b></button>
        </div>
        <nav className="page-width secondary-nav" aria-label="Основная навигация"><a href="#catalog">Каталог запчастей</a><a href="#fitment">Подбор по автомобилю</a><a href="#popular">Популярное</a><a href="#delivery">Доставка</a><button onClick={() => openDialog('business')}>Оптовым клиентам <span aria-hidden="true">↗</span></button></nav>
      </header>

      <main id="top">
        <section className="hero page-width">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> ПОДБОР БЕЗ ЛИШНИХ ОШИБОК</div>
            <h1>Нужная деталь.<br /><em>С первого раза.</em></h1>
            <p className="hero-description">Находим запчасти по VIN и автомобилю. Проверяем совместимость до покупки.</p>
            <div className="fitment-panel" id="fitment">
              <div className="fitment-tabs" role="tablist" aria-label="Способ подбора">
                <button className={searchMode === 'car' ? 'active' : ''} onClick={() => { setSearchMode('car'); setFitmentMessage('') }} role="tab" aria-selected={searchMode === 'car'}>По автомобилю</button>
                <button className={searchMode === 'vin' ? 'active' : ''} onClick={() => { setSearchMode('vin'); setFitmentMessage('') }} role="tab" aria-selected={searchMode === 'vin'}>По VIN-коду</button>
              </div>
              <form className="fitment-form" onSubmit={submitFitment}>
                {searchMode === 'car' ? <div className="vehicle-fields">
                  <label><span>Марка</span><select value={brand} onChange={(event) => { setBrand(event.target.value); setModel(vehicleModels[event.target.value][0]) }}>{Object.keys(vehicleModels).map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label><span>Модель</span><select value={model} onChange={(event) => setModel(event.target.value)}>{vehicleModels[brand].map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="year-field"><span>Год</span><select value={year} onChange={(event) => setYear(event.target.value)}>{Array.from({ length: 16 }, (_, index) => String(2026 - index)).map((item) => <option key={item}>{item}</option>)}</select></label>
                </div> : <label className="vin-field"><span>VIN-код автомобиля</span><input autoComplete="off" maxLength={17} placeholder="Например, JTNB11HK303123456" value={vin} onChange={(event) => setVin(event.target.value.toUpperCase())} /></label>}
                <button className="primary-button fitment-submit" type="submit">Подобрать детали <span aria-hidden="true">→</span></button>
              </form>
              <div className={`fitment-note ${fitmentMessage.includes('Проверьте') ? 'error' : ''}`} aria-live="polite">{fitmentMessage || <><span className="check-glyph">✓</span> Подбор по оригинальному каталогу</>}</div>
            </div>
            <div className="hero-proof"><div className="proof-avatars"><span>А</span><span>М</span><span>И</span></div><p><strong>12 000+</strong> водителей уже нашли свою деталь</p><span className="proof-rating">★★★★★ <small>4.9 / 5</small></span></div>
          </div>
          <div className="hero-visual"><img src="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1500&q=90" alt="Автомобиль на обслуживании в современной мастерской" /><div className="hero-image-shade" /><div className="image-caption"><span>01 / ПОДБОР</span><strong>Точность начинается<br />с правильных данных.</strong></div><div className="floating-stock"><span className="stock-pulse" /><div><strong>Всё в наличии</strong><small>на собственном складе</small></div><span className="stock-arrow">↗</span></div><div className="hero-index">MTR / 2026</div></div>
        </section>

        <section className="benefit-strip page-width" id="delivery">
          <div className="benefit"><span className="benefit-mark">01</span><div><strong>Подтверждаем применяемость</strong><small>по VIN и каталогам производителей</small></div></div>
          <div className="benefit"><span className="benefit-mark">02</span><div><strong>Отгружаем в день заказа</strong><small>доставка по городу от 2 часов</small></div></div>
          <div className="benefit"><span className="benefit-mark">03</span><div><strong>Работаем с бизнесом</strong><small>персональные цены для СТО и магазинов</small></div></div>
          <a href="#delivery-details" className="benefit-link">Условия доставки <span aria-hidden="true">→</span></a>
        </section>

        <section className="category-section page-width" id="catalog">
          <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> БЫСТРЫЙ ДОСТУП</div><h2>Что ищем <em>сегодня?</em></h2></div><a href="#popular" className="text-link">Весь каталог <span aria-hidden="true">↗</span></a></div>
          <div className="category-grid">{categories.map((category, index) => <button key={category.id} className={`category-card category-card-${index} ${activeCategory === category.id ? 'selected' : ''}`} onClick={() => { setActiveCategory(category.id); document.querySelector('#popular')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><img src={category.image} alt="" /><span className="category-overlay" /><span className="category-number">0{index + 1}</span><span className="category-copy"><strong>{category.name}</strong><small>{category.count}</small></span><span className="category-arrow" aria-hidden="true">↗</span></button>)}</div>
        </section>

        <section className="products-section" id="popular"><div className="page-width">
          <div className="section-heading product-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> ПРОВЕРЕНО ПОПУЛЯРНОСТЬЮ</div><h2>{query ? 'Результаты поиска' : <>Выбор <em>недели</em></>}</h2></div><div className="product-controls"><label className="product-search"><span className="search-glyph" aria-hidden="true" /><input aria-label="Найти товар в каталоге" placeholder="Найти запчасть" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="filter-button" onClick={() => { setActiveCategory('all'); setQuery('') }}>Сбросить фильтры</button></div></div>
          {catalogError && <p className="catalog-error" role="status">API каталога недоступен; показываем локальные демо-данные.</p>}
          <div className="product-grid">{visibleProducts.map((product) => <article className="product-card" key={product.id}><div className="product-image"><img src={product.image} alt={product.name} />{product.oldPrice && <span className="product-badge">Хит продаж</span>}<button className="favorite-button" aria-label={`Добавить ${product.name} в избранное`} onClick={(event) => event.currentTarget.classList.toggle('is-favorite')}>♡</button></div><div className="product-info"><div className="product-brand">{product.brand}<span>АРТИКУЛ {product.code}</span></div><button className="product-title" onClick={() => setSelectedProduct(product)}>{product.name}</button><p className="product-stock"><span />{product.stock}</p><div className="delivery-line">Сегодня, после 16:00</div><div className="product-buy"><div className="price-block"><strong>{formatPrice(product.price)}</strong>{product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}</div><button className="add-button" onClick={() => addToCart(product)} aria-label={`Добавить ${product.name} в корзину`}><span aria-hidden="true">+</span></button></div></div></article>)}
            {visibleProducts.length === 0 && <div className="empty-products"><span className="empty-symbol">?</span><h3>Пока не нашли такую деталь</h3><p>Проверьте артикул или попробуйте поиск по VIN.</p><button className="text-link" onClick={() => { setQuery(''); setActiveCategory('all') }}>Показать весь каталог <span aria-hidden="true">→</span></button></div>}
          </div>
        </div></section>

        <section className="business-band page-width" id="business"><div className="business-index">B2B<br />/ 02</div><div className="business-copy"><div className="eyebrow"><span className="eyebrow-line" /> ПАРТНЁРСТВО ДЛЯ ПРОФЕССИОНАЛОВ</div><h2>Ваш склад.<br /><em>Только больше.</em></h2><p>Специальные цены, заказ по артикулам и один менеджер, который знает ваш бизнес.</p><button className="light-button" onClick={() => openDialog('business')}>Стать партнёром <span aria-hidden="true">→</span></button></div><div className="business-visual"><img src={products[1].image} alt="Колесо автомобиля в сервисной мастерской" /><div className="business-stamp"><strong>СТО</strong><span>УСЛОВИЯ<br />ДЛЯ БИЗНЕСА</span></div><div className="business-visual-note">ОДНА ПОСТАВКА<br />МНОГО ВОЗМОЖНОСТЕЙ</div></div></section>
      </main>

      <footer className="site-footer page-width" id="delivery-details"><div className="footer-main"><div className="footer-brand"><a className="wordmark" href="#top"><span className="wordmark-mark">М</span><span>моторика<small>АВТОЗАПЧАСТИ</small></span></a><p>Детали для тех, кто ценит<br />точность в каждом километре.</p></div><div className="footer-column"><strong>Покупателям</strong><a href="#catalog">Каталог</a><a href="#fitment">Подбор по VIN</a><a href="#delivery">Доставка и оплата</a><a href="#delivery-details">Возврат и гарантия</a></div><div className="footer-column"><strong>Партнёрам</strong><button onClick={() => openDialog('business')}>Оптовые условия</button><a href="#business">Для автосервисов</a><a href="#business">Поставщикам</a></div><div className="footer-contact"><span>ЕСТЬ ВОПРОС?</span><a href="tel:+78005553210">8 800 555-32-10</a><small>Ежедневно с 9:00 до 21:00</small><a className="footer-mail" href="mailto:hello@motorika.ru">hello@motorika.ru</a></div></div><div className="footer-bottom"><span>© 2026 «Моторика». Все права защищены.</span><a href="#privacy">Политика конфиденциальности</a><span>Сделано для тех, кто в пути <b>↗</b></span></div></footer>

      {cartOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false) }}><aside className="cart-drawer" aria-label="Корзина"><div className="drawer-heading"><div><span className="eyebrow">ВАШ ЗАКАЗ</span><h2>Корзина <span>({cartCount})</span></h2></div><button className="close-button" onClick={() => setCartOpen(false)} aria-label="Закрыть">×</button></div>{cart.length ? <><div className="cart-lines">{cart.map((line) => <div className="cart-line" key={line.product.id}><img src={line.product.image} alt="" /><div className="cart-line-info"><strong>{line.product.name}</strong><small>{line.product.brand} · {line.product.code}</small><b>{formatPrice(line.product.price * line.quantity)}</b><div className="quantity-control"><button onClick={() => changeQuantity(line.product.id, -1)} aria-label="Уменьшить количество">−</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.product.id, 1)} aria-label="Увеличить количество">+</button></div></div></div>)}</div><div className="cart-summary"><div><span>Товары</span><strong>{formatPrice(cartTotal)}</strong></div><div><span>Доставка</span><strong>Рассчитаем при заказе</strong></div><div className="cart-total"><span>Итого</span><strong>{formatPrice(cartTotal)}</strong></div><button className="primary-button checkout-button" onClick={() => { setCheckoutOpen(true); setFormMessage('') }}>Перейти к оформлению <span>→</span></button><p className="checkout-note">Наличие и цены подтвердим перед оплатой</p></div></> : <div className="empty-cart"><span className="empty-symbol">＋</span><h3>Корзина пока пуста</h3><p>Добавьте нужные детали, а мы проверим наличие.</p><button className="primary-button" onClick={() => setCartOpen(false)}>Перейти к покупкам <span>→</span></button></div>}{formMessage && cartOpen && <p className="drawer-message" aria-live="polite">{formMessage}</p>}</aside></div>}

      {checkoutOpen && <div className="overlay modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutOpen(false) }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button className="close-button dialog-close" onClick={() => setCheckoutOpen(false)} aria-label="Закрыть">×</button><div className="eyebrow"><span className="eyebrow-line" /> ОФОРМЛЕНИЕ ЗАКАЗА</div><h2 id="checkout-title">Куда <em>перезвонить?</em></h2><p>Проверим остатки и подтвердим заказ перед оплатой.</p><form className="dialog-form" onSubmit={submitOrder}><input required name="customerName" minLength={2} maxLength={120} placeholder="Ваше имя" aria-label="Ваше имя" /><input required name="phone" type="tel" placeholder="Телефон для связи" aria-label="Телефон для связи" /><select name="customerType" defaultValue="retail" aria-label="Тип клиента"><option value="retail">Розничный клиент</option><option value="business">Компания или СТО</option></select><button className="primary-button" type="submit">Подтвердить заказ <span>→</span></button></form>{formMessage && <p className="form-message" aria-live="polite">{formMessage}</p>}</section></div>}

      {selectedProduct && <div className="overlay modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null) }}><section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title"><button className="close-button dialog-close" onClick={() => setSelectedProduct(null)} aria-label="Закрыть">×</button><img src={selectedProduct.image} alt={selectedProduct.name} /><div className="product-detail-copy"><div className="eyebrow"><span className="eyebrow-line" /> {selectedProduct.brand}</div><h2 id="product-dialog-title">{selectedProduct.name}</h2><p className="detail-code">Артикул {selectedProduct.code}</p><p className="product-stock"><span />{selectedProduct.stock}</p><div className="detail-fitment"><strong>Проверка совместимости</strong><span>Подберём для {brand} {model}, {year} г. или уточним по VIN перед заказом.</span></div><div className="detail-price">{formatPrice(selectedProduct.price)}{selectedProduct.oldPrice && <del>{formatPrice(selectedProduct.oldPrice)}</del>}</div><button className="primary-button" onClick={() => { addToCart(selectedProduct); setSelectedProduct(null) }}>Добавить в корзину <span>→</span></button></div></section></div>}

      {dialog && <div className="overlay modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null) }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="close-button dialog-close" onClick={() => setDialog(null)} aria-label="Закрыть">×</button><div className="eyebrow"><span className="eyebrow-line" /> {dialog === 'business' ? 'ПАРТНЁРСТВО' : 'ЛИЧНЫЙ КАБИНЕТ'}</div><h2 id="dialog-title">{dialog === 'business' ? <>Запчасти —<br /><em>по вашим условиям.</em></> : <>Рады<br /><em>снова видеть.</em></>}</h2><p>{dialog === 'business' ? 'Оставьте контакты компании. Подготовим доступ к оптовым ценам и персональному кабинету.' : 'Войдите по номеру телефона, чтобы видеть заказы и персональные цены.'}</p><form className="dialog-form" onSubmit={submitDialog}>{dialog === 'business' && <input required name="companyName" placeholder="Название компании или СТО" aria-label="Название компании" />}<input required name="phone" type="tel" placeholder="Телефон для связи" aria-label="Телефон для связи" />{dialog === 'business' && <input name="email" type="email" placeholder="Рабочая почта" aria-label="Рабочая почта" />}<button className="primary-button" type="submit">{dialog === 'business' ? 'Запросить условия' : 'Получить код'} <span>→</span></button></form>{formMessage && <p className="form-message" aria-live="polite">{formMessage}</p>}<small className="consent-note">Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.</small></section></div>}
    </div>
  )
}

export default App