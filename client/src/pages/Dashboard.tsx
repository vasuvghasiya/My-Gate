import React from 'react'
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Chip,
  Button,
} from '@mui/material'
import {
  People,
  Security,
  AdminPanelSettings,
  TrendingUp,
  AccessTime,
  CheckCircle,
} from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'
import { useQuery } from 'react-query'
import { visitorAPI, publicAPI } from '../services/api'
import { format } from 'date-fns'

const Dashboard: React.FC = () => {
  const { user } = useAuthStore()

  const { data: visitors, isLoading } = useQuery(
    'visitors',
    () => visitorAPI.getAll({ limit: 10 }),
    {
      select: (response) => response.data.visitors,
    }
  )

  const { data: amenities, isLoading: amenitiesLoading } = useQuery(
    'amenities',
    () => publicAPI.amenities(),
    {
      select: (response) => response.data.amenities,
    }
  )

  const getRoleIcon = (roles: string[]) => {
    if (roles.includes('admin')) return <AdminPanelSettings />
    if (roles.includes('guard')) return <Security />
    return <People />
  }

  const getRoleColor = (roles: string[]) => {
    if (roles.includes('admin')) return 'error'
    if (roles.includes('guard')) return 'warning'
    return 'primary'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning'
      case 'approved': return 'success'
      case 'denied': return 'error'
      case 'checked_in': return 'info'
      case 'checked_out': return 'default'
      default: return 'default'
    }
  }

  const recentVisitors = visitors?.slice(0, 5) || []
  const pendingVisitors = visitors?.filter((v: any) => v.status === 'pending').length || 0
  const approvedVisitors = visitors?.filter((v: any) => v.status === 'approved').length || 0
  const checkedInVisitors = visitors?.filter((v: any) => v.status === 'checked_in').length || 0

  const asDate = (value: any): Date | null => {
    if (!value) return null
    if (typeof value?.toDate === 'function') return value.toDate()
    if (typeof value === 'string' || typeof value === 'number') return new Date(value)
    if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000)
    return null
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.displayName}!
      </Typography>
      
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Here's what's happening in your community today.
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* User Info Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  {getRoleIcon(user?.roles || [])}
                </Avatar>
                <Box>
                  <Typography variant="h6">{user?.displayName}</Typography>
                  <Chip
                    label={user?.roles?.join(', ') || 'User'}
                    color={getRoleColor(user?.roles || [])}
                    size="small"
                  />
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Email: {user?.email}
              </Typography>
              {user?.phone && (
                <Typography variant="body2" color="text.secondary">
                  Phone: {user?.phone}
                </Typography>
              )}
              {user?.householdId && (
                <Typography variant="body2" color="text.secondary">
                  Household: {user?.householdId}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <AccessTime color="warning" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{pendingVisitors}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <CheckCircle color="success" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{approvedVisitors}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Approved
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <TrendingUp color="info" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{checkedInVisitors}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Checked In
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <People color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{visitors?.length || 0}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Today
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        {/* Recent Visitors */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Recent Visitors</Typography>
                <Button variant="outlined" size="small">
                  View All
                </Button>
              </Box>
              
              {isLoading ? (
                <Typography>Loading visitors...</Typography>
              ) : recentVisitors.length === 0 ? (
                <Typography color="text.secondary">
                  No recent visitors found.
                </Typography>
              ) : (
                <List>
                  {recentVisitors.map((visitor: any) => (
                    <ListItem key={visitor.id} divider>
                      <ListItemAvatar>
                        <Avatar>
                          {visitor.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={visitor.name}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {visitor.purpose}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {(() => {
                                const d = asDate(visitor.createdAt)
                                return d ? format(d, 'MMM dd, yyyy HH:mm') : '—'
                              })()}
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={visitor.status.replace('_', ' ')}
                        color={getStatusColor(visitor.status)}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Amenities Section - Only for residents */}
        {user?.roles?.includes('resident') && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Community Amenities
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Available amenities in your community
                </Typography>
                
                {amenitiesLoading ? (
                  <Box display="flex" justifyContent="center" p={3}>
                    <Typography>Loading amenities...</Typography>
                  </Box>
                ) : (amenities?.length || 0) === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No amenities available at the moment.
                  </Typography>
                ) : (
                  <Grid container spacing={2}>
                    {amenities?.slice(0, 6).map((amenity: any) => (
                      <Grid item xs={12} sm={6} md={4} key={amenity.id}>
                        <Paper 
                          sx={{ 
                            p: 2, 
                            border: '1px solid', 
                            borderColor: 'divider',
                            borderRadius: 2,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          <Typography variant="h6" gutterBottom>
                            {amenity.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, mb: 2 }} component="div">
                            {amenity.description}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Chip
                              label={`Capacity: ${amenity.capacity}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                            <Typography variant="body2" color="primary" fontWeight="bold" component="span">
                              ₹{amenity.hourlyRate}/hour
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }} component="div">
                            Available: {amenity.availableHours?.start} - {amenity.availableHours?.end}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}

export default Dashboard
