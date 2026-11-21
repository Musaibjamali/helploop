
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import { supabase } from './supabase'
import './Profile.css'

type ProfileForm = {
  full_name: string
  username: string
  bio: string
  avatar_url: string
  age: string
  gender: string
  country: string
  city: string
  state_province: string
  languages: string
  education_level: string
  institution: string
  field_of_study: string
  graduation_year: string
  profession: string
  skills: string
  work_experience: string
  services_offered: string
  hobbies: string
  interests: string
  favorite_topics: string
  website: string
  linkedin_url: string
  instagram_url: string
  facebook_url: string
  profile_visibility: string
  show_age: boolean
  show_location: boolean
}

const emptyProfile: ProfileForm = {
  full_name: '',
  username: '',
  bio: '',
  avatar_url: '',
  age: '',
  gender: '',
  country: '',
  city: '',
  state_province: '',
  languages: '',
  education_level: '',
  institution: '',
  field_of_study: '',
  graduation_year: '',
  profession: '',
  skills: '',
  work_experience: '',
  services_offered: '',
  hobbies: '',
  interests: '',
  favorite_topics: '',
  website: '',
  linkedin_url: '',
  instagram_url: '',
  facebook_url: '',
  profile_visibility: 'private',
  show_age: false,
  show_location: false,
}

