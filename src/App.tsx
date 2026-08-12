import { ChangeEvent, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Camera,
  ChevronRight,
  Library,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'

type Recipe = {
  name_kr: string
  name_en: string
  ingredients: string[]
  steps: string[]
  notes: string
}

type SavedRecipe = Recipe & {
  id: string
  image: string
  savedAt: string
}

type View = 'camera' | 'saved' | 'recipe'

const STORAGE_KEY = 'bapsang-recipes-v1'
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function readSaved(): SavedRecipe[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read this photo.'))
    reader.onload = () => {
      const photo = new Image()
      photo.onerror = () => reject(new Error('This photo format is not supported.'))
      photo.onload = () => {
        const maxSide = 1280
        const ratio = Math.min(1, maxSide / Math.max(photo.width, photo.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(photo.width * ratio)
        canvas.height = Math.round(photo.height * ratio)
        const context = canvas.getContext('2d')
        if (!context) return reject(new Error('Could not prepare this photo.'))
        context.drawImage(photo, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.76))
      }
      photo.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function App() {
  const [view, setView] = useState<View>('camera')
  const [image, setImage] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [saved, setSaved] = useState<SavedRecipe[]>(readSaved)
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const cameraInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [view, recipe])

  const activeSaved = activeSavedId ? saved.find((item) => item.id === activeSavedId) : undefined
  const shownRecipe = activeSaved || recipe
  const shownImage = activeSaved?.image || image
  const isCurrentSaved = Boolean(activeSaved || (recipe && saved.some((item) => item.name_en === recipe.name_en && item.image === image)))

  const analyze = async (photo = image) => {
    if (!photo || isLoading) return
    setIsLoading(true)
    setError('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 75_000)

    try {
      if (import.meta.env.PROD && !API_BASE_URL) {
        throw new Error('The scanner is not connected yet.')
      }

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo }),
        signal: controller.signal,
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || `The scanner returned ${response.status}. Please try again.`)
      }

      setRecipe(result as Recipe)
      setActiveSavedId(null)
      setView('recipe')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('The scanner is taking too long. Try again in a moment.')
      } else {
        setError(err instanceof Error ? err.message : 'Could not scan this dish. Try again.')
      }
    } finally {
      window.clearTimeout(timeout)
      setIsLoading(false)
    }
  }

  const selectPhoto = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please take a photo of the dish.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('That photo is too large. Try again.')
      return
    }

    try {
      const prepared = await compressImage(file)
      setImage(prepared)
      setRecipe(null)
      setActiveSavedId(null)
      setError('')
      setSaveError('')
      setView('camera')
      await analyze(prepared)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare this photo.')
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    void selectPhoto(event.target.files?.[0])
    event.target.value = ''
  }

  const resetCamera = () => {
    setImage(null)
    setRecipe(null)
    setActiveSavedId(null)
    setError('')
    setView('camera')
  }

  const openCamera = () => {
    if (isLoading) return
    resetCamera()
    cameraInput.current?.click()
  }

  const saveRecipe = () => {
    if (!shownRecipe || !shownImage || activeSaved) return
    const next: SavedRecipe = {
      ...shownRecipe,
      id: crypto.randomUUID(),
      image: shownImage,
      savedAt: new Date().toISOString(),
    }
    const updated = [next, ...saved]
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      setSaved(updated)
      setSaveError('')
    } catch {
      setSaveError('Storage is full. Remove an older recipe and try again.')
    }
  }

  const removeRecipe = (id: string) => {
    const updated = saved.filter((item) => item.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setSaved(updated)
    if (activeSavedId === id) {
      setActiveSavedId(null)
      setView('saved')
    }
  }

  const openSaved = (item: SavedRecipe) => {
    setActiveSavedId(item.id)
    setView('recipe')
  }

  const showCamera = () => {
    setActiveSavedId(null)
    setView('camera')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="wordmark" onClick={resetCamera} aria-label="Bapsang home">
          <strong>Bapsang</strong>
          <span lang="ko">밥상</span>
        </button>
        <span className="creator-credit">Made by Jayden Ko</span>
      </header>

      <main className="app-main">
        {view === 'camera' && (
          <section className={`camera-view ${image ? 'has-photo' : ''}`}>
            {!image ? (
              <div className="capture-state">
                <div className="camera-copy">
                  <h1>Scan a dish</h1>
                </div>
                <button className="capture-button" onClick={() => cameraInput.current?.click()} aria-label="Take a photo">
                  <Camera size={42} strokeWidth={1.8} />
                </button>
                <span className="capture-label">Take photo</span>
              </div>
            ) : (
              <div className="scan-state">
                <img src={image} alt="Dish being scanned" />
                <button className="close-photo" onClick={resetCamera} aria-label="Close photo"><X size={20} /></button>
                {isLoading && (
                  <div className="scan-progress" role="status" aria-live="polite">
                    <strong>Please wait</strong>
                  </div>
                )}
                {error && !isLoading && (
                  <div className="scan-error" role="alert">
                    <strong>Scan paused</strong>
                    <p>{error}</p>
                    <div>
                      <button className="retry-button" onClick={() => void analyze()}><RefreshCw size={17} /> Try again</button>
                      <button className="retake-button" onClick={openCamera}><Camera size={17} /> Retake</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {view === 'saved' && (
          <section className="saved-view">
            <div className="screen-title">
              <h1>Recipes</h1>
              <span>{saved.length}</span>
            </div>

            {saved.length === 0 ? (
              <div className="empty-state">
                <Bookmark size={30} strokeWidth={1.5} />
                <h2>No saved recipes</h2>
                <button onClick={openCamera}><Camera size={18} /> Scan a dish</button>
              </div>
            ) : (
              <div className="recipe-grid">
                {saved.map((item) => (
                  <article className="saved-card" key={item.id}>
                    <button className="saved-card-main" onClick={() => openSaved(item)}>
                      <img src={item.image} alt={item.name_en} />
                      <span className="saved-card-copy">
                        <small lang="ko">{item.name_kr}</small>
                        <strong>{item.name_en}</strong>
                      </span>
                      <ChevronRight size={19} />
                    </button>
                    <button className="card-delete" onClick={() => removeRecipe(item.id)} aria-label={`Delete ${item.name_en}`}><Trash2 size={17} /></button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'recipe' && shownRecipe && shownImage && (
          <section className="recipe-view">
            <div className="recipe-toolbar">
              <button onClick={() => setView(activeSaved ? 'saved' : 'camera')} aria-label="Go back"><ArrowLeft size={22} /></button>
              <button className={isCurrentSaved ? 'is-saved' : ''} onClick={saveRecipe} disabled={isCurrentSaved} aria-label={isCurrentSaved ? 'Recipe saved' : 'Save recipe'}>
                {isCurrentSaved ? <BookmarkCheck size={22} /> : <Bookmark size={22} />}
              </button>
            </div>

            <article className="recipe-card">
              <img className="recipe-photo" src={shownImage} alt={shownRecipe.name_en} />
              <div className="recipe-heading">
                <p lang="ko">{shownRecipe.name_kr}</p>
                <h1>{shownRecipe.name_en}</h1>
                <span>{shownRecipe.ingredients.length} ingredients · {shownRecipe.steps.length} steps</span>
                {saveError && <small>{saveError}</small>}
              </div>

              <section className="recipe-section">
                <h2>Ingredients</h2>
                <ul>
                  {shownRecipe.ingredients.map((ingredient, index) => <li key={`${ingredient}-${index}`}>{ingredient}</li>)}
                </ul>
              </section>

              <section className="recipe-section method-section">
                <h2>Method</h2>
                <ol>
                  {shownRecipe.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                </ol>
              </section>

              {shownRecipe.notes && (
                <aside className="recipe-note"><strong>Note:</strong> {shownRecipe.notes}</aside>
              )}
            </article>

            <button className="scan-another" onClick={openCamera}><Camera size={18} /> Scan another dish</button>
          </section>
        )}
      </main>

      <nav className="tab-bar" aria-label="Main navigation">
        <button className={view === 'camera' ? 'active' : ''} onClick={showCamera}>
          <Camera size={23} strokeWidth={1.8} />
          <span>Scan</span>
        </button>
        <button className={view === 'saved' || (view === 'recipe' && Boolean(activeSaved)) ? 'active' : ''} onClick={() => setView('saved')}>
          <Library size={23} strokeWidth={1.8} />
          <span>Recipes</span>
          {saved.length > 0 && <i>{saved.length}</i>}
        </button>
      </nav>

      <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={handleChange} />
    </div>
  )
}

export default App
