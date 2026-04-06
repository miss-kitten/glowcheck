import { useState, useEffect } from 'react'
import './App.css'

// ── Constants ──────────────────────────────────────────────────────────────

const ACTIVES = ['AHA', 'BHA', 'Retinol', 'Vitamin C', 'Niacinamide', 'Benzoyl Peroxide', 'Peptides', 'SPF']

const CONFLICT_RULES = [
  { a: 'Retinol', b: 'AHA', message: 'Over-exfoliation risk', suggestion: 'Alternate nights' },
  { a: 'Retinol', b: 'BHA', message: 'Over-exfoliation risk', suggestion: 'Alternate nights' },
  { a: 'Retinol', b: 'Benzoyl Peroxide', message: 'Deactivates retinol', suggestion: 'Alternate nights' },
  { a: 'Vitamin C', b: 'AHA', message: 'pH conflict reduces efficacy', suggestion: '30 min gap or separate routines' },
  { a: 'Vitamin C', b: 'BHA', message: 'pH conflict reduces efficacy', suggestion: '30 min gap or separate routines' },
  { a: 'Niacinamide', b: 'Vitamin C', message: 'May reduce efficacy', suggestion: 'Monitor skin response', advisory: true },
  { a: 'Benzoyl Peroxide', b: 'Retinol', message: 'Deactivates retinol', suggestion: 'Alternate nights' },
]

const GOAL_ACTIVES = {
  Hydration: ['Peptides', 'SPF'],
  'Anti-aging': ['Retinol', 'Peptides', 'Vitamin C', 'SPF'],
  'Acne control': ['BHA', 'Niacinamide', 'Benzoyl Peroxide'],
  Brightening: ['Vitamin C', 'AHA', 'Niacinamide'],
  'Barrier repair': ['Peptides', 'Niacinamide'],
}

const ACTIVE_EXPLANATIONS = {
  AHA: 'exfoliates dead skin cells for a brighter complexion',
  BHA: 'unclogs pores and reduces breakouts',
  Retinol: 'boosts cell turnover and reduces fine lines',
  'Vitamin C': 'brightens skin tone and fights free radicals',
  Niacinamide: 'balances oil production and strengthens the skin barrier',
  'Benzoyl Peroxide': 'kills acne-causing bacteria',
  Peptides: 'support collagen production and improve hydration',
  SPF: 'protects against UV damage and premature aging',
}

const NAV_ITEMS = [
  { id: 'dashboard', icon: '✦', label: 'Dashboard' },
  { id: 'products', icon: '✿', label: 'My Products' },
  { id: 'routine', icon: '☀', label: 'My Routine' },
  { id: 'goals', icon: '◎', label: 'Skin Goals' },
  { id: 'account', icon: '◷', label: 'Account' },
]