function createCroppedImage(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height

      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Could not crop this image.'))
        return
      }

      context.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      )

      canvas.toBlob(
        blob => {
          if (blob) resolve(blob)
          else reject(new Error('Could not create cropped photo.'))
        },
        'image/jpeg',
        0.92
      )
    }

    image.onerror = () => reject(new Error('Could not load image.'))
    image.src = imageSrc
  })
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [viewPhoto, setViewPhoto] = useState(false)

  const [cropImage, setCropImage] = useState('')
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [circleSize, setCircleSize] = useState(260)
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<Area | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setMessage('Please sign in again.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        setMessage(error.message)
      } else if (data) {
        setProfile({
          ...emptyProfile,
          ...data,
          age: data.age?.toString() ?? '',
          graduation_year: data.graduation_year?.toString() ?? '',
          profile_visibility: data.profile_visibility ?? 'private',
        })

        if (data.avatar_url) {
          const { data: signedData } = await supabase.storage
            .from('profile-photos')
            .createSignedUrl(data.avatar_url, 3600)

          if (signedData?.signedUrl) {
            setPhotoUrl(signedData.signedUrl)
          }
        }
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  function updateField(
    field: keyof ProfileForm,
    value: string | boolean
  ) {
    setProfile(previous => ({
      ...previous,
      [field]: value,
    }))
  }

  function handlePhotoSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Please select a JPG, PNG or WEBP image.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('Photo size must be less than 5 MB.')
      return
    }

    const imageUrl = URL.createObjectURL(file)

    setCropImage(imageUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCircleSize(260)
    setCroppedAreaPixels(null)
    setMenuOpen(false)
    setMessage('')
  }

  function cancelCrop() {
    if (cropImage) URL.revokeObjectURL(cropImage)

    setCropImage('')
    setCroppedAreaPixels(null)
  }

  async function saveCroppedPhoto() {
    if (!cropImage || !croppedAreaPixels) {
      setMessage('Please adjust your photo first.')
      return
    }

    setPhotoLoading(true)
    setMessage('')

    try {
      const croppedBlob = await createCroppedImage(
        cropImage,
        croppedAreaPixels
      )

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Please sign in again.')
      }

      const oldPath = profile.avatar_url
      const newPath = `${user.id}/avatar-${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(newPath, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newPath })
        .eq('id', user.id)

      if (updateError) {
        await supabase.storage.from('profile-photos').remove([newPath])
        throw updateError
      }

      if (oldPath && oldPath.startsWith(`${user.id}/`)) {
        await supabase.storage.from('profile-photos').remove([oldPath])
      }

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from('profile-photos')
          .createSignedUrl(newPath, 3600)

      setProfile(previous => ({
        ...previous,
        avatar_url: newPath,
      }))

      if (signedData?.signedUrl) {
        setPhotoUrl(signedData.signedUrl)
        setMessage('Profile photo updated successfully!')
      } else {
        setPhotoUrl('')
        setMessage(
          signedError?.message ||
          'Photo saved, but preview could not be loaded.'
        )
      }

      cancelCrop()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong while saving photo.'
      )
    }

    setPhotoLoading(false)
  }

  async function deletePhoto() {
    if (!profile.avatar_url) {
      setMessage('No profile photo to delete.')
      return
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete your profile photo?'
    )

    if (!confirmed) return

    setPhotoLoading(true)
    setMenuOpen(false)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage('Please sign in again.')
      setPhotoLoading(false)
      return
    }

    const path = profile.avatar_url

    if (!path.startsWith(`${user.id}/`)) {
      setMessage('Invalid photo path.')
      setPhotoLoading(false)
      return
    }

    const { error: deleteError } = await supabase.storage
      .from('profile-photos')
      .remove([path])

    if (deleteError) {
      setMessage(deleteError.message)
      setPhotoLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)

    if (updateError) {
      setMessage(updateError.message)
    } else {
      setProfile(previous => ({
        ...previous,
        avatar_url: '',
      }))
      setPhotoUrl('')
      setMessage('Profile photo deleted successfully!')
    }

    setPhotoLoading(false)
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setMessage('Please sign in again.')
      setSaving(false)
      return
    }

    const updates = {
      ...profile,
      profile_visibility: profile.profile_visibility,
      age: profile.age ? Number(profile.age) : null,
      graduation_year: profile.graduation_year
        ? Number(profile.graduation_year)
        : null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    setMessage(
      error ? error.message : 'Profile saved successfully!'
    )

    setSaving(false)
  }

  if (loading) {
    return <div className="profile-loading">Loading profile...</div>
  }

  const input = (
    label: string,
    field: keyof ProfileForm,
    placeholder = ''
  ) => (
    <label className="profile-field">
      <span>{label}</span>
      <input
        value={String(profile[field])}
        onChange={e => updateField(field, e.target.value)}
        placeholder={placeholder || label}
        type={
          field === 'age' || field === 'graduation_year'
            ? 'number'
            : 'text'
        }
      />
    </label>
  )

  return (
    <div className="profile-page">
      <div className="profile-heading">
        <span>YOUR ACCOUNT</span>
        <h2>My Profile</h2>
        <p>
          Tell the world a little about yourself.
          You control what you share.
        </p>
      </div>

      <div className="profile-card">
        <div className="profile-avatar-area">
          <button
            type="button"
            className="profile-avatar-button"
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={photoLoading}
            aria-label="Profile photo options"
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile"
                className="profile-avatar-image"
              />
            ) : (
              <span className="profile-avatar-placeholder">👤</span>
            )}
            <span className="avatar-camera">📷</span>
          </button>

          {menuOpen && (
            <div className="photo-menu">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                📷 Choose Photo
              </button>
              <button
                type="button"
                disabled={!photoUrl}
                onClick={() => {
                  setViewPhoto(true)
                  setMenuOpen(false)
                }}
              >
                👁️ View Photo
              </button>
              <button
                type="button"
                disabled={!profile.avatar_url}
                onClick={deletePhoto}
              >
                🗑️ Delete Photo
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoSelected}
            hidden
          />
        </div>

        <div className="profile-card-info">
          <h3>{profile.full_name || 'Your Name'}</h3>
          <p>
            {profile.username
              ? `@${profile.username}`
              : 'Add your username'}
          </p>
          <span>
            {photoLoading
              ? 'Updating photo...'
              : 'Tap your photo to manage it'}
          </span>
        </div>
      </div>

      {cropImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              background: '#fff',
              color: '#222',
              width: '100%',
              maxWidth: 480,
              borderRadius: 18,
              padding: 20,
              maxHeight: '95vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Crop Your Profile Photo</h3>

            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 360,
                background: '#222',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                cropSize={{
                  width: circleSize,
                  height: circleSize,
                }}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) =>
                  setCroppedAreaPixels(croppedPixels)
                }
              />
            </div>

            <label
              style={{
                display: 'block',
                marginTop: 20,
                fontWeight: 600,
              }}
            >
              Zoom: {zoom.toFixed(1)}x
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                style={{ width: '100%', marginTop: 10 }}
              />
            </label>

            <label
              style={{
                display: 'block',
                marginTop: 18,
                fontWeight: 600,
              }}
            >
              Crop Circle Size: {circleSize}px
              <input
                type="range"
                min={160}
                max={330}
                step={10}
                value={circleSize}
                onChange={e => setCircleSize(Number(e.target.value))}
                style={{ width: '100%', marginTop: 10 }}
              />
            </label>

            <p style={{ fontSize: 13, color: '#666' }}>
              Move your photo, adjust zoom and change the circle size
              to select the part you want.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={cancelCrop}
                disabled={photoLoading}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #ccc',
                  background: '#f3f3f3',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveCroppedPhoto}
                disabled={photoLoading || !croppedAreaPixels}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: '#5145cd',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {photoLoading ? 'Saving...' : 'Save Crop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewPhoto && photoUrl && (
        <div
          className="photo-viewer"
          onClick={() => setViewPhoto(false)}
        >
          <button
            type="button"
            className="photo-viewer-close"
            onClick={() => setViewPhoto(false)}
          >
            ✕
          </button>
          <img
            src={photoUrl}
            alt="Full profile"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <form onSubmit={saveProfile}>
        <section className="profile-section">
          <h3>👤 Personal Information</h3>
          <div className="profile-grid">
            {input('Full Name', 'full_name')}
            {input('Username', 'username', 'Choose a unique username')}
            {input('Age', 'age')}

            <label className="profile-field">
              <span>Gender (optional)</span>
              <select
                value={profile.gender}
                onChange={e => updateField('gender', e.target.value)}
              >
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label className="profile-field profile-wide">
              <span>About Me / Bio</span>
              <textarea
                value={profile.bio}
                onChange={e => updateField('bio', e.target.value)}
                placeholder="Write something about yourself..."
              />
            </label>
          </div>
        </section>

        <section className="profile-section">
          <h3>🌍 Location & Languages</h3>
          <div className="profile-grid">
            {input('Country', 'country')}
            {input('City', 'city')}
            {input('State / Province', 'state_province')}
            {input('Languages', 'languages', 'English, Urdu, etc.')}
          </div>
        </section>

        <section className="profile-section">
          <h3>🎓 Education</h3>
          <div className="profile-grid">
            {input('Education Level', 'education_level')}
            {input('School / College / University', 'institution')}
            {input('Degree / Field of Study', 'field_of_study')}
            {input('Graduation Year', 'graduation_year')}
          </div>
        </section>

        <section className="profile-section">
          <h3>💼 Work & Skills</h3>
          <div className="profile-grid">
            {input('Profession', 'profession')}
            {input('Skills', 'skills', 'Design, Programming, etc.')}
            {input('Work Experience', 'work_experience')}
            {input('Services Offered', 'services_offered')}
          </div>
        </section>

        <section className="profile-section">
          <h3>⭐ Interests & Hobbies</h3>
          <div className="profile-grid">
            {input('Hobbies', 'hobbies')}
            {input('Interests', 'interests')}
            {input('Favorite Topics', 'favorite_topics')}
          </div>
        </section>

        <section className="profile-section">
          <h3>🔗 Social Links</h3>
          <div className="profile-grid">
            {input('Personal Website', 'website')}
            {input('LinkedIn URL', 'linkedin_url')}
            {input('Instagram URL', 'instagram_url')}
            {input('Facebook URL', 'facebook_url')}
          </div>
        </section>

        <section className="profile-section">
          <h3>🔒 Privacy Settings</h3>
          <div className="profile-grid">
            <label className="profile-field">
              <span>Profile Visibility</span>
              <select
                value={profile.profile_visibility}
                onChange={e =>
                  updateField('profile_visibility', e.target.value)
                }
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>

            <label className="profile-check">
              <input
                type="checkbox"
                checked={profile.show_age}
                onChange={e => updateField('show_age', e.target.checked)}
              />
              Show my age
            </label>

            <label className="profile-check">
              <input
                type="checkbox"
                checked={profile.show_location}
                onChange={e =>
                  updateField('show_location', e.target.checked)
                }
              />
              Show my location
            </label>
          </div>

          <p className="privacy-note">
            Private profiles are hidden from other users.
            Public profiles share only the information allowed
            by your privacy settings.
          </p>
        </section>

        <button
          className="profile-save"
          type="submit"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>

        {message && (
          <p className="profile-message">{message}</p>
        )}
      </form>
    </div>
  )
}
