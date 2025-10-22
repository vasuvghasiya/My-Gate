import React, { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
} from '@mui/material'
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Home as HomeIcon,
  Security as SecurityIcon,
} from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'
import { useMutation } from 'react-query'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

const Profile: React.FC = () => {
  const { user, updateUser } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [profileData, setProfileData] = useState({
    displayName: user?.displayName || '',
    phone: user?.phone || '',
    householdId: user?.householdId || '',
  })

  const updateProfileMutation = useMutation(authAPI.updateProfile, {
    onSuccess: (response) => {
      updateUser(response.data.updated)
      setIsEditing(false)
      toast.success('Profile updated successfully!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update profile')
    },
  })

  const handleSave = () => {
    updateProfileMutation.mutate(profileData)
  }

  const handleCancel = () => {
    setProfileData({
      displayName: user?.displayName || '',
      phone: user?.phone || '',
      householdId: user?.householdId || '',
    })
    setIsEditing(false)
  }

  const getRoleIcon = (roles: string[]) => {
    if (roles.includes('admin')) return <SecurityIcon color="error" />
    if (roles.includes('guard')) return <SecurityIcon color="warning" />
    return <PersonIcon color="primary" />
  }

  const getRoleColor = (roles: string[]) => {
    if (roles.includes('admin')) return 'error'
    if (roles.includes('guard')) return 'warning'
    return 'primary'
  }

  if (!user) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Profile Not Found
        </Typography>
        <Alert severity="error">
          Unable to load user profile. Please try logging in again.
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Profile
      </Typography>

      <Grid container spacing={3}>
        {/* Profile Overview */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  mx: 'auto',
                  mb: 2,
                  bgcolor: 'primary.main',
                  fontSize: '3rem',
                }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </Avatar>
              
              <Typography variant="h5" gutterBottom>
                {user.displayName}
              </Typography>
              
              <Box display="flex" alignItems="center" justifyContent="center" mb={1}>
                {getRoleIcon(user.roles)}
                <Typography variant="body1" sx={{ ml: 1 }}>
                  {user.roles.join(', ')}
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Profile Details */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6">Profile Information</Typography>
                <Button
                  variant={isEditing ? "outlined" : "contained"}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </Button>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={isEditing ? profileData.displayName : user.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                    disabled={!isEditing}
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={user.email}
                    disabled
                    InputProps={{
                      startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                    helperText="Email cannot be changed"
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={isEditing ? profileData.phone : user.phone || ''}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    disabled={!isEditing}
                    InputProps={{
                      startAdornment: <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Household ID"
                    value={isEditing ? profileData.householdId : user.householdId || ''}
                    onChange={(e) => setProfileData({ ...profileData, householdId: e.target.value })}
                    disabled={!isEditing}
                    InputProps={{
                      startAdornment: <HomeIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>
              </Grid>

              {isEditing && (
                <Box display="flex" gap={2} mt={3}>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={updateProfileMutation.isLoading}
                  >
                    {updateProfileMutation.isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleCancel}
                    disabled={updateProfileMutation.isLoading}
                  >
                    Cancel
                  </Button>
                </Box>
              )}

              <Divider sx={{ my: 3 }} />

              {/* Account Information */}
              <Typography variant="h6" gutterBottom>
                Account Information
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    User ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {user.uid}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Roles
                  </Typography>
                  <Box display="flex" gap={1} mt={1}>
                    {user.roles.map((role) => (
                      <Button
                        key={role}
                        variant="outlined"
                        size="small"
                        color={getRoleColor([role])}
                        disabled
                      >
                        {role}
                      </Button>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default Profile
