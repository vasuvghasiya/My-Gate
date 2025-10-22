import { useQueryClient } from 'react-query'

export const useVisitorRefresh = () => {
  const queryClient = useQueryClient()

  const refreshVisitorData = () => {
    // Invalidate all visitor-related queries
    queryClient.invalidateQueries('visitors')
    queryClient.invalidateQueries('guard-visitors')
    queryClient.invalidateQueries('pending-visitors')
    queryClient.invalidateQueries('approved-visitors')
    queryClient.invalidateQueries('checked-in-visitors')
    
    // Force refetch
    queryClient.refetchQueries('visitors')
    queryClient.refetchQueries('guard-visitors')
  }

  return { refreshVisitorData }
}
