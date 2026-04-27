import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export interface FavoriteItem {
  bvid: string
  title: string
  uploader_name: string
  view_count: number
  like_count: number
  partition_name: string
  cover_url: string
  duration: number
  addedAt: string
}

interface FavoritesContextValue {
  favorites: FavoriteItem[]
  addFavorite: (item: FavoriteItem) => void
  removeFavorite: (bvid: string) => void
  isFavorite: (bvid: string) => boolean
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favorites: [],
  addFavorite: () => {},
  removeFavorite: () => {},
  isFavorite: () => false,
})

const STORAGE_KEY = 'bili-favorites'

function loadFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore parse errors
  }
  return []
}

function saveFavorites(items: FavoriteItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota errors
  }
}

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(loadFavorites)

  useEffect(() => {
    saveFavorites(favorites)
  }, [favorites])

  const addFavorite = useCallback((item: FavoriteItem) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.bvid === item.bvid)) return prev
      return [{ ...item, addedAt: item.addedAt || new Date().toISOString() }, ...prev]
    })
  }, [])

  const removeFavorite = useCallback((bvid: string) => {
    setFavorites((prev) => prev.filter((f) => f.bvid !== bvid))
  }, [])

  const isFavorite = useCallback(
    (bvid: string) => favorites.some((f) => f.bvid === bvid),
    [favorites],
  )

  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export const useFavorites = (): FavoritesContextValue => useContext(FavoritesContext)

export default FavoritesContext
