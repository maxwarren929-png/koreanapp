import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Camera,
  Check,
  ChevronRight,
  ImagePlus,
  Library,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
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

type View = 'discover' | 'saved' | 'recipe'

const STORAGE_KEY = 'bapsang-recipes-v1'

function BowlMark() {
  return (
    <svg className="bowl-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M8 17.5h24c0 8-4.8 13-12 13s-12-5-12-13Z" fill="currentColor" />
      <path d="M13 12c1.5-2.1 3-2.1 4.5 0s3 2.1 4.5 0 3-2.1 4.5 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 31h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

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
      const image = new Image()
      image.onerror = () => reject(new Error('This image format is not supported.'))
      image.onload = () => {
        const maxSide = 1600
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * ratio)
        canvas.height = Math.round(image.height * ratio)
        const context = canvas.getContext('2d')
        if (!context) return reject(new Error('Could not prepare this photo.'))
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function App() {
  const [view, setView] = useState<View>('discover')
  const [image, setImage] = useState<string | null>(null)
  const [imageName, setImageName] = useState('')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [saved, setSaved] = useState<SavedRecipe[]>(readSaved)
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [view, recipe])

  const activeSaved = activeSavedId ? saved.find((item) => item.id === activeSavedId) : undefined
  const shownRecipe = activeSaved || recipe
  const shownImage = activeSaved?.image || image
  const isCurrentSaved = activeSaved || (recipe && saved.some((item) => item.name_en === recipe.name_en && item.image === image))

  const selectFile = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo file, such as JPG, PNG, or HEIC.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('That photo is larger than 20 MB. Choose a smaller image and try again.')
      return
    }
    try {
      const prepared = await compressImage(file)
      setImage(prepared)
      setImageName(file.name)
      setRecipe(null)
      setActiveSavedId(null)
      setError('')
      setSaveError('')
      setView('discover')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare this photo.')
    }
  }

  const analyze = async () => {
    if (!image) return
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'We could not read this dish. Please try again.')
      setRecipe(result as Recipe)
      setActiveSavedId(null)
      setView('recipe')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
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
      setSaveError('Your browser storage is full. Remove an older recipe and try again.')
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

  const startOver = () => {
    setImage(null)
    setImageName('')
    setRecipe(null)
    setActiveSavedId(null)
    setError('')
    setView('discover')
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void selectFile(event.dataTransfer.files[0])
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    void selectFile(event.target.files?.[0])
    event.target.value = ''
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={startOver} aria-label="Bapsang home">
          <span className="brand-mark"><BowlMark /></span>
          <span className="brand-copy">
            <strong>Bapsang</strong>
            <small>밥상</small>
          </span>
        </button>

        <nav className="top-nav" aria-label="Main navigation">
          <button className={view === 'discover' ? 'active' : ''} onClick={() => setView('discover')}>
            <Camera size={17} strokeWidth={1.9} />
            Identify
          </button>
          <button className={view === 'saved' ? 'active' : ''} onClick={() => setView('saved')}>
            <Library size={17} strokeWidth={1.9} />
            Saved
            {saved.length > 0 && <span className="nav-count">{saved.length}</span>}
          </button>
        </nav>
      </header>

      <main>
        {view === 'discover' && (
          <section className="discover-view">
            <div className="intro-copy">
              <p className="eyebrow">Korean food, made familiar</p>
              <h1>See a dish.<br />Cook it at home.</h1>
              <p className="intro-text">Share a photo and get a practical recipe, with ingredient swaps for wherever you live.</p>
              <div className="quiet-feature-list" aria-label="How it works">
                <span><i>1</i> Add a clear photo</span>
                <span><i>2</i> We identify the dish</span>
                <span><i>3</i> Save it for dinner</span>
              </div>
            </div>

            <div className="upload-panel">
              {!image ? (
                <div
                  className={`drop-zone ${isDragging ? 'dragging' : ''}`}
                  onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <div className="upload-icon"><ImagePlus size={27} strokeWidth={1.6} /></div>
                  <h2>Add a dish photo</h2>
                  <p>Choose a well-lit image where the food fills most of the frame.</p>
                  <button className="primary-button" onClick={() => fileInput.current?.click()}>
                    <Upload size={17} /> Choose photo
                  </button>
                  <button className="camera-button" onClick={() => cameraInput.current?.click()}>
                    <Camera size={17} /> Take a photo
                  </button>
                  <span className="file-hint">JPG, PNG or HEIC · up to 20 MB</span>
                </div>
              ) : (
                <div className="preview-card">
                  <div className="preview-image-wrap">
                    <img src={image} alt="Selected Korean dish" />
                    <button className="image-close" onClick={startOver} aria-label="Remove photo"><X size={18} /></button>
                    <span className="photo-ready"><Check size={13} /> Photo ready</span>
                  </div>
                  <div className="preview-meta">
                    <div>
                      <span>Selected photo</span>
                      <strong>{imageName || 'Dish photo'}</strong>
                    </div>
                    <button className="text-button" onClick={() => fileInput.current?.click()}>Change</button>
                  </div>
                  <button className="analyze-button" onClick={analyze} disabled={isLoading}>
                    {isLoading ? <><LoaderCircle className="spin" size={18} /> Reading your dish…</> : <><Sparkles size={18} /> Find the recipe <ArrowRight size={18} /></>}
                  </button>
                  <p className="privacy-note">Processed by OpenCode MiMo. Avoid uploading personal or sensitive images.</p>
                </div>
              )}
              {error && (
                <div className="error-message" role="alert">
                  <span>{error}</span>
                  {image && !isLoading && <button onClick={analyze}><RefreshCw size={14} /> Try again</button>}
                </div>
              )}
            </div>
          </section>
        )}

        {view === 'saved' && (
          <section className="saved-view">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your collection</p>
                <h1>Saved recipes</h1>
              </div>
              <p>{saved.length ? `${saved.length} ${saved.length === 1 ? 'dish' : 'dishes'}, kept on this device.` : 'A quiet place for recipes you want to make again.'}</p>
            </div>

            {saved.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon"><Bookmark size={25} strokeWidth={1.6} /></span>
                <h2>Your recipe shelf is empty</h2>
                <p>Identify a dish from a photo, then save the recipe here for later.</p>
                <button className="primary-button" onClick={() => setView('discover')}>Identify a dish <ArrowRight size={17} /></button>
              </div>
            ) : (
              <div className="recipe-grid">
                {saved.map((item) => (
                  <article className="saved-card" key={item.id}>
                    <button className="saved-card-main" onClick={() => openSaved(item)}>
                      <img src={item.image} alt={item.name_en} />
                      <span className="saved-card-copy">
                        <small>{item.name_kr}</small>
                        <strong>{item.name_en}</strong>
                        <em>{item.ingredients.length} ingredients · {item.steps.length} steps</em>
                      </span>
                      <ChevronRight className="saved-chevron" size={19} />
                    </button>
                    <button className="card-delete" onClick={() => removeRecipe(item.id)} aria-label={`Delete ${item.name_en}`}><Trash2 size={16} /></button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'recipe' && shownRecipe && shownImage && (
          <section className="recipe-view">
            <button className="back-button" onClick={() => setView(activeSaved ? 'saved' : 'discover')}>
              <ArrowLeft size={17} /> {activeSaved ? 'Saved recipes' : 'Back to photo'}
            </button>

            <article className="recipe-sheet">
              <div className="recipe-hero">
                <img src={shownImage} alt={shownRecipe.name_en} />
                <div className="recipe-title">
                  <p className="eyebrow">Your dish</p>
                  <p className="korean-name" lang="ko">{shownRecipe.name_kr}</p>
                  <h1>{shownRecipe.name_en}</h1>
                  <div className="recipe-stats">
                    <span>{shownRecipe.ingredients.length} ingredients</span>
                    <i />
                    <span>{shownRecipe.steps.length} steps</span>
                  </div>
                  <button className={`save-button ${isCurrentSaved ? 'saved' : ''}`} onClick={saveRecipe} disabled={Boolean(isCurrentSaved)}>
                    {isCurrentSaved ? <><BookmarkCheck size={18} /> Saved to your recipes</> : <><Bookmark size={18} /> Save recipe</>}
                  </button>
                  {saveError && <p className="save-error">{saveError}</p>}
                </div>
              </div>

              <div className="recipe-body">
                <section className="ingredients-section">
                  <div className="recipe-section-title">
                    <span>01</span>
                    <h2>Ingredients</h2>
                  </div>
                  <ul>
                    {shownRecipe.ingredients.map((ingredient, index) => (
                      <li key={`${ingredient}-${index}`}><span className="ingredient-check" />{ingredient}</li>
                    ))}
                  </ul>
                </section>

                <section className="method-section">
                  <div className="recipe-section-title">
                    <span>02</span>
                    <h2>Method</h2>
                  </div>
                  <ol>
                    {shownRecipe.steps.map((step, index) => (
                      <li key={`${step}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>
                    ))}
                  </ol>
                </section>
              </div>

              {shownRecipe.notes && (
                <aside className="cook-note">
                  <span className="note-line" />
                  <div>
                    <p>Cook’s note</p>
                    <span>{shownRecipe.notes}</span>
                  </div>
                </aside>
              )}
            </article>

            <div className="recipe-footer-actions">
              <button className="secondary-button" onClick={startOver}><Camera size={17} /> Identify another dish</button>
              {activeSaved && <button className="delete-button" onClick={() => removeRecipe(activeSaved.id)}><Trash2 size={16} /> Remove from saved</button>}
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <span>Bapsang · 밥상</span>
        <p>Recipes are AI-generated. Check ingredients for allergies and cook food to safe temperatures.</p>
      </footer>

      <input ref={fileInput} className="sr-only" type="file" accept="image/*" onChange={handleChange} />
      <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={handleChange} />
    </div>
  )
}

export default App
