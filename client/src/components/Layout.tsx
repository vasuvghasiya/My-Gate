import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
  Badge,
  Paper,
  ListItemAvatar,
  Chip,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Chat as ChatIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  AdminPanelSettings as AdminIcon,
  ExitToApp as LogoutIcon,
  Notifications as NotificationIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { notificationAPI } from '../services/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface LayoutProps {
  children: React.ReactNode
}

const DRAWER_WIDTH = 240

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [notificationMenuAnchor, setNotificationMenuAnchor] = useState<null | HTMLElement>(null)
  
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const queryClient = useQueryClient()

  // Fetch notifications
  const { data: notifications, isLoading: notificationsLoading, error: notificationsError } = useQuery(
    'notifications',
    () => notificationAPI.getAll({ limit: 10 }),
    {
      select: (response) => response.data.notifications || [],
      refetchInterval: 30000, // Refetch every 30 seconds
      retry: 3,
      retryDelay: 1000,
      onError: (error) => {
        console.error('Failed to fetch notifications:', error)
      }
    }
  )

  // Mark notification as read mutation
  const markAsReadMutation = useMutation(notificationAPI.markAsRead, {
    onSuccess: () => {
      queryClient.invalidateQueries('notifications')
    },
    onError: (error: any) => {
      console.error('Failed to mark notification as read:', error)
    }
  })

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleProfileMenuClose = () => {
    setAnchorEl(null)
  }

  const handleNotificationMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationMenuAnchor(event.currentTarget)
  }

  const handleNotificationMenuClose = () => {
    setNotificationMenuAnchor(null)
  }

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'visitor_created':
      case 'visitor_approved':
      case 'visitor_denied':
      case 'visitor_checked_in':
      case 'visitor_checked_out':
        return <PeopleIcon />
      case 'audit_event_created':
      case 'security_incident':
        return <WarningIcon />
      case 'amenity_added':
      case 'amenity_updated':
        return <InfoIcon />
      default:
        return <NotificationIcon />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'visitor_created':
      case 'visitor_approved':
        return 'success'
      case 'visitor_denied':
      case 'security_incident':
        return 'error'
      case 'audit_event_created':
        return 'warning'
      case 'amenity_added':
      case 'amenity_updated':
        return 'info'
      default:
        return 'default'
    }
  }

  const unreadCount = notifications?.filter((n: any) => !n.read).length || 0

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      navigate('/')
    } catch (error: any) {
      toast.error(error.message || 'Logout failed')
    }
    handleProfileMenuClose()
  }

  const getNavigationItems = () => {
    const baseItems = [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
      { text: 'Visitors', icon: <PeopleIcon />, path: '/visitors' },
      { text: 'AI Chat', icon: <ChatIcon />, path: '/chat' },
    ]

    const roleBasedItems = []
    
    // Residents: link to Audit
    if (user?.roles?.includes('resident')) {
      roleBasedItems.push({ text: 'Audit', icon: <HistoryIcon /> as any, path: '/audit' })
    }

    if (user?.roles?.includes('guard')) {
      roleBasedItems.push({
        text: 'Guard Panel',
        icon: <SecurityIcon />,
        path: '/guard'
      })
    }
    
    if (user?.roles?.includes('admin')) {
      roleBasedItems.push({
        text: 'Admin Panel',
        icon: <AdminIcon />,
        path: '/admin'
      })
    }

    return [...baseItems, ...roleBasedItems]
  }

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" color="primary">
          MyGate
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {getNavigationItems().map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path)
                if (isMobile) {
                  setMobileOpen(false)
                }
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {getNavigationItems().find(item => item.path === location.pathname)?.text || 'MyGate'}
          </Typography>
          
          <IconButton 
            color="inherit" 
            sx={{ mr: 1 }}
            onClick={handleNotificationMenuOpen}
          >
            <Badge badgeContent={unreadCount} color="error">
              <NotificationIcon />
            </Badge>
          </IconButton>
          
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.displayName?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>

          {/* Notification Menu */}
          <Menu
            anchorEl={notificationMenuAnchor}
            open={Boolean(notificationMenuAnchor)}
            onClose={handleNotificationMenuClose}
            PaperProps={{
              sx: { width: 400, maxHeight: 500 }
            }}
          >
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6">Notifications</Typography>
            </Box>
            
            {notificationsLoading ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography>Loading notifications...</Typography>
              </Box>
            ) : notificationsError ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="error">Failed to load notifications</Typography>
              </Box>
            ) : (notifications?.length || 0) === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">No notifications</Typography>
              </Box>
            ) : (
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {notifications?.map((notification: any) => {
                  try {
                    return (
                      <ListItem
                        key={notification.id}
                        sx={{
                          bgcolor: notification.read ? 'transparent' : 'action.hover',
                          borderBottom: '1px solid',
                          borderColor: 'divider'
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: `${getNotificationColor(notification.type)}.main` }}>
                            {getNotificationIcon(notification.type)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2">
                                {notification.title || 'Untitled'}
                              </Typography>
                              {!notification.read && (
                                <Chip label="New" size="small" color="error" />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {notification.message || 'No message'}
                              </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(() => {
                              let date;
                              try {
                                // Debug: Log the timestamp structure
                                console.log('🔍 Timestamp debug:', {
                                  timestamp: notification.timestamp,
                                  hasToDate: !!notification.timestamp?.toDate,
                                  type: typeof notification.timestamp,
                                  keys: notification.timestamp ? Object.keys(notification.timestamp) : 'no timestamp'
                                });
                                
                                if (notification.timestamp?.toDate) {
                                  // Firestore Timestamp
                                  date = notification.timestamp.toDate();
                                } else if (notification.timestamp) {
                                  // Try to create Date from timestamp
                                  date = new Date(notification.timestamp);
                                }
                                
                                // Validate the date
                                if (date && !isNaN(date.getTime())) {
                                  return format(date, 'MMM dd, HH:mm');
                                }
                              } catch (error) {
                                console.warn('Date formatting error:', error, notification.timestamp);
                              }
                              return 'Unknown time';
                            })()}
                          </Typography>
                            </Box>
                          }
                        />
                        {!notification.read && (
                          <IconButton
                            size="small"
                            onClick={() => handleMarkAsRead(notification.id)}
                            disabled={markAsReadMutation.isLoading}
                          >
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                        )}
                      </ListItem>
                    )
                  } catch (error) {
                    console.error('Error rendering notification:', error, notification)
                    return null
                  }
                })}
              </List>
            )}
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default Layout
