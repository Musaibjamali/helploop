import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import './Education.css'

type Book = {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  cover_i?: number
}

type Resource = {
  title: string
  category: string
  description: string
  icon: string
  link: string
  level: string
}

type Video = {
  videoId: string
  title: string
  description: string
  channelTitle: string
  thumbnail: string
  publishedAt: string
  duration: string
  viewCount: string
  url: string
}

const skills: Resource[] = [
  { title: 'C++ Programming', category: 'Programming', description: 'Learn programming logic, loops, functions and object-oriented programming.', icon: '💻', link: 'https://www.learncpp.com/', level: 'Beginner' },
  { title: 'Python Programming', category: 'Programming', description: 'Learn Python fundamentals and build useful applications.', icon: '🐍', link: 'https://www.python.org/about/gettingstarted/', level: 'Beginner' },
  { title: 'Java Programming', category: 'Programming', description: 'Learn Java, object-oriented programming and application development.', icon: '☕', link: 'https://dev.java/learn/', level: 'Beginner' },
  { title: 'JavaScript', category: 'Programming', description: 'Learn the language used to make websites interactive.', icon: '📜', link: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript', level: 'Beginner' },
  { title: 'Web Development', category: 'Programming', description: 'Learn HTML, CSS, JavaScript and website development.', icon: '🌐', link: 'https://developer.mozilla.org/en-US/docs/Learn', level: 'Beginner' },
  { title: 'App Development', category: 'Programming', description: 'Explore Android and mobile application development.', icon: '📱', link: 'https://developer.android.com/courses', level: 'Beginner' },
  { title: 'React Development', category: 'Programming', description: 'Build modern user interfaces with React.', icon: '⚛️', link: 'https://react.dev/learn', level: 'Beginner' },
  { title: 'SQL & Databases', category: 'Programming', description: 'Learn databases, SQL queries and data management.', icon: '🗄️', link: 'https://www.w3schools.com/sql/', level: 'Beginner' },
  { title: 'Graphic Design', category: 'Creative Skills', description: 'Learn visual design, layouts, typography and creative tools.', icon: '🎨', link: 'https://www.canva.com/designschool/', level: 'Beginner' },
  { title: 'Video Editing', category: 'Creative Skills', description: 'Learn video editing techniques and storytelling.', icon: '🎬', link: 'https://www.blackmagicdesign.com/products/davinciresolve/training', level: 'Beginner' },
  { title: 'UI/UX Design', category: 'Creative Skills', description: 'Learn user interface and user experience design.', icon: '✨', link: 'https://www.figma.com/resource-library/', level: 'Beginner' },
  { title: 'Photography', category: 'Creative Skills', description: 'Explore photography basics, composition and editing.', icon: '📷', link: 'https://www.adobe.com/creativecloud/photography/discover.html', level: 'Beginner' },
  { title: 'Artificial Intelligence', category: 'Technology', description: 'Understand AI, machine learning and practical AI tools.', icon: '🤖', link: 'https://www.elementsofai.com/', level: 'Beginner' },
  { title: 'Cybersecurity', category: 'Technology', description: 'Explore online safety, security fundamentals and networks.', icon: '🔐', link: 'https://www.netacad.com/', level: 'Beginner' },
  { title: 'Data Science', category: 'Technology', description: 'Explore data analysis, statistics and visualization.', icon: '📊', link: 'https://www.kaggle.com/learn', level: 'Beginner' },
  { title: 'Cloud Computing', category: 'Technology', description: 'Learn cloud concepts and cloud services.', icon: '☁️', link: 'https://learn.microsoft.com/en-us/training/azure/', level: 'Beginner' },
  { title: 'Microsoft Excel', category: 'Technology', description: 'Learn spreadsheets, formulas and data management.', icon: '📈', link: 'https://support.microsoft.com/excel', level: 'Beginner' },
  { title: 'Computer Fundamentals', category: 'Technology', description: 'Understand computers, operating systems and hardware.', icon: '🖥️', link: 'https://edu.gcfglobal.org/en/computerbasics/', level: 'Beginner' },
  { title: 'Digital Marketing', category: 'Business', description: 'Learn digital marketing, SEO and online promotion.', icon: '📣', link: 'https://skillshop.withgoogle.com/', level: 'Beginner' },
  { title: 'Freelancing', category: 'Business', description: 'Develop skills for finding clients and working online.', icon: '💼', link: 'https://www.upwork.com/resources', level: 'Beginner' },
  { title: 'Entrepreneurship', category: 'Business', description: 'Learn how to develop and grow a business idea.', icon: '🚀', link: 'https://www.sba.gov/business-guide', level: 'Beginner' },
  { title: 'Personal Finance', category: 'Business', description: 'Understand budgeting, saving and financial planning.', icon: '💰', link: 'https://www.khanacademy.org/college-careers-more/personal-finance', level: 'Beginner' },
  { title: 'English Communication', category: 'Languages', description: 'Improve English speaking, grammar and vocabulary.', icon: '🗣️', link: 'https://learnenglish.britishcouncil.org/', level: 'Beginner' },
  { title: 'English Grammar', category: 'Languages', description: 'Practice grammar, sentence structure and writing.', icon: '✍️', link: 'https://learnenglish.britishcouncil.org/grammar', level: 'Beginner' },
  { title: 'Mathematics', category: 'Education', description: 'Practice mathematics, algebra and problem solving.', icon: '📐', link: 'https://www.khanacademy.org/math', level: 'Beginner' },
  { title: 'Physics', category: 'Education', description: 'Explore physics concepts, motion, energy and forces.', icon: '⚛️', link: 'https://www.khanacademy.org/science/physics', level: 'Beginner' },
  { title: 'Chemistry', category: 'Education', description: 'Learn chemistry, atoms, reactions and compounds.', icon: '🧪', link: 'https://www.khanacademy.org/science/chemistry', level: 'Beginner' },
  { title: 'Biology', category: 'Education', description: 'Explore cells, genetics, organisms and life sciences.', icon: '🧬', link: 'https://www.khanacademy.org/science/biology', level: 'Beginner' },
  { title: 'Communication Skills', category: 'Personal Development', description: 'Improve speaking, listening and communication.', icon: '🤝', link: 'https://www.coursera.org/browse/personal-development', level: 'Beginner' },
  { title: 'Time Management', category: 'Personal Development', description: 'Learn planning, productivity and time management.', icon: '⏰', link: 'https://www.atlassian.com/blog/productivity', level: 'Beginner' },
]

const courses: Resource[] = [
  { title: 'C++ Programming', category: 'Programming', description: 'Variables, conditions, loops, functions and problem solving.', icon: '💻', link: 'https://www.learncpp.com/', level: 'Beginner' },
  { title: 'Python for Beginners', category: 'Programming', description: 'Learn Python fundamentals and build your first programs.', icon: '🐍', link: 'https://www.python.org/about/gettingstarted/', level: 'Beginner' },
  { title: 'Web Development', category: 'Programming', description: 'Explore HTML, CSS, JavaScript and web development.', icon: '🌐', link: 'https://developer.mozilla.org/en-US/docs/Learn', level: 'Beginner' },
  { title: 'Java Programming', category: 'Programming', description: 'Learn Java programming from the official learning portal.', icon: '☕', link: 'https://dev.java/learn/', level: 'Beginner' },
  { title: 'React Basics', category: 'Programming', description: 'Learn React components, state and user interfaces.', icon: '⚛️', link: 'https://react.dev/learn', level: 'Beginner' },
  { title: 'Introduction to AI', category: 'Artificial Intelligence', description: 'Understand AI concepts and real-world applications.', icon: '🤖', link: 'https://www.elementsofai.com/', level: 'Beginner' },
  { title: 'Machine Learning', category: 'Artificial Intelligence', description: 'Explore machine learning lessons and practical exercises.', icon: '🧠', link: 'https://www.kaggle.com/learn', level: 'Beginner' },
  { title: 'Cybersecurity Basics', category: 'IT & Technology', description: 'Learn networking and cybersecurity fundamentals.', icon: '🔐', link: 'https://www.netacad.com/', level: 'Beginner' },
  { title: 'Microsoft Excel', category: 'IT & Technology', description: 'Learn Excel through Microsoft support and tutorials.', icon: '📊', link: 'https://support.microsoft.com/excel', level: 'Beginner' },
  { title: 'Cloud Computing', category: 'IT & Technology', description: 'Explore cloud computing and Azure training.', icon: '☁️', link: 'https://learn.microsoft.com/en-us/training/azure/', level: 'Beginner' },
  { title: 'Graphic Design', category: 'Creative Skills', description: 'Learn design basics and creative techniques.', icon: '🎨', link: 'https://www.canva.com/designschool/', level: 'Beginner' },
  { title: 'Video Editing', category: 'Creative Skills', description: 'Learn video editing with free official training.', icon: '🎬', link: 'https://www.blackmagicdesign.com/products/davinciresolve/training', level: 'Beginner' },
  { title: 'English Grammar & Writing', category: 'Languages', description: 'Improve grammar, vocabulary and communication.', icon: '📚', link: 'https://learnenglish.britishcouncil.org/', level: 'Beginner' },
  { title: 'Mathematics Fundamentals', category: 'Mathematics', description: 'Practice arithmetic, algebra and equations.', icon: '📐', link: 'https://www.khanacademy.org/math', level: 'Beginner' },
  { title: 'Physics Fundamentals', category: 'Science', description: 'Study physics concepts with guided lessons.', icon: '⚛️', link: 'https://www.khanacademy.org/science/physics', level: 'Beginner' },
  { title: 'Biology Fundamentals', category: 'Science', description: 'Explore biology and life science topics.', icon: '🧬', link: 'https://www.khanacademy.org/science/biology', level: 'Beginner' },
  { title: 'Digital Marketing', category: 'Business', description: 'Learn Google tools and digital marketing skills.', icon: '📣', link: 'https://skillshop.withgoogle.com/', level: 'Beginner' },
  { title: 'Freelancing Resources', category: 'Business', description: 'Explore guides for starting freelance work.', icon: '💼', link: 'https://www.upwork.com/resources', level: 'Beginner' },
  { title: 'Computer Fundamentals', category: 'IT & Technology', description: 'Understand computer hardware and software.', icon: '🖥️', link: 'https://edu.gcfglobal.org/en/computerbasics/', level: 'Beginner' },
  { title: 'IT Skills', category: 'IT & Technology', description: 'Explore practical technology learning resources.', icon: '⚙️', link: 'https://learn.microsoft.com/en-us/training/', level: 'Beginner' },
]

const tabs = ['Books', 'Skills', 'Courses', 'Videos']

// A single broad search phrase is used because YouTube does not treat "|" as OR.
const DEFAULT_VIDEO_QUERY = 'educational tutorials learning technology programming science'

function formatDuration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''

  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function Education() {
  const [activeTab, setActiveTab] = useState('Books')
  const [search, setSearch] = useState('')
  const [bookQuery, setBookQuery] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookPage, setBookPage] = useState(1)
  const [bookTotal, setBookTotal] = useState(0)
  const [category, setCategory] = useState('All')

  const [videos, setVideos] = useState<Video[]>([])
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [activeVideoQuery, setActiveVideoQuery] = useState('')

  const searchBooks = async (page = 1) => {
    const query = bookQuery.trim()

    if (!query) {
      setError('Please enter a book title, author or subject.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=24&page=${page}`
      )

      if (!response.ok) {
        throw new Error('Book search is temporarily unavailable.')
      }

      const data = await response.json()
      setBooks(data.docs || [])
      setBookTotal(data.numFound || data.num_found || 0)
      setBookPage(page)

      if (!data.docs?.length) {
        setError('No books found. Try another title or subject.')
      }
    } catch {
      setError('Could not load books. Check your internet connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const searchVideos = async (loadMore = false, queryOverride?: string) => {
    const query = (queryOverride || (loadMore ? activeVideoQuery : search.trim())).trim()

    if (!query) {
      setVideoError('Please enter a topic to search videos.')
      return
    }

    setVideoLoading(true)
    setVideoError('')

    if (!loadMore) {
      setVideos([])
      setNextPageToken(null)
      setSelectedVideoId('')
      setActiveVideoQuery(query)
    }

    try {
      const { data, error } = await supabase.functions.invoke('youtube-search', {
        body: {
          q: query,
          pageToken: loadMore ? nextPageToken : null,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      const newVideos: Video[] = data?.items || []

      setVideos(previous =>
        loadMore ? [...previous, ...newVideos] : newVideos
      )

      setNextPageToken(data?.nextPageToken || null)

      if (!newVideos.length && !loadMore) {
        setVideoError('No videos found. Try another topic.')
      }
    } catch (err) {
      setVideoError(
        err instanceof Error
          ? err.message
          : 'Could not load videos. Please try again.'
      )
    } finally {
      setVideoLoading(false)
    }
  }

  // Automatically load a general video feed as soon as the Videos tab is opened.
  useEffect(() => {
    if (activeTab === 'Videos' && videos.length === 0 && !videoLoading) {
      searchVideos(false, DEFAULT_VIDEO_QUERY)
    }
    // Intentionally run when the selected tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const filteredSkills = skills.filter(item => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || `${item.title} ${item.category} ${item.description}`.toLowerCase().includes(q)
    return matchesSearch && (category === 'All' || item.category === category)
  })

  const filteredCourses = courses.filter(item => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || `${item.title} ${item.category} ${item.description}`.toLowerCase().includes(q)
    return matchesSearch && (category === 'All' || item.category === category)
  })

  const categories = activeTab === 'Skills'
    ? ['All', ...Array.from(new Set(skills.map(item => item.category)))]
    : ['All', ...Array.from(new Set(courses.map(item => item.category)))]

  return (
    <div className="education-page">
      <section className="education-hero">
        <div className="education-hero-copy">
          <span className="education-eyebrow">EXPLOREX • HELLOOP DISCOVERY HUB</span>
          <h2>Explore something <span>new every day.</span></h2>
          <p>Discover books, useful skills, courses, videos and fresh ideas on topics that interest you.</p>
          <button
            className="education-explore-btn"
            onClick={() => document.getElementById('education-library')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Explore now <span>→</span>
          </button>
        </div>

        <div className="education-hero-art">
          <div className="education-art-circle">🎓</div>
          <span className="education-float education-float-one">📘</span>
          <span className="education-float education-float-two">💡</span>
          <span className="education-float education-float-three">🚀</span>
        </div>
      </section>

      <section className="education-stats">
        <div className="education-stat">
          <span className="education-stat-icon purple">📚</span>
          <div><strong>Online Books</strong><small>Search a large book catalogue</small></div>
        </div>

        <div className="education-stat">
          <span className="education-stat-icon blue">🧠</span>
          <div><strong>{skills.length}+ Skills</strong><small>Explore useful skills</small></div>
        </div>

        <div className="education-stat">
          <span className="education-stat-icon green">🌱</span>
          <div><strong>{courses.length}+ Courses</strong><small>Explore learning resources</small></div>
        </div>
      </section>

      <section className="education-section" id="education-library">
        <div className="education-heading">
          <div>
            <span className="education-kicker">YOUR NEXT DISCOVERY STARTS HERE</span>
            <h2>ExploreX Discovery Hub</h2>
            <p>Explore books, skills, courses and videos — all in one place.</p>
          </div>
        </div>

        <div className="education-tabs">
          {tabs.map(tab => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => {
                setActiveTab(tab)
                setSearch('')
                setCategory('All')
                setError('')
                setVideoError('')
              }}
            >
              {tab === 'Books' ? '📚 ' : tab === 'Skills' ? '💡 ' : tab === 'Courses' ? '🎓 ' : '▶️ '}
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Books' && (
          <div className="education-library-panel">
            <h3>Find your next book</h3>
            <p>Search books by title, author or subject from the Open Library catalogue.</p>

            <form
              className="education-search education-live-search"
              onSubmit={event => {
                event.preventDefault()
                searchBooks(1)
              }}
            >
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search books, authors, programming, science..."
                value={bookQuery}
                onChange={event => setBookQuery(event.target.value)}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Search Books'}
              </button>
            </form>

            {error && <p className="education-message">{error}</p>}

            <div className="education-book-grid">
              {books.map((book, index) => (
                <article className="education-book-card" key={book.key || index}>
                  {book.cover_i ? (
                    <img
                      src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                      alt={`Cover of ${book.title}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="education-book-placeholder">📖</div>
                  )}

                  <div className="education-book-info">
                    <h4>{book.title}</h4>
                    <p>{book.author_name?.slice(0, 2).join(', ') || 'Author not listed'}</p>
                    {book.first_publish_year && <small>First published: {book.first_publish_year}</small>}
                    <a href={`https://openlibrary.org${book.key}`} target="_blank" rel="noopener noreferrer">
                      View book ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>

            {!books.length && !loading && !error && (
              <div className="education-empty">
                <span>🔎</span>
                <h3>Discover thousands of books</h3>
                <p>Enter any subject or book title above to get started.</p>
              </div>
            )}

            {books.length > 0 && (
              <div className="education-pagination">
                <button disabled={loading || bookPage <= 1} onClick={() => searchBooks(bookPage - 1)}>
                  ← Previous
                </button>

                <span>Page {bookPage} {bookTotal > 0 ? `of ${Math.ceil(bookTotal / 24)}` : ''}</span>

                <button
                  disabled={loading || bookPage * 24 >= bookTotal}
                  onClick={() => searchBooks(bookPage + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {(activeTab === 'Skills' || activeTab === 'Courses') && (
          <>
            <div className="education-search">
              <span>⌕</span>
              <input
                type="search"
                placeholder={activeTab === 'Skills' ? 'Search skills: coding, design, freelancing...' : 'Search courses and subjects...'}
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>

            <div className="education-filter-row">
              <label htmlFor="education-category">Category</label>
              <select
                id="education-category"
                value={category}
                onChange={event => setCategory(event.target.value)}
              >
                {categories.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <p className="education-result-count">
              {activeTab === 'Skills' ? filteredSkills.length : filteredCourses.length} results
            </p>

            <div className="education-course-grid">
              {(activeTab === 'Skills' ? filteredSkills : filteredCourses).map(item => (
                <article className="education-course-card" key={item.title}>
                  <div className="education-course-top">
                    <span className={`education-course-icon ${activeTab === 'Skills' ? 'purple' : 'blue'}`}>
                      {item.icon}
                    </span>
                    <span className="education-level">{item.level}</span>
                  </div>

                  <span className="education-course-category">{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>

                  <div className="education-course-footer">
                    <span>Self-paced</span>
                    <a href={item.link} target="_blank" rel="noopener noreferrer">
                      Start learning ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>

            {activeTab === 'Skills' && !filteredSkills.length && (
              <div className="education-empty">
                <h3>No skills found</h3>
                <p>Try another search or category.</p>
              </div>
            )}

            {activeTab === 'Courses' && !filteredCourses.length && (
              <div className="education-empty">
                <h3>No courses found</h3>
                <p>Try another search or category.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'Videos' && (
          <div className="education-library-panel">
            <h3>Discover videos on every topic</h3>
            <p>Explore videos about programming, AI, English, science, freelancing, technology and more.</p>

            <form
              className="education-search education-live-search"
              onSubmit={event => {
                event.preventDefault()
                searchVideos(false)
              }}
            >
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search any topic: Python, English, freelancing, AI..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <button type="submit" disabled={videoLoading || !search.trim()}>
                {videoLoading ? 'Searching...' : 'Search Videos'}
              </button>
            </form>

            {videoError && <p className="education-message">{videoError}</p>}

            {selectedVideoId && (
              <div className="education-video-player">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${selectedVideoId}`}
                  title="YouTube learning video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <button onClick={() => setSelectedVideoId('')}>
                  Close Video
                </button>
              </div>
            )}

            <div className="education-video-grid">
              {videos.map(video => (
                <article className="education-video-card" key={video.videoId}>
                  <button
                    type="button"
                    className="education-video-thumbnail"
                    onClick={() => setSelectedVideoId(video.videoId)}
                    aria-label={`Play ${video.title}`}
                  >
                    <img src={video.thumbnail} alt={video.title} loading="lazy" />
                    <span>▶</span>
                  </button>

                  <div className="education-video-info">
                    <h4>{video.title}</h4>
                    <p>{video.channelTitle}</p>
                    <small>
                      {formatDuration(video.duration) ? `${formatDuration(video.duration)} · ` : ''}
                      {Number(video.viewCount || 0).toLocaleString()} views
                    </small>
                  </div>
                </article>
              ))}
            </div>

            {videoLoading && (
              <p className="education-message">Loading videos...</p>
            )}

            {!videos.length && !videoLoading && !videoError && (
              <div className="education-empty">
                <span>▶️</span>
                <h3>Loading your discovery feed</h3>
                <p>Videos will appear here automatically when you open this tab.</p>
              </div>
            )}

            {videos.length > 0 && nextPageToken && (
              <div className="education-pagination">
                <button
                  disabled={videoLoading}
                  onClick={() => searchVideos(true)}
                >
                  {videoLoading ? 'Loading...' : 'Load More Videos'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="education-bottom">
        <div className="education-bottom-icon">✨</div>
        <div>
          <h3>Discover more. Learn more. Grow every day.</h3>
          <p>Explore new ideas, build useful skills and find something interesting every day.</p>
        </div>
      </section>
    </div>
  )
}
