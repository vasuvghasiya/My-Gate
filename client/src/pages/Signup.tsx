import React, { useState } from 'react'
import {
    Container,
    Paper,
    TextField,
    Button,
    Typography,
    Box,
    Alert,
    InputAdornment,
    IconButton,
    ToggleButton,
    ToggleButtonGroup,
    MenuItem,
} from '@mui/material'
import {
	Visibility,
	VisibilityOff,
	Email,
	Lock,
	Person,
	Phone,
	Home,
} from '@mui/icons-material'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '../config/firebase'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useQuery } from 'react-query'

const Signup: React.FC = () => {
	const [role, setRole] = useState<'resident' | 'admin' | 'guard'>('resident')
	const [displayName, setDisplayName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
    const [householdId, setHouseholdId] = useState('')
	const [phone, setPhone] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

    const { data: householdsData } = useQuery('households', async () => {
        const res = await api.get('/api/public/households')
        return res.data.households as Array<{ id: string; flatNo?: string; name?: string }>
    })

    const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!displayName || !email || !password || !householdId) {
			setError('Please fill in all required fields')
			return
		}

		setLoading(true)
		setError('')

		try {
      // Create Firebase Auth user
			const cred = await createUserWithEmailAndPassword(auth, email, password)
			await updateProfile(cred.user, { displayName })

			// Call backend to create profile and set custom claims
      const normalizedRole = (role || 'resident').toString().trim().toLowerCase() as 'resident' | 'admin' | 'guard'
      await api.post('/auth/create-profile', {
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        householdId: householdId.trim(),
        roles: [normalizedRole],
      })

			toast.success('Account created! You can now use the app.')
		} catch (err: any) {
			setError(err.response?.data?.error || err.message || 'Signup failed')
		} finally {
			setLoading(false)
		}
	}

	return (
		<Container component="main" maxWidth="sm">
			<Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
				<Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 520 }}>
					<Typography component="h1" variant="h4" color="primary" fontWeight="bold" gutterBottom>
						Create account
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						Choose your role and enter details to sign up.
					</Typography>

					{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

					<Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
						<ToggleButtonGroup
							color="primary"
							exclusive
							value={role}
							onChange={(_, v) => v && setRole(v)}
						>
							<ToggleButton value="resident">Resident</ToggleButton>
							<ToggleButton value="guard">Guard</ToggleButton>
							<ToggleButton value="admin">Admin</ToggleButton>
						</ToggleButtonGroup>
					</Box>

					<Box component="form" onSubmit={handleSubmit}>
						<TextField
							margin="normal"
							fullWidth
							label="Full name"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							InputProps={{ startAdornment: (<InputAdornment position="start"><Person /></InputAdornment>) }}
						/>

						<TextField
							margin="normal"
							fullWidth
							label="Email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							InputProps={{ startAdornment: (<InputAdornment position="start"><Email /></InputAdornment>) }}
						/>

						<TextField
							margin="normal"
							fullWidth
							label="Password"
							type={showPassword ? 'text' : 'password'}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							InputProps={{
								startAdornment: (<InputAdornment position="start"><Lock /></InputAdornment>),
								endAdornment: (
									<InputAdornment position="end">
										<IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label="toggle password visibility">
											{showPassword ? <VisibilityOff /> : <Visibility />}
										</IconButton>
									</InputAdornment>
								)
							}}
						/>

            <TextField
                margin="normal"
                select
                fullWidth
                label="Household ID"
                value={householdId}
                onChange={(e) => setHouseholdId(e.target.value)}
                helperText={householdsData && householdsData.length === 0 ? 'No households available. Ask admin to add one.' : 'Select your household'}
                InputProps={{ startAdornment: (<InputAdornment position="start"><Home /></InputAdornment>) }}
            >
                {(householdsData || []).map(h => (
                    <MenuItem key={h.id} value={h.id}>
                        {h.id} — {h.flatNo || ''} {h.name || ''}
                    </MenuItem>
                ))}
            </TextField>

						<TextField
							margin="normal"
							fullWidth
							label="Phone (optional)"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							InputProps={{ startAdornment: (<InputAdornment position="start"><Phone /></InputAdornment>) }}
						/>

						<Button type="submit" fullWidth variant="contained" sx={{ mt: 3 }} disabled={loading}>
							{loading ? 'Creating...' : 'Create account'}
						</Button>

						<Box sx={{ mt: 2, textAlign: 'center' }}>
							<Typography variant="body2">
								Already have an account? <a href="/">Login</a>
							</Typography>
						</Box>
					</Box>
				</Paper>
			</Box>
		</Container>
	)
}

export default Signup
