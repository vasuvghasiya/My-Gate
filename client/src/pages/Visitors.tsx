import React, { useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as ApproveIcon,
  Cancel as DenyIcon,
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { visitorAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useVisitorRefresh } from '../hooks/useVisitorRefresh'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface Visitor {
  id: string
  name: string
  phone: string
  purpose: string
  hostHouseholdId: string
  status: 'pending' | 'approved' | 'denied' | 'checked_in' | 'checked_out'
  createdAt: Date
  approvedAt?: Date
  deniedAt?: Date
  checkedInAt?: Date
  checkedOutAt?: Date
  reason?: string
}

const Visitors: React.FC = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [denyDialogOpen, setDenyDialogOpen] = useState(false)
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [newVisitor, setNewVisitor] = useState({
    name: '',
    phone: '',
    purpose: '',
    notes: '',
  })
  const [denyReason, setDenyReason] = useState('')

  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const { refreshVisitorData } = useVisitorRefresh()

  const { data: visitors, isLoading } = useQuery(
    'visitors',
    () => visitorAPI.getAll(),
    {
      select: (response) => response.data.visitors,
    }
  )

  const createVisitorMutation = useMutation(visitorAPI.create, {
    onSuccess: () => {
      refreshVisitorData()
      setCreateDialogOpen(false)
      setNewVisitor({ name: '', phone: '', purpose: '', notes: '' })
      toast.success('Visitor created successfully!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create visitor')
    },
  })

  const approveVisitorMutation = useMutation(visitorAPI.approve, {
    onSuccess: () => {
      refreshVisitorData()
      toast.success('Visitor approved!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to approve visitor')
    },
  })

  const denyVisitorMutation = useMutation(visitorAPI.deny, {
    onSuccess: () => {
      refreshVisitorData()
      setDenyDialogOpen(false)
      setDenyReason('')
      toast.success('Visitor denied!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to deny visitor')
    },
  })

  const checkInMutation = useMutation(visitorAPI.checkin, {
    onSuccess: () => {
      refreshVisitorData()
      toast.success('Visitor checked in!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to check in visitor')
    },
  })

  const checkOutMutation = useMutation(visitorAPI.checkout, {
    onSuccess: () => {
      refreshVisitorData()
      toast.success('Visitor checked out!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to check out visitor')
    },
  })

  const handleCreateVisitor = () => {
    if (!newVisitor.name || !newVisitor.phone || !newVisitor.purpose) {
      toast.error('Please fill in all required fields')
      return
    }
    createVisitorMutation.mutate(newVisitor)
  }

  const handleApprove = (visitorId: string) => {
    approveVisitorMutation.mutate(visitorId)
    setAnchorEl(null)
  }

  const handleDeny = (visitor: Visitor) => {
    setSelectedVisitor(visitor)
    setDenyDialogOpen(true)
    setAnchorEl(null)
  }

  const handleConfirmDeny = () => {
    if (selectedVisitor) {
      denyVisitorMutation.mutate({ id: selectedVisitor.id, reason: denyReason })
    }
  }

  const handleCheckIn = (visitorId: string) => {
    checkInMutation.mutate(visitorId)
    setAnchorEl(null)
  }

  const handleCheckOut = (visitorId: string) => {
    checkOutMutation.mutate(visitorId)
    setAnchorEl(null)
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, visitor: Visitor) => {
    setAnchorEl(event.currentTarget)
    setSelectedVisitor(visitor)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedVisitor(null)
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

  const asDate = (value: any): Date | null => {
    if (!value) return null
    if (typeof value?.toDate === 'function') return value.toDate()
    if (typeof value === 'string' || typeof value === 'number') return new Date(value)
    if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000)
    return null
  }

  const canManageVisitor = (visitor: Visitor) => {
    if (!user) return false
    
    // Admins can manage all visitors
    if (user.roles?.includes('admin')) return true
    
    // Guards can check in/out approved visitors
    if (user.roles?.includes('guard')) {
      return visitor.status === 'approved' || visitor.status === 'checked_in'
    }
    
    // Residents can manage visitors for their household
    if (user.roles?.includes('resident')) {
      return visitor.hostHouseholdId === user.householdId
    }
    
    return false
  }

  const getAvailableActions = (visitor: Visitor) => {
    const actions = []
    
    if (user?.roles?.includes('resident') || user?.roles?.includes('admin')) {
      if (visitor.status === 'pending') {
        actions.push({ label: 'Approve', icon: <ApproveIcon />, action: 'approve' })
        actions.push({ label: 'Deny', icon: <DenyIcon />, action: 'deny' })
      }
    }
    
    if (user?.roles?.includes('guard') || user?.roles?.includes('admin')) {
      if (visitor.status === 'approved') {
        actions.push({ label: 'Check In', icon: <CheckInIcon />, action: 'checkin' })
      }
      if (visitor.status === 'checked_in') {
        actions.push({ label: 'Check Out', icon: <CheckOutIcon />, action: 'checkout' })
      }
    }
    
    return actions
  }

  const filteredVisitors = visitors?.filter((visitor: Visitor) => {
    if (user?.roles?.includes('admin') || user?.roles?.includes('guard')) {
      return true // Admins and guards can see all visitors
    }
    if (user?.roles?.includes('resident')) {
      return visitor.hostHouseholdId === user.householdId
    }
    return false
  }) || []

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Visitors</Typography>
        {(user?.roles?.includes('resident') || user?.roles?.includes('admin')) && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Create Visitor
          </Button>
        )}
      </Box>

      {isLoading ? (
        <Typography>Loading visitors...</Typography>
      ) : filteredVisitors.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No visitors found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create a new visitor or check back later
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredVisitors.map((visitor: Visitor) => (
            <Grid item xs={12} sm={6} md={4} key={visitor.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="h6">{visitor.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {visitor.phone}
                      </Typography>
                    </Box>
                    <Chip
                      label={visitor.status.replace('_', ' ')}
                      color={getStatusColor(visitor.status)}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {visitor.purpose}
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary">
                    {(() => {
                      const d = asDate(visitor.createdAt)
                      return d ? format(d, 'MMM dd, yyyy HH:mm') : '—'
                    })()}
                  </Typography>
                  
                  {canManageVisitor(visitor) && getAvailableActions(visitor).length > 0 && (
                    <Box display="flex" justifyContent="flex-end" mt={2}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, visitor)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Visitor Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Visitor</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Visitor Name"
            fullWidth
            variant="outlined"
            value={newVisitor.name}
            onChange={(e) => setNewVisitor({ ...newVisitor, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Phone Number"
            fullWidth
            variant="outlined"
            value={newVisitor.phone}
            onChange={(e) => setNewVisitor({ ...newVisitor, phone: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Purpose of Visit"
            fullWidth
            variant="outlined"
            value={newVisitor.purpose}
            onChange={(e) => setNewVisitor({ ...newVisitor, purpose: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Additional Notes (Optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newVisitor.notes}
            onChange={(e) => setNewVisitor({ ...newVisitor, notes: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateVisitor}
            variant="contained"
            disabled={createVisitorMutation.isLoading}
          >
            {createVisitorMutation.isLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deny Visitor Dialog */}
      <Dialog open={denyDialogOpen} onClose={() => setDenyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Deny Visitor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please provide a reason for denying {selectedVisitor?.name}:
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Reason"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDenyDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmDeny}
            variant="contained"
            color="error"
            disabled={denyVisitorMutation.isLoading}
          >
            {denyVisitorMutation.isLoading ? 'Denying...' : 'Deny Visitor'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedVisitor && getAvailableActions(selectedVisitor).map((action) => (
          <MenuItem
            key={action.action}
            onClick={() => {
              switch (action.action) {
                case 'approve':
                  handleApprove(selectedVisitor.id)
                  break
                case 'deny':
                  handleDeny(selectedVisitor)
                  break
                case 'checkin':
                  handleCheckIn(selectedVisitor.id)
                  break
                case 'checkout':
                  handleCheckOut(selectedVisitor.id)
                  break
              }
            }}
          >
            <ListItemIcon>{action.icon}</ListItemIcon>
            <ListItemText>{action.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}

export default Visitors
