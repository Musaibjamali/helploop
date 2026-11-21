
import { useEffect, useState } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { supabase } from './supabase'
import './Community.css'

type Post = {
  id: string
  user_id: string
  content: string
  created_at: string
  author_name: string
  author_username: string
  image_path: string | null
  image_url?: string | null
}

type Comment = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  author_name: string
  author_username: string
}

type LikeInfo = {
  count: number
  liked: boolean
}

export default function Community() {
  const [posts, setPosts] = useState<Post[]>([])
  const [userId, setUserId] = useState('')
  const [content, setContent] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [posting, setPosting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [likes, setLikes] = useState<Record<string, LikeInfo>>({})
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({})
  const [commenting, setCommenting] = useState('')

  const [editingPostId, setEditingPostId] = useState('')
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [reportingPostId, setReportingPostId] = useState('')
const [reportReason, setReportReason] = useState('Spam')
const [reportDetails, setReportDetails] = useState('')
const [submittingReport, setSubmittingReport] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
const [postFilter, setPostFilter] = useState<'all' | 'photos'>('all')
const [postSort, setPostSort] = useState<'latest' | 'oldest'>('latest')

  useEffect(() => {
    async function start() {
      const { data } = await supabase.auth.getUser()
      const id = data.user?.id || ''
      setUserId(id)
      await loadPosts(id)
    }

    start()
  }, [])

  useEffect(() => {
    const sharedId = new URLSearchParams(window.location.search)
      .get('communityPost')

    if (!loading && sharedId) {
      document.getElementById(`post-${sharedId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [posts, loading])

  async function loadPosts(currentUserId = userId) {
    setLoading(true)
    setError('')

    const { data, error } = await supabase.rpc('get_community_posts')

    if (error) {
      setError(error.message)
      setPosts([])
      setLoading(false)
      return
    }

    const postList = (data || []) as Post[]

    const postsWithPhotos = await Promise.all(
      postList.map(async post => {
        if (!post.image_path) return post

        const { data: imageData } = await supabase.storage
          .from('community-photos')
          .createSignedUrl(post.image_path, 3600)

        return {
          ...post,
          image_url: imageData?.signedUrl || null,
        }
      })
    )

    setPosts(postsWithPhotos)

    const { data: likeData } = await supabase
      .from('post_likes')
      .select('post_id, user_id')

    const likeInfo: Record<string, LikeInfo> = {}

    for (const post of postList) {
      const postLikes = (likeData || []).filter(
        like => like.post_id === post.id
      )

      likeInfo[post.id] = {
        count: postLikes.length,
        liked: postLikes.some(like => like.user_id === currentUserId),
      }
    }

    setLikes(likeInfo)
    setLoading(false)
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Sirf JPG, PNG aur WEBP photos allowed hain.')
      e.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo 5MB se chhoti honi chahiye.')
      e.target.value = ''
      return
    }

    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview('')
  }

  async function handlePost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const cleanContent = content.trim()

    if (!cleanContent) {
      alert('Post ke saath caption zaroor likho.')
      return
    }

    if (!userId) return

    setPosting(true)

    let imagePath: string | null = null

    if (photo) {
      const extension = photo.type === 'image/png'
        ? 'png'
        : photo.type === 'image/webp'
          ? 'webp'
          : 'jpg'

      imagePath = `${userId}/${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('community-photos')
        .upload(imagePath, photo, {
          contentType: photo.type,
          upsert: false,
        })

      if (uploadError) {
        alert(uploadError.message)
        setPosting(false)
        return
      }
    }

    const { error: insertError } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content: cleanContent,
        image_path: imagePath,
      })

    if (insertError) {
      if (imagePath) {
        await supabase.storage
          .from('community-photos')
          .remove([imagePath])
      }

      alert(insertError.message)
    } else {
      setContent('')
      removePhoto()
      await loadPosts(userId)
    }

    setPosting(false)
  }

  function startEdit(post: Post) {
    setEditingPostId(post.id)
    setEditContent(post.content)
  }

  function cancelEdit() {
    setEditingPostId('')
    setEditContent('')
  }

  async function saveEdit(postId: string) {
    const cleanContent = editContent.trim()

    if (!cleanContent) {
      alert('Caption khaali nahi ho sakta.')
      return
    }

    if (cleanContent.length > 2000) {
      alert('Caption 2000 characters se zyada nahi ho sakta.')
      return
    }

    setSavingEdit(true)

    const { error } = await supabase
      .from('posts')
      .update({ content: cleanContent })
      .eq('id', postId)
      .eq('user_id', userId)

    if (error) {
      alert(error.message)
    } else {
      setPosts(current =>
        current.map(post =>
          post.id === postId
            ? { ...post, content: cleanContent }
            : post
        )
      )
      cancelEdit()
      alert('Post successfully updated! ✅')
    }

    setSavingEdit(false)
  }


  async function submitReport(
  e: FormEvent<HTMLFormElement>,
  postId: string
) {
  e.preventDefault()

  if (!userId || submittingReport) return

  setSubmittingReport(true)

  const { error } = await supabase
    .from('post_reports')
    .insert({
      post_id: postId,
      reporter_id: userId,
      reason: reportReason,
      details: reportDetails.trim() || null,
    })

  if (error) {
    alert(error.message)
  } else {
    alert('Report submitted successfully. Thank you for helping keep HelpLoop safe!')

    setReportingPostId('')
    setReportReason('Spam')
    setReportDetails('')
  }

  setSubmittingReport(false)
}

  async function handleLike(postId: string) {
    const { data, error } = await supabase.rpc(
      'toggle_community_like',
      { p_post_id: postId }
    )

    if (error) {
      console.error('LIKE ERROR:', error)
      alert(error.message)
      return
    }

    const result = data?.[0]

    if (!result) {
      alert('Like update nahi ho saka. Dobara try karo.')
      return
    }

    setLikes(current => ({
      ...current,
      [postId]: {
        count: Number(result.like_count),
        liked: result.liked,
      },
    }))
  }



  async function loadComments(postId: string) {
    const { data, error } = await supabase.rpc(
      'get_community_comments',
      { p_post_id: postId }
    )

    if (error) {
      alert(error.message)
      return
    }

    setComments(current => ({
      ...current,
      [postId]: (data || []) as Comment[],
    }))
  }

  async function toggleComments(postId: string) {
    const isOpen = !!openComments[postId]

    setOpenComments(current => ({
      ...current,
      [postId]: !isOpen,
    }))

    if (!isOpen) {
      await loadComments(postId)
    }
  }

  async function handleComment(
    e: FormEvent<HTMLFormElement>,
    postId: string
  ) {
    e.preventDefault()

    const text = (commentDrafts[postId] || '').trim()
    if (!text || !userId) return

    setCommenting(postId)

    const { error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content: text,
      })

    if (error) {
      alert(error.message)
    } else {
      setCommentDrafts(current => ({
        ...current,
        [postId]: '',
      }))

      await loadComments(postId)
    }

    setCommenting('')
  }

  async function deletePost(post: Post) {
    if (!window.confirm('Kya tum apni post delete karna chahte ho?')) {
      return
    }

    if (post.image_path) {
      const { error: photoError } = await supabase.storage
        .from('community-photos')
        .remove([post.image_path])

      if (photoError) {
        alert(photoError.message)
        return
      }
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', post.id)
      .eq('user_id', userId)

    if (error) {
      alert(error.message)
    } else {
      setPosts(current => current.filter(item => item.id !== post.id))
    }
  }

  async function sharePost(post: Post) {
    const shareUrl =
      `${window.location.origin}${window.location.pathname}?communityPost=${post.id}`

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'HelpLoop Community Post',
          text: post.content,
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        alert('Post link copied!')
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        alert('Sharing nahi ho saka. Dobara try karo.')
      }
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString()
  }
const filteredPosts = [...posts]
  .filter(post => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) return true

    return (
      post.content.toLowerCase().includes(query) ||
      (post.author_name || '').toLowerCase().includes(query) ||
      (post.author_username || '').toLowerCase().includes(query)
    )
  })
  .filter(post =>
    postFilter === 'all' ||
    Boolean(post.image_path || post.image_url)
  )
  .sort((a, b) => {
    const dateA = new Date(a.created_at).getTime()
    const dateB = new Date(b.created_at).getTime()

    return postSort === 'latest'
      ? dateB - dateA
      : dateA - dateB
  })
  return (
    <div className="community-page">
      <div style={{ marginBottom: '24px' }}>
        <span style={{
          color: '#5146df',
          fontWeight: 800,
          fontSize: '12px',
          letterSpacing: '2px',
        }}>
          CONNECT • SHARE • GROW
        </span>

        <h2 style={{ fontSize: '28px', margin: '8px 0' }}>
          Welcome to Community 🌍
        </h2>

        <p style={{ color: '#777b91' }}>
          Share photos, thoughts and connect with people around the world.
        </p>
      </div>

      <form
        onSubmit={handlePost}
        style={{
          background: '#ffffff',
          padding: '22px',
          borderRadius: '18px',
          boxShadow: '0 5px 25px rgba(30,35,80,0.06)',
          marginBottom: '25px',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Create a post ✨</h3>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What's on your mind?"
          maxLength={2000}
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '15px',
            borderRadius: '12px',
            border: '1px solid #e4e5ef',
            resize: 'vertical',
            fontSize: '15px',
            outlineColor: '#5146df',
            fontFamily: 'inherit',
          }}
        />

        {photoPreview && (
          <div style={{ marginTop: '14px' }}>
            <img
              src={photoPreview}
              alt="Selected post"
              style={{
                width: '100%',
                maxHeight: '350px',
                objectFit: 'contain',
                borderRadius: '12px',
                background: '#f5f5f8',
              }}
            />

            <button
              type="button"
              onClick={removePhoto}
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                border: 'none',
                borderRadius: '8px',
                background: '#fff0f0',
                color: '#d93636',
                cursor: 'pointer',
              }}
            >
              Remove Photo ✕
            </button>
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '14px',
        }}>
          <label style={{
            background: '#f0efff',
            color: '#5146df',
            padding: '11px 15px',
            borderRadius: '10px',
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            📷 Choose Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              hidden
            />
          </label>

          <small style={{ color: '#85889a' }}>
            {content.length}/2000
          </small>

          <button
            type="submit"
            disabled={posting || !content.trim() || !userId}
            style={{
              background: '#5146df',
              color: 'white',
              border: 'none',
              padding: '12px 22px',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              opacity: posting || !content.trim() || !userId ? 0.6 : 1,
            }}
          >
            {posting ? 'Publishing...' : 'Publish Post →'}
          </button>
        </div>

        <small style={{ display: 'block', marginTop: '12px', color: '#85889a' }}>
          JPG, PNG or WEBP • Maximum 5MB • Caption required
        </small>
      </form>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <h3>Community Posts</h3>

        <button
          onClick={() => loadPosts(userId)}
          style={{
            border: '1px solid #dedff0',
            background: 'white',
            padding: '9px 14px',
            borderRadius: '9px',
            cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>
<div style={{
  background: 'white',
  padding: '16px',
  borderRadius: '15px',
  marginBottom: '18px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  boxShadow: '0 4px 18px rgba(30,35,80,0.04)',
}}>
  <input
    type="search"
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    placeholder="🔍 Search posts, names or usernames..."
    style={{
      flex: '1 1 220px',
      minWidth: 0,
      padding: '12px 14px',
      border: '1px solid #e4e5ef',
      borderRadius: '10px',
      fontSize: '14px',
      outlineColor: '#5146df',
    }}
  />

  <select
    value={postFilter}
    onChange={e =>
      setPostFilter(e.target.value as 'all' | 'photos')
    }
    style={{
      flex: '1 1 130px',
      padding: '12px',
      border: '1px solid #e4e5ef',
      borderRadius: '10px',
      background: '#fff',
      color: '#45465c',
      cursor: 'pointer',
    }}
  >
    <option value="all">All Posts</option>
    <option value="photos">With Photos</option>
  </select>

  <select
    value={postSort}
    onChange={e =>
      setPostSort(e.target.value as 'latest' | 'oldest')
    }
    style={{
      flex: '1 1 130px',
      padding: '12px',
      border: '1px solid #e4e5ef',
      borderRadius: '10px',
      background: '#fff',
      color: '#45465c',
      cursor: 'pointer',
    }}
  >
    <option value="latest">Latest First</option>
    <option value="oldest">Oldest First</option>
  </select>
</div>

{!loading && !error && posts.length > 0 && filteredPosts.length === 0 && (
  <div style={{
    background: 'white',
    borderRadius: '16px',
    padding: '30px 20px',
    textAlign: 'center',
    color: '#777b91',
    marginBottom: '16px',
  }}>
    <div style={{ fontSize: '35px' }}>🔎</div>
    <h3>No matching posts found</h3>
    <p>Try another search or change your filters.</p>

    <button
      onClick={() => {
        setSearchQuery('')
        setPostFilter('all')
        setPostSort('latest')
      }}
      style={{
        background: '#5146df',
        color: 'white',
        border: 'none',
        padding: '10px 18px',
        borderRadius: '9px',
        cursor: 'pointer',
        fontWeight: 700,
      }}
    >
      Clear Filters
    </button>
  </div>
)}
      {loading && <p>Loading posts...</p>}

      {error && (
        <p style={{ color: '#d93636' }}>Error: {error}</p>
      )}

      {!loading && !error && posts.length === 0 && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '35px 20px',
          textAlign: 'center',
          color: '#777b91',
        }}>
          <div style={{ fontSize: '38px' }}>🌱</div>
          <h3>No posts yet</h3>
          <p>Be the first person to share something!</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '16px' }}>
        {filteredPosts.map(post => (
          <article
            id={`post-${post.id}`}
            key={post.id}
            style={{
              background: 'white',
              padding: '20px',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(30,35,80,0.05)',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '10px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <div style={{
                  width: '43px',
                  height: '43px',
                  borderRadius: '50%',
                  background: '#eeedff',
                  color: '#5146df',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '18px',
                }}>
                  {(post.author_name || 'H').charAt(0).toUpperCase()}
                </div>

                <div>
                  <strong>{post.author_name}</strong>
                  <div style={{ color: '#85889a', fontSize: '12px' }}>
                    @{post.author_username}
                  </div>
                  <small style={{ color: '#9295a5' }}>
                    {formatDate(post.created_at)}
                  </small>
                </div>
              </div>

              {post.user_id === userId && (
                <div style={{
                  display: 'flex',
                  gap: '7px',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}>
                  <button
                    onClick={() => startEdit(post)}
                    style={{
                      border: 'none',
                      background: '#f0efff',
                      color: '#5146df',
                      padding: '8px 11px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    ✏️ Edit
                  </button>

                  <button
                    onClick={() => deletePost(post)}
                    style={{
                      border: 'none',
                      background: '#fff0f0',
                      color: '#d93636',
                      padding: '8px 11px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>

            {editingPostId === post.id ? (
              <div style={{ marginTop: '18px' }}>
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '13px',
                    borderRadius: '10px',
                    border: '1px solid #c9c5ff',
                    resize: 'vertical',
                    fontSize: '15px',
                    fontFamily: 'inherit',
                  }}
                />

                <small style={{ color: '#85889a' }}>
                  {editContent.length}/2000
                </small>

                <div style={{
                  display: 'flex',
                  gap: '9px',
                  marginTop: '10px',
                }}>
                  <button
                    onClick={() => saveEdit(post.id)}
                    disabled={savingEdit || !editContent.trim()}
                    style={{
                      border: 'none',
                      background: '#5146df',
                      color: 'white',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      opacity: savingEdit || !editContent.trim() ? 0.6 : 1,
                    }}
                  >
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>

                  <button
                    onClick={cancelEdit}
                    disabled={savingEdit}
                    style={{
                      border: '1px solid #dedff0',
                      background: 'white',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                lineHeight: 1.7,
                margin: '18px 0 12px',
              }}>
                {post.content}
              </p>
            )}

            {post.image_path && (
              post.image_url ? (
                <img
                  src={post.image_url}
                  alt="Community post"
                  style={{
                    width: '100%',
                    maxHeight: '480px',
                    objectFit: 'contain',
                    borderRadius: '12px',
                    background: '#f5f5f8',
                  }}
                />
              ) : (
                <p style={{ color: '#b45309' }}>
                  Photo load nahi ho saki. Refresh karke dekho.
                </p>
              )
            )}

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              borderTop: '1px solid #eeeef4',
              marginTop: '16px',
              paddingTop: '14px',
            }}>
              <button
                onClick={() => handleLike(post.id)}
                style={{
                  flex: 1,
                  minWidth: '100px',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '9px',
                  background: likes[post.id]?.liked ? '#fff0f3' : '#f6f6fa',
                  color: likes[post.id]?.liked ? '#e33b65' : '#55586c',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {likes[post.id]?.liked ? '❤️ Liked' : '🤍 Like'}
                {' '}{likes[post.id]?.count || 0}
              </button>

              <button
                onClick={() => toggleComments(post.id)}
                style={{
                  flex: 1,
                  minWidth: '100px',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '9px',
                  background: '#f6f6fa',
                  color: '#55586c',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                💬 Comments
              </button>

              <button
                onClick={() => sharePost(post)}
                style={{
                  flex: 1,
                  minWidth: '100px',
                  padding: '10px',
                  border: 'none',
                  borderRadius: '9px',
                  background: '#f6f6fa',
                  color: '#55586c',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔗 Share
              </button>
            </div>
            {userId && post.user_id !== userId && (
  <button
    type="button"
    onClick={() => {
      setReportingPostId(
        reportingPostId === post.id ? '' : post.id
      )
      setReportReason('Spam')
      setReportDetails('')
    }}
    style={{
      flex: 1,
      minWidth: '100px',
      padding: '10px',
      border: 'none',
      borderRadius: '9px',
      background: '#fff0f0',
      color: '#d93636',
      fontWeight: 700,
      cursor: 'pointer',
    }}
  >
    🚩 Report
  </button>
)}

{reportingPostId === post.id && (
  <form
    onSubmit={e => submitReport(e, post.id)}
    style={{
      marginTop: '15px',
      padding: '16px',
      background: '#fff8f8',
      border: '1px solid #ffe0e0',
      borderRadius: '12px',
    }}
  >
    <h4 style={{ marginTop: 0, color: '#b42318' }}>
      🚩 Report this post
    </h4>

    <label style={{
      display: 'block',
      marginBottom: '7px',
      fontWeight: 700,
    }}>
      Select a reason
    </label>

    <select
      value={reportReason}
      onChange={e => setReportReason(e.target.value)}
      style={{
        width: '100%',
        padding: '11px',
        border: '1px solid #e4e5ef',
        borderRadius: '9px',
        background: 'white',
        marginBottom: '12px',
      }}
    >
      <option value="Spam">Spam</option>
      <option value="Harassment">Harassment</option>
      <option value="Hate speech">Hate speech</option>
      <option value="False information">False information</option>
      <option value="Inappropriate content">Inappropriate content</option>
      <option value="Other">Other</option>
    </select>

    <label style={{
      display: 'block',
      marginBottom: '7px',
      fontWeight: 700,
    }}>
      Additional details (optional)
    </label>

    <textarea
      value={reportDetails}
      onChange={e => setReportDetails(e.target.value)}
      placeholder="Explain the issue (optional)..."
      maxLength={1000}
      rows={3}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '11px',
        border: '1px solid #e4e5ef',
        borderRadius: '9px',
        resize: 'vertical',
        fontFamily: 'inherit',
      }}
    />

    <div style={{
      display: 'flex',
      gap: '9px',
      marginTop: '12px',
    }}>
      <button
        type="submit"
        disabled={submittingReport}
        style={{
          background: '#d93636',
          color: 'white',
          border: 'none',
          padding: '10px 16px',
          borderRadius: '8px',
          fontWeight: 700,
          cursor: 'pointer',
          opacity: submittingReport ? 0.6 : 1,
        }}
      >
        {submittingReport ? 'Submitting...' : 'Submit Report'}
      </button>

      <button
        type="button"
        disabled={submittingReport}
        onClick={() => {
          setReportingPostId('')
          setReportDetails('')
          setReportReason('Spam')
        }}
        style={{
          background: 'white',
          border: '1px solid #dedff0',
          padding: '10px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  </form>
)}

            {openComments[post.id] && (
              <div style={{
                marginTop: '16px',
                borderTop: '1px solid #eeeef4',
                paddingTop: '14px',
              }}>
                <h4>Comments</h4>

                {(comments[post.id] || []).map(comment => (
                  <div
                    key={comment.id}
                    style={{
                      background: '#f7f7fb',
                      padding: '12px',
                      borderRadius: '10px',
                      marginBottom: '9px',
                    }}
                  >
                    <strong>{comment.author_name}</strong>
                    <small style={{
                      color: '#85889a',
                      marginLeft: '8px',
                    }}>
                      @{comment.author_username}
                    </small>
                    <p style={{
                      margin: '7px 0 0',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                    }}>
                      {comment.content}
                    </p>
                  </div>
                ))}

                {(comments[post.id] || []).length === 0 && (
                  <p style={{ color: '#85889a' }}>
                    No comments yet. Be the first!
                  </p>
                )}

                <form
                  onSubmit={e => handleComment(e, post.id)}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '12px',
                  }}
                >
                  <input
                    value={commentDrafts[post.id] || ''}
                    onChange={e => setCommentDrafts(current => ({
                      ...current,
                      [post.id]: e.target.value,
                    }))}
                    placeholder="Write a comment..."
                    maxLength={1000}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '12px',
                      border: '1px solid #e4e5ef',
                      borderRadius: '9px',
                    }}
                  />

                  <button
                    type="submit"
                    disabled={
                      commenting === post.id ||
                      !(commentDrafts[post.id] || '').trim()
                    }
                    style={{
                      border: 'none',
                      borderRadius: '9px',
                      padding: '0 15px',
                      background: '#5146df',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {commenting === post.id ? '...' : 'Send'}
                  </button>
                </form>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
