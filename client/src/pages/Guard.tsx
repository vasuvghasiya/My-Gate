import React, { useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material'
import {
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  People as PeopleIcon,
  AccessTime as PendingIcon,
  CheckCircle as ApprovedIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { visitorAPI, auditAPI } from '../services/api'
import { useVisitorRefresh } from '../hooks/useVisitorRefresh'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { TextField, Table, TableHead, TableRow, TableCell, TableBody, TableContainer } from '@mui/material'

const Guard: React.FC = () => {
  const queryClient = useQueryClient()
  const { refreshVisitorData } = useVisitorRefresh()

  const { data: visitors, isLoading } = useQuery(
    'guard-visitors',
    () => visitorAPI.getAll(),
    {
      select: (response) => response.data.visitors,
    }
  )

  // Audit events functionality
  const { data: auditEvents, isLoading: auditLoading } = useQuery(
    'guard-audit-events',
    () => auditAPI.list(),
    {
      select: (response) => response.data.events,
    }
  )

  const [auditForm, setAuditForm] = useState({
    type: 'security_incident',
    subject: '',
    actor: '',
    date: '',
    time: ''
  })

  const checkInMutation = useMutation(visitorAPI.checkin, {
    onSuccess: () => {
      refreshVisitorData()
      toast.success('Visitor checked in successfully!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to check in visitor')
    },
  })

  const checkOutMutation = useMutation(visitorAPI.checkout, {
    onSuccess: () => {
      refreshVisitorData()
      toast.success('Visitor checked out successfully!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to check out visitor')
    },
  })

  const createAuditMutation = useMutation(auditAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('guard-audit-events')
      setAuditForm({ type: 'security_incident', subject: '', actor: '', date: '', time: '' })
      toast.success('Audit event created successfully!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create audit event')
    },
  })

  const handleCheckIn = (visitorId: string) => {
    checkInMutation.mutate(visitorId)
  }

  const handleCheckOut = (visitorId: string) => {
    checkOutMutation.mutate(visitorId)
  }

  const handleCreateAuditEvent = () => {
    if (!auditForm.type.trim()) {
      toast.error('Please select an event type')
      return
    }
    
    createAuditMutation.mutate({
      type: auditForm.type.trim(),
      subject: auditForm.subject.trim() || undefined,
      actor: auditForm.actor.trim() || undefined,
      date: auditForm.date.trim() || undefined,
      time: auditForm.time.trim() || undefined
    })
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <PendingIcon />
      case 'approved': return <ApprovedIcon />
      case 'checked_in': return <CheckInIcon />
      case 'checked_out': return <CheckOutIcon />
      default: return <PeopleIcon />
    }
  }

  const asDate = (value: any): Date | null => {
    if (!value) return null
    if (typeof value?.toDate === 'function') return value.toDate()
    if (typeof value === 'string' || typeof value === 'number') return new Date(value)
    if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000)
    return null
  }

  // Filter visitors for guard operations
  const approvedVisitors = visitors?.filter((v: any) => v.status === 'approved') || []
  const checkedInVisitors = visitors?.filter((v: any) => v.status === 'checked_in') || []
  const pendingVisitors = visitors?.filter((v: any) => v.status === 'pending') || []

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Guard Panel
      </Typography>

      <Typography variant="body1" color="text.secondary" gutterBottom>
        Manage visitor check-ins and check-outs at the gate.
      </Typography>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <PendingIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h4">{pendingVisitors.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Pending Approval
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ApprovedIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h4">{approvedVisitors.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Ready for Check-in
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckInIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h4">{checkedInVisitors.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                Currently Inside
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Approved Visitors - Ready for Check-in */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Approved Visitors - Ready for Check-in
          </Typography>
          
          {isLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : approvedVisitors.length === 0 ? (
            <Alert severity="info">
              No approved visitors waiting for check-in.
            </Alert>
          ) : (
            <List>
              {approvedVisitors.map((visitor: any) => (
                <ListItem key={visitor.id} divider>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={2}>
                        <Typography variant="h6">{visitor.name}</Typography>
                        <Chip
                          label={visitor.status.replace('_', ' ')}
                          color={getStatusColor(visitor.status)}
                          size="small"
                          icon={getStatusIcon(visitor.status)}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Phone: {visitor.phone}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Purpose: {visitor.purpose}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Approved: {(() => { const d = asDate(visitor.approvedAt); return d ? format(d, 'MMM dd, HH:mm') : 'Unknown' })()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<CheckInIcon />}
                      onClick={() => handleCheckIn(visitor.id)}
                      disabled={checkInMutation.isLoading}
                    >
                      Check In
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Checked-in Visitors - Ready for Check-out */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Visitors Inside - Ready for Check-out
          </Typography>
          
          {checkedInVisitors.length === 0 ? (
            <Alert severity="info">
              No visitors currently inside the premises.
            </Alert>
          ) : (
            <List>
              {checkedInVisitors.map((visitor: any) => (
                <ListItem key={visitor.id} divider>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={2}>
                        <Typography variant="h6">{visitor.name}</Typography>
                        <Chip
                          label={visitor.status.replace('_', ' ')}
                          color={getStatusColor(visitor.status)}
                          size="small"
                          icon={getStatusIcon(visitor.status)}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Phone: {visitor.phone}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Purpose: {visitor.purpose}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Checked in: {(() => { const d = asDate(visitor.checkedInAt); return d ? format(d, 'MMM dd, HH:mm') : 'Unknown' })()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<CheckOutIcon />}
                      onClick={() => handleCheckOut(visitor.id)}
                      disabled={checkOutMutation.isLoading}
                    >
                      Check Out
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Pending Visitors (for information) */}
      {pendingVisitors.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Pending Approval ({pendingVisitors.length})
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              These visitors are waiting for resident approval:
            </Typography>
            
            <List>
              {pendingVisitors.slice(0, 5).map((visitor: any) => (
                <ListItem key={visitor.id} divider>
                  <ListItemText
                    primary={visitor.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Purpose: {visitor.purpose}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Requested: {(() => { const d = asDate(visitor.createdAt); return d ? format(d, 'MMM dd, HH:mm') : '—' })()}
                        </Typography>
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Chip
                      label="Pending"
                      color="warning"
                      size="small"
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            
            {pendingVisitors.length > 5 && (
              <Typography variant="caption" color="text.secondary">
                ... and {pendingVisitors.length - 5} more
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Events Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Security Audit Events
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Report security incidents and other events that require documentation.
          </Typography>

          {/* Create Audit Event Form */}
          <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Report New Event
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Event Type"
                  value={auditForm.type}
                  onChange={(e) => setAuditForm({ ...auditForm, type: e.target.value })}
                  SelectProps={{ native: true }}
                >
                  <option value="security_incident">Security Incident</option>
                  <option value="suspicious_activity">Suspicious Activity</option>
                  <option value="maintenance_issue">Maintenance Issue</option>
                  <option value="visitor_issue">Visitor Issue</option>
                  <option value="other">Other</option>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Subject/Description"
                  value={auditForm.subject}
                  onChange={(e) => setAuditForm({ ...auditForm, subject: e.target.value })}
                  placeholder="Brief description of the event"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Actor/Person Involved (Optional)"
                  value={auditForm.actor}
                  onChange={(e) => setAuditForm({ ...auditForm, actor: e.target.value })}
                  placeholder="Name or description of person involved"
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={auditForm.date}
                  onChange={(e) => setAuditForm({ ...auditForm, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Time"
                  type="time"
                  value={auditForm.time}
                  onChange={(e) => setAuditForm({ ...auditForm, time: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={handleCreateAuditEvent}
                  disabled={createAuditMutation.isLoading}
                  sx={{ mt: 1 }}
                >
                  {createAuditMutation.isLoading ? 'Creating...' : 'Create Audit Event'}
                </Button>
              </Grid>
            </Grid>
          </Box>

          {/* Audit Events List */}
          <Typography variant="subtitle1" gutterBottom>
            Recent Audit Events
          </Typography>
          
          {auditLoading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (auditEvents?.length || 0) === 0 ? (
            <Alert severity="info">No audit events yet.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditEvents?.slice(0, 10).map((event: any) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        {(() => {
                          const d = asDate(event.timestamp);
                          return d ? format(d, 'MMM dd, yyyy HH:mm') : '—';
                        })()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.type?.replace('_', ' ')}
                          size="small"
                          color={event.type === 'security_incident' ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{event.subject || '—'}</TableCell>
                      <TableCell>{event.actor || '—'}</TableCell>
                      <TableCell>
                        {event.status === 'approved' ? (
                          <Chip label="Approved" color="success" size="small" />
                        ) : event.status === 'denied' ? (
                          <Chip label="Denied" color="error" size="small" />
                        ) : (
                          <Chip label="Pending" color="warning" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={event.actorRole || 'Unknown'}
                          size="small"
                          color={event.actorRole === 'guard' ? 'primary' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default Guard
