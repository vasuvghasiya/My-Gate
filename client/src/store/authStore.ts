import { create } from 'zustand'
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth'
import { auth } from '../config/firebase'
import { api } from '../services/api'

interface User {
  uid: string
  email: string
  displayName: string
  phone?: string
  householdId?: string
  roles: string[]
  createdAt?: Date
}

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (userData: Partial<User>) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  isAuthenticated: false,
  loading: true,

  login: async (email: string, password: string) => {
    try {
      set({ loading: true })
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const idToken = await userCredential.user.getIdToken()
      
      // Verify token with backend and get user data
      const response = await api.post('/auth/verify', {}, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      })
      
      set({
        user: response.data,
        firebaseUser: userCredential.user,
        isAuthenticated: true,
        loading: false
      })
      // Navigate to dashboard implicitly by allowing App to render authenticated routes
    } catch (error: any) {
      set({ loading: false })
      throw new Error(error.message || 'Login failed')
    }
  },

  logout: async () => {
    try {
      await signOut(auth)
      set({
        user: null,
        firebaseUser: null,
        isAuthenticated: false,
        loading: false
      })
    } catch (error: any) {
      throw new Error(error.message || 'Logout failed')
    }
  },

  updateUser: (userData: Partial<User>) => {
    const currentUser = get().user
    if (currentUser) {
      set({
        user: { ...currentUser, ...userData }
      })
    }
  }
}))

// Listen to auth state changes
onAuthStateChanged(auth, async (firebaseUser) => {
  const { user } = useAuthStore.getState()

  if (firebaseUser) {
    try {
      // Get fresh token and verify with backend
      const idToken = await firebaseUser.getIdToken()
      const response = await api.post('/auth/verify', {}, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      })

      useAuthStore.setState({
        user: response.data,
        firebaseUser,
        isAuthenticated: true,
        loading: false
      })
    } catch (error) {
      console.error('Auth verification failed:', error)
      useAuthStore.setState({
        user: null,
        firebaseUser: null,
        isAuthenticated: false,
        loading: false
      })
    }
  } else {
    // No logged-in user — ensure we stop showing the loading spinner
    useAuthStore.setState({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      loading: false
    })
  }
})
