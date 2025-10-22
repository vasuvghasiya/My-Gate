import React, { useState } from 'react'
import { Box, Typography, Card, CardContent, TextField, Button, Table, TableHead, TableRow, TableCell, TableBody, Paper, TableContainer, Chip, CircularProgress, Alert } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { auditAPI } from '../services/api'
import { format } from 'date-fns'

const asDate = (value: any): Date | null => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (typeof value === 'string' || typeof value === 'number') return new Date(value)
  if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  return null
}

const ResidentAudit: React.FC = () => {
  const queryClient = useQueryClient()
  const { data: events, isLoading } = useQuery('resident-audit', () => auditAPI.list(), {
    select: (r) => r.data.events,
  })

  const [form, setForm] = useState({ type: 'issue_reported', subject: '', actor: '', date: '', time: '' })
  const create = useMutation((payload: any) => auditAPI.create(payload), {
    onSuccess: () => {
      setForm({ type: 'issue_reported', subject: '', actor: '', date: '', time: '' })
      queryClient.invalidateQueries('resident-audit')
    },
    onError: (err: any) => {
      console.error(err)
      alert(err?.response?.data?.error || 'Failed to submit audit event')
    }
  })

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Audit Events</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Submit an audit event (status starts as pending). Admin approval will mark it approved.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>New Audit Event</Typography>
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2}>
            <TextField label="Type" value={form.type} onChange={(e)=>setForm({ ...form, type: e.target.value })} />
            <TextField
              label="Date"
              type="date"
              value={form.date}
              onChange={(e)=>setForm({ ...form, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Time"
              type="time"
              value={form.time}
              onChange={(e)=>setForm({ ...form, time: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField label="Subject (optional)" value={form.subject} onChange={(e)=>setForm({ ...form, subject: e.target.value })} />
            <TextField label="Actor (optional)" value={form.actor} onChange={(e)=>setForm({ ...form, actor: e.target.value })} />
          </Box>
          <Box mt={2}>
            <Button variant="contained" onClick={()=>create.mutate({ type: form.type.trim(), subject: form.subject.trim() || undefined, actor: form.actor.trim() || undefined, date: form.date.trim() || undefined, time: form.time.trim() || undefined })} disabled={create.isLoading || !form.type}>
              {create.isLoading ? 'Submitting...' : 'Submit'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>My Household Events</Typography>
          {isLoading ? (
            <Box display="flex" justifyContent="center" p={3}><CircularProgress /></Box>
          ) : (events?.length || 0) === 0 ? (
            <Alert severity="info">No audit events yet.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Actor</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events?.map((e: any)=> (
                    <TableRow key={e.id}>
                      <TableCell>{(() => { const d = asDate(e.timestamp); return d ? format(d, 'MMM dd, yyyy HH:mm') : '—' })()}</TableCell>
                      <TableCell>{e.status === 'approved' ? <Chip label="Approved" color="success" size="small"/> : e.status === 'denied' ? <Chip label="Denied" color="error" size="small"/> : <Chip label="Pending" color="warning" size="small"/>}</TableCell>
                      <TableCell>{e.subject || '—'}</TableCell>
                      <TableCell>{e.actor || '—'}</TableCell>
                      <TableCell>{String(e.type)}</TableCell>
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

export default ResidentAudit