const PAGE_META = {
  dashboard: { title: 'Dashboard', sub: "Here's your skincare summary." },
  products: { title: 'My Products', sub: 'Manage your skincare cabinet.' },
  routine: { title: 'My Routine', sub: 'Build your AM and PM routines.' },
  goals: { title: 'Skin Goals', sub: 'Track progress toward your skin goals.' },
  account: { title: 'Account', sub: 'Your profile and settings.' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveState(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function checkConflicts(routineProducts) {
  const ingredientSet = new Set()
  const ingredientToProducts = {}

  routineProducts.forEach((p) => {
    p.ingredients.forEach((ing) => {
      ingredientSet.add(ing)
      if (!ingredientToProducts[ing]) ingredientToProducts[ing] = []
      ingredientToProducts[ing].push(p.id)
    })
  })

  const conflicts = []
  const seen = new Set()

  CONFLICT_RULES.forEach((rule) => {
    if (ingredientSet.has(rule.a) && ingredientSet.has(rule.b)) {
      const key = [rule.a, rule.b].sort().join('+')
      if (!seen.has(key)) {
        seen.add(key)
        const affectedProductIds = new Set([
          ...(ingredientToProducts[rule.a] || []),
          ...(ingredientToProducts[rule.b] || []),
        ])
        conflicts.push({ ...rule, affectedProductIds: [...affectedProductIds] })
      }
    }
  })

  return conflicts
}

function scoreGoals(products, selectedGoals) {
  const allIngredients = new Set(products.flatMap((p) => p.ingredients))
  return selectedGoals.map((goal) => {
    const required = GOAL_ACTIVES[goal]
    const present = required.filter((a) => allIngredients.has(a))
    const missing = required.filter((a) => !allIngredients.has(a))
    return { goal, score: Math.round((present.length / required.length) * 100), present, missing }
  })
}

// ── Shared components ──────────────────────────────────────────────────────

function Sidebar({ active, onNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">✿</div>
        <h1>GlowCheck</h1>
      </div>
      <nav className="nav-section">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => onNav(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="avatar">K</div>
          <div className="user-info">
            <div className="user-name">Kitty</div>
            <div className="user-role">Skincare enthusiast</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function ConflictBanner({ conflicts }) {
  if (!conflicts.length) return null
  return (
    <div className="conflict-banner">
      <div className="conflict-banner-title">⚠ Ingredient Conflicts Detected</div>
      {conflicts.map((c, i) => (
        <div key={i} className="conflict-item">
          <strong>{c.a} + {c.b}:</strong> {c.message}. {c.suggestion}.
          {c.advisory && <span className="advisory-pill">Advisory</span>}
        </div>
      ))}
    </div>
  )
}

// ── Pages ──────────────────────────────────────────────────────────────────

function Dashboard({ products, amRoutine, pmRoutine, selectedGoals, onNav }) {
  const amProducts = products.filter((p) => amRoutine.includes(p.id))
  const pmProducts = products.filter((p) => pmRoutine.includes(p.id))
  const allRoutineProducts = [...new Map([...amProducts, ...pmProducts].map((p) => [p.id, p])).values()]
  const conflicts = checkConflicts(allRoutineProducts)
  const goalScores = scoreGoals(products, selectedGoals)
  const activeRoutines = (amRoutine.length > 0 ? 1 : 0) + (pmRoutine.length > 0 ? 1 : 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <div className="dash-greeting">
        <span>{greeting}, Kitty ✨</span>
      </div>

      <ConflictBanner conflicts={conflicts} />

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total Products</div>
          <div className="stat-value">{products.length}</div>
          <div className="stat-sub">in your cabinet</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Routines</div>
          <div className="stat-value">{activeRoutines}</div>
          <div className="stat-sub">of 2 (AM + PM)</div>
        </div>
        <div className="stat-card" style={conflicts.length > 0 ? { borderColor: '#F5C4B3' } : {}}>
          <div className="stat-label">Conflicts Flagged</div>
          <div className="stat-value" style={{ color: conflicts.length > 0 ? '#993C1D' : undefined }}>
            {conflicts.length}
          </div>
          <div className="stat-sub">{conflicts.length > 0 ? 'needs attention' : 'all clear'}</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-label">Goals Tracked</div>
          <div className="stat-value">{selectedGoals.length}</div>
          <div className="stat-sub">skin goals active</div>
        </div>
      </div>

      {goalScores.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Skin Goals Summary</span>
            <button className="card-action" onClick={() => onNav('goals')}>View all</button>
          </div>
          <div className="card-body">
            <div className="goals-list">
              {goalScores.map((gs) => (
                <div key={gs.goal} className="goal-row">
                  <div className="goal-row-top">
                    <span className="goal-name">{gs.goal}</span>
                    <span className="goal-pct">{gs.score}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${gs.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">AM Routine</span>
            <button className="card-action" onClick={() => onNav('routine')}>Edit</button>
          </div>
          {amProducts.length === 0 ? (
            <div className="empty-state">No AM products yet.</div>
          ) : (
            <div className="routine-list">
              {amProducts.map((p, i) => (
                <div key={p.id} className="routine-item">
                  <span className="step-num">{i + 1}</span>
                  <span className="routine-name">{p.name}</span>
                  <div className="ingredient-tags">
                    {p.ingredients.map((ing) => (
                      <span key={ing} className="ing-tag">{ing}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">PM Routine</span>
            <button className="card-action" onClick={() => onNav('routine')}>Edit</button>
          </div>
          {pmProducts.length === 0 ? (
            <div className="empty-state">No PM products yet.</div>
          ) : (
            <div className="routine-list">
              {pmProducts.map((p, i) => (
                <div key={p.id} className="routine-item">
                  <span className="step-num">{i + 1}</span>
                  <span className="routine-name">{p.name}</span>
                  <div className="ingredient-tags">
                    {p.ingredients.map((ing) => (
                      <span key={ing} className="ing-tag">{ing}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function ProductsPage({ products, onAdd, onDelete }) {
  const [name, setName] = useState('')
  const [selectedIngredients, setSelectedIngredients] = useState([])
  const [tag, setTag] = useState('am')
  const [error, setError] = useState('')

  function toggleIngredient(ing) {
    setSelectedIngredients((prev) =>
      prev.includes(ing) ? prev.filter((i) => i !== ing) : [...prev, ing]
    )
  }

  function handleAdd() {
    if (!name.trim()) { setError('Please enter a product name.'); return }
    if (selectedIngredients.length === 0) { setError('Please select at least one active ingredient.'); return }
    setError('')
    onAdd({ name: name.trim(), ingredients: selectedIngredients, tag })
    setName('')
    setSelectedIngredients([])
    setTag('am')
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Add Product</span>
        </div>
        <div className="card-body form-body">
          <div className="form-group">
            <label className="form-label">Product Name</label>
            <input
              className="form-input"
              placeholder="e.g. The Ordinary Retinol 1%"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Active Ingredients</label>
            <div className="ingredient-picker">
              {ACTIVES.map((ing) => (
                <button
                  key={ing}
                  className={`ing-btn ${selectedIngredients.includes(ing) ? 'selected' : ''}`}
                  onClick={() => toggleIngredient(ing)}
                  type="button"
                >
                  {ing}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Use in Routine</label>
            <div className="tag-picker">
              {['am', 'pm', 'both'].map((t) => (
                <button
                  key={t}
                  className={`tag-btn tag-btn-${t} ${tag === t ? 'selected' : ''}`}
                  onClick={() => setTag(t)}
                  type="button"
                >
                  {t === 'am' ? '☀ AM' : t === 'pm' ? '☾ PM' : '✦ Both'}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAdd}>
            + Add Product
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">My Cabinet</span>
          <span className="card-sub">{products.length} product{products.length !== 1 ? 's' : ''}</span>
        </div>
        {products.length === 0 ? (
          <div className="empty-state">No products yet. Add your first one!</div>
        ) : (
          <div className="product-cabinet">
            {products.map((p) => (
              <div key={p.id} className="cabinet-item">
                <div className="cabinet-item-main">
                  <div className="cabinet-name">{p.name}</div>
                  <div className="cabinet-meta">
                    <span className={`routine-tag tag-${p.tag}`}>{p.tag.toUpperCase()}</span>
                    <div className="ingredient-tags">
                      {p.ingredients.map((ing) => (
                        <span key={ing} className="ing-tag">{ing}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <button className="delete-btn" onClick={() => onDelete(p.id)} aria-label="Delete product">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RoutinePage({ products, amRoutine, pmRoutine, onUpdateRoutine }) {
  const [view, setView] = useState('am')

  const routine = view === 'am' ? amRoutine : pmRoutine
  const setRoutine = (ids) => onUpdateRoutine(view, ids)

  const routineProducts = routine.map((id) => products.find((p) => p.id === id)).filter(Boolean)
  const availableProducts = products.filter((p) => !routine.includes(p.id))
  const conflicts = checkConflicts(routineProducts)
  const conflictProductIds = new Set(conflicts.flatMap((c) => c.affectedProductIds))

  function addToRoutine(productId) {
    setRoutine([...routine, productId])
  }

  function removeFromRoutine(productId) {
    setRoutine(routine.filter((id) => id !== productId))
  }

  function moveUp(index) {
    if (index === 0) return
    const r = [...routine]
    ;[r[index - 1], r[index]] = [r[index], r[index - 1]]
    setRoutine(r)
  }

  function moveDown(index) {
    if (index === routine.length - 1) return
    const r = [...routine]
    ;[r[index], r[index + 1]] = [r[index + 1], r[index]]
    setRoutine(r)
  }

  return (
    <>
      <div className="view-tabs">
        <button className={`view-tab ${view === 'am' ? 'active' : ''}`} onClick={() => setView('am')}>
          ☀ AM Routine
        </button>
        <button className={`view-tab ${view === 'pm' ? 'active' : ''}`} onClick={() => setView('pm')}>
          ☾ PM Routine
        </button>
      </div>

      <ConflictBanner conflicts={conflicts} />

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{view === 'am' ? '☀ AM' : '☾ PM'} Steps</span>
            <span className="card-sub">{routineProducts.length} product{routineProducts.length !== 1 ? 's' : ''}</span>
          </div>
          {routineProducts.length === 0 ? (
            <div className="empty-state">Add products from the panel on the right.</div>
          ) : (
            <div className="routine-steps">
              {routine.map((id, i) => {
                const p = products.find((prod) => prod.id === id)
                if (!p) return null
                const hasConflict = conflictProductIds.has(p.id)
                return (
                  <div key={id} className={`step-item ${hasConflict ? 'has-conflict' : ''}`}>
                    <span className="step-num">{i + 1}</span>
                    <div className="step-info">
                      <div className="step-name">
                        {p.name}
                        {hasConflict && <span className="conflict-badge">⚠ Conflict</span>}
                      </div>
                      <div className="ingredient-tags">
                        {p.ingredients.map((ing) => (
                          <span key={ing} className="ing-tag">{ing}</span>
                        ))}
                      </div>
                    </div>
                    <div className="step-actions">
                      <button className="icon-btn" onClick={() => moveUp(i)} disabled={i === 0} title="Move up">↑</button>
                      <button className="icon-btn" onClick={() => moveDown(i)} disabled={i === routine.length - 1} title="Move down">↓</button>
                      <button className="icon-btn remove" onClick={() => removeFromRoutine(id)} title="Remove">✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Add to Routine</span>
          </div>
          {availableProducts.length === 0 ? (
            <div className="empty-state">
              {products.length === 0
                ? 'Add products in My Products first.'
                : 'All products are already in this routine.'}
            </div>
          ) : (
            <div className="available-list">
              {availableProducts.map((p) => (
                <div key={p.id} className="available-item">
                  <div className="available-info">
                    <div className="available-name">{p.name}</div>
                    <div className="available-meta">
                      <span className={`routine-tag tag-${p.tag}`}>{p.tag.toUpperCase()}</span>
                      <div className="ingredient-tags">
                        {p.ingredients.map((ing) => (
                          <span key={ing} className="ing-tag">{ing}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => addToRoutine(p.id)}>+ Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function GoalsPage({ products, selectedGoals, onToggleGoal }) {
  const goalScores = scoreGoals(products, selectedGoals)
  const allGoals = Object.keys(GOAL_ACTIVES)

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <span className="card-title">My Skin Goals</span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Select the goals you want to work toward.
          </p>
          <div className="goals-picker">
            {allGoals.map((goal) => (
              <button
                key={goal}
                className={`goal-btn ${selectedGoals.includes(goal) ? 'selected' : ''}`}
                onClick={() => onToggleGoal(goal)}
              >
                {goal}
              </button>
            ))}
          </div>
        </div>

        {goalScores.length > 0 && (
          <>
            <div className="card-divider" />
            <div className="card-header">
              <span className="card-title">Progress</span>
            </div>
            <div className="card-body">
              <div className="goals-list">
                {goalScores.map((gs) => (
                  <div key={gs.goal} className="goal-row">
                    <div className="goal-row-top">
                      <span className="goal-name">{gs.goal}</span>
                      <span className="goal-pct">{gs.score}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${gs.score}%` }} />
                    </div>
                    <div className="active-chips">
                      {GOAL_ACTIVES[gs.goal].map((a) => (
                        <span key={a} className={`active-chip ${gs.present.includes(a) ? 'have' : 'missing'}`}>{a}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Suggestions</span>
        </div>
        {selectedGoals.length === 0 ? (
          <div className="empty-state">Select goals on the left to see suggestions.</div>
        ) : goalScores.every((gs) => gs.missing.length === 0) ? (
          <div className="empty-state success-state">All your goals are well-covered!</div>
        ) : (
          <div className="suggestions-list">
            {goalScores
              .filter((gs) => gs.missing.length > 0)
              .map((gs) => (
                <div key={gs.goal} className="suggestion-card">
                  <div className="suggestion-goal">{gs.goal}</div>
                  <div className="suggestion-label">Consider adding:</div>
                  {gs.missing.map((a) => (
                    <div key={a} className="suggestion-active">
                      <span className="suggestion-ing">{a}</span>
                      <span className="suggestion-desc"> — {ACTIVE_EXPLANATIONS[a]}</span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AccountPage() {
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Profile</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, paddingTop: 32, paddingBottom: 32 }}>
          <div className="profile-avatar">K</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-heading)' }}>Kitty</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Skincare enthusiast</div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">About GlowCheck</span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            GlowCheck helps you build a safe, effective skincare routine by tracking your products,
            detecting ingredient conflicts, and guiding you toward your skin goals.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8, marginTop: 12 }}>
            All your data is stored locally in your browser — nothing is sent to any server.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [products, setProducts] = useState(() => loadState('gc_products', []))
  const [amRoutine, setAmRoutine] = useState(() => loadState('gc_am_routine', []))
  const [pmRoutine, setPmRoutine] = useState(() => loadState('gc_pm_routine', []))
  const [selectedGoals, setSelectedGoals] = useState(() => loadState('gc_goals', []))

  useEffect(() => { saveState('gc_products', products) }, [products])
  useEffect(() => { saveState('gc_am_routine', amRoutine) }, [amRoutine])
  useEffect(() => { saveState('gc_pm_routine', pmRoutine) }, [pmRoutine])
  useEffect(() => { saveState('gc_goals', selectedGoals) }, [selectedGoals])

  function addProduct(product) {
    setProducts((prev) => [...prev, { ...product, id: Date.now() }])
  }

  function deleteProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setAmRoutine((prev) => prev.filter((pid) => pid !== id))
    setPmRoutine((prev) => prev.filter((pid) => pid !== id))
  }

  function updateRoutine(view, ids) {
    if (view === 'am') setAmRoutine(ids)
    else setPmRoutine(ids)
  }

  function toggleGoal(goal) {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    )
  }

  const meta = PAGE_META[activePage]

  return (
    <div className="app">
      <Sidebar active={activePage} onNav={setActivePage} />
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h2>{meta.title}</h2>
            <p>{meta.sub}</p>
          </div>
        </header>
        <main className="content">
          {activePage === 'dashboard' && (
            <Dashboard
              products={products}
              amRoutine={amRoutine}
              pmRoutine={pmRoutine}
              selectedGoals={selectedGoals}
              onNav={setActivePage}
            />
          )}
          {activePage === 'products' && (
            <ProductsPage products={products} onAdd={addProduct} onDelete={deleteProduct} />
          )}
          {activePage === 'routine' && (
            <RoutinePage
              products={products}
              amRoutine={amRoutine}
              pmRoutine={pmRoutine}
              onUpdateRoutine={updateRoutine}
            />
          )}
          {activePage === 'goals' && (
            <GoalsPage products={products} selectedGoals={selectedGoals} onToggleGoal={toggleGoal} />
          )}
          {activePage === 'account' && <AccountPage />}
        </main>
      </div>
    </div>
  )
}
