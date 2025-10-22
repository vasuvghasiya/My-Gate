import React, { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  People as PeopleIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingUpIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { adminAPI, publicAPI } from '../services/api'
import { format } from 'date-fns'
import { TextField } from '@mui/material'

const asDate = (value: any): Date | null => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  return null
}

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'stats' | 'households' | 'amenities'>('users')
  const [householdForm, setHouseholdForm] = useState({ id: '', flatNo: '', name: '' })
  const queryClient = useQueryClient()

  const { data: users, isLoading: usersLoading } = useQuery(
    'admin-users',
    () => adminAPI.getUsers(),
    {
      select: (response) => response.data.users,
      enabled: activeTab === 'users',
    }
  )

  const { data: auditEvents, isLoading: auditLoading } = useQuery(
    'admin-audit',
    () => adminAPI.getAuditEvents({ limit: 50 }),
    {
      select: (response) => response.data.events,
      enabled: activeTab === 'audit',
    }
  )

  const { data: amenities } = useQuery(
    'admin-amenities',
    () => publicAPI.amenities(),
    { select: (r) => r.data.amenities, enabled: activeTab === 'households' || activeTab === 'amenities' }
  )

  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set())
  const [denyingIds, setDenyingIds] = useState<Set<string>>(new Set())
  const approveAudit = useMutation((id: string) => adminAPI.approveAudit(id), {
    onSuccess: () => {
      // Refresh list to reflect latest approval state
      queryClient.invalidateQueries('admin-audit')
    },
    onSettled: (_, __, id) => {
      // Clear per-row loading state
      setApprovingIds((prev) => {
        const next = new Set(prev)
        next.delete(String(id))
        return next
      })
    }
  })

  const denyAudit = useMutation((id: string) => adminAPI.denyAudit(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('admin-audit')
    },
    onSettled: (_, __, id) => {
      setDenyingIds((prev) => { const next = new Set(prev); next.delete(String(id)); return next })
    }
  })

  const [amenityForm, setAmenityForm] = useState({
    name: '', description: '', capacity: 10, hourlyRate: 0, start: '06:00', end: '22:00', isActive: true,
  })
  const createAmenity = useMutation((payload: any) => adminAPI.createAmenity(payload), {
    onSuccess: () => {
      queryClient.invalidateQueries('admin-amenities')
      setAmenityForm({ name: '', description: '', capacity: 10, hourlyRate: 0, start: '06:00', end: '22:00', isActive: true })
    },
  })

  const { data: stats, isLoading: statsLoading } = useQuery(
    'admin-stats',
    () => adminAPI.getStats(),
    {
      select: (response) => response.data,
      enabled: activeTab === 'stats',
    }
  )

  const getRoleColor = (roles: string[]) => {
    if (roles.includes('admin')) return 'error'
    if (roles.includes('guard')) return 'warning'
    return 'primary'
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'visitor_created': return 'info'
      case 'visitor_approved': return 'success'
      case 'visitor_denied': return 'error'
      case 'visitor_checked_in': return 'warning'
      case 'visitor_checked_out': return 'default'
      default: return 'default'
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Admin Panel
      </Typography>

      <Typography variant="body1" color="text.secondary" gutterBottom>
        Manage users, view audit logs, and monitor system statistics.
      </Typography>

      {/* Tab Navigation */}
      <Box display="flex" gap={2} mb={3}>
        <Button
          variant={activeTab === 'users' ? 'contained' : 'outlined'}
          startIcon={<PeopleIcon />}
          onClick={() => setActiveTab('users')}
        >
          Users
        </Button>
        <Button
          variant={activeTab === 'audit' ? 'contained' : 'outlined'}
          startIcon={<HistoryIcon />}
          onClick={() => setActiveTab('audit')}
        >
          Audit Log
        </Button>
        <Button
          variant={activeTab === 'stats' ? 'contained' : 'outlined'}
          startIcon={<TrendingUpIcon />}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </Button>
        <Button
          variant={activeTab === 'households' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('households')}
        >
          Households
        </Button>
        <Button
          variant={activeTab === 'amenities' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('amenities')}
        >
          Amenities
        </Button>
      </Box>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Users
            </Typography>
            
            {usersLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : users?.length === 0 ? (
              <Alert severity="info">No users found.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Roles</TableCell>
                      <TableCell>Household</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users?.map((user: any) => (
                      <TableRow key={user.uid}>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <SecurityIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            {user.displayName}
                          </Box>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            {user.roles?.map((role: string) => (
                              <Chip
                                key={role}
                                label={role}
                                color={getRoleColor([role])}
                                size="small"
                              />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>{user.householdId || 'N/A'}</TableCell>
                        <TableCell>
                          {(() => { const d = asDate(user.createdAt); return d ? format(d, 'MMM dd, yyyy') : 'Unknown' })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Amenities Tab (Create) */}
      {activeTab === 'amenities' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Add Amenity
            </Typography>
            <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2}>
              <TextField label="Name" value={amenityForm.name} onChange={(e)=>setAmenityForm({...amenityForm, name: e.target.value})} />
              <TextField label="Capacity" type="number" value={amenityForm.capacity} onChange={(e)=>setAmenityForm({...amenityForm, capacity: Number(e.target.value)})} />
              <TextField label="Hourly Rate" type="number" value={amenityForm.hourlyRate} onChange={(e)=>setAmenityForm({...amenityForm, hourlyRate: Number(e.target.value)})} />
              <TextField label="Available From" value={amenityForm.start} onChange={(e)=>setAmenityForm({...amenityForm, start: e.target.value})} />
              <TextField label="Available To" value={amenityForm.end} onChange={(e)=>setAmenityForm({...amenityForm, end: e.target.value})} />
              <TextField label="Description" value={amenityForm.description} onChange={(e)=>setAmenityForm({...amenityForm, description: e.target.value})} multiline rows={3} />
            </Box>
            <Box mt={2}>
              <Button variant="contained" onClick={()=>createAmenity.mutate({
                name: amenityForm.name.trim(), description: amenityForm.description.trim(),
                capacity: amenityForm.capacity, hourlyRate: amenityForm.hourlyRate,
                availableHours: { start: amenityForm.start, end: amenityForm.end }, isActive: true,
              })} disabled={createAmenity.isLoading || !amenityForm.name || !amenityForm.description}>
                {createAmenity.isLoading ? 'Saving...' : 'Save Amenity'}
              </Button>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>Active Amenities</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Capacity</TableCell>
                      <TableCell>Rate</TableCell>
                      <TableCell>Hours</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(amenities||[]).map((a:any)=> (
                      <TableRow key={a.id}>
                        <TableCell>{a.name}</TableCell>
                        <TableCell>{a.capacity}</TableCell>
                        <TableCell>{a.hourlyRate}</TableCell>
                        <TableCell>{a.availableHours?.start} - {a.availableHours?.end}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </CardContent>
        </Card>
      )}
      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Audit Events
            </Typography>
            
            {auditLoading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : auditEvents?.length === 0 ? (
              <Alert severity="info">No audit events found.</Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Subject</TableCell>
                      <TableCell>Actor</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(auditEvents || []).map((event: any) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          {event.date || (() => { const d = asDate(event.timestamp); return d ? format(d, 'MMM dd, yyyy') : '—' })()}
                        </TableCell>
                        <TableCell>
                          {event.time || (() => { const d = asDate(event.timestamp); return d ? format(d, 'HH:mm') : '—' })()}
                        </TableCell>
                        <TableCell>
                          {event.status === 'approved' || event.approved ? (
                            <Chip label="Approved" color="success" size="small" />
                          ) : event.status === 'denied' ? (
                            <Chip label="Denied" color="error" size="small" />
                          ) : (
                            <Chip label="Pending" color="warning" size="small" />
                          )}
                        </TableCell>
                        <TableCell>{event.subject || '—'}</TableCell>
                        <TableCell>{event.actor || '—'}</TableCell>
                        <TableCell>{String(event.type)}</TableCell>
                        <TableCell align="right">
                          {event.status === 'approved' || event.approved ? (
                            <Chip label="Approved" size="small" color="success" />
                          ) : event.status === 'denied' ? (
                            <Chip label="Denied" size="small" color="error" />
                          ) : (
                            <Box display="flex" gap={1}>
                              <Button size="small" variant="contained" onClick={()=>{ setApprovingIds(prev=> new Set(prev).add(event.id)); approveAudit.mutate(event.id) }} disabled={approvingIds.has(event.id)}>
                                {approvingIds.has(event.id) ? 'Approving...' : 'Approve'}
                              </Button>
                              <Button size="small" variant="outlined" color="error" onClick={()=>{ setDenyingIds(prev=> new Set(prev).add(event.id)); denyAudit.mutate(event.id) }} disabled={denyingIds.has(event.id)}>
                                {denyingIds.has(event.id) ? 'Denying...' : 'Deny'}
                              </Button>
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4">
                  {statsLoading ? '...' : stats?.totalUsers || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Users
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <SecurityIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4">
                  {statsLoading ? '...' : stats?.totalVisitors || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Visitors
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4">
                  {statsLoading ? '...' : stats?.totalEvents || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Audit Events
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <HistoryIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4">
                  {statsLoading ? '...' : stats?.activeSessions || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Sessions
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Additional Stats */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Overview
                </Typography>
                
                {statsLoading ? (
                  <Box display="flex" justifyContent="center" p={3}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        System Uptime
                      </Typography>
                      <Typography variant="h6">
                        {stats?.systemUptime || 'Unknown'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2" color="text.secondary">
                        Last Backup
                      </Typography>
                      <Typography variant="h6">
                        {stats?.lastBackup || 'Never'}
                      </Typography>
                    </Grid>
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Households Tab */}
      {activeTab === 'households' && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Add Household
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              <TextField
                label="Household ID"
                value={householdForm.id}
                onChange={(e) => setHouseholdForm({ ...householdForm, id: e.target.value })}
                size="small"
              />
              <TextField
                label="Flat No"
                value={householdForm.flatNo}
                onChange={(e) => setHouseholdForm({ ...householdForm, flatNo: e.target.value })}
                size="small"
              />
              <TextField
                label="Name"
                value={householdForm.name}
                onChange={(e) => setHouseholdForm({ ...householdForm, name: e.target.value })}
                size="small"
              />
              <AddHouseholdButton form={householdForm} onAdded={() => setHouseholdForm({ id: '', flatNo: '', name: '' })} />
            </Box>
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>Existing Amenities</Typography>
              <Typography variant="body2" color="text.secondary">{amenities?.length || 0} amenities active</Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Audit Approvals inline action */}
      {activeTab === 'audit' && auditEvents && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Click an event to approve it.
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default Admin

// Inline component for adding household
function AddHouseholdButton({ form, onAdded }: { form: { id: string; flatNo: string; name: string }; onAdded: () => void }) {
  const queryClient = useQueryClient()
  const createMutation = useMutation(adminAPI.createHousehold, {
    onSuccess: () => {
      queryClient.invalidateQueries('households')
      onAdded()
    },
  })

  const disabled = !form.id || !form.flatNo || !form.name

  return (
    <Button
      variant="contained"
      disabled={disabled || createMutation.isLoading}
      onClick={() => createMutation.mutate({ id: form.id.trim(), flatNo: form.flatNo.trim(), name: form.name.trim() })}
    >
      {createMutation.isLoading ? 'Saving...' : 'Save Household'}
    </Button>
  )
}
