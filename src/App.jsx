import { useState, useEffect, useRef } from 'react'
import './App.css'
import { db } from './utils/firebase'
import { collection, getDocs, query, orderBy, writeBatch, doc, runTransaction, getDoc } from 'firebase/firestore'

const ADMIN_PASSWORD = '07h%*136v8NoV' // fixed admin password

function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [visitorCount, setVisitorCount] = useState(0)
  const [isVideoOpen, setIsVideoOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')
  const [currentStep, setCurrentStep] = useState(1)
  const [comfortLevel, setComfortLevel] = useState(50)
  const [comfortText, setComfortText] = useState('Neutral')
  const [beliefNumber, setBeliefNumber] = useState(125)

  const [selectedBelief, setSelectedBelief] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  // Editor states
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isSavingFs, setIsSavingFs] = useState(false)
  const [saveFsMsg, setSaveFsMsg] = useState('')
  
  const spectrumRef = useRef(null)
  const handleRef = useRef(null)
  const [data, setData] = useState([])
  const shouldFocusNewRowRef = useRef(false)
console.log("data", data)
  useEffect(() => {
    // Global visitor counter stored in Firestore; increment only once per browser
    const syncVisitor = async () => {
      try {
        const countersRef = doc(db, 'meta', 'counters')
        const already = localStorage.getItem('visitor_counted') === 'true'
        if (!already) {
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(countersRef)
            if (!snap.exists()) {
              tx.set(countersRef, { visitors: 1 })
            } else {
              const current = Number(snap.data().visitors || 0)
              tx.update(countersRef, { visitors: current + 1 })
            }
          })
          localStorage.setItem('visitor_counted', 'true')
        }
        const latest = await getDoc(countersRef)
        if (latest.exists()) {
          setVisitorCount(Number(latest.data().visitors || 0))
        } else {
          setVisitorCount(1)
        }
      } catch (e) {
        console.error('Visitor counter sync failed', e)
      }
    }
    syncVisitor()
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsVideoOpen(false)
        setIsEditorOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isVideoOpen || isEditorOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isVideoOpen, isEditorOpen])

  // URL param: ?passwordAdmin=XXXX or ?adminPassword=XXXX
  useEffect(() => {
    const url = new URL(window.location.href)
    const p1 = url.searchParams.get('passwordAdmin')
    const p2 = url.searchParams.get('adminPassword')
    const param = p1 ?? p2
    if (param !== null) {
      if (param === ADMIN_PASSWORD) {
        setIsEditorOpen(true)
      } else {
        setIsEditorOpen(false)
        setShowLanding(true)
      }
      // Clean URL (remove both keys, then rewrite)
      url.searchParams.delete('passwordAdmin')
      url.searchParams.delete('adminPassword')
      const cleaned = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash
      window.history.replaceState({}, document.title, cleaned)
    }
  }, [])

  // Load beliefs: Firestore only
  useEffect(() => {
    const loadFromFirestore = async () => {
      try {
        const q = query(collection(db, 'beliefs'), orderBy('number', 'asc'))
        const snap = await getDocs(q)
        const rows = snap.docs.map(d => ({ id: d.id, ...(d.data()) }))
        setData(rows.map(r => ({ number: r.number, content: r.content })))
      } catch (err) {
        console.error('Failed to load Firestore', err)
        setData([])
      }
    }
    loadFromFirestore()
  }, [])

  useEffect(() => {
    // Add global event listeners
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }

    const handleGlobalMouseMove = (e) => {
      if (isDragging) {
        updateHandlePosition(e.clientX)
      }
    }

    const handleGlobalTouchMove = (e) => {
      if (isDragging) {
        updateHandlePosition(e.touches[0].clientX)
      }
    }

    const handleGlobalTouchEnd = () => {
      setIsDragging(false)
    }

    document.addEventListener('mouseup', handleGlobalMouseUp)
    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('touchmove', handleGlobalTouchMove)
    document.addEventListener('touchend', handleGlobalTouchEnd)

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp)
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('touchmove', handleGlobalTouchMove)
      document.removeEventListener('touchend', handleGlobalTouchEnd)
    }
  }, [isDragging])

  // Focus the last row input after adding
  useEffect(() => {
    if (isEditorOpen && shouldFocusNewRowRef.current) {
      const input = document.querySelector('.editor-table tbody tr:last-child input[type="text"]')
      if (input && 'focus' in input) {
        input.focus()
        try { input.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch {}
      }
      shouldFocusNewRowRef.current = false
    }
  }, [data.length, isEditorOpen])

  const updateHandlePosition = (clientX) => {
    if (!spectrumRef.current) return

    const rect = spectrumRef.current.getBoundingClientRect()
    let position = (clientX - rect.left) / rect.width
    position = Math.max(0, Math.min(1, position))

    const percentage = Math.round(position * 100)
    let text = 'Neutral'
    
    if (percentage < 20) {
      text = 'Very Uncomfortable'
    } else if (percentage < 40) {
      text = 'Somewhat Uncomfortable'
    } else if (percentage < 60) {
      text = 'Neutral'
    } else if (percentage < 80) {
      text = 'Somewhat Comfortable'
    } else {
      text = 'Very Comfortable'
    }

    setComfortLevel(percentage)
    setComfortText(text)
    if (handleRef.current) {
      handleRef.current.style.left = `${position * 100}%`
    }
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    setIsDragging(true)
    updateHandlePosition(e.clientX)
  }

  const handleTouchStart = (e) => {
    setIsDragging(true)
    updateHandlePosition(e.touches[0].clientX)
  }

  const handleSpectrumClick = (e) => {
    updateHandlePosition(e.clientX)
  }

  const handleNumberChange = (e) => {
    let value = parseInt(e.target.value)
    if (isNaN(value)) {
      value = 1
    } else {
      value = Math.max(1, Math.min(data.length, value))
    }
    setBeliefNumber(value)
  }

  const handleRevealBelief = () => {
    const matchingData = data.find(item => item.number === beliefNumber)
    if (matchingData) {
      setSelectedBelief(matchingData.content)
    } else {
      setSelectedBelief('No belief found for this number. Please choose another.')
    }
    setCurrentStep(3)
  }

  const addRow = () => {
    setData(prev => [...prev, { number: prev.length + 1, content: '' }])
    shouldFocusNewRowRef.current = true
  }

  const normalizedData = () => data.map((row, i) => ({ number: i + 1, content: row.content }))

  const saveToFirestore = async () => {
    try {
      setIsSavingFs(true)
      setSaveFsMsg('')
      const batch = writeBatch(db)
      const rows = normalizedData()
      // Upsert all rows with doc id = number
      rows.forEach(row => {
        batch.set(doc(db, 'beliefs', String(row.number)), { number: row.number, content: row.content })
      })
      // Delete docs that no longer exist (fetch existing ids then diff)
      const existing = await getDocs(collection(db, 'beliefs'))
      const existingIds = new Set(existing.docs.map(d => d.id))
      const newIds = new Set(rows.map(r => String(r.number)))
      existingIds.forEach(id => { if (!newIds.has(id)) batch.delete(doc(db, 'beliefs', id)) })

      await batch.commit()
      setSaveFsMsg('Saved')
      setTimeout(() => setSaveFsMsg(''), 2500)
    } catch (e) {
      console.error(e)
      setSaveFsMsg('Save failed')
      setTimeout(() => setSaveFsMsg(''), 3000)
    } finally {
      setIsSavingFs(false)
    }
  }

  return (
    <div className={`popup-container ${showLanding ? 'is-landing' : ''}`}>
      {showLanding && (
        <div className="landing">
          <div className="popup-header">
          <h1>Thanks for stopping by! You are visitor number</h1>
          </div>
          <div className="flip-counter" aria-label={`Visitor ${visitorCount}`}>
            {String(visitorCount).padStart(4, '0').split('').map((digit, idx) => (
              <div key={idx} className="flip-digit">{digit}</div>
            ))}
          </div>
          <div className="landing-actions">
            <button
              className="nav-btn"
              onClick={() => {
                setVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1')
                setIsVideoOpen(true)
              }}
            >
              Watch Video
            </button>
            <button className="nav-btn next" onClick={() => setShowLanding(false)}>Start Now</button>
          </div>
        </div>
      )}
      
      {!showLanding && (
      <>
      <div className="popup-header">
        <h1>Explore Your World Comfort</h1>
        <p>Discover the subconscious beliefs that may be limiting your comfort in exploring the world.</p>
      </div>

      {/* Step 1: Comfort Spectrum */}
      {currentStep === 1 && (
        <div className="step active">
          <h2>Where do you see yourself on the comfort spectrum?</h2>
          <div className="spectrum-container">
            <div className="spectrum-label">
              <span>Non-Comfort</span>
              <span>Comfort</span>
            </div>
            <div 
              className="spectrum-track" 
              ref={spectrumRef}
              onClick={handleSpectrumClick}
            >
              <div 
                className="spectrum-handle" 
                ref={handleRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                style={{ left: '50%' }}
              />
            </div>
            <div className="spectrum-value">
              {comfortText} ({comfortLevel}%)
            </div>
          </div>
          <div className="navigation">
            <div></div>
            <button className="nav-btn next" onClick={() => setCurrentStep(2)}>
              Continue
            </button>
          </div>
          <div className="progress-bar">
            <div className="progress" style={{ width: '33%' }} />
          </div>
        </div>
      )}

      {/* Step 2: Number Selection */}
      {currentStep === 2 && (
        <div className="step active">
          <div className="number-selection">
            <h2>Choose a number between 1 and {data.length}</h2>
            <p>This number will reveal a subconscious belief that may be influencing your comfort level.</p>
            <div className="number-input">
              <input
                type="number"
                value={beliefNumber}
                onChange={handleNumberChange}
                min="1"
                max={data.length}
              />
            </div>
          </div>
          <div className="navigation">
            <button className="nav-btn" onClick={() => setCurrentStep(1)}>
              Back
            </button>
            <button className="nav-btn next" onClick={handleRevealBelief}>
              Reveal My Belief
            </button>
          </div>
          <div className="progress-bar">
            <div className="progress" style={{ width: '66%' }} />
          </div>
        </div>
      )}

      {/* Step 3: Belief Display and Offer */}
      {currentStep === 3 && (
        <div className="step active">
          <div className="belief-result">
            <h2>Your Dominant Subconscious Belief</h2>
            <div className="belief-text">
              "{selectedBelief}"
            </div>
            <div className="belief-explanation">
              This belief may be limiting your ability to fully embrace new experiences and explore the world with confidence.
            </div>
          </div>
          <div className="session-offer">
            <h2>Transform Your Belief, Expand Your Comfort</h2>
            <p>Work with me to discharge this limiting belief through deep PEAT and mindshifting methods.</p>
            <div className="pricing-options">
              <div className="pricing-option">
                <h3>Single Session</h3>
                <div className="price">€350</div>
                <p>One guided session to address your specific belief</p>
                <button className="book-btn" onClick={() => window.open('https://tidycal.com/ccequity/60-minute-mindshifting', '_blank')}>Book Now</button>
              </div>
              <div className="pricing-option">
                <h3>Complete Package</h3>
                <div className="price">€1000</div>
                <p>3 Sessions + Perception Journal</p>
                <p><small>Recommended for lasting transformation</small></p>
                <button className="book-btn" onClick={() => window.open('https://tidycal.com/ccequity/60-minute-mindshifting', '_blank')}>Book Package</button>
              </div>
            </div>
          </div>
          <div className="navigation">
            <button className="nav-btn" onClick={() => setCurrentStep(2)}>
              Back
            </button>
            <div></div>
          </div>
          <div className="progress-bar">
            <div className="progress" style={{ width: '100%' }} />
          </div>
        </div>
      )}
      </>
      )}

      {isVideoOpen && (
        <div className="modal-overlay" onClick={() => setIsVideoOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setIsVideoOpen(false)}>×</button>
            <div className="video-responsive">
              <iframe
                src={videoUrl}
                title="Intro Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {isEditorOpen && (
        <div className="modal-overlay" onClick={() => setIsEditorOpen(false)}>
          <div className="modal-content light" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setIsEditorOpen(false)}>×</button>
            <h3>Edit Beliefs</h3>
            <div className="editor-actions">
              <button className="nav-btn" onClick={addRow}>Add Row</button>
              <button className="nav-btn next" disabled={isSavingFs} onClick={saveToFirestore}>{isSavingFs ? 'Saving…' : 'Save'}</button>
              {saveFsMsg && <span style={{ marginLeft: 8 }}>{saveFsMsg}</span>}
            </div>
            <div className="editor-table-wrapper">
              <table className="editor-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>#</th>
                    <th>Content</th>
                    <th style={{ width: '90px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <input type="number" value={row.number} onChange={(e) => setData(prev => { const copy = [...prev]; copy[idx] = { ...copy[idx], number: parseInt(e.target.value) || 0 }; return copy })} style={{ width: '70px' }} />
                      </td>
                      <td>
                        <input type="text" value={row.content} onChange={(e) => setData(prev => { const copy = [...prev]; copy[idx] = { ...copy[idx], content: e.target.value }; return copy })} style={{ width: '100%' }} />
                      </td>
                      <td>
                        <button className="nav-btn" onClick={() => setData(prev => prev.filter((_, i) => i !== idx).map((r, i2) => ({ number: i2 + 1, content: r.content })))}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
