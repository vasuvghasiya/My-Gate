import React, { useState, useRef, useEffect } from 'react'
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  List,
  ListItem,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'
import { useMutation, useQueryClient } from 'react-query'
import { chatAPI } from '../services/api'
import toast from 'react-hot-toast'
import { useVisitorRefresh } from '../hooks/useVisitorRefresh'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: Date
  toolCalls?: any[]
  toolResults?: any[]
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your AI assistant for community management. I can help you approve visitors, check them in/out, and answer questions. What would you like to do?",
      role: 'assistant',
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const { refreshVisitorData } = useVisitorRefresh()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessageMutation = useMutation(chatAPI.sendMessage, {
    onSuccess: (response) => {
      const { message, toolCalls, toolResults } = response.data
      
      // Add assistant response
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: message,
        role: 'assistant',
        timestamp: new Date(),
        toolCalls,
        toolResults
      }])
      
      // Check if visitor operations were performed and refresh visitor data
      if (toolCalls && toolCalls.length > 0) {
        const toolName = toolCalls[0].function.name
        
        // Refresh visitor queries if visitor operations were performed
        if (['approve_visitor', 'deny_visitor', 'checkin_visitor', 'checkout_visitor', 'get_visitors'].includes(toolName)) {
          // Add a small delay to ensure database is updated, then refresh
          setTimeout(() => {
            refreshVisitorData()
          }, 500)
          toast.success(`Executed: ${toolName.replace('_', ' ')} - Visitor list refreshed!`)
        } else {
          toast.success(`Executed: ${toolName.replace('_', ' ')}`)
        }
      }
    },
    onError: (error: any) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: error.response?.data?.message || 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: new Date(),
      }])
    },
    onSettled: () => {
      setIsLoading(false)
    }
  })

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      await sendMessageMutation.mutateAsync(input)
    } catch (error) {
      console.error('Chat error:', error)
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const renderToolCalls = (toolCalls: any[]) => {
    return (
      <Box sx={{ mt: 1 }}>
        {toolCalls.map((toolCall, index) => (
          <Chip
            key={index}
            label={`${toolCall.function.name}(${toolCall.function.arguments})`}
            color="primary"
            size="small"
            sx={{ mr: 1, mb: 1 }}
          />
        ))}
      </Box>
    )
  }

  const renderToolResults = (toolResults: any[]) => {
    return (
      <Box sx={{ mt: 1 }}>
        {toolResults.map((result, index) => {
          try {
            const parsed = JSON.parse(result.result)
            return (
              <Alert key={index} severity={parsed.error ? 'error' : 'success'} sx={{ mb: 1 }}>
                {parsed.error || parsed.message || 'Action completed successfully'}
              </Alert>
            )
          } catch {
            return (
              <Alert key={index} severity="info" sx={{ mb: 1 }}>
                {result.result}
              </Alert>
            )
          }
        })}
      </Box>
    )
  }

  return (
    <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" gutterBottom>
        AI Copilot
      </Typography>
      
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Chat with the AI assistant to manage visitors and community operations.
      </Typography>

      {/* Chat Messages */}
      <Paper 
        sx={{ 
          flex: 1, 
          overflow: 'auto', 
          p: 2, 
          mb: 2,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <List sx={{ flex: 1 }}>
          {messages.map((message) => (
            <ListItem
              key={message.id}
              sx={{
                flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                mb: 2,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  maxWidth: '80%',
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: message.role === 'user' ? 'primary.main' : 'grey.500',
                    mx: 1,
                  }}
                >
                  {message.role === 'user' ? <PersonIcon /> : <BotIcon />}
                </Avatar>
                
                <Box>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100',
                      color: message.role === 'user' ? 'white' : 'text.primary',
                      maxWidth: '100%',
                      wordBreak: 'break-word',
                    }}
                  >
                    <Typography variant="body1">{message.content}</Typography>
                    
                    {message.toolCalls && renderToolCalls(message.toolCalls)}
                    {message.toolResults && renderToolResults(message.toolResults)}
                    
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 1,
                        opacity: 0.7,
                      }}
                    >
                      {formatTimestamp(message.timestamp)}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </ListItem>
          ))}
          
          {isLoading && (
            <ListItem>
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 7 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  AI is thinking...
                </Typography>
              </Box>
            </ListItem>
          )}
          
          <div ref={messagesEndRef} />
        </List>
      </Paper>

      {/* Chat Input */}
      <Paper component="form" onSubmit={handleSendMessage} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here... (e.g., 'approve Ramesh', 'check in Mr. Verma')"
            variant="outlined"
            disabled={isLoading}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage(e)
              }
            }}
          />
          <IconButton
            type="submit"
            color="primary"
            disabled={!input.trim() || isLoading}
            sx={{ ml: 1 }}
          >
            <SendIcon />
          </IconButton>
        </Box>
        
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Try: "approve Ramesh", "deny visitor with reason: not expected", "check in Mr. Verma", "show pending visitors"
        </Typography>
      </Paper>
    </Box>
  )
}

export default Chat
